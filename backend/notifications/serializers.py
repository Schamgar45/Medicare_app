from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):

    class Meta:
        model = Notification

        fields = [
            "id",
            "user",
            "title",
            "message",
            "type",
            "channel",
            "is_read",
            "sent_email",
            "sent_sms",
            "sent_at",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "user",
            "channel",
            "sent_email",
            "sent_sms",
            "sent_at",
            "created_at",
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):

    class Meta:
        model = NotificationPreference

        fields = [
            "id",
            "user",
            "lab_result",
            "low_stock",
            "appointment",
            "payment",
            "invoice",
            "system",
            "email_enabled",
            "sms_enabled",
            "email_address",
            "phone_number",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "user",
            "created_at",
            "updated_at",
        ]
