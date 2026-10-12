from rest_framework import serializers

from users.numbering import AutoNumberMixin
from users.validators import validate_date_of_birth, validate_phone

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

        # Sexe et âge obligatoires pour toute écriture : indispensables aux
        # études cliniques et aux statistiques (le modèle reste tolérant pour
        # l'insertion interne via ORM, l'API est la seule porte d'entrée).
        extra_kwargs = {
            "gender": {"required": True, "allow_blank": False},
            "date_of_birth": {"required": True, "allow_null": False},
        }

    def validate_date_of_birth(self, value):
        try:
            return validate_date_of_birth(value)
        except Exception as e:
            raise serializers.ValidationError(getattr(e, "messages", [str(e)]))

    def validate_phone(self, value):
        try:
            return validate_phone(value)
        except Exception as e:
            raise serializers.ValidationError(getattr(e, "messages", [str(e)]))

    def validate_emergency_contact_phone(self, value):
        try:
            return validate_phone(value)
        except Exception as e:
            raise serializers.ValidationError(getattr(e, "messages", [str(e)]))