from django.db import models


class Medication(models.Model):

    name = models.CharField(max_length=255)

    generic_name = models.CharField(max_length=255, blank=True)

    form = models.CharField(max_length=100, blank=True)

    dosage = models.CharField(max_length=100, blank=True)

    manufacturer = models.CharField(max_length=255, blank=True)

    unit = models.CharField(max_length=50, blank=True)

    minimum_stock = models.PositiveIntegerField(default=0)

    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class MedicationBatch(models.Model):

    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="batches"
    )

    batch_number = models.CharField(max_length=100)

    expiration_date = models.DateField(null=True, blank=True)

    quantity = models.PositiveIntegerField(default=0)

    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["medication", "batch_number"], name="unique_medication_batch"
            )
        ]

    def __str__(self):
        return f"{self.medication.name} - {self.batch_number}"


class StockMovement(models.Model):

    class MovementType(models.TextChoices):
        IN = "IN", "Entrée"
        OUT = "OUT", "Sortie"
        ADJUSTMENT = "ADJUSTMENT", "Ajustement"
        RETURN = "RETURN", "Retour"
        EXPIRED = "EXPIRED", "Expiré"
        DAMAGED = "DAMAGED", "Endommagé"

    medication = models.ForeignKey(
        Medication, on_delete=models.RESTRICT, related_name="stock_movements"
    )

    batch = models.ForeignKey(
        MedicationBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )

    movement_type = models.CharField(max_length=20, choices=MovementType.choices)

    quantity = models.PositiveIntegerField()

    reason = models.TextField(blank=True)

    reference = models.CharField(max_length=100, blank=True)

    performed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )

    movement_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.medication.name} - {self.movement_type}"
