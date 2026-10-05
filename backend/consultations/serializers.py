from rest_framework import serializers

from users.numbering import AutoNumberMixin

from users.brief import DoctorBriefSerializer, PatientBriefSerializer

from .models import Consultation


class ConsultationSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "consultation_number"
    number_prefix = "CONS"

    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    doctor_detail = DoctorBriefSerializer(source="doctor", read_only=True)

    def validate(self, attrs):
        appointment = attrs.get("appointment")
        patient = attrs.get("patient")
        doctor = attrs.get("doctor")

        if appointment:
            if patient and appointment.patient_id != patient.id:
                raise serializers.ValidationError(
                    {"patient": "Patient must match the appointment."}
                )
            if doctor and appointment.doctor_id != doctor.id:
                raise serializers.ValidationError(
                    {"doctor": "Doctor must match the appointment."}
                )
        return attrs

    class Meta:
        model = Consultation

        fields = [
            "id",
            "consultation_number",
            "patient",
            "patient_detail",
            "doctor",
            "doctor_detail",
            "appointment",
            "consultation_date",
            "reason",
            "symptoms",
            "temperature",
            "weight",
            "height",
            "blood_pressure",
            "heart_rate",
            "diagnosis",
            "observations",
            "treatment_plan",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "consultation_date",
            "created_at",
            "updated_at",
        ]
