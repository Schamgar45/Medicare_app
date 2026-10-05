from django.db import models
from users.models import User
from services.models import MedicalService


class Doctor(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="doctor_profile",
    )

    specialty = models.ForeignKey(
        "speciality.Specialty",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="doctors",
    )

    registration_number = models.CharField(
        max_length=100, unique=True, null=True, blank=True
    )

    service = models.ForeignKey(
        MedicalService,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="doctors",
    )

    consultation_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dr. {self.user.first_name} {self.user.last_name}"
