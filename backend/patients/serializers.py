from rest_framework import serializers

from users.numbering import AutoNumberMixin

from .models import Patient


class PatientSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "patient_number"
    number_prefix = "PAT"

    class Meta:
        model = Patient

        fields = [
            "id",
            "patient_number",
            "first_name",
            "last_name",
            "gender",
            "date_of_birth",
            "phone",
            "email",
            "address",
            "blood_group",
            "allergies",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]