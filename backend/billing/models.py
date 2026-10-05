from django.db import models
from django.db.models import Sum
from patients.models import Patient


class BillingItem(models.Model):

    name = models.CharField(max_length=255, unique=True)

    description = models.TextField(blank=True)

    category = models.CharField(max_length=100, blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Invoice(models.Model):

    class Status(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially paid"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    invoice_number = models.CharField(max_length=50, unique=True)

    patient = models.ForeignKey(
        Patient, on_delete=models.RESTRICT, related_name="invoices"
    )
    # Département d'où vient la prestation (Laboratoire, Pharmacie...), choisi par la
    # réception / la caisse. Il détermine le nom et la couleur du cachet imprimé.
    service = models.ForeignKey(
        "services.MedicalService",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.UNPAID
    )

    invoice_date = models.DateTimeField(auto_now_add=True)

    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invoices",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.invoice_number


class InvoiceItem(models.Model):

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")

    billing_item = models.ForeignKey(
        BillingItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_items",
    )

    medication = models.ForeignKey(
        "pharmacy.Medication",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_items",
    )

    description = models.CharField(max_length=255)

    quantity = models.PositiveIntegerField(default=1)

    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.description

    def save(self, *args, **kwargs):
        self.total = self.unit_price * self.quantity
        super().save(*args, **kwargs)
        self.invoice.recalculate_totals()


class Payment(models.Model):

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        BANK = "BANK", "Bank"
        CARD = "CARD", "Card"
        INSURANCE = "INSURANCE", "Insurance"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    payment_number = models.CharField(max_length=50, unique=True)

    invoice = models.ForeignKey(
        Invoice, on_delete=models.RESTRICT, related_name="payments"
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)

    reference = models.CharField(max_length=150, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.COMPLETED
    )

    payment_date = models.DateTimeField(auto_now_add=True)

    received_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_payments",
    )

    notes = models.TextField(blank=True)

    def __str__(self):
        return self.payment_number


def _recalculate_invoice_totals(self):
    subtotal = self.items.aggregate(total=Sum("total"))["total"] or 0
    self.subtotal = subtotal
    self.total = max(subtotal - self.discount + self.tax, 0)
    self.amount_paid = (
        self.payments.filter(status=self.payments.model.Status.COMPLETED).aggregate(
            total=Sum("amount")
        )["total"]
        or 0
    )
    self.balance = max(self.total - self.amount_paid, 0)
    if self.status != self.Status.CANCELLED:
        if self.balance == 0 and self.total > 0:
            self.status = self.Status.PAID
        elif self.amount_paid > 0:
            self.status = self.Status.PARTIALLY_PAID
        else:
            self.status = self.Status.UNPAID
    type(self).objects.filter(pk=self.pk).update(
        subtotal=self.subtotal,
        total=self.total,
        amount_paid=self.amount_paid,
        balance=self.balance,
        status=self.status,
    )


Invoice.recalculate_totals = _recalculate_invoice_totals
