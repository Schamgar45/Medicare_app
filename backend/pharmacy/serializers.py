from django.db.models import Q, Sum
from rest_framework import serializers
from django.utils import timezone

from .models import Medication, MedicationBatch, StockMovement


class MedicationSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()

    def get_current_stock(self, obj) -> int:
        # Valeur annotée par MedicationViewSet.queryset ; sinon (réponse d'un POST/PATCH) on la calcule.
        value = getattr(obj, "current_stock", None)
        if value is None:
            value = obj.batches.filter(
                Q(expiration_date__isnull=True)
                | Q(expiration_date__gte=timezone.localdate())
            ).aggregate(total=Sum("quantity"))["total"] or 0
        return value

    def get_is_low_stock(self, obj) -> bool:
        return self.get_current_stock(obj) <= obj.minimum_stock

    class Meta:
        model = Medication

        fields = [
            "id",
            "name",
            "generic_name",
            "form",
            "dosage",
            "manufacturer",
            "unit",
            "minimum_stock",
            "unit_price",
            "is_active",
            "current_stock",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class MedicationBatchSerializer(serializers.ModelSerializer):

    medication_name = serializers.CharField(source="medication.name", read_only=True)

    class Meta:
        model = MedicationBatch

        fields = [
            "id",
            "medication",
            "medication_name",
            "batch_number",
            "expiration_date",
            "quantity",
            "purchase_price",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


class StockMovementSerializer(serializers.ModelSerializer):

    medication_name = serializers.CharField(source="medication.name", read_only=True)

    def validate(self, attrs):
        batch = attrs.get("batch")
        medication = attrs.get("medication")
        movement_type = attrs.get(
            "movement_type", getattr(self.instance, "movement_type", None)
        )
        if batch is None and self.instance is None:
            raise serializers.ValidationError(
                {"batch": "Sélectionnez un lot pour tracer ce mouvement de stock."}
            )
        if batch and medication and batch.medication_id != medication.id:
            raise serializers.ValidationError(
                {"batch": "Batch must belong to the selected medication."}
            )
        if (
            batch
            and movement_type in (StockMovement.MovementType.IN, StockMovement.MovementType.RETURN)
            and batch.expiration_date is not None
            and batch.expiration_date < timezone.localdate()
        ):
            raise serializers.ValidationError(
                {"batch": "Un lot périmé ne peut pas recevoir de stock utilisable."}
            )
        if (
            batch
            and movement_type == StockMovement.MovementType.OUT
            and batch.expiration_date is not None
            and batch.expiration_date < timezone.localdate()
        ):
            raise serializers.ValidationError(
                {"batch": "Un lot périmé ne peut pas être délivré."}
            )
        return attrs

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à zéro.")
        return value

    class Meta:
        model = StockMovement

        fields = [
            "id",
            "medication",
            "medication_name",
            "batch",
            "movement_type",
            "quantity",
            "reason",
            "reference",
            "performed_by",
            "movement_date",
        ]

        read_only_fields = [
            "id",
            "performed_by",
            "movement_date",
        ]
