from django.core.exceptions import ValidationError as ModelValidationError
from django.db import models
from users.models import User


class AuditLog(models.Model):
    """Trace append-only des actions sensibles (comptes utilisateurs...).

    Lecture seule : même un superuser ne peut ni modifier ni supprimer une
    ligne, ni via l'API (ReadOnly), ni via /admin/ (permissions refusées),
    ni via l'ORM (save/update/delete verrouillés). Seule la création est
    autorisée, depuis le code (audit/services.py).
    """

    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        PROMOTE = "PROMOTE", "Promote"
        DEMOTE = "DEMOTE", "Demote"
        DEACTIVATE = "DEACTIVATE", "Deactivate"
        ACTIVATE = "ACTIVATE", "Activate"
        SUSPEND = "SUSPEND", "Suspend"
        DELETE = "DELETE", "Delete"

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="Acteur de l'action (qui a fait).",
    )

    action = models.CharField(max_length=100)

    table_name = models.CharField(max_length=100, blank=True)

    record_id = models.BigIntegerField(null=True, blank=True)

    old_data = models.JSONField(null=True, blank=True)

    new_data = models.JSONField(null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)

    user_agent = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Pas de add/change/delete via l'admin : lecture seule même pour le superadmin.
        default_permissions = ("view",)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ModelValidationError("Les lignes d'audit sont immuables (readonly).")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ModelValidationError("Les lignes d'audit ne peuvent pas être supprimées.")

    def __str__(self):
        return f"{self.action} - {self.table_name} - {self.record_id}"
