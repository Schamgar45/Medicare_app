from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Prefetch, Sum

from consultations.models import Consultation
from laboratory.models import LabRequest
from prescriptions.models import PrescriptionItem
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

    queryset = Invoice.objects.select_related("patient", "service").prefetch_related(
        Prefetch(
            "items",
            queryset=InvoiceItem.objects.select_related(
                "service",
                "doctor__user",
                "consultation",
                "lab_request",
                "prescription_item__prescription",
            ),
        )
    )

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
        with transaction.atomic():
            invoice = serializer.save(created_by=self.request.user)
            self._add_unbilled_activities(invoice)

    @staticmethod
    def _add_unbilled_activities(invoice):
        consultation_items = (
            Consultation.objects.select_for_update()
            .filter(
                patient=invoice.patient,
                status__in=(Consultation.Status.OPEN, Consultation.Status.COMPLETED),
                doctor__consultation_fee__gt=0,
            )
            .select_related("doctor__user", "doctor__service")
            .order_by("consultation_date", "id")
        )
        for consultation in consultation_items:
            already_invoiced = InvoiceItem.objects.filter(
                consultation=consultation
            ).exclude(invoice__status=Invoice.Status.CANCELLED)
            if already_invoiced.exists():
                continue
            doctor = consultation.doctor
            doctor_name = doctor.user.get_full_name() or doctor.user.username
            InvoiceItem.objects.create(
                invoice=invoice,
                consultation=consultation,
                doctor=doctor,
                service=doctor.service,
                description=f"Consultation - Dr {doctor_name}",
                unit_price=doctor.consultation_fee,
            )

        exam_items = (
            LabRequest.objects.select_for_update()
            .filter(
                patient=invoice.patient,
                status=LabRequest.Status.VALIDATED,
                lab_test__price__gt=0,
            )
            .select_related("lab_test__service", "doctor__user")
            .order_by("requested_at", "id")
        )
        for request in exam_items:
            already_invoiced = InvoiceItem.objects.filter(
                lab_request=request
            ).exclude(invoice__status=Invoice.Status.CANCELLED)
            if already_invoiced.exists():
                continue
            InvoiceItem.objects.create(
                invoice=invoice,
                lab_request=request,
                doctor=request.doctor,
                service=request.lab_test.service,
                description=request.lab_test.name,
                unit_price=request.lab_test.price,
            )

        dispensed_items = (
            PrescriptionItem.objects.select_for_update()
            .filter(
                prescription__patient=invoice.patient,
                prescription__status__in=(
                    "PARTIALLY_DISPENSED",
                    "DISPENSED",
                ),
                dispensed_quantity__gt=0,
                medication__unit_price__gt=0,
            )
            .select_related(
                "medication",
                "prescription__doctor__user",
                "prescription__doctor__service",
            )
            .order_by("prescription__prescription_date", "id")
        )
        for item in dispensed_items:
            billed_quantity = (
                InvoiceItem.objects.filter(prescription_item=item)
                .exclude(invoice__status=Invoice.Status.CANCELLED)
                .aggregate(total=Sum("quantity"))["total"]
                or 0
            )
            quantity_to_bill = item.dispensed_quantity - billed_quantity
            if quantity_to_bill <= 0:
                continue
            InvoiceItem.objects.create(
                invoice=invoice,
                prescription_item=item,
                medication=item.medication,
                doctor=item.prescription.doctor,
                description=item.medication.name,
                quantity=quantity_to_bill,
                unit_price=item.medication.unit_price,
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        # Payment.invoice est en RESTRICT : supprimer une facture payée exploserait
        # en 500 (RestrictedError). On refuse proprement ; l'annulation se fait
        # via le statut CANCELLED.
        if instance.payments.exists():
            raise ValidationError(
                {
                    "detail": (
                        "Impossible de supprimer une facture qui a des paiements. "
                        "Utilisez plutôt le statut « Annulée »."
                    )
                }
            )
        instance.delete()


class InvoiceItemViewSet(viewsets.ModelViewSet):

    queryset = InvoiceItem.objects.select_related(
        "invoice",
        "service",
        "doctor__user",
        "consultation",
        "lab_request",
        "prescription_item__prescription",
    )

    serializer_class = InvoiceItemSerializer

    read_roles = BILLING_STAFF
    write_roles = BILLING_STAFF
    delete_roles = BILLING_STAFF  # retirer une ligne d'une facture en cours

    filterset_fields = ["invoice"]
    ordering = ["id"]

    @transaction.atomic
    def perform_create(self, serializer):
        invoice = serializer.validated_data["invoice"]
        serializer.save(service=invoice.service)

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
