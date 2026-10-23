from django.db import models
from consultations.models import Consultation
from patients.models import Patient
from doctor.models import Doctor


class Prescription(models.Model):

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        VALIDATED = "VALIDATED", "Validated"
        PARTIALLY_DISPENSED = "PARTIALLY_DISPENSED", "Partially dispensed"
        DISPENSED = "DISPENSED", "Dispensed"
        CANCELLED = "CANCELLED", "Cancelled"

    prescription_number = models.CharField(max_length=50, unique=True)

    consultation = models.ForeignKey(
        Consultation, on_delete=models.CASCADE, related_name="prescriptions"
    )

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="prescriptions"
    )

    doctor = models.ForeignKey(
        Doctor, on_delete=models.RESTRICT, related_name="prescriptions"
    )

    prescription_date = models.DateTimeField(auto_now_add=True)

    instructions = models.TextField(blank=True)

    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.DRAFT
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.prescription_number


class PrescriptionItem(models.Model):

    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name="items"
    )

    # Sera relié à Medication quand pharmacy sera créée
    medication = models.ForeignKey(
        "pharmacy.Medication",
        on_delete=models.RESTRICT,
        related_name="prescription_items",
    )

    dosage = models.CharField(max_length=100, blank=True)

    frequency = models.CharField(max_length=100, blank=True)

    duration = models.CharField(max_length=100, blank=True)

    quantity = models.IntegerField(null=True, blank=True)

    instructions = models.TextField(blank=True)

    dispensed_quantity = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.prescription.prescription_number} - {self.medication}"
