# Create your views here.
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from notifications.models import Notification
from users.roles import DOCTOR, LABORANT
from users.scoping import DoctorScopedMixin, scoped_doctor

from .models import LabTest, LabRequest, LabResult
from .serializers import (
    LabTestSerializer,
    LabRequestSerializer,
    LabResultSerializer,
)

Status = LabRequest.Status


class LabTestViewSet(viewsets.ModelViewSet):

    queryset = LabTest.objects.all()

    serializer_class = LabTestSerializer

    read_roles = [DOCTOR, LABORANT]
    write_roles = [LABORANT]

    filterset_fields = ["is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["id", "name", "price"]
    ordering = ["name"]


class LabRequestViewSet(DoctorScopedMixin, viewsets.ModelViewSet):
    """Demande d'examen. Le résultat arrive souvent un autre jour : l'examen est donc suivi par
    statut (REQUESTED -> SAMPLE_COLLECTED -> IN_PROGRESS -> RESULT_AVAILABLE -> VALIDATED).

    Le laboratoire fait avancer le statut jusqu'à IN_PROGRESS ; RESULT_AVAILABLE et VALIDATED
    sont posés automatiquement par le résultat. Un médecin peut seulement annuler sa demande.
    """

    queryset = LabRequest.objects.select_related("patient", "doctor__user", "lab_test")

    serializer_class = LabRequestSerializer

    doctor_lookup = "doctor"
    doctor_owned_relations = {"consultation": "doctor"}

    read_roles = [DOCTOR, LABORANT]
    write_roles = [DOCTOR, LABORANT]

    filterset_fields = {
        "status": ["exact"],
        "priority": ["exact"],
        "doctor": ["exact"],
        "patient": ["exact"],
        "consultation": ["exact"],
        "lab_test": ["exact"],
        "requested_at": ["gte", "lte"],
    }
    search_fields = [
        "request_number",
        "patient__first_name",
        "patient__last_name",
        "lab_test__name",
    ]
    ordering_fields = ["id", "requested_at", "priority"]
    ordering = ["-requested_at"]

    def perform_update(self, serializer):
        instance = serializer.instance
        new_status = serializer.validated_data.get("status")

        if new_status and new_status != instance.status:
            if instance.status == Status.VALIDATED:
                raise ValidationError({"status": "Cet examen est déjà validé."})
            if new_status in (Status.RESULT_AVAILABLE, Status.VALIDATED):
                raise ValidationError(
                    {"status": "Ce statut change automatiquement avec le résultat."}
                )
            is_doctor, _ = scoped_doctor(self.request.user)
            if is_doctor and new_status != Status.CANCELLED:
                raise PermissionDenied("Seul le laboratoire fait avancer un examen.")

        super().perform_update(serializer)

        if new_status == Status.SAMPLE_COLLECTED and instance.sample_collected_at is None:
            instance.sample_collected_at = timezone.now()
            instance.save(update_fields=["sample_collected_at"])


class LabResultViewSet(DoctorScopedMixin, viewsets.ModelViewSet):
    """Résultat d'examen. Saisi par le laboratoire (l'examen passe à RESULT_AVAILABLE), puis
    validé par POST /lab/results/{id}/validate/ : on enregistre qui a validé et quand, et le
    médecin demandeur reçoit une notification."""

    queryset = LabResult.objects.select_related(
        "validated_by",
        "lab_request__patient",
        "lab_request__doctor__user",
        "lab_request__lab_test",
    )
    serializer_class = LabResultSerializer

    doctor_lookup = "lab_request__doctor"  # le médecin lit les résultats de ses demandes

    read_roles = [DOCTOR, LABORANT]
    write_roles = [LABORANT]

    filterset_fields = {
        "lab_request": ["exact"],
        "lab_request__status": ["exact"],
        "lab_request__patient": ["exact"],
        "result_date": ["gte", "lte"],
        "validated_at": ["gte", "lte", "isnull"],
    }
    ordering_fields = ["id", "result_date", "validated_at"]
    ordering = ["-result_date"]

    @transaction.atomic
    def perform_create(self, serializer):
        result = serializer.save()
        lab_request = result.lab_request
        if lab_request.status in (Status.REQUESTED, Status.SAMPLE_COLLECTED, Status.IN_PROGRESS):
            lab_request.status = Status.RESULT_AVAILABLE
            lab_request.save(update_fields=["status"])

    def perform_update(self, serializer):
        if serializer.instance.validated_at:
            raise ValidationError("Résultat déjà validé : il ne peut plus être modifié.")
        super().perform_update(serializer)

    @extend_schema(request=None, responses=LabResultSerializer)
    @action(detail=True, methods=["post"], url_path="validate")
    def validate_result(self, request, pk=None):
        """Valide le résultat (laboratoire) et prévient le médecin qui a fait la demande."""
        with transaction.atomic():
            result = self.get_object()
            if result.validated_at:
                raise ValidationError("Ce résultat est déjà validé.")

            now = timezone.now()
            result.validated_by = request.user
            result.validated_at = now
            result.save(update_fields=["validated_by", "validated_at"])

            lab_request = result.lab_request
            lab_request.status = Status.VALIDATED
            lab_request.completed_at = now
            lab_request.save(update_fields=["status", "completed_at"])

            patient = lab_request.patient
            Notification.objects.create(
                user=lab_request.doctor.user,
                title="Résultat d'examen disponible",
                message=(
                    f"Le résultat de « {lab_request.lab_test.name} » pour "
                    f"{patient.first_name} {patient.last_name} "
                    f"({lab_request.request_number}) est validé."
                ),
                type="LAB_RESULT",
            )
        return Response(self.get_serializer(result).data)
