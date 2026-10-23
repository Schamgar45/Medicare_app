"""Examens de laboratoire : le résultat arrive souvent un autre jour que la demande."""

from datetime import date, time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from appointments.models import Appointment
from consultations.models import Consultation
from doctor.models import Doctor
from notifications.models import Notification
from patients.models import Patient

from .models import LabRequest, LabResult, LabTest

User = get_user_model()


def make_user(username, role):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="pass1234",
        role=role,
        first_name=username.title(),
    )


class LabBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.laborant = make_user("labo", "LABORANT")
        cls.user_a = make_user("dra", "DOCTOR")
        cls.user_b = make_user("drb", "DOCTOR")
        cls.doc_a = Doctor.objects.create(user=cls.user_a)
        cls.doc_b = Doctor.objects.create(user=cls.user_b)
        cls.patient = Patient.objects.create(
            patient_number="P1", first_name="Alice", last_name="A"
        )
        appt = Appointment.objects.create(
            appointment_number="R1",
            patient=cls.patient,
            doctor=cls.doc_a,
            appointment_date=date.today(),
            appointment_time=time(9, 0),
        )
        cls.cons = Consultation.objects.create(
            consultation_number="C1",
            patient=cls.patient,
            doctor=cls.doc_a,
            appointment=appt,
        )
        cls.test = LabTest.objects.create(name="Goutte épaisse", normal_range="Négatif")

    def new_request(self, number="L1"):
        return LabRequest.objects.create(
            request_number=number,
            consultation=self.cons,
            patient=self.patient,
            doctor=self.doc_a,
            lab_test=self.test,
        )

    def result_payload(self, lab_request, text="NÉGATIF"):
        return {"lab_request": lab_request.id, "result": text}


