from rest_framework import serializers

from .models import MedicalHistory


class MedicalHistorySerializer(serializers.ModelSerializer):

    class Meta:
        model = MedicalHistory

        fields = [
            "id",
            "patient",
            "title",
            "description",
            "diagnosed_date",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]
