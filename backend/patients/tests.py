from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Patient
from .serializers import PatientSerializer

User = get_user_model()
URL = "/api/patients/"


def make_user(role):
    return User.objects.create_user(
        username=role.lower(), email=f"{role.lower()}@example.com", password="pass1234", role=role
    )


class DateOfBirthValidationTests(APITestCase):
    """Une date de naissance postérieure à aujourd'hui est refusée (API + sérialiseur)."""

    @classmethod
    def setUpTestData(cls):
        cls.receptionist = make_user("RECEPTIONIST")

    @staticmethod
    def payload(date_of_birth, gender="MALE"):
        return {
            "first_name": "Jean",
            "last_name": "Ndaye",
            "gender": gender,
            "date_of_birth": date_of_birth,
        }

    def test_future_date_rejected_by_api(self):
        self.client.force_authenticate(self.receptionist)
        future = (timezone.localdate() + timedelta(days=365)).isoformat()
        resp = self.client.post(URL, self.payload(future), format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("date_of_birth", resp.data)
        self.assertFalse(Patient.objects.filter(last_name="Ndaye").exists())

    def test_tomorrow_rejected_by_serializer(self):
        tomorrow = timezone.localdate() + timedelta(days=1)
        serializer = PatientSerializer(data=self.payload(tomorrow.isoformat()))
        self.assertFalse(serializer.is_valid())
        self.assertIn("date_of_birth", serializer.errors)

    def test_today_and_past_dates_accepted(self):
        self.client.force_authenticate(self.receptionist)
        today = timezone.localdate()
        for value in (today.isoformat(), (today - timedelta(days=1)).isoformat(), (today - timedelta(days=30 * 12)).isoformat()):
            with self.subTest(value=value):
                resp = self.client.post(URL, self.payload(value), format="json")
                self.assertEqual(resp.status_code, 201, resp.data)
                self.assertEqual(resp.data["date_of_birth"], value)

    def test_missing_date_of_birth_rejected_by_api(self):
        self.client.force_authenticate(self.receptionist)
        data = self.payload(timezone.localdate().isoformat())
        del data["date_of_birth"]
        resp = self.client.post(URL, data, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("date_of_birth", resp.data)

    def test_missing_gender_rejected_by_api(self):
        self.client.force_authenticate(self.receptionist)
        data = self.payload(timezone.localdate().isoformat())
        del data["gender"]
        resp = self.client.post(URL, data, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("gender", resp.data)

    def test_blank_gender_rejected_by_api(self):
        self.client.force_authenticate(self.receptionist)
        resp = self.client.post(URL, self.payload(timezone.localdate().isoformat(), gender=""), format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("gender", resp.data)
        self.assertFalse(Patient.objects.filter(last_name="Ndaye").exists())


class DateOfBirthModelValidatorTests(TestCase):
    """Le validateur du modèle couvre aussi l'admin et tout appel à full_clean()."""

    def test_full_clean_rejects_future_date(self):
        tomorrow = timezone.localdate() + timedelta(days=1)
        patient = Patient(patient_number="PAT-T1", first_name="Jean", last_name="Ndaye", date_of_birth=tomorrow)
        with self.assertRaisesMessage(Exception, "ne peut pas être dans le futur"):
            patient.full_clean()

    def test_full_clean_accepts_past_date(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        patient = Patient(patient_number="PAT-T2", first_name="Jean", last_name="Ndaye", date_of_birth=yesterday)
        patient.full_clean()  # ne doit pas lever d'exception