class LabWorkflowTests(LabBase):

    # ---- demande ----
    def test_sample_date_is_stamped_when_sample_collected(self):
        req = self.new_request()
        self.client.force_authenticate(self.laborant)
        response = self.client.patch(
            f"/api/lab/requests/{req.id}/",
            {"status": "SAMPLE_COLLECTED"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        req.refresh_from_db()
        self.assertIsNotNone(req.sample_collected_at)
        self.assertEqual(
            response.data["sample_collected_at"][:10], str(timezone.localdate())
        )

    def test_clients_cannot_write_dates(self):
        req = self.new_request()
        self.client.force_authenticate(self.laborant)
        self.client.patch(
            f"/api/lab/requests/{req.id}/",
            {
                "completed_at": "2020-01-01T00:00:00Z",
                "sample_collected_at": "2020-01-01T00:00:00Z",
            },
            format="json",
        )
        req.refresh_from_db()
        self.assertIsNone(req.completed_at)
        self.assertIsNone(req.sample_collected_at)

    def test_doctor_can_only_cancel(self):
        req = self.new_request()
        self.client.force_authenticate(self.user_a)
        self.assertEqual(
            self.client.patch(
                f"/api/lab/requests/{req.id}/", {"status": "IN_PROGRESS"}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/lab/requests/{req.id}/", {"status": "CANCELLED"}, format="json"
            ).status_code,
            200,
        )

    def test_status_result_available_cannot_be_set_by_hand(self):
        req = self.new_request()
        self.client.force_authenticate(self.laborant)
        for status in ("RESULT_AVAILABLE", "VALIDATED"):
            response = self.client.patch(
                f"/api/lab/requests/{req.id}/", {"status": status}, format="json"
            )
            self.assertEqual(response.status_code, 400, status)

    def test_request_exposes_print_details(self):
        req = self.new_request()
        self.client.force_authenticate(self.laborant)
        data = self.client.get(f"/api/lab/requests/{req.id}/").data
        self.assertEqual(data["patient_detail"]["patient_number"], "P1")
        self.assertEqual(data["lab_test_detail"]["normal_range"], "Négatif")
        self.assertEqual(data["doctor_name"], "Dra")

    # ---- résultat ----
    def test_creating_a_result_marks_request_available(self):
        req = self.new_request()
        self.client.force_authenticate(self.laborant)
        response = self.client.post(
            "/api/lab/results/", self.result_payload(req), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        req.refresh_from_db()
        self.assertEqual(req.status, "RESULT_AVAILABLE")
        self.assertIsNone(req.completed_at)

    def test_result_rejected_on_cancelled_request(self):
        req = self.new_request()
        req.status = "CANCELLED"
        req.save()
        self.client.force_authenticate(self.laborant)
        response = self.client.post(
            "/api/lab/results/", self.result_payload(req), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(LabResult.objects.exists())

    def test_validation_stamps_request_and_notifies_only_requesting_doctor(self):
        req = self.new_request()
        result = LabResult.objects.create(lab_request=req, result="POSITIF")
        req.status = "RESULT_AVAILABLE"
        req.save()
        self.client.force_authenticate(self.laborant)
        response = self.client.post(f"/api/lab/results/{result.id}/validate/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["validated_by"], self.laborant.id)
        self.assertEqual(response.data["validated_by_name"], "Labo")
        req.refresh_from_db()
        self.assertEqual(req.status, "VALIDATED")
        self.assertIsNotNone(req.completed_at)
        self.assertEqual(
            Notification.objects.filter(user=self.user_a, type="LAB_RESULT").count(), 1
        )
        self.assertFalse(Notification.objects.filter(user=self.user_b).exists())

    def test_second_validation_and_edit_after_validation_are_refused(self):
        req = self.new_request()
        result = LabResult.objects.create(lab_request=req, result="POSITIF")
        self.client.force_authenticate(self.laborant)
        self.assertEqual(
            self.client.post(f"/api/lab/results/{result.id}/validate/").status_code, 200
        )
        self.assertEqual(
            self.client.post(f"/api/lab/results/{result.id}/validate/").status_code, 400
        )
        edit = self.client.patch(
            f"/api/lab/results/{result.id}/", {"result": "NÉGATIF"}, format="json"
        )
        self.assertEqual(edit.status_code, 400)
        result.refresh_from_db()
        self.assertEqual(result.result, "POSITIF")
        self.assertEqual(Notification.objects.count(), 1)

    def test_dates_differ_when_result_comes_days_later(self):
        req = self.new_request()
        LabRequest.objects.filter(pk=req.pk).update(
            requested_at=timezone.now() - timedelta(days=3)
        )
        result = LabResult.objects.create(lab_request=req, result="NÉGATIF")
        self.client.force_authenticate(self.laborant)
        data = self.client.post(f"/api/lab/results/{result.id}/validate/").data
        requested = data["request_detail"]["requested_at"][:10]
        completed = data["request_detail"]["completed_at"][:10]
        self.assertEqual(completed, str(timezone.localdate()))
        self.assertNotEqual(requested, completed)

    def test_only_laborant_can_validate_and_doctor_scoping_holds(self):
        req = self.new_request()
        result = LabResult.objects.create(lab_request=req, result="POSITIF")
        self.client.force_authenticate(self.user_a)
        self.assertEqual(
            self.client.post(f"/api/lab/results/{result.id}/validate/").status_code, 403
        )
        self.client.force_authenticate(self.user_b)
        self.assertEqual(
            self.client.get(f"/api/lab/results/{result.id}/").status_code, 404
        )
        self.client.force_authenticate(self.user_a)
        self.assertEqual(
            self.client.get(f"/api/lab/results/{result.id}/").status_code, 200
        )


class PrintDetailsTests(LabBase):
    """Ordonnance et consultation portent patient, médecin et département pour l'impression."""

    def test_prescription_and_consultation_print_details(self):
        from pharmacy.models import Medication
        from prescriptions.models import Prescription, PrescriptionItem
        from services.models import MedicalService

        service = MedicalService.objects.create(
            name="Consultation", theme_color="MARINE"
        )
        self.doc_a.service = service
        self.doc_a.save()
        presc = Prescription.objects.create(
            prescription_number="PRE-1",
            consultation=self.cons,
            patient=self.patient,
            doctor=self.doc_a,
        )
        PrescriptionItem.objects.create(
            prescription=presc, medication=Medication.objects.create(name="Paracétamol")
        )
        self.client.force_authenticate(self.user_a)

        data = self.client.get(f"/api/prescriptions/{presc.id}/").data
        self.assertEqual(data["patient_detail"]["first_name"], "Alice")
        self.assertEqual(data["doctor_detail"]["name"], "Dra")
        self.assertEqual(
            data["doctor_detail"]["service_detail"]["name"], "Consultation"
        )
        self.assertEqual(data["items"][0]["medication_name"], "Paracétamol")

        data = self.client.get(f"/api/consultations/{self.cons.id}/").data
        self.assertEqual(data["patient_detail"]["patient_number"], "P1")
        self.assertEqual(
            data["doctor_detail"]["service_detail"]["theme_color"], "MARINE"
        )


class AutoNumberTests(LabBase):
    """Le serveur attribue les numéros de documents ; le client n'a pas à les inventer."""

    def test_numbers_are_generated_and_unique(self):
        self.client.force_authenticate(self.laborant)
        payload = {
            "consultation": self.cons.id,
            "patient": self.patient.id,
            "doctor": self.doc_a.id,
            "lab_test": self.test.id,
        }
        first = self.client.post("/api/lab/requests/", payload, format="json")
        second = self.client.post("/api/lab/requests/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertRegex(first.data["request_number"], r"^EXA-\d{4}-000001$")
        self.assertRegex(second.data["request_number"], r"^EXA-\d{4}-000002$")

    def test_client_number_is_still_accepted(self):
        self.client.force_authenticate(self.laborant)
        response = self.client.post(
            "/api/lab/requests/",
            {
                "request_number": "MANUEL-1",
                "consultation": self.cons.id,
                "patient": self.patient.id,
                "doctor": self.doc_a.id,
                "lab_test": self.test.id,
            },
            format="json",
        )
        self.assertEqual(response.data["request_number"], "MANUEL-1")
