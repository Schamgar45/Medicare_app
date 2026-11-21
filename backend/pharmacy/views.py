import django_filters
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F, Q, Sum
from django.db.models.deletion import RestrictedError
from django.db.models.functions import Coalesce
from django.utils import timezone
from users.models import User

from users.roles import CASHIER, DOCTOR, PHARMACIST, RECEPTIONIST
from notifications.models import Notification
from notifications.service import send_notification

from .models import Medication, MedicationBatch, StockMovement
from .serializers import (
    MedicationSerializer,
    MedicationBatchSerializer,
    StockMovementSerializer,
)


def _current_stock(medication_id):
    return (
        MedicationBatch.objects.filter(medication_id=medication_id)
        .filter(
            Q(expiration_date__isnull=True)
            | Q(expiration_date__gte=timezone.localdate())
        )
        .aggregate(total=Sum("quantity"))["total"]
        or 0
    )


def _notify_if_stock_became_low(medication, was_low):
    current_stock = _current_stock(medication.pk)
    if was_low or current_stock > medication.minimum_stock:
        return

    users = User.objects.filter(
        role=PHARMACIST,
        status=User.Status.ACTIVE,
    )
    for user in users:
        send_notification(
            user=user,
            title="Stock bas",
            message=(
                f"Le stock de {medication.name} est bas : "
                f"{current_stock} unité(s) restante(s), "
                f"seuil minimum {medication.minimum_stock}."
            ),
            notif_type=Notification.Type.LOW_STOCK,
        )


class MedicationFilter(django_filters.FilterSet):
    # GET /api/medications/?low_stock=true  -> médicaments sous leur seuil minimum
    low_stock = django_filters.BooleanFilter(method="filter_low_stock")

    class Meta:
        model = Medication
        fields = ["is_active", "form"]

    def filter_low_stock(self, queryset, name, value):
        low = queryset.filter(current_stock__lte=F("minimum_stock"))
        return low if value else queryset.exclude(pk__in=low.values("pk"))


