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
