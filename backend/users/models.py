from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager

from .validators import validate_phone


class UserManager(DjangoUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        # Un superuser est toujours un ADMIN (le champ role n'a pas de valeur par défaut).
        extra_fields.setdefault("role", "ADMIN")
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):

    objects = UserManager()

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        DOCTOR = "DOCTOR", "Doctor"
        RECEPTIONIST = "RECEPTIONIST", "Receptionist"
        LABORANT = "LABORANT", "Laborant"
        PHARMACIST = "PHARMACIST", "Pharmacist"
        CASHIER = "CASHIER", "Cashier"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        SUSPENDED = "SUSPENDED", "Suspended"

    class Gender(models.TextChoices):
        MASCULIN = "MASCULIN", "Masculin"
        FEMININ = "FEMININ", "Féminin"

    phone = models.CharField(max_length=30, blank=True, validators=[validate_phone])

    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.MASCULIN,
        blank=True,
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    email = models.EmailField(unique=True)

    avatar = models.ImageField(
        upload_to="avatars/",
        blank=True,
        null=True,
        help_text="Photo de profil (optionnelle).",
    )
    last_seen_at = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date du dernier changement de mot de passe (limite : 1 fois / 7 jours).",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    failed_login_attempts = models.IntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True)

    def clean(self):
        super().clean()
        if self.phone:
            try:
                self.phone = validate_phone(self.phone)
            except DjangoValidationError as e:
                from django.core.exceptions import ValidationError as V

                raise V({"phone": e.messages})