class MedicationViewSet(viewsets.ModelViewSet):

    serializer_class = MedicationSerializer

    read_roles = [DOCTOR, PHARMACIST, RECEPTIONIST, CASHIER]
    write_roles = [PHARMACIST]

    filterset_class = MedicationFilter
    search_fields = ["name", "generic_name", "manufacturer"]
    ordering_fields = ["id", "name", "unit_price", "current_stock"]
    ordering = ["name"]

    def get_queryset(self):
        # Calculé par requête afin que la date d'expiration reste juste après minuit.
        return Medication.objects.annotate(
            current_stock=Coalesce(
                Sum(
                    "batches__quantity",
                    filter=Q(batches__expiration_date__isnull=True)
                    | Q(batches__expiration_date__gte=timezone.localdate()),
                ),
                0,
            )
        )

    @transaction.atomic
    def perform_update(self, serializer):
        medication = serializer.instance
        was_low = _current_stock(medication.pk) <= medication.minimum_stock
        medication = serializer.save()
        _notify_if_stock_became_low(medication, was_low)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except RestrictedError as exc:
            return Response(
                {
                    "detail": (
                        "Impossible de supprimer ce médicament : "
                        f"{self._restricted_error_message(exc)}"
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _restricted_error_message(exc):
        """
        Construit un message lisible listant les objets qui bloquent la
        suppression (foreign keys with on_delete=RESTRICT).
        """
        # exc.args est (message, ensemble_des_objets_bloquants)
        blocked = ()
        for candidate in exc.args:
            if isinstance(candidate, (set, list, tuple)) and candidate:
                first = next(iter(candidate))
                if not isinstance(first, str):
                    blocked = candidate
                    break

        labels = {
            "prescriptionitem": "élément de prescription",
            "stockmovement": "mouvement de stock",
        }
        counts = {}
        for obj in blocked:
            key = labels.get(obj._meta.model_name, obj._meta.model_name)
            counts[key] = counts.get(key, 0) + 1

        parts = [
            f"{count} {label}" + ("s" if count > 1 else "")
            for label, count in counts.items()
        ]

        if not parts:
            return "des dépendances bloquent toujours sa suppression."
        return (
            "il est encore référencé par " + " et ".join(parts)
            + ". Supprimez ces dépendances avant de pouvoir supprimer le médicament."
        )


class MedicationBatchViewSet(viewsets.ModelViewSet):

    queryset = MedicationBatch.objects.select_related("medication")

    serializer_class = MedicationBatchSerializer

    read_roles = [PHARMACIST]
    write_roles = [PHARMACIST]

    filterset_fields = {
        "medication": ["exact"],
        "expiration_date": ["gte", "lte"],
    }
    search_fields = ["batch_number", "medication__name"]
    ordering_fields = ["id", "expiration_date", "quantity"]
    ordering = ["expiration_date"]

    @transaction.atomic
    def perform_create(self, serializer):
        medication = serializer.validated_data["medication"]
        was_low = _current_stock(medication.pk) <= medication.minimum_stock
        batch = serializer.save()
        if batch.quantity:
            StockMovement.objects.create(
                medication=batch.medication,
                batch=batch,
                movement_type=StockMovement.MovementType.IN,
                quantity=batch.quantity,
                reason="Stock initial du lot",
                performed_by=self.request.user,
            )
        _notify_if_stock_became_low(batch.medication, was_low)

    @transaction.atomic
    def perform_update(self, serializer):
        batch = type(serializer.instance).objects.select_for_update().get(
            pk=serializer.instance.pk
        )
        next_medication = serializer.validated_data.get("medication", batch.medication)
        if next_medication.pk != batch.medication_id and (
            batch.quantity or batch.stock_movements.exists()
        ):
            raise serializers.ValidationError(
                "Un lot avec du stock ou un historique ne peut pas changer de médicament."
            )
        previous_quantity = batch.quantity
        was_low = (
            _current_stock(next_medication.pk) <= next_medication.minimum_stock
        )
        serializer.instance = batch
        batch = serializer.save()
        difference = batch.quantity - previous_quantity
        if difference:
            StockMovement.objects.create(
                medication=batch.medication,
                batch=batch,
                movement_type=(
                    StockMovement.MovementType.IN
                    if difference > 0
                    else StockMovement.MovementType.OUT
                ),
                quantity=abs(difference),
                reason="Ajustement manuel du lot",
                performed_by=self.request.user,
            )
        _notify_if_stock_became_low(batch.medication, was_low)

    @transaction.atomic
    def perform_destroy(self, instance):
        batch = type(instance).objects.select_for_update().get(pk=instance.pk)
        if batch.quantity or batch.stock_movements.exists():
            raise serializers.ValidationError(
                "Impossible de supprimer un lot avec du stock ou des mouvements."
            )
        batch.delete()


class StockMovementViewSet(viewsets.ModelViewSet):

    queryset = StockMovement.objects.select_related("medication", "batch")

    serializer_class = StockMovementSerializer

    read_roles = [PHARMACIST]
    write_roles = [PHARMACIST]

    filterset_fields = {
        "medication": ["exact"],
        "batch": ["exact"],
        "movement_type": ["exact"],
        "movement_date": ["gte", "lte"],
    }
    search_fields = ["medication__name", "reference", "reason"]
    ordering_fields = ["id", "movement_date"]
    ordering = ["-movement_date"]

    def update(self, request, *args, **kwargs):
        return self.http_method_not_allowed(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.http_method_not_allowed(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return self.http_method_not_allowed(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        medication = serializer.validated_data["medication"]
        was_low = _current_stock(medication.pk) <= medication.minimum_stock
        movement = serializer.save(performed_by=self.request.user)
        batch = (
            type(movement.batch)
            .objects.select_for_update()
            .get(pk=movement.batch_id)
        )
        delta = movement.quantity
        if movement.movement_type in ("OUT", "EXPIRED", "DAMAGED"):
            delta = -delta
        if batch.quantity + delta < 0:
            raise serializers.ValidationError("Insufficient batch stock.")
        batch.quantity = F("quantity") + delta
        batch.save(update_fields=["quantity"])
        _notify_if_stock_became_low(movement.medication, was_low)
