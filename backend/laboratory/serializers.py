from rest_framework import serializers

from users.numbering import AutoNumberMixin

from users.brief import PatientBriefSerializer

from .models import LabRequest, LabResult, LabTest


class LabTestSerializer(serializers.ModelSerializer):

    class Meta:
        model = LabTest

        fields = [
            "id",
            "name",
            "description",
            "price",
            "normal_range",
            "is_active",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


class LabTestBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTest
        fields = ["id", "name", "normal_range"]
        read_only_fields = fields


def _doctor_name(doctor):
    if doctor is None:
        return None
    user = doctor.user
    return user.get_full_name() or user.username


class LabRequestSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "request_number"
    number_prefix = "EXA"
    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    lab_test_detail = LabTestBriefSerializer(source="lab_test", read_only=True)
    doctor_name = serializers.SerializerMethodField()

    def get_doctor_name(self, obj):
        return _doctor_name(obj.doctor)

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
        model = LabRequest

        fields = [
            "id",
            "request_number",
            "consultation",
            "patient",
            "patient_detail",
            "doctor",
            "doctor_name",
            "lab_test",
            "lab_test_detail",
            "priority",
            "clinical_information",
            "status",
            "requested_at",
            "sample_collected_at",
            "completed_at",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "requested_at",
            "sample_collected_at",
            "completed_at",
            "created_at",
        ]


class LabResultSerializer(serializers.ModelSerializer):
    request_detail = LabRequestSerializer(source="lab_request", read_only=True)
    validated_by_name = serializers.SerializerMethodField()

    def get_validated_by_name(self, obj):
        user = obj.validated_by
        if user is None:
            return None
        return user.get_full_name() or user.username

    def validate_lab_request(self, value):
        if value.status in (LabRequest.Status.CANCELLED, LabRequest.Status.VALIDATED):
            raise serializers.ValidationError(
                "Cette demande est annulée ou déjà validée : aucun résultat ne peut être ajouté."
            )
        return value

    class Meta:
        model = LabResult

        fields = [
            "id",
            "lab_request",
            "request_detail",
            "result",
            "comment",
            "validated_by",
            "validated_by_name",
            "result_date",
            "validated_at",
        ]

        read_only_fields = [
            "id",
            "validated_by",
            "result_date",
            "validated_at",
        ]
