from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Prefetch, Sum

from consultations.models import Consultation
from laboratory.models import LabRequest
from prescriptions.models import PrescriptionItem
from users.roles import CASHIER, RECEPTIONIST
from users.models import User
from audit.models import AuditLog
from audit.services import log_record_action, snapshot_payment
from notifications.models import Notification
from notifications.service import send_notification

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


def _notify_billing_staff(title, message, notif_type):
    for user in User.objects.filter(
        role__in=BILLING_STAFF,
        status=User.Status.ACTIVE,
    ):
        send_notification(
            user=user,
            title=title,
            message=message,
            notif_type=notif_type,
        )


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
                "doctor__service",
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
            _notify_billing_staff(
                title="Nouvelle facture",
                message=(
                    f"La facture {invoice.invoice_number} a été créée pour "
                    f"{invoice.patient.first_name} {invoice.patient.last_name} "
                    f"(montant : {invoice.total})."
                ),
                notif_type=Notification.Type.INVOICE,
            )
            # Reuse the fully eager-loaded list queryset for the create response;
            # nested invoice lines otherwise fetch their doctor/service per row.
            serializer.instance = self.get_queryset().get(pk=invoice.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        invoice = serializer.save()
        invoice.recalculate_totals()

    @staticmethod
    def _add_unbilled_activities(invoice):
        pending_items = []
        consultation_items = (
            Consultation.objects.select_for_update(of=("self",))
            .filter(
                patient=invoice.patient,
                status__in=(Consultation.Status.OPEN, Consultation.Status.COMPLETED),
                doctor__consultation_fee__gt=0,
            )
            .select_related("doctor__user", "doctor__service")
            .order_by("consultation_date", "id")
        )
        invoiced_consultations = set(
            InvoiceItem.objects.filter(consultation__in=consultation_items)
            .exclude(invoice__status=Invoice.Status.CANCELLED)
            .values_list("consultation_id", flat=True)
        )
        for consultation in consultation_items:
            if consultation.pk in invoiced_consultations:
                continue
            doctor = consultation.doctor
            doctor_name = doctor.user.get_full_name() or doctor.user.username
            pending_items.append(
                InvoiceItem(
                    invoice=invoice,
                    consultation=consultation,
                    doctor=doctor,
                    service=doctor.service,
                    description=f"Consultation - Dr {doctor_name}",
                    unit_price=doctor.consultation_fee,
                    total=doctor.consultation_fee,
                )
            )

        exam_items = (
            LabRequest.objects.select_for_update(of=("self",))
            .filter(
                patient=invoice.patient,
                status=LabRequest.Status.VALIDATED,
                lab_test__price__gt=0,
            )
            .select_related("lab_test__service", "doctor__user")
            .order_by("requested_at", "id")
        )
        invoiced_requests = set(
            InvoiceItem.objects.filter(lab_request__in=exam_items)
            .exclude(invoice__status=Invoice.Status.CANCELLED)
            .values_list("lab_request_id", flat=True)
        )
        for request in exam_items:
            if request.pk in invoiced_requests:
                continue
            pending_items.append(
                InvoiceItem(
                    invoice=invoice,
                    lab_request=request,
                    doctor=request.doctor,
                    service=request.lab_test.service,
                    description=request.lab_test.name,
                    unit_price=request.lab_test.price,
                    total=request.lab_test.price,
                )
            )

        dispensed_items = (
            PrescriptionItem.objects.select_for_update(of=("self",))
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
        billed_quantities = dict(
            InvoiceItem.objects.filter(prescription_item__in=dispensed_items)
            .exclude(invoice__status=Invoice.Status.CANCELLED)
            .values_list("prescription_item_id")
            .annotate(total=Sum("quantity"))
        )
        for item in dispensed_items:
            billed_quantity = billed_quantities.get(item.pk, 0)
            quantity_to_bill = item.dispensed_quantity - billed_quantity
            if quantity_to_bill <= 0:
                continue
            line_total = item.medication.unit_price * quantity_to_bill
            pending_items.append(
                InvoiceItem(
                    invoice=invoice,
                    prescription_item=item,
                    medication=item.medication,
                    doctor=item.prescription.doctor,
                    description=item.medication.name,
                    quantity=quantity_to_bill,
                    unit_price=item.medication.unit_price,
                    total=line_total,
                )
            )

        if pending_items:
            InvoiceItem.objects.bulk_create(pending_items)
            invoice.recalculate_totals()

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
        previous_invoice = serializer.instance.invoice
        item = serializer.save()
        item.invoice.recalculate_totals()
        if previous_invoice.pk != item.invoice_id:
            previous_invoice.recalculate_totals()

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
            if payment.status == Payment.Status.COMPLETED:
                _notify_billing_staff(
                    title="Paiement reçu",
                    message=(
                        f"Le paiement {payment.payment_number} de {payment.amount} "
                        f"a été enregistré pour la facture "
                        f"{payment.invoice.invoice_number}."
                    ),
                    notif_type=Notification.Type.PAYMENT,
                )
            log_record_action(
                actor=self.request.user,
                action=AuditLog.Action.CREATE,
                table_name="billing.Payment",
                record_id=payment.pk,
                new=snapshot_payment(payment),
                request=self.request,
            )

    @transaction.atomic
    def perform_update(self, serializer):
        old_invoice = serializer.instance.invoice
        old = snapshot_payment(serializer.instance)
        payment = serializer.save()
        payment.invoice.recalculate_totals()
        if old_invoice.pk != payment.invoice_id:
            old_invoice.recalculate_totals()
        log_record_action(
            actor=self.request.user,
            action=AuditLog.Action.UPDATE,
            table_name="billing.Payment",
            record_id=payment.pk,
            old=old,
            new=snapshot_payment(payment),
            request=self.request,
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        old = snapshot_payment(instance)
        invoice = instance.invoice
        payment_id = instance.pk
        instance.delete()
        invoice.recalculate_totals()
        log_record_action(
            actor=self.request.user,
            action=AuditLog.Action.DELETE,
            table_name="billing.Payment",
            record_id=payment_id,
            old=old,
            request=self.request,
        )
