"""Tests de la hiérarchie des comptes et de l'audit immuable.

Règles :
- superuser (createsuperuser) intouchable via l'API ;
- un ADMIN ne gère que le staff (jamais un autre ADMIN ni le superuser) ;
- le dernier admin actif ne peut pas être supprimé/désactivé/rétrogradé ;
- toutes les actions CRUD sont loguées et les logs sont readonly.
"""

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.test import APITestCase

from audit.models import AuditLog
from audit.services import log_user_action

User = get_user_model()


def make_user(role, username, superuser=False):
    if superuser:
        return User.objects.create_superuser(
            username=username, email=f"{username}@example.com", password="pass1234"
        )
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="pass1234",
        role=role,
    )


class AccountHierarchyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # Le "root" créé par createsuperuser.
        cls.root = make_user("ADMIN", "root", superuser=True)
        # Un ADMIN créé via l'API par root (is_superuser=False).
        cls.admin = make_user("ADMIN", "admin2")
        cls.doctor = make_user("DOCTOR", "doc")
        cls.other_admin = make_user("ADMIN", "admin3")

    # ---------- hiérarchie : l'ADMIN ne touche pas aux ADMIN ----------

    def test_admin_cannot_create_another_admin(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            "/api/auth/register/",
            {
                "username": "newadmin",
                "email": "newadmin@example.com",
                "password": "StrongPass123!",
                "role": "ADMIN",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_root_can_create_another_admin(self):
        self.client.force_authenticate(self.root)
        resp = self.client.post(
            "/api/auth/register/",
            {
                "username": "newadmin",
                "email": "newadmin@example.com",
                "password": "StrongPass123!",
                "role": "ADMIN",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(User.objects.get(username="newadmin").role, "ADMIN")

    def test_admin_cannot_patch_or_delete_another_admin(self):
        self.client.force_authenticate(self.admin)
        patch = self.client.patch(
            f"/api/auth/users/{self.other_admin.id}/",
            {"status": "INACTIVE"},
            format="json",
        )
        self.assertEqual(patch.status_code, 403)
        delete = self.client.delete(f"/api/auth/users/{self.other_admin.id}/")
        self.assertEqual(delete.status_code, 403)

    def test_admin_cannot_touch_root_superuser(self):
        self.client.force_authenticate(self.admin)
        patch = self.client.patch(
            f"/api/auth/users/{self.root.id}/", {"status": "INACTIVE"}, format="json"
        )
        self.assertEqual(patch.status_code, 403)
        delete = self.client.delete(f"/api/auth/users/{self.root.id}/")
        self.assertEqual(delete.status_code, 403)
        resp = self.client.post(f"/api/auth/users/{self.root.id}/deactivate/")
        self.assertEqual(resp.status_code, 403)
        self.root.refresh_from_db()
        self.assertEqual(self.root.status, User.Status.ACTIVE)

    def test_root_cannot_delete_or_deactivate_itself(self):
        self.client.force_authenticate(self.root)
        delete = self.client.delete(f"/api/auth/users/{self.root.id}/")
        self.assertEqual(delete.status_code, 403)
        deact = self.client.post(f"/api/auth/users/{self.root.id}/deactivate/")
        self.assertEqual(deact.status_code, 403)
        self.root.refresh_from_db()
        self.assertEqual(self.root.status, User.Status.ACTIVE)

    def test_root_can_manage_staff_and_admins(self):
        self.client.force_authenticate(self.root)
        ok = self.client.post(f"/api/auth/users/{self.doctor.id}/deactivate/")
        self.assertEqual(ok.status_code, 200)
        ok2 = self.client.post(f"/api/auth/users/{self.other_admin.id}/deactivate/")
        self.assertEqual(ok2.status_code, 200)

    # ---------- statut personnel ----------

    def test_user_cannot_change_own_status_or_role(self):
        self.client.force_authenticate(self.admin)
        own_status = self.client.patch(
            f"/api/auth/users/{self.admin.id}/", {"status": "INACTIVE"}, format="json"
        )
        self.assertEqual(own_status.status_code, 400)
        own_role = self.client.patch(
            f"/api/auth/users/{self.admin.id}/", {"role": "DOCTOR"}, format="json"
        )
        self.assertEqual(own_role.status_code, 400)

    def test_last_active_admin_cannot_be_deactivated(self):
        # Scénario limite : root est superuser mais plus actif en BDD, admin3 aussi :
        # admin2 devient le dernier ADMIN actif.
        User.objects.filter(pk__in=[self.root.pk, self.other_admin.pk]).update(
            status="INACTIVE"
        )
        self.root.refresh_from_db()
        self.client.force_authenticate(self.root)
        resp = self.client.post(f"/api/auth/users/{self.admin.id}/deactivate/")
        self.assertEqual(resp.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.status, User.Status.ACTIVE)

    # ---------- audit ----------

    def test_crud_actions_are_logged(self):
        self.client.force_authenticate(self.root)
        self.client.post(
            "/api/auth/register/",
            {
                "username": "audited",
                "email": "audited@example.com",
                "password": "StrongPass123!",
                "role": "DOCTOR",
            },
            format="json",
        )
        target = User.objects.get(username="audited")
        self.client.patch(
            f"/api/auth/users/{target.id}/", {"status": "INACTIVE"}, format="json"
        )
        self.client.post(f"/api/auth/users/{target.id}/activate/")
        self.client.delete(f"/api/auth/users/{target.id}/")

        actions = set(
            AuditLog.objects.filter(record_id=target.pk).values_list(
                "action", flat=True
            )
        )
        self.assertEqual(actions, {"CREATE", "DEACTIVATE", "ACTIVATE", "DELETE"})
        for log in AuditLog.objects.filter(record_id=target.pk):
            self.assertEqual(log.user_id, self.root.pk)
            self.assertEqual(log.table_name, "users.User")

    def test_audit_is_immutable_via_orm(self):
        log = log_user_action(
            actor=self.root, action=AuditLog.Action.CREATE, target=self.doctor
        )
        self.assertIsNotNone(log)
        with self.assertRaises(DjangoValidationError):
            log.save()
        with self.assertRaises(DjangoValidationError):
            log.delete()

    def test_audit_api_is_readonly(self):
        log = log_user_action(
            actor=self.root, action=AuditLog.Action.CREATE, target=self.doctor
        )
        self.client.force_authenticate(self.root)
        read = self.client.get(f"/api/audit/{log.pk}/")
        self.assertEqual(read.status_code, 200)
        patch = self.client.patch(
            f"/api/audit/{log.pk}/", {"action": "UPDATE"}, format="json"
        )
        self.assertIn(patch.status_code, (403, 405))
        delete = self.client.delete(f"/api/audit/{log.pk}/")
        self.assertIn(delete.status_code, (403, 405))
