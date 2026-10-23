from django.db.models import Sum
from rest_framework import serializers

from .models import Medication, MedicationBatch, StockMovement


class MedicationSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()

    def get_current_stock(self, obj) -> int:
        # Valeur annotée par MedicationViewSet.queryset ; sinon (réponse d'un POST/PATCH) on la calcule.
        value = getattr(obj, "current_stock", None)
        if value is None:
            value = obj.batches.aggregate(total=Sum("quantity"))["total"] or 0
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
            "quantity",
            "created_at",
        ]


class StockMovementSerializer(serializers.ModelSerializer):

    medication_name = serializers.CharField(source="medication.name", read_only=True)

    def validate(self, attrs):
        batch = attrs.get("batch")
        medication = attrs.get("medication")
        if batch and medication and batch.medication_id != medication.id:
            raise serializers.ValidationError(
                {"batch": "Batch must belong to the selected medication."}
            )
        return attrs

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
