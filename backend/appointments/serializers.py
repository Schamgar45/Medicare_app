from datetime import datetime

from django.utils import timezone
from rest_framework import serializers

from users.numbering import AutoNumberMixin

from users.brief import (
    DoctorBriefSerializer,
    PatientBriefSerializer,
    ServiceBriefSerializer,
)

from .models import Appointment


class AppointmentSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "appointment_number"
    number_prefix = "RDV"

    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    doctor_detail = DoctorBriefSerializer(source="doctor", read_only=True)
    service_detail = ServiceBriefSerializer(source="service", read_only=True)

    class Meta:
        model = Appointment

        fields = [
            "id",
            "appointment_number",
            "patient",
            "patient_detail",
            "doctor",
            "doctor_detail",
            "service",
            "service_detail",
            "appointment_date",
            "appointment_time",
            "reason",
            "status",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        """Empêche la création ou le déplacement d'un rendez-vous dans le passé.

        La vérification est faite côté API, donc elle s'applique aussi aux appels
        directs, indépendamment de la borne affichée dans le formulaire. Une mise
        à jour de statut ou de notes d'un ancien rendez-vous reste toutefois
        possible : elle ne modifie pas sa date ni son heure.
        """
        is_creating = self.instance is None
        changes_schedule = "appointment_date" in attrs or "appointment_time" in attrs
        if not (is_creating or changes_schedule):
            return attrs

        appointment_date = attrs.get(
            "appointment_date", getattr(self.instance, "appointment_date", None)
        )
        appointment_time = attrs.get(
            "appointment_time", getattr(self.instance, "appointment_time", None)
        )
        if appointment_date is None or appointment_time is None:
            return attrs

        scheduled_at = timezone.make_aware(
            datetime.combine(appointment_date, appointment_time),
            timezone.get_current_timezone(),
        )
        if scheduled_at < timezone.now():
            raise serializers.ValidationError(
                {"appointment_date": "Un rendez-vous ne peut pas être programmé dans le passé."}
            )
        return attrs
