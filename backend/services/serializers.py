from rest_framework import serializers
from .models import MedicalService


class MedicalServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalService
        fields = [
            "id",
            "name",
            "description",
            "price",
            "is_active",
            "theme_color",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
