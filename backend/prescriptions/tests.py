from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from consultations.models import Consultation
from doctor.models import Doctor
from patients.models import Patient
from pharmacy.models import Medication
from services.models import MedicalService

from .models import Prescription, PrescriptionItem

User = get_user_model()


class PrescriptionDispensingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        pharmacist = User.objects.create_user(
            username="dispensing-pharmacist",
            email="dispensing-pharmacist@example.com",
            password="test-password",
            role="PHARMACIST",
        )
        service = MedicalService.objects.create(name="Dispensing")
        doctor_user = User.objects.create_user(
            username="dispensing-doctor",
            email="dispensing-doctor@example.com",
            password="test-password",
            role="DOCTOR",
        )
        doctor = Doctor.objects.create(user=doctor_user, service=service)
        patient = Patient.objects.create(
            patient_number="PAT-DISPENSE",
            first_name="Aline",
            last_name="Ndaye",
        )
        consultation = Consultation.objects.create(
            consultation_number="CONS-DISPENSE",
            patient=patient,
            doctor=doctor,
            status=Consultation.Status.COMPLETED,
        )
        medication = Medication.objects.create(name="Médicament délivré")
        cls.prescription = Prescription.objects.create(
            prescription_number="ORD-DISPENSE",
            consultation=consultation,
            patient=patient,
            doctor=doctor,
            status=Prescription.Status.VALIDATED,
        )
        cls.first_item = PrescriptionItem.objects.create(
            prescription=cls.prescription,
            medication=medication,
            quantity=5,
        )
        cls.second_item = PrescriptionItem.objects.create(
            prescription=cls.prescription,
            medication=medication,
            quantity=3,
        )
        cls.pharmacist = pharmacist

    def setUp(self):
        self.client.force_authenticate(self.pharmacist)

    def dispense(self, payload):
        return self.client.post(
            f"/api/prescriptions/{self.prescription.id}/dispense/",
            payload,
            format="json",
        )

    def test_full_dispensing_records_prescribed_quantities(self):
        response = self.dispense({"status": "DISPENSED"})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "DISPENSED")
        self.first_item.refresh_from_db()
        self.second_item.refresh_from_db()
        self.assertEqual(self.first_item.dispensed_quantity, 5)
        self.assertEqual(self.second_item.dispensed_quantity, 3)

    def test_partial_dispensing_records_actual_quantities(self):
        response = self.dispense(
            {
                "status": "PARTIALLY_DISPENSED",
                "items": [
                    {"id": self.first_item.id, "dispensed_quantity": 2},
                    {"id": self.second_item.id, "dispensed_quantity": 0},
                ],
            }
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "PARTIALLY_DISPENSED")
        self.first_item.refresh_from_db()
        self.second_item.refresh_from_db()
        self.assertEqual(self.first_item.dispensed_quantity, 2)
        self.assertEqual(self.second_item.dispensed_quantity, 0)

    def test_partial_dispensing_rejects_quantities_above_prescription(self):
        response = self.dispense(
            {
                "status": "PARTIALLY_DISPENSED",
                "items": [
                    {"id": self.first_item.id, "dispensed_quantity": 6},
                    {"id": self.second_item.id, "dispensed_quantity": 0},
                ],
            }
        )

        self.assertEqual(response.status_code, 400)
        self.first_item.refresh_from_db()
        self.assertEqual(self.first_item.dispensed_quantity, 0)

    def test_partial_dispensing_cannot_reduce_already_recorded_quantity(self):
        self.first_item.dispensed_quantity = 2
        self.first_item.save(update_fields=["dispensed_quantity"])

        response = self.dispense(
            {
                "status": "PARTIALLY_DISPENSED",
                "items": [
                    {"id": self.first_item.id, "dispensed_quantity": 1},
                    {"id": self.second_item.id, "dispensed_quantity": 0},
                ],
            }
        )

        self.assertEqual(response.status_code, 400)
        self.first_item.refresh_from_db()
        self.assertEqual(self.first_item.dispensed_quantity, 2)
