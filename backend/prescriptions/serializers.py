from rest_framework import serializers

from users.numbering import AutoNumberMixin

from users.brief import DoctorBriefSerializer, PatientBriefSerializer

from .models import Prescription, PrescriptionItem


class PrescriptionItemSerializer(serializers.ModelSerializer):

    medication_name = serializers.CharField(source="medication.name", read_only=True)

    def validate_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value

    def validate_dispensed_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Dispensed quantity cannot be negative.")
        return value

    class Meta:
        model = PrescriptionItem

        fields = [
            "id",
            "prescription",
            "medication",
            "medication_name",
            "dosage",
            "frequency",
            "duration",
            "quantity",
            "instructions",
            "dispensed_quantity",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "dispensed_quantity",
            "created_at",
        ]


class PrescriptionSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "prescription_number"
    number_prefix = "ORD"

    items = PrescriptionItemSerializer(many=True, read_only=True)
    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    doctor_detail = DoctorBriefSerializer(source="doctor", read_only=True)

    def validate(self, attrs):
        consultation = attrs.get("consultation")
        patient = attrs.get("patient")
        doctor = attrs.get("doctor")
        if consultation:
            if patient and consultation.patient_id != patient.id:
                raise serializers.ValidationError(
                    {"patient": "Patient must match the consultation."}
                )
            if doctor and consultation.doctor_id != doctor.id:
                raise serializers.ValidationError(
                    {"doctor": "Doctor must match the consultation."}
                )
        return attrs

    class Meta:
        model = Prescription

        fields = [
            "id",
            "prescription_number",
            "consultation",
            "patient",
            "patient_detail",
            "doctor",
            "doctor_detail",
            "prescription_date",
            "instructions",
            "status",
            "items",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "prescription_date",
            "created_at",
            "updated_at",
        ]
