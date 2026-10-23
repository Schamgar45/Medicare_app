"""Résumés en lecture seule (patient, médecin, département) pour l'impression des documents."""

from rest_framework import serializers

from doctor.models import Doctor
from patients.models import Patient
from services.models import MedicalService


class ServiceBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalService
        fields = ["id", "name", "theme_color"]
        read_only_fields = fields


class PatientBriefSerializer(serializers.ModelSerializer):
    """Identité complète pour l'en-tête d'un document (l'âge se calcule avec date_of_birth)."""

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
        ]
        read_only_fields = fields


class DoctorBriefSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    service_detail = ServiceBriefSerializer(source="service", read_only=True)

    def get_name(self, obj) -> str | None:
        return obj.user.get_full_name() or obj.user.username

    class Meta:
        model = Doctor
        fields = ["id", "name", "registration_number", "service_detail"]
        read_only_fields = fields
