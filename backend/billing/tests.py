from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from patients.models import Patient
from services.models import MedicalService
from consultations.models import Consultation
from doctor.models import Doctor
from laboratory.models import LabRequest, LabTest
from pharmacy.models import Medication
from prescriptions.models import Prescription, PrescriptionItem

from .models import Invoice, InvoiceItem

User = get_user_model()


def make_user(role):
    return User.objects.create_user(
        username=role.lower(),
        email=f"{role.lower()}@example.com",
        password="pass1234",
        role=role,
    )


class InvoiceServiceTests(APITestCase):
    """La facture porte le département d'origine : il fixe le nom et la couleur du cachet."""

    @classmethod
    def setUpTestData(cls):
        cls.cashier = make_user("CASHIER")
        cls.doctor = make_user("DOCTOR")
        cls.patient = Patient.objects.create(
            patient_number="PAT-1",
            first_name="Jean",
            last_name="Ndaye",
            phone="+25779000000",
        )
        cls.labo = MedicalService.objects.create(name="Laboratoire", theme_color="VERT")
        cls.consult = MedicalService.objects.create(
            name="Consultation", theme_color="MARINE"
        )
        cls.closed = MedicalService.objects.create(
            name="Ancien service", is_active=False
        )

    def create(self, **extra):
        self.client.force_authenticate(self.cashier)
        payload = {
            "invoice_number": f"FAC-{Invoice.objects.count() + 1}",
            "patient": self.patient.id,
            **extra,
        }
        return self.client.post("/api/invoices/", payload, format="json")

    def test_cashier_picks_the_department_and_gets_print_details(self):
        response = self.create(service=self.labo.id)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            dict(response.data["service_detail"]),
            {"id": self.labo.id, "name": "Laboratoire", "theme_color": "VERT"},
        )
        self.assertEqual(response.data["patient_detail"]["last_name"], "Ndaye")
        self.assertEqual(response.data["patient_detail"]["patient_number"], "PAT-1")

    def test_department_is_optional(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["service"])
        self.assertIsNone(response.data["service_detail"])

    def test_discount_accepts_null_and_totals_remain_valid(self):
        response = self.create(discount=None)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["discount"])

        invoice = Invoice.objects.get(pk=response.data["id"])
        InvoiceItem.objects.create(
            invoice=invoice,
            description="Acte test",
            quantity=1,
            unit_price=1200,
        )
        invoice.refresh_from_db()
        self.assertEqual(invoice.discount, None)
        self.assertEqual(invoice.total, 1200)

    def test_inactive_department_is_refused(self):
        response = self.create(service=self.closed.id)
        self.assertEqual(response.status_code, 400)
        self.assertIn("service", response.data)

    def test_unknown_department_is_refused(self):
        self.assertEqual(self.create(service=99999).status_code, 400)

    def test_filter_invoices_by_department(self):
        self.create(service=self.labo.id)
        self.create(service=self.consult.id)
        self.create(service=self.labo.id)
        response = self.client.get(f"/api/invoices/?service={self.labo.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertTrue(
            all(
                row["service_detail"]["name"] == "Laboratoire"
                for row in response.data["results"]
            )
        )

    def test_department_can_be_corrected_after_creation(self):
        invoice_id = self.create(service=self.consult.id).data["id"]
        response = self.client.patch(
            f"/api/invoices/{invoice_id}/", {"service": self.labo.id}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["service_detail"]["theme_color"], "VERT")

    def test_doctor_still_cannot_read_invoices(self):
        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.get("/api/invoices/").status_code, 403)

    def test_deleting_a_department_keeps_its_invoices(self):
        invoice_id = self.create(service=self.labo.id).data["id"]
        self.labo.delete()
        invoice = Invoice.objects.get(pk=invoice_id)
        self.assertIsNone(invoice.service)


