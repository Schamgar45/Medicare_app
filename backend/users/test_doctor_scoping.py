"""Un médecin ne voit et ne modifie que ses propres données."""

from datetime import date, time

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from appointments.models import Appointment
from consultations.models import Consultation
from doctor.models import Doctor
from laboratory.models import LabRequest, LabResult, LabTest
from medical_history.models import MedicalHistory
from patients.models import Patient
from pharmacy.models import Medication
from prescriptions.models import Prescription, PrescriptionItem

User = get_user_model()


def make_user(username, role):
    return User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pass1234", role=role
    )


class DoctorScopingBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user("boss", "ADMIN")
        cls.receptionist = make_user("recep", "RECEPTIONIST")
        cls.laborant = make_user("labo", "LABORANT")
        cls.pharmacist = make_user("pharma", "PHARMACIST")

        cls.user_a = make_user("dr_a", "DOCTOR")
        cls.user_b = make_user("dr_b", "DOCTOR")
        cls.doc_a = Doctor.objects.create(user=cls.user_a)
        cls.doc_b = Doctor.objects.create(user=cls.user_b)

        # patient A : suivi par le Dr A ; patient B : suivi par le Dr B ; patient X : personne
        cls.pat_a = Patient.objects.create(patient_number="PA", first_name="Alice", last_name="A")
        cls.pat_b = Patient.objects.create(patient_number="PB", first_name="Bob", last_name="B")
        cls.pat_x = Patient.objects.create(patient_number="PX", first_name="Xavier", last_name="X")

        cls.appt_a = Appointment.objects.create(
            appointment_number="RDV-A", patient=cls.pat_a, doctor=cls.doc_a,
            appointment_date=date.today(), appointment_time=time(9, 0),
        )
        cls.appt_b = Appointment.objects.create(
            appointment_number="RDV-B", patient=cls.pat_b, doctor=cls.doc_b,
            appointment_date=date.today(), appointment_time=time(10, 0),
        )

        cls.cons_a = Consultation.objects.create(
            consultation_number="C-A", patient=cls.pat_a, doctor=cls.doc_a, appointment=cls.appt_a
        )
        cls.cons_b = Consultation.objects.create(
            consultation_number="C-B", patient=cls.pat_b, doctor=cls.doc_b, appointment=cls.appt_b
        )

        cls.med = Medication.objects.create(name="Paracétamol")
        cls.presc_a = Prescription.objects.create(
            prescription_number="PRE-A", consultation=cls.cons_a, patient=cls.pat_a, doctor=cls.doc_a
        )
        cls.presc_b = Prescription.objects.create(
            prescription_number="PRE-B", consultation=cls.cons_b, patient=cls.pat_b, doctor=cls.doc_b
        )
        cls.item_a = PrescriptionItem.objects.create(prescription=cls.presc_a, medication=cls.med)
        cls.item_b = PrescriptionItem.objects.create(prescription=cls.presc_b, medication=cls.med)

        test = LabTest.objects.create(name="Goutte épaisse")
        cls.lab_a = LabRequest.objects.create(
            request_number="L-A", consultation=cls.cons_a, patient=cls.pat_a, doctor=cls.doc_a, lab_test=test
        )
        cls.lab_b = LabRequest.objects.create(
            request_number="L-B", consultation=cls.cons_b, patient=cls.pat_b, doctor=cls.doc_b, lab_test=test
        )
        cls.res_a = LabResult.objects.create(lab_request=cls.lab_a, result="POSITIF")
        cls.res_b = LabResult.objects.create(lab_request=cls.lab_b, result="NEGATIF")

        cls.hist_a = MedicalHistory.objects.create(patient=cls.pat_a, title="Asthme")
        cls.hist_b = MedicalHistory.objects.create(patient=cls.pat_b, title="Diabète")

    def ids(self, url, user):
        self.client.force_authenticate(user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        return {row["id"] for row in response.data["results"]}


class DoctorReadScopingTests(DoctorScopingBase):
    def test_each_list_only_contains_the_doctors_own_data(self):
        expectations = [
            ("/api/patients/", {self.pat_a.id}, {self.pat_b.id}),
            ("/api/appointments/", {self.appt_a.id}, {self.appt_b.id}),
            ("/api/consultations/", {self.cons_a.id}, {self.cons_b.id}),
            ("/api/prescriptions/", {self.presc_a.id}, {self.presc_b.id}),
            ("/api/prescription-items/", {self.item_a.id}, {self.item_b.id}),
            ("/api/lab/requests/", {self.lab_a.id}, {self.lab_b.id}),
            ("/api/lab/results/", {self.res_a.id}, {self.res_b.id}),
            ("/api/medical-history/", {self.hist_a.id}, {self.hist_b.id}),
        ]
        for url, mine_for_a, mine_for_b in expectations:
            with self.subTest(url=url):
                self.assertEqual(self.ids(url, self.user_a), mine_for_a)
                self.assertEqual(self.ids(url, self.user_b), mine_for_b)

    def test_patient_without_link_is_visible_to_nobody_but_staff(self):
        self.assertNotIn(self.pat_x.id, self.ids("/api/patients/", self.user_a))
        self.assertNotIn(self.pat_x.id, self.ids("/api/patients/", self.user_b))
        self.assertIn(self.pat_x.id, self.ids("/api/patients/", self.receptionist))

    def test_other_doctors_object_returns_404(self):
        self.client.force_authenticate(self.user_a)
        for url in [
            f"/api/patients/{self.pat_b.id}/",
            f"/api/appointments/{self.appt_b.id}/",
            f"/api/consultations/{self.cons_b.id}/",
            f"/api/prescriptions/{self.presc_b.id}/",
            f"/api/lab/requests/{self.lab_b.id}/",
            f"/api/medical-history/{self.hist_b.id}/",
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 404)

    def test_filters_cannot_bypass_the_scope(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.get(f"/api/consultations/?doctor={self.doc_b.id}")
        self.assertEqual(response.data["count"], 0)
        response = self.client.get(f"/api/appointments/?patient={self.pat_b.id}")
        self.assertEqual(response.data["count"], 0)

    def test_patient_becomes_visible_once_an_appointment_is_booked(self):
        self.assertNotIn(self.pat_x.id, self.ids("/api/patients/", self.user_a))
        Appointment.objects.create(
            appointment_number="RDV-X", patient=self.pat_x, doctor=self.doc_a,
            appointment_date=date.today(), appointment_time=time(11, 0),
        )
        self.assertIn(self.pat_x.id, self.ids("/api/patients/", self.user_a))

    def test_other_roles_keep_their_full_view(self):
        self.assertEqual(len(self.ids("/api/patients/", self.admin)), 3)
        self.assertEqual(len(self.ids("/api/patients/", self.receptionist)), 3)
        self.assertEqual(len(self.ids("/api/appointments/", self.receptionist)), 2)
        self.assertEqual(len(self.ids("/api/appointments/", self.admin)), 2)
        self.assertEqual(len(self.ids("/api/lab/requests/", self.laborant)), 2)
        self.assertEqual(len(self.ids("/api/prescriptions/", self.pharmacist)), 2)

    def test_doctor_account_without_doctor_profile_sees_nothing(self):
        orphan = make_user("orphan", "DOCTOR")
        for url in ["/api/patients/", "/api/appointments/", "/api/consultations/", "/api/prescriptions/"]:
            with self.subTest(url=url):
                self.assertEqual(self.ids(url, orphan), set())

    def test_scoping_works_with_a_real_jwt_login(self):
        login = self.client.post(
            "/api/auth/login/", {"email": "dr_a@example.com", "password": "pass1234"}, format="json"
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        patients = self.client.get("/api/patients/")
        self.assertEqual([p["id"] for p in patients.data["results"]], [self.pat_a.id])
        self.assertEqual(self.client.get(f"/api/consultations/{self.cons_b.id}/").status_code, 404)

    def test_doctors_me(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.get("/api/doctors/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.doc_a.id)
        self.client.force_authenticate(self.receptionist)
        self.assertEqual(self.client.get("/api/doctors/me/").status_code, 404)


class DoctorWriteScopingTests(DoctorScopingBase):
    def setUp(self):
        self.client.force_authenticate(self.user_a)

    def test_doctor_cannot_modify_or_delete_other_doctors_records(self):
        self.assertEqual(
            self.client.patch(f"/api/consultations/{self.cons_b.id}/", {"diagnosis": "x"}, format="json").status_code,
            404,
        )
        self.assertEqual(
            self.client.patch(f"/api/appointments/{self.appt_b.id}/", {"status": "CANCELLED"}, format="json").status_code,
            404,
        )
        self.assertEqual(self.client.delete(f"/api/consultations/{self.cons_b.id}/").status_code, 403)
        self.cons_b.refresh_from_db()
        self.assertEqual(self.cons_b.diagnosis, "")

    def test_doctor_cannot_create_patients_or_appointments(self):
        patient = self.client.post(
            "/api/patients/", {"patient_number": "NEW", "first_name": "N", "last_name": "N"}, format="json"
        )
        self.assertEqual(patient.status_code, 403)
        appointment = self.client.post(
            "/api/appointments/",
            {
                "appointment_number": "RDV-NEW", "patient": self.pat_x.id, "doctor": self.doc_a.id,
                "appointment_date": "2026-11-01", "appointment_time": "09:00:00",
            },
            format="json",
        )
        self.assertEqual(appointment.status_code, 403)
        self.assertFalse(Appointment.objects.filter(appointment_number="RDV-NEW").exists())

    def test_doctor_can_only_change_progress_of_his_appointment(self):
        ok = self.client.patch(
            f"/api/appointments/{self.appt_a.id}/", {"status": "IN_PROGRESS", "notes": "arrivé"}, format="json"
        )
        self.assertEqual(ok.status_code, 200)
        self.appt_a.refresh_from_db()
        self.assertEqual(self.appt_a.status, "IN_PROGRESS")

        # il ne peut pas s'attribuer un autre patient via un rendez-vous existant
        steal = self.client.patch(
            f"/api/appointments/{self.appt_a.id}/", {"patient": self.pat_x.id}, format="json"
        )
        self.assertEqual(steal.status_code, 403)
        self.appt_a.refresh_from_db()
        self.assertEqual(self.appt_a.patient_id, self.pat_a.id)

    def test_doctor_creates_consultation_for_own_patient(self):
        response = self.client.post(
            "/api/consultations/",
            {"consultation_number": "C-NEW", "patient": self.pat_a.id, "doctor": self.doc_a.id, "reason": "Fièvre"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_doctor_cannot_consult_in_someone_elses_name(self):
        response = self.client.post(
            "/api/consultations/",
            {"consultation_number": "C-FAKE", "patient": self.pat_a.id, "doctor": self.doc_b.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Consultation.objects.filter(consultation_number="C-FAKE").exists())

    def test_doctor_cannot_consult_a_patient_that_is_not_his(self):
        response = self.client.post(
            "/api/consultations/",
            {"consultation_number": "C-X", "patient": self.pat_b.id, "doctor": self.doc_a.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Consultation.objects.filter(consultation_number="C-X").exists())

    def test_doctor_prescribes_on_own_consultation_only(self):
        ok = self.client.post(
            "/api/prescriptions/",
            {
                "prescription_number": "PRE-NEW", "consultation": self.cons_a.id,
                "patient": self.pat_a.id, "doctor": self.doc_a.id,
            },
            format="json",
        )
        self.assertEqual(ok.status_code, 201, ok.data)

        other = self.client.post(
            "/api/prescriptions/",
            {
                "prescription_number": "PRE-BAD", "consultation": self.cons_b.id,
                "patient": self.pat_b.id, "doctor": self.doc_a.id,
            },
            format="json",
        )
        self.assertIn(other.status_code, (400, 403))
        self.assertFalse(Prescription.objects.filter(prescription_number="PRE-BAD").exists())

    def test_doctor_cannot_add_item_to_someone_elses_prescription(self):
        response = self.client.post(
            "/api/prescription-items/",
            {"prescription": self.presc_b.id, "medication": self.med.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.presc_b.items.count(), 1)

    def test_doctor_requests_lab_exam_on_own_consultation_only(self):
        test = LabTest.objects.get(name="Goutte épaisse")
        payload = {
            "request_number": "L-NEW", "consultation": self.cons_a.id, "patient": self.pat_a.id,
            "doctor": self.doc_a.id, "lab_test": test.id,
        }
        self.assertEqual(self.client.post("/api/lab/requests/", payload, format="json").status_code, 201)
        bad = {**payload, "request_number": "L-BAD", "consultation": self.cons_b.id, "patient": self.pat_b.id}
        self.assertIn(self.client.post("/api/lab/requests/", bad, format="json").status_code, (400, 403))
        self.assertFalse(LabRequest.objects.filter(request_number="L-BAD").exists())

    def test_doctor_cannot_write_lab_results(self):
        response = self.client.post(
            "/api/lab/results/", {"lab_request": self.lab_a.id, "result": "truqué"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_is_not_restricted(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/consultations/{self.cons_b.id}/", {"diagnosis": "revu par admin"}, format="json"
        )
        self.assertEqual(response.status_code, 200)


class DoctorDashboardScopingTests(DoctorScopingBase):
    def stats(self, user):
        self.client.force_authenticate(user)
        return self.client.get("/api/stats/dashboard/").data

    def test_doctor_dashboard_only_counts_own_data(self):
        for user in (self.user_a, self.user_b):
            with self.subTest(user=user.username):
                data = self.stats(user)
                self.assertEqual(data["patients"]["total"], 1)
                self.assertEqual(data["appointments"]["today"], 1)
                self.assertEqual(data["consultations"]["total"], 1)
                self.assertEqual(data["lab"]["pending_requests"], 1)
                self.assertEqual(sum(p["value"] for p in data["patients"]["per_month"]), 1.0)

    def test_admin_and_reception_dashboards_stay_global(self):
        admin = self.stats(self.admin)
        self.assertEqual(admin["patients"]["total"], 3)
        self.assertEqual(admin["appointments"]["today"], 2)
        self.assertEqual(admin["consultations"]["total"], 2)
        self.assertEqual(self.stats(self.receptionist)["patients"]["total"], 3)

    def test_doctor_without_profile_gets_zeros(self):
        data = self.stats(make_user("orphan", "DOCTOR"))
        self.assertEqual(data["patients"]["total"], 0)
        self.assertEqual(data["consultations"]["total"], 0)
