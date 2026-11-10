from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from users.roles import DOCTOR, PHARMACIST
from users.scoping import DoctorScopedMixin

from .models import Prescription, PrescriptionItem
from .serializers import (
    PrescriptionSerializer,
    PrescriptionItemSerializer,
)

# Le pharmacien doit pouvoir marquer une ordonnance comme délivrée
# (status, dispensed_quantity), d'où son droit d'écriture.
PRESCRIPTION_READ = [DOCTOR, PHARMACIST]
PRESCRIPTION_WRITE = [DOCTOR, PHARMACIST]


class PrescriptionViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = Prescription.objects.select_related(
        "patient", "doctor__user", "doctor__service"
    ).prefetch_related("items__medication")

    serializer_class = PrescriptionSerializer

    doctor_lookup = "doctor"
    doctor_owned_relations = {"consultation": "doctor"}

    read_roles = PRESCRIPTION_READ
    write_roles = PRESCRIPTION_WRITE

    filterset_fields = ["status", "doctor", "patient", "consultation"]
    search_fields = [
        "prescription_number",
        "patient__first_name",
        "patient__last_name",
    ]
    ordering_fields = ["id", "prescription_date"]
    ordering = ["-prescription_date"]

    def perform_update(self, serializer):
        status = serializer.validated_data.get("status")
        if status in (
            Prescription.Status.PARTIALLY_DISPENSED,
            Prescription.Status.DISPENSED,
        ):
            raise ValidationError(
                {"status": "Utilisez l'action de délivrance pour saisir les quantités."}
            )
        serializer.save()

    @action(detail=True, methods=["post"], url_path="dispense")
    def dispense(self, request, pk=None):
        prescription = self.get_object()
        if request.user.role != PHARMACIST:
            raise PermissionDenied("Seul le pharmacien peut délivrer une ordonnance.")

        target_status = request.data.get("status")
        if target_status not in (
            Prescription.Status.PARTIALLY_DISPENSED,
            Prescription.Status.DISPENSED,
        ):
            raise ValidationError({"status": "Statut de délivrance invalide."})
        if prescription.status not in (
            Prescription.Status.VALIDATED,
            Prescription.Status.PARTIALLY_DISPENSED,
        ):
            raise ValidationError(
                {"status": "Seule une ordonnance validée peut être délivrée."}
            )

        with transaction.atomic():
            prescription = Prescription.objects.select_for_update().get(
                pk=prescription.pk
            )
            if prescription.status not in (
                Prescription.Status.VALIDATED,
                Prescription.Status.PARTIALLY_DISPENSED,
            ):
                raise ValidationError(
                    {"status": "Seule une ordonnance validée peut être délivrée."}
                )
            items = list(
                PrescriptionItem.objects.select_for_update()
                .filter(prescription=prescription)
                .order_by("id")
            )
            if not items:
                raise ValidationError("Ajoutez au moins un médicament avant la délivrance.")

            if target_status == Prescription.Status.DISPENSED:
                quantities = {item.id: item.quantity for item in items}
            else:
                submitted_items = request.data.get("items")
                if not isinstance(submitted_items, list):
                    raise ValidationError(
                        {"items": "Indiquez les quantités réellement délivrées."}
                    )
                quantities = {}
                for submitted in submitted_items:
                    if not isinstance(submitted, dict):
                        raise ValidationError({"items": "Format de ligne invalide."})
                    item_id = submitted.get("id")
                    quantity = submitted.get("dispensed_quantity")
                    if not isinstance(item_id, int) or isinstance(item_id, bool):
                        raise ValidationError({"items": "Identifiant de ligne invalide."})
                    if item_id in quantities:
                        raise ValidationError({"items": "Une ligne est répétée."})
                    quantities[item_id] = quantity
                if set(quantities) != {item.id for item in items}:
                    raise ValidationError(
                        {"items": "Fournissez une quantité pour chaque médicament."}
                    )

            dispensed_total = 0
            for item in items:
                quantity = quantities[item.id]
                if item.quantity is None:
                    raise ValidationError(
                        {
                            "items": (
                                f"La quantité prescrite est absente pour "
                                f"{item.medication.name}."
                            )
                        }
                    )
                if (
                    not isinstance(quantity, int)
                    or isinstance(quantity, bool)
                    or quantity < 0
                    or quantity > item.quantity
                    or quantity < item.dispensed_quantity
                ):
                    raise ValidationError(
                        {
                            "items": (
                                f"Quantité délivrée invalide pour "
                                f"{item.medication.name}."
                            )
                        }
                    )
                item.dispensed_quantity = quantity
                item.save(update_fields=["dispensed_quantity"])
                dispensed_total += quantity

            if dispensed_total == 0:
                raise ValidationError(
                    {"items": "La quantité délivrée doit être supérieure à zéro."}
                )

            prescription.status = target_status
            prescription.save(update_fields=["status", "updated_at"])

        return Response(self.get_serializer(prescription).data)


class PrescriptionItemViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = PrescriptionItem.objects.select_related("medication")

    serializer_class = PrescriptionItemSerializer

    doctor_lookup = "prescription__doctor"
    doctor_owned_relations = {"prescription": "doctor"}
    doctor_must_be_self = ()
    doctor_visible_patient_fields = ()

    read_roles = PRESCRIPTION_READ
    write_roles = PRESCRIPTION_WRITE

    filterset_fields = ["prescription", "medication"]
    ordering = ["id"]
