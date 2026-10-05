from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):

    class Meta:
        model = AuditLog

        fields = [
            "id",
            "user",
            "action",
            "table_name",
            "record_id",
            "old_data",
            "new_data",
            "ip_address",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]