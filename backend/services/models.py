from django.db import models

# Create your models here.
class MedicalService(models.Model):
    """Service / département de l'hôpital (Consultation, Laboratoire...)."""

    class ThemeColor(models.TextChoices):
        MARINE = "MARINE", "Marine"
        VERT = "VERT", "Vert"


    name = models.CharField(
        max_length=150,
        unique=True
    )

    description = models.TextField(
        blank=True
    )

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    # Couleur du logo et du cachet imprimés pour ce département (factures, ordonnances...).
    theme_color = models.CharField(
        max_length=10,
        choices=ThemeColor.choices,
        default=ThemeColor.MARINE,
    )

    is_active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.name