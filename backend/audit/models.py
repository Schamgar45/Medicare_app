from django.db import models
from users.models import User


class AuditLog(models.Model):

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )

    action = models.CharField(
        max_length=100
    )

    table_name = models.CharField(
        max_length=100,
        blank=True
    )

    record_id = models.BigIntegerField(
        null=True,
        blank=True
    )

    old_data = models.JSONField(
        null=True,
        blank=True
    )

    new_data = models.JSONField(
        null=True,
        blank=True
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.action} - {self.table_name} - {self.record_id}"