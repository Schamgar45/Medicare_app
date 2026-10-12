from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models

from users.validators import validate_date_of_birth, validate_phone


class Patient(models.Model):

    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        ARCHIVED = "ARCHIVED", "Archived"

    patient_number = models.CharField(
        max_length=50,
        unique=True
    )

    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100
    )

    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        blank=True
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True,
        validators=[validate_date_of_birth],
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
        validators=[validate_phone],
    )

    email = models.EmailField(
        blank=True
    )

    address = models.TextField(
        blank=True
    )

    blood_group = models.CharField(
        max_length=10,
        blank=True
    )

    allergies = models.TextField(
        blank=True
    )

    emergency_contact_name = models.CharField(
        max_length=200,
        blank=True
    )

    emergency_contact_phone = models.CharField(
        max_length=30,
        blank=True,
        validators=[validate_phone],
    )

    emergency_contact_relationship = models.CharField(
        max_length=100,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def clean(self):
        super().clean()
        errors: dict[str, list[str]] = {}
        for field in ("phone", "emergency_contact_phone"):
            value = getattr(self, field)
            if value:
                try:
                    setattr(self, field, validate_phone(value))
                except DjangoValidationError as e:
                    errors[field] = e.messages
        if errors:
            from django.core.exceptions import ValidationError as V
            raise V(errors)