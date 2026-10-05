import django_filters
from rest_framework import serializers, viewsets
from django.db import transaction
from django.db.models import F, Sum
from django.db.models.functions import Coalesce

from users.roles import CASHIER, DOCTOR, PHARMACIST, RECEPTIONIST

from .models import Medication, MedicationBatch, StockMovement
from .serializers import (
    MedicationSerializer,
    MedicationBatchSerializer,
    StockMovementSerializer,
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

    # current_stock = somme des quantités de tous les lots du médicament
    queryset = Medication.objects.annotate(
        current_stock=Coalesce(Sum("batches__quantity"), 0)
    )

    serializer_class = MedicationSerializer

    read_roles = [DOCTOR, PHARMACIST, RECEPTIONIST, CASHIER]
    write_roles = [PHARMACIST]

    filterset_class = MedicationFilter
    search_fields = ["name", "generic_name", "manufacturer"]
    ordering_fields = ["id", "name", "unit_price", "current_stock"]
    ordering = ["name"]


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
        movement = serializer.save(performed_by=self.request.user)
        if movement.batch_id:
            delta = movement.quantity
            if movement.movement_type in ("OUT", "EXPIRED", "DAMAGED"):
                delta = -delta
            batch = (
                type(movement.batch)
                .objects.select_for_update()
                .get(pk=movement.batch_id)
            )
            if batch.quantity + delta < 0:
                raise serializers.ValidationError("Insufficient batch stock.")
            batch.quantity = F("quantity") + delta
            batch.save(update_fields=["quantity"])
