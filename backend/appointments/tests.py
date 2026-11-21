from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from doctor.models import Doctor
from notifications.models import Notification
from patients.models import Patient

from .models import Appointment


User = get_user_model()


class AppointmentScheduleValidationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.receptionist = User.objects.create_user(
            username="appointment-receptionist",
            email="appointment-receptionist@example.com",
            password="test-password",
            role="RECEPTIONIST",
        )
        doctor_user = User.objects.create_user(
            username="appointment-doctor",
            email="appointment-doctor@example.com",
            password="test-password",
            role="DOCTOR",
        )
        cls.doctor = Doctor.objects.create(user=doctor_user)
        cls.patient = Patient.objects.create(
            patient_number="PAT-APPOINTMENT",
            first_name="Aline",
            last_name="Ndaye",
        )

    def payload(self, appointment_date, appointment_time="09:00:00"):
        return {
            "patient": self.patient.id,
            "doctor": self.doctor.id,
            "appointment_date": appointment_date.isoformat(),
            "appointment_time": appointment_time,
            "status": Appointment.Status.SCHEDULED,
        }

    def test_api_rejects_an_appointment_in_the_past(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            "/api/appointments/",
            self.payload(timezone.localdate() - timedelta(days=1)),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("appointment_date", response.data)
        self.assertFalse(Appointment.objects.exists())

    def test_api_rejects_a_time_that_has_already_passed_today(self):
        self.client.force_authenticate(self.receptionist)
        past = timezone.localtime() - timedelta(minutes=1)
        response = self.client.post(
            "/api/appointments/",
            self.payload(past.date(), past.strftime("%H:%M:%S")),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("appointment_date", response.data)
        self.assertFalse(Appointment.objects.exists())

    def test_status_update_on_a_past_appointment_stays_allowed(self):
        appointment = Appointment.objects.create(
            appointment_number="RDV-PAST",
            patient=self.patient,
            doctor=self.doctor,
            appointment_date=timezone.localdate() - timedelta(days=1),
            appointment_time="09:00:00",
        )
        self.client.force_authenticate(self.receptionist)

        response = self.client.patch(
            f"/api/appointments/{appointment.id}/",
            {"status": Appointment.Status.NO_SHOW},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Status.NO_SHOW)

    def test_creating_an_appointment_notifies_its_doctor(self):
        self.client.force_authenticate(self.receptionist)

        response = self.client.post(
            "/api/appointments/",
            self.payload(timezone.localdate() + timedelta(days=1)),
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        notification = Notification.objects.get(user=self.doctor.user)
        self.assertEqual(notification.type, Notification.Type.APPOINTMENT)
        self.assertIn("Aline Ndaye", notification.message)

    def test_updating_an_appointment_notifies_its_doctor(self):
        appointment = Appointment.objects.create(
            appointment_number="RDV-UPDATE",
            patient=self.patient,
            doctor=self.doctor,
            appointment_date=timezone.localdate() + timedelta(days=1),
            appointment_time="09:00:00",
        )
        self.client.force_authenticate(self.receptionist)

        response = self.client.patch(
            f"/api/appointments/{appointment.id}/",
            {"appointment_time": "10:00:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        notification = Notification.objects.get(user=self.doctor.user)
        self.assertEqual(notification.type, Notification.Type.APPOINTMENT)
        self.assertIn("10:00:00", notification.message)
