from rest_framework import viewsets
from django.db import transaction

from users.roles import CASHIER, RECEPTIONIST

from .models import (
    BillingItem,
    Invoice,
    InvoiceItem,
    Payment,
)

from .serializers import (
    BillingItemSerializer,
    InvoiceSerializer,
    InvoiceItemSerializer,
    PaymentSerializer,
)

BILLING_STAFF = [RECEPTIONIST, CASHIER]


class BillingItemViewSet(viewsets.ModelViewSet):

    queryset = BillingItem.objects.all()

    serializer_class = BillingItemSerializer

    read_roles = BILLING_STAFF
    write_roles = []  # catalogue des tarifs : ADMIN uniquement

    filterset_fields = ["category", "is_active"]
    search_fields = ["name", "description", "category"]
    ordering_fields = ["id", "name", "price"]
    ordering = ["name"]


class InvoiceViewSet(viewsets.ModelViewSet):

    queryset = Invoice.objects.select_related("patient", "service").prefetch_related("items")

    serializer_class = InvoiceSerializer

    read_roles = BILLING_STAFF
    write_roles = BILLING_STAFF
    # DELETE : ADMIN uniquement (une facture s'annule via son statut)

    filterset_fields = {
        "status": ["exact"],
        "patient": ["exact"],
        "service": ["exact"],
        "invoice_date": ["gte", "lte"],
    }
    search_fields = [
        "invoice_number",
        "patient__first_name",
        "patient__last_name",
        "patient__patient_number",
    ]
    ordering_fields = ["id", "invoice_date", "total", "balance"]
    ordering = ["-invoice_date"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InvoiceItemViewSet(viewsets.ModelViewSet):

    queryset = InvoiceItem.objects.select_related("invoice")

    serializer_class = InvoiceItemSerializer

    read_roles = BILLING_STAFF
    write_roles = BILLING_STAFF
    delete_roles = BILLING_STAFF  # retirer une ligne d'une facture en cours

    filterset_fields = ["invoice"]
    ordering = ["id"]

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    @transaction.atomic
    def perform_update(self, serializer):
        item = serializer.save()
        item.invoice.recalculate_totals()

    @transaction.atomic
    def perform_destroy(self, instance):
        invoice = instance.invoice
        instance.delete()
        invoice.recalculate_totals()


class PaymentViewSet(viewsets.ModelViewSet):

    queryset = Payment.objects.select_related(
        "invoice__patient", "invoice__service", "received_by"
    )

    serializer_class = PaymentSerializer

    read_roles = BILLING_STAFF
    write_roles = BILLING_STAFF
    # DELETE : ADMIN uniquement (trace comptable)

    filterset_fields = {
        "invoice": ["exact"],
        "status": ["exact"],
        "payment_method": ["exact"],
        "payment_date": ["gte", "lte"],
    }
    search_fields = ["payment_number", "reference"]
    ordering_fields = ["id", "payment_date", "amount"]
    ordering = ["-payment_date"]

    def perform_create(self, serializer):
        with transaction.atomic():
            payment = serializer.save(received_by=self.request.user)
            payment.invoice.recalculate_totals()

    @transaction.atomic
    def perform_update(self, serializer):
        payment = serializer.save()
        payment.invoice.recalculate_totals()
