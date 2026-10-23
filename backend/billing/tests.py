from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from patients.models import Patient
from services.models import MedicalService

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
