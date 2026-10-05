from django.test import override_settings
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework_simplejwt.tokens import RefreshToken


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="pass1234",
            role="DOCTOR",
        )

    def test_login_with_username_and_email_and_profile(self):
        # login with email (required format)
        resp = self.client.post(
            "/api/auth/login/",
            {"email": "test@example.com", "password": "pass1234"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        access = resp.data["access"]

        # access profile
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        profile = self.client.get("/api/auth/profile/")
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data["email"], "test@example.com")

        # logout and ensure refresh is blacklisted (if blacklist enabled)
        refresh = resp.data["refresh"]
        logout = self.client.post(
            "/api/auth/logout/", {"refresh": refresh}, format="json"
        )
        self.assertIn(logout.status_code, (200, 205))

        # username should no longer be accepted for login
        resp2 = self.client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "pass1234"},
            format="json",
        )
        self.assertEqual(resp2.status_code, 400)

    def test_password_reset_flow(self):
        # request password reset
        resp = self.client.post(
            "/api/auth/password-reset/", {"email": "test@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        # email sent
        self.assertTrue(len(mail.outbox) >= 1)
        message = mail.outbox[-1].body
        # extract uid and token from message (we used a simple link containing uid & token)
        import re

        m = re.search(r"uid=([^&]+)&token=(\w+-\w+)", message)
        self.assertIsNotNone(m)
        uid = m.group(1)
        token = m.group(2)

        # confirm password reset
        new_password = "newpass1234"
        resp2 = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": new_password},
            format="json",
        )
        self.assertEqual(resp2.status_code, 200)

        # login with new password
        resp3 = self.client.post(
            "/api/auth/login/",
            {"email": "test@example.com", "password": new_password},
            format="json",
        )
        self.assertEqual(resp3.status_code, 200)

    def test_create_user(self):
        User = get_user_model()
        admin = User.objects.create_user(
            username="boss", email="boss@example.com", password="pass1234", role="ADMIN"
        )
        self.client.force_authenticate(admin)
        resp = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "first_name": "Alice",
                "last_name": "Doe",
                "phone": "+237600000000",
                "gender": "FEMININ",
                "role": "RECEPTIONIST",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        user = User.objects.get(email="new@example.com")
        self.assertTrue(user.check_password("StrongPass123!"))
        self.assertEqual(user.role, User.Role.RECEPTIONIST)
        self.assertEqual(user.gender, "FEMININ")

    def test_registration_requires_admin(self):
        payload = {
            "username": "intruder",
            "email": "intruder@example.com",
            "password": "StrongPass123!",
            "role": "ADMIN",
        }

        # sans authentification
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 401)

        # avec un rôle non admin
        self.client.force_authenticate(self.user)  # DOCTOR
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(get_user_model().objects.filter(username="intruder").exists())

    def test_non_admin_cannot_toggle_another_user(self):
        target = get_user_model().objects.create_user(
            username="target",
            email="target@example.com",
            password="StrongPass123!",
            role="DOCTOR",
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/auth/profile/toggle-active/",
            {"user_id": target.id, "action": "deactivate"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        target.refresh_from_db()
        self.assertEqual(target.status, target.Status.ACTIVE)

    def test_suspended_user_cannot_login(self):
        user = get_user_model().objects.create_user(
            username="suspended",
            email="suspended@example.com",
            password="StrongPass123!",
            role="DOCTOR",
            status="SUSPENDED",
        )

        response = self.client.post(
            "/api/auth/login/",
            {"email": user.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_login_token_contains_role_and_failed_attempts_lock_account(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        for _ in range(4):
            self.client.post(
                "/api/auth/login/",
                {"email": self.user.email, "password": "wrong-password"},
                format="json",
            )

        self.user.refresh_from_db()
        self.assertEqual(self.user.status, self.user.Status.SUSPENDED)
        self.assertEqual(self.user.failed_login_attempts, 5)

        valid_login = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "pass1234"},
            format="json",
        )
        self.assertEqual(valid_login.status_code, 400)

        self.user.status = self.user.Status.ACTIVE
        self.user.lockout_until = None
        self.user.failed_login_attempts = 0
        self.user.save()
        valid_login = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "pass1234"},
            format="json",
        )
        self.assertEqual(valid_login.status_code, 200)
        self.assertEqual(RefreshToken(valid_login.data["refresh"])["role"], "DOCTOR")

    def test_user_cannot_logout_another_users_refresh_token(self):
        other = get_user_model().objects.create_user(
            username="other",
            email="other@example.com",
            password="StrongPass123!",
            role="DOCTOR",
        )
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "pass1234"},
            format="json",
        )
        other_refresh = str(RefreshToken.for_user(other))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

        logout = self.client.post(
            "/api/auth/logout/", {"refresh": other_refresh}, format="json"
        )

        self.assertEqual(logout.status_code, 400)
