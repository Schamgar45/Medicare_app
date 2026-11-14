from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from django.urls import reverse

from configs.settings import _postgres_database_settings_from_url


class HealthCheckTests(SimpleTestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_health_endpoint_only_accepts_get(self):
        response = self.client.post(reverse("health"))

        self.assertEqual(response.status_code, 405)


class PostgresDatabaseUrlTests(SimpleTestCase):
    def test_decodes_postgres_uri_credentials(self):
        settings = _postgres_database_settings_from_url(
            "postgresql://db-user:p%40ss%3Aword@db.example.com:5432/medicare"
        )

        self.assertEqual(settings["USER"], "db-user")
        self.assertEqual(settings["PASSWORD"], "p@ss:word")
        self.assertEqual(settings["HOST"], "db.example.com")
        self.assertEqual(settings["NAME"], "medicare")
        self.assertEqual(settings["PORT"], 5432)

    def test_rejects_non_postgres_uri(self):
        with self.assertRaises(ImproperlyConfigured):
            _postgres_database_settings_from_url(
                "mysql://db-user:password@db.example.com/medicare"
            )
