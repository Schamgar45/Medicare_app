from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from patients.models import Patient
from pharmacy.models import Medication, MedicationBatch, StockMovement
from users.roles import (
    ALL_STAFF,
    CASHIER,
    DOCTOR,
    LABORANT,
    PHARMACIST,
    RECEPTIONIST,
)

User = get_user_model()

# endpoint de liste -> rôles autorisés en lecture (l'ADMIN passe toujours)
READ_MATRIX = {
    "/api/patients/": ALL_STAFF,
    "/api/doctors/": ALL_STAFF,
    "/api/services/": ALL_STAFF,
    "/api/specialties/": ALL_STAFF,
    "/api/appointments/": [DOCTOR, RECEPTIONIST],
    "/api/consultations/": [DOCTOR],
    "/api/medical-history/": [DOCTOR],
    "/api/prescriptions/": [DOCTOR, PHARMACIST],
    "/api/lab/tests/": [DOCTOR, LABORANT],
    "/api/lab/requests/": [DOCTOR, LABORANT],
    "/api/lab/results/": [DOCTOR, LABORANT],
    "/api/billing-items/": [RECEPTIONIST, CASHIER],
    "/api/invoices/": [RECEPTIONIST, CASHIER],
    "/api/payments/": [RECEPTIONIST, CASHIER],
    "/api/medications/": [DOCTOR, PHARMACIST, RECEPTIONIST, CASHIER],
    "/api/medication-batches/": [PHARMACIST],
    "/api/stock-movements/": [PHARMACIST],
    "/api/audit/": [],
}


def make_user(role):
    return User.objects.create_user(
        username=role.lower(),
        email=f"{role.lower()}@example.com",
        password="pass1234",
        role=role,
    )


class RoleMatrixTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = {r: make_user(r) for r in ["ADMIN", *ALL_STAFF]}

    def test_anonymous_is_rejected_everywhere(self):
        for url in READ_MATRIX:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 401)

    def test_read_access_per_role(self):
        for url, allowed in READ_MATRIX.items():
            for role, user in self.users.items():
                expected = 200 if role == "ADMIN" or role in allowed else 403
                with self.subTest(url=url, role=role):
                    self.client.force_authenticate(user)
                    self.assertEqual(self.client.get(url).status_code, expected)

    def test_write_access_on_patients(self):
        payload = {
            "patient_number": "PAT-1",
            "first_name": "Jean",
            "last_name": "Ndaye",
            "gender": "MALE",
            "date_of_birth": "1990-01-01",
        }
        for role, expected in [
            (RECEPTIONIST, 201),
            (DOCTOR, 403),  # l'enregistrement d'un patient se fait à la réception
            (LABORANT, 403),
            (PHARMACIST, 403),
            (CASHIER, 403),
        ]:
            with self.subTest(role=role):
                self.client.force_authenticate(self.users[role])
                data = {**payload, "patient_number": f"PAT-{role}"}
                self.assertEqual(
                    self.client.post("/api/patients/", data, format="json").status_code,
                    expected,
                )

    def test_delete_is_admin_only_by_default(self):
        patient = Patient.objects.create(
            patient_number="PAT-DEL", first_name="A", last_name="B"
        )
        for role in (RECEPTIONIST, DOCTOR):
            self.client.force_authenticate(self.users[role])
            self.assertEqual(
                self.client.delete(f"/api/patients/{patient.id}/").status_code, 403
            )
        self.client.force_authenticate(self.users["ADMIN"])
        self.assertEqual(
            self.client.delete(f"/api/patients/{patient.id}/").status_code, 204
        )

    def test_only_admin_can_create_doctors_and_services(self):
        self.client.force_authenticate(self.users[RECEPTIONIST])
        self.assertEqual(
            self.client.post(
                "/api/services/", {"name": "X"}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post("/api/doctors/", {}, format="json").status_code, 403
        )

    def test_superuser_without_role_is_treated_as_admin(self):
        boss = User.objects.create_superuser("root", "root@example.com", "pass1234")
        self.assertEqual(boss.role, "ADMIN")  # createsuperuser pose le rôle
        boss.role = ""  # superuser historique créé avant ce correctif
        boss.save()
        self.client.force_authenticate(boss)
        self.assertEqual(self.client.get("/api/audit/").status_code, 200)

    def test_notifications_remain_open_to_any_authenticated_user(self):
        for role in ALL_STAFF:
            self.client.force_authenticate(self.users[role])
            self.assertEqual(self.client.get("/api/notifications/").status_code, 200)


class UserAdminTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user("ADMIN")
        cls.doctor = make_user(DOCTOR)

    def payload(self, **over):
        base = {
            "username": "newdoc",
            "email": "newdoc@example.com",
            "password": "StrongPass123!",
            "role": "DOCTOR",
        }
        return {**base, **over}

    def test_admin_creates_user_with_chosen_role(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/auth/register/", self.payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(User.objects.get(username="newdoc").role, "DOCTOR")

    def test_registration_rejects_invalid_role_and_weak_password(self):
        self.client.force_authenticate(self.admin)
        r1 = self.client.post(
            "/api/auth/register/", self.payload(role="GOD"), format="json"
        )
        self.assertEqual(r1.status_code, 400)
        r2 = self.client.post(
            "/api/auth/register/", self.payload(password="12345678"), format="json"
        )
        self.assertEqual(r2.status_code, 400)

    def test_user_list_is_admin_only_and_filterable(self):
        self.client.force_authenticate(self.doctor)
        self.assertEqual(self.client.get("/api/auth/users/").status_code, 403)

        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/auth/users/?role=DOCTOR")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([u["username"] for u in resp.data["results"]], ["doctor"])
        self.assertNotIn("password", resp.data["results"][0])

    def test_admin_can_deactivate_another_user_but_not_themself(self):
        self.client.force_authenticate(self.admin)
        ok = self.client.patch(
            f"/api/auth/users/{self.doctor.id}/", {"status": "INACTIVE"}, format="json"
        )
        self.assertEqual(ok.status_code, 200)
        own = self.client.patch(
            f"/api/auth/users/{self.admin.id}/", {"status": "INACTIVE"}, format="json"
        )
        self.assertEqual(own.status_code, 400)
        demote = self.client.patch(
            f"/api/auth/users/{self.admin.id}/", {"role": "DOCTOR"}, format="json"
        )
        self.assertEqual(demote.status_code, 400)


class ListFeaturesTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.receptionist = make_user(RECEPTIONIST)
        Patient.objects.bulk_create(
            Patient(patient_number=f"P{i:03}", first_name=f"Name{i}", last_name="Test")
            for i in range(25)
        )
        Patient.objects.create(
            patient_number="Z999", first_name="Aline", last_name="Nkurunziza"
        )

    def setUp(self):
        self.client.force_authenticate(self.receptionist)

    def test_pagination_shape_and_page_size(self):
        resp = self.client.get("/api/patients/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 26)
        self.assertEqual(len(resp.data["results"]), 20)
        self.assertIsNotNone(resp.data["next"])
        small = self.client.get("/api/patients/?page_size=5&page=2")
        self.assertEqual(len(small.data["results"]), 5)

    def test_page_size_is_capped(self):
        resp = self.client.get("/api/patients/?page_size=5000")
        self.assertLessEqual(len(resp.data["results"]), 100)

    def test_search_and_ordering(self):
        found = self.client.get("/api/patients/?search=nkuru")
        self.assertEqual([p["patient_number"] for p in found.data["results"]], ["Z999"])
        asc = self.client.get("/api/patients/?ordering=patient_number")
        self.assertEqual(asc.data["results"][0]["patient_number"], "P000")


class MedicationStockTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pharmacist = make_user(PHARMACIST)
        low = Medication.objects.create(name="Amoxicilline", minimum_stock=20)
        ok = Medication.objects.create(name="Paracétamol", minimum_stock=20)
        empty = Medication.objects.create(name="Ibuprofène", minimum_stock=10)
        MedicationBatch.objects.create(medication=low, batch_number="A1", quantity=5)
        MedicationBatch.objects.create(medication=low, batch_number="A2", quantity=4)
        MedicationBatch.objects.create(medication=ok, batch_number="P1", quantity=125)
        cls.low, cls.ok, cls.empty = low, ok, empty

    def setUp(self):
        self.client.force_authenticate(self.pharmacist)

    def test_current_stock_sums_batches_and_flags_low_stock(self):
        rows = {
            m["name"]: m for m in self.client.get("/api/medications/").data["results"]
        }
        self.assertEqual(rows["Amoxicilline"]["current_stock"], 9)
        self.assertTrue(rows["Amoxicilline"]["is_low_stock"])
        self.assertEqual(rows["Paracétamol"]["current_stock"], 125)
        self.assertFalse(rows["Paracétamol"]["is_low_stock"])
        self.assertEqual(rows["Ibuprofène"]["current_stock"], 0)  # aucun lot
        self.assertTrue(rows["Ibuprofène"]["is_low_stock"])

    def test_low_stock_filter(self):
        low = self.client.get("/api/medications/?low_stock=true").data["results"]
        self.assertEqual(sorted(m["name"] for m in low), ["Amoxicilline", "Ibuprofène"])
        fine = self.client.get("/api/medications/?low_stock=false").data["results"]
        self.assertEqual([m["name"] for m in fine], ["Paracétamol"])

    def test_create_response_includes_stock_fields(self):
        resp = self.client.post(
            "/api/medications/", {"name": "Nouveau", "minimum_stock": 3}, format="json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["current_stock"], 0)
        self.assertTrue(resp.data["is_low_stock"])


class MedicationDeletionTests(APITestCase):
    """Un médicament référencé ne doit pas être supprimable en silencieux (500)."""

    @classmethod
    def setUpTestData(cls):
        # DELETE sur les médicaments est réservé à l'ADMIN (delete_roles non déclaré)
        cls.admin = make_user("ADMIN")
        cls.medication = Medication.objects.create(name="Xenociline", minimum_stock=0)
        cls.batch = MedicationBatch.objects.create(
            medication=cls.medication, batch_number="B1", quantity=10
        )

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def test_delete_referenced_medication_returns_409(self):
        StockMovement.objects.create(
            medication=self.medication,
            batch=self.batch,
            movement_type=StockMovement.MovementType.IN,
            quantity=5,
            performed_by=self.admin,
        )
        resp = self.client.delete(f"/api/medications/{self.medication.pk}/")
        self.assertEqual(resp.status_code, 409)
        self.assertIn("mouvement de stock", resp.data["detail"])
        # le médicament doit rester en base
        self.assertTrue(Medication.objects.filter(pk=self.medication.pk).exists())

    def test_delete_unreferenced_medication_returns_204(self):
        resp = self.client.delete(f"/api/medications/{self.medication.pk}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Medication.objects.filter(pk=self.medication.pk).exists())
