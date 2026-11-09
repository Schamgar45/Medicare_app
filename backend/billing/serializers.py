from rest_framework import serializers

from users.numbering import AutoNumberMixin

from patients.models import Patient
from services.models import MedicalService

from .models import (
    BillingItem,
    Invoice,
    InvoiceItem,
    Payment,
)


class BillingItemSerializer(serializers.ModelSerializer):

    class Meta:
        model = BillingItem

        fields = [
            "id",
            "name",
            "description",
            "category",
            "price",
            "is_active",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


class InvoiceItemSerializer(serializers.ModelSerializer):

    class Meta:
        model = InvoiceItem

        fields = [
            "id",
            "invoice",
            "billing_item",
            "medication",
            "description",
            "quantity",
            "unit_price",
            "total",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "total",
            "created_at",
        ]

    def validate(self, attrs):
        billing_item = attrs.get("billing_item")
        medication = attrs.get("medication")
        unit_price = attrs.get("unit_price")
        description = attrs.get("description")

        # Auto-remplir le prix et la désignation depuis un acte du catalogue
        if billing_item and not unit_price:
            attrs["unit_price"] = billing_item.price
        if billing_item and not description:
            attrs["description"] = billing_item.name

        # Auto-remplir le prix et la désignation depuis un médicament
        if medication and not unit_price:
            attrs["unit_price"] = medication.unit_price
        if medication and not description:
            attrs["description"] = medication.name

        if not description:
            raise serializers.ValidationError(
                {"description": "Indiquez une désignation, un acte ou un médicament."}
            )
        if unit_price is None:
            attrs["unit_price"] = 0

        return attrs


class InvoicePatientSerializer(serializers.ModelSerializer):
    """Identité du patient telle qu'elle s'imprime sur la facture."""

    class Meta:
        model = Patient
        fields = ["id", "patient_number", "first_name", "last_name", "phone"]
        read_only_fields = fields


class InvoiceServiceSerializer(serializers.ModelSerializer):
    """Département : le nom et la couleur du cachet viennent d'ici."""

    class Meta:
        model = MedicalService
        fields = ["id", "name", "theme_color"]
        read_only_fields = fields


class InvoiceSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "invoice_number"
    number_prefix = "FAC"

    items = InvoiceItemSerializer(many=True, read_only=True)
    patient_detail = InvoicePatientSerializer(source="patient", read_only=True)
    service_detail = InvoiceServiceSerializer(source="service", read_only=True)

    def validate_service(self, value):
        if value is not None and not value.is_active:
            raise serializers.ValidationError("Ce département n'est plus actif.")
        return value

    class Meta:
        model = Invoice

        fields = [
            "id",
            "invoice_number",
            "patient",
            "patient_detail",
            "service",
            "service_detail",
            "subtotal",
            "discount",
            "tax",
            "total",
            "amount_paid",
            "balance",
            "status",
            "invoice_date",
            "created_by",
            "items",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "subtotal",
            "total",
            "amount_paid",
            "balance",
            "created_by",
            "invoice_date",
            "created_at",
            "updated_at",
        ]


class PaymentSerializer(AutoNumberMixin, serializers.ModelSerializer):

    number_field = "payment_number"
    number_prefix = "PAY"

    # Données du reçu : tout vient de la base, le front n'invente rien.
    patient_detail = InvoicePatientSerializer(source="invoice.patient", read_only=True)
    service_detail = InvoiceServiceSerializer(source="invoice.service", read_only=True)
    invoice_number = serializers.CharField(
        source="invoice.invoice_number", read_only=True
    )
    invoice_total = serializers.DecimalField(
        source="invoice.total", max_digits=12, decimal_places=2, read_only=True
    )
    invoice_balance = serializers.DecimalField(
        source="invoice.balance", max_digits=12, decimal_places=2, read_only=True
    )
    received_by_name = serializers.SerializerMethodField()

    def get_received_by_name(self, obj) -> str | None:
        user = obj.received_by
        if user is None:
            return None
        return user.get_full_name() or user.username

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be positive.")
        return value

    class Meta:
        model = Payment

        fields = [
            "id",
            "payment_number",
            "invoice",
            "invoice_number",
            "invoice_total",
            "invoice_balance",
            "patient_detail",
            "service_detail",
            "amount",
            "payment_method",
            "reference",
            "status",
            "payment_date",
            "received_by",
            "received_by_name",
            "notes",
        ]

        read_only_fields = [
            "id",
            "received_by",
            "payment_date",
            "status",
        ]