class PaymentReceiptTests(APITestCase):
    """Le reçu s'imprime depuis le paiement : patient, facture, département, caissier."""

    def test_payment_exposes_receipt_data(self):
        cashier = User.objects.create_user(
            username="caisse",
            email="caisse@example.com",
            password="pass1234",
            role="CASHIER",
            first_name="Claire",
            last_name="Caisse",
        )
        patient = Patient.objects.create(
            patient_number="PAT-9", first_name="Jean", last_name="Ndaye"
        )
        labo = MedicalService.objects.create(name="Laboratoire", theme_color="VERT")
        invoice = Invoice.objects.create(
            invoice_number="FAC-9", patient=patient, service=labo
        )
        InvoiceItem.objects.create(
            invoice=invoice, description="Goutte épaisse", quantity=1, unit_price=10000
        )
        invoice.recalculate_totals()

        self.client.force_authenticate(cashier)
        response = self.client.post(
            "/api/payments/",
            {
                "payment_number": "PAY-1",
                "invoice": invoice.id,
                "amount": "4000",
                "payment_method": "CASH",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        data = self.client.get(f"/api/payments/{response.data['id']}/").data
        self.assertEqual(data["patient_detail"]["last_name"], "Ndaye")
        self.assertEqual(
            data["service_detail"],
            {"id": labo.id, "name": "Laboratoire", "theme_color": "VERT"},
        )
        self.assertEqual(data["invoice_number"], "FAC-9")
        self.assertEqual(data["received_by_name"], "Claire Caisse")
        self.assertEqual(float(data["invoice_total"]), 10000)
        self.assertEqual(float(data["invoice_balance"]), 6000)


class InvoiceDeletionTests(APITestCase):
    """Supprimer une facture : refus propre si elle a des paiements, sinon suppression."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user("ADMIN")
        cls.patient = Patient.objects.create(
            patient_number="PAT-DEL", first_name="Jean", last_name="Ndaye"
        )

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def create_invoice(self):
        invoice = Invoice.objects.create(
            invoice_number=f"FAC-DEL-{Invoice.objects.count() + 1}",
            patient=self.patient,
        )
        return invoice

    def test_invoice_without_payments_can_be_deleted(self):
        invoice = self.create_invoice()
        response = self.client.delete(f"/api/invoices/{invoice.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Invoice.objects.filter(pk=invoice.id).exists())

    def test_invoice_with_payments_is_refused_with_400(self):
        from .models import Payment

        invoice = self.create_invoice()
        Payment.objects.create(
            payment_number="PAY-DEL-1",
            invoice=invoice,
            amount=1000,
            payment_method="CASH",
        )
        response = self.client.delete(f"/api/invoices/{invoice.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)
        self.assertTrue(Invoice.objects.filter(pk=invoice.id).exists())


class BillableActivityImportTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cashier = make_user("CASHIER")
        cls.patient = Patient.objects.create(
            patient_number="PAT-BILL",
            first_name="Aline",
            last_name="Ndaye",
        )
        cls.consultation_service = MedicalService.objects.create(
            name="Consultation - Billing", theme_color="MARINE"
        )
        cls.lab_service = MedicalService.objects.create(
            name="Laboratoire - Billing", theme_color="VERT"
        )
        doctor_user = User.objects.create_user(
            username="billing-doctor",
            email="billing-doctor@example.com",
            password="test-password",
            role="DOCTOR",
            first_name="Mireille",
            last_name="Niy",
        )
        cls.doctor = Doctor.objects.create(
            user=doctor_user,
            service=cls.consultation_service,
            consultation_fee=15000,
        )
        cls.consultation = Consultation.objects.create(
            consultation_number="CONS-BILL-1",
            patient=cls.patient,
            doctor=cls.doctor,
            status=Consultation.Status.COMPLETED,
        )
        Consultation.objects.create(
            consultation_number="CONS-BILL-OPEN",
            patient=cls.patient,
            doctor=cls.doctor,
            status=Consultation.Status.OPEN,
        )
        Consultation.objects.create(
            consultation_number="CONS-BILL-CANCELLED",
            patient=cls.patient,
            doctor=cls.doctor,
            status=Consultation.Status.CANCELLED,
        )
        cls.lab_test = LabTest.objects.create(
            name="Analyse - Billing",
            price=7500,
            service=cls.lab_service,
        )
        cls.lab_request = LabRequest.objects.create(
            request_number="EXA-BILL-1",
            consultation=cls.consultation,
            patient=cls.patient,
            doctor=cls.doctor,
            lab_test=cls.lab_test,
            status=LabRequest.Status.VALIDATED,
        )
        LabRequest.objects.create(
            request_number="EXA-BILL-PENDING",
            consultation=cls.consultation,
            patient=cls.patient,
            doctor=cls.doctor,
            lab_test=cls.lab_test,
            status=LabRequest.Status.REQUESTED,
        )
        medication = Medication.objects.create(
            name="Médicament - Billing",
            unit_price=1000,
        )
        prescription = Prescription.objects.create(
            prescription_number="ORD-BILL-1",
            consultation=cls.consultation,
            patient=cls.patient,
            doctor=cls.doctor,
            status=Prescription.Status.DISPENSED,
        )
        cls.prescription_item = PrescriptionItem.objects.create(
            prescription=prescription,
            medication=medication,
            quantity=5,
            dispensed_quantity=2,
        )
        draft = Prescription.objects.create(
            prescription_number="ORD-BILL-DRAFT",
            consultation=cls.consultation,
            patient=cls.patient,
            doctor=cls.doctor,
            status=Prescription.Status.DRAFT,
        )
        PrescriptionItem.objects.create(
            prescription=draft,
            medication=medication,
            quantity=5,
            dispensed_quantity=0,
        )

    def setUp(self):
        self.client.force_authenticate(self.cashier)

    def create_invoice(self):
        return self.client.post(
            "/api/invoices/",
            {
                "invoice_number": f"FAC-BILL-{Invoice.objects.count() + 1}",
                "patient": self.patient.id,
            },
            format="json",
        )

    def test_invoice_imports_completed_consultations_validated_exams_and_dispensed_items(self):
        response = self.create_invoice()

        self.assertEqual(response.status_code, 201, response.data)
        items = response.data["items"]
        self.assertEqual(
            {item["source_type"] for item in items},
            {"CONSULTATION", "LAB", "PHARMACY"},
        )
        self.assertEqual(
            len([item for item in items if item["source_type"] == "CONSULTATION"]),
            2,
        )
        self.assertNotIn(
            "CONS-BILL-CANCELLED",
            {item["source_reference"] for item in items},
        )

        consultation = next(
            item for item in items if item["source_type"] == "CONSULTATION"
        )
        self.assertEqual(consultation["source_reference"], "CONS-BILL-1")
        self.assertEqual(consultation["doctor_name"], "Mireille Niy")
        self.assertEqual(
            consultation["service_detail"]["name"], "Consultation - Billing"
        )
        self.assertEqual(float(consultation["unit_price"]), 15000)

        exam = next(item for item in items if item["source_type"] == "LAB")
        self.assertEqual(exam["source_reference"], "EXA-BILL-1")
        self.assertEqual(exam["service_detail"]["name"], "Laboratoire - Billing")
        self.assertEqual(float(exam["unit_price"]), 7500)

        dispensed = next(item for item in items if item["source_type"] == "PHARMACY")
        self.assertEqual(dispensed["source_reference"], "ORD-BILL-1")
        self.assertEqual(dispensed["quantity"], 2)
        self.assertEqual(float(dispensed["total"]), 2000)
        self.assertEqual(float(response.data["total"]), 39500)

    def test_activity_is_not_added_to_two_active_invoices(self):
        first = self.create_invoice()
        second = self.create_invoice()

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(len(first.data["items"]), 4)
        self.assertEqual(second.data["items"], [])

    def test_cancelled_invoice_does_not_block_rebilling_its_activities(self):
        first = self.create_invoice()
        Invoice.objects.filter(pk=first.data["id"]).update(
            status=Invoice.Status.CANCELLED
        )

        replacement = self.create_invoice()

        self.assertEqual(replacement.status_code, 201, replacement.data)
        self.assertEqual(len(replacement.data["items"]), 4)

    def test_later_partial_dispensing_only_bills_the_new_quantity(self):
        first = self.create_invoice()
        item = next(
            row for row in first.data["items"] if row["source_type"] == "PHARMACY"
        )
        self.assertEqual(item["quantity"], 2)

        self.prescription_item.dispensed_quantity = 5
        self.prescription_item.save(update_fields=["dispensed_quantity"])
        second = self.create_invoice()

        pharmacy_items = [
            row for row in second.data["items"] if row["source_type"] == "PHARMACY"
        ]
        self.assertEqual(len(pharmacy_items), 1)
        self.assertEqual(pharmacy_items[0]["quantity"], 3)
