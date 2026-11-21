from django.core.exceptions import ImproperlyConfigured
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from configs.settings import _postgres_database_settings_from_url
from configs.middleware import SlowRequestLoggingMiddleware


class HealthCheckTests(TestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "email_transport": "test"},
        )

    def test_health_endpoint_only_accepts_get(self):
        response = self.client.post(reverse("health"))

        self.assertEqual(response.status_code, 405)

    def test_readiness_endpoint_checks_database_connectivity(self):
        response = self.client.get(reverse("readiness"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class SlowRequestLoggingTests(SimpleTestCase):
    @override_settings(DJANGO_SLOW_REQUEST_MS=0)
    def test_slow_request_log_uses_route_template_without_query_string(self):
        from django.http import JsonResponse
        from django.urls import resolve, reverse
        from unittest.mock import patch

        request = RequestFactory().get(reverse("health") + "?patient=private")
        request.resolver_match = resolve(reverse("health"))
        middleware = SlowRequestLoggingMiddleware(
            lambda request: JsonResponse({"status": "ok"})
        )

        with patch("configs.middleware.logger.warning") as warning:
            response = middleware(request)

        self.assertEqual(response.status_code, 200)
        warning.assert_called_once()
        self.assertIn("health", warning.call_args.args)
        self.assertNotIn("patient=private", str(warning.call_args.args))

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
