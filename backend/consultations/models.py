from django.db import models
from patients.models import Patient
from doctor.models import Doctor
from appointments.models import Appointment


class Consultation(models.Model):

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    consultation_number = models.CharField(
        max_length=50,
        unique=True
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="consultations"
    )

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.RESTRICT,
        related_name="consultations"
    )

    appointment = models.OneToOneField(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consultation"
    )

    consultation_date = models.DateTimeField(
        auto_now_add=True
    )

    reason = models.TextField(
        blank=True
    )

    symptoms = models.TextField(
        blank=True
    )

    temperature = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True
    )

    weight = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )

    height = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )

    blood_pressure = models.CharField(
        max_length=20,
        blank=True
    )

    heart_rate = models.IntegerField(
        null=True,
        blank=True
    )

    diagnosis = models.TextField(
        blank=True
    )

    observations = models.TextField(
        blank=True
    )

    treatment_plan = models.TextField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.consultation_number