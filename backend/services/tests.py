from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import MedicalService

User = get_user_model()


def make_user(role):
    return User.objects.create_user(
        username=role.lower(),
        email=f"{role.lower()}@example.com",
        password="pass1234",
        role=role,
    )


class ServiceThemeColorTests(APITestCase):
    """Chaque service (département) porte la couleur de son logo et de son cachet imprimés."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user("ADMIN")
        cls.cashier = make_user("CASHIER")

    def test_color_defaults_to_marine(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/services/", {"name": "Consultation"}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["theme_color"], "MARINE")

    def test_admin_can_choose_green_and_staff_can_read_it(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/services/",
            {"name": "Laboratoire", "theme_color": "VERT"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)

        self.client.force_authenticate(self.cashier)
        listing = self.client.get("/api/services/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["results"][0]["theme_color"], "VERT")

    def test_unknown_color_is_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/services/",
            {"name": "Pharmacie", "theme_color": "ROUGE"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MedicalService.objects.filter(name="Pharmacie").exists())

    def test_only_admin_can_change_the_color(self):
        service = MedicalService.objects.create(name="Imagerie")
        self.client.force_authenticate(self.cashier)
        response = self.client.patch(
            f"/api/services/{service.id}/", {"theme_color": "VERT"}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        service.refresh_from_db()
        self.assertEqual(service.theme_color, "MARINE")
