from django.db import models
from users.models import User


class Notification(models.Model):

    class Channel(models.TextChoices):
        IN_APP = "IN_APP", "In-app"
        EMAIL = "EMAIL", "Email"
        SMS = "SMS", "SMS"

    class Type(models.TextChoices):
        LAB_RESULT = "LAB_RESULT", "Résultat d'examen"
        LOW_STOCK = "LOW_STOCK", "Stock bas"
        APPOINTMENT = "APPOINTMENT", "Rendez-vous"
        PAYMENT = "PAYMENT", "Paiement"
        INVOICE = "INVOICE", "Facture"
        SYSTEM = "SYSTEM", "Système"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )

    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=50, choices=Type.choices, default=Type.SYSTEM)
    channel = models.CharField(
        max_length=10, choices=Channel.choices, default=Channel.IN_APP
    )
    is_read = models.BooleanField(default=False)
    sent_email = models.BooleanField(default=False)
    sent_sms = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.user.username}"


class NotificationPreference(models.Model):

    class Channel(models.TextChoices):
        IN_APP = "IN_APP", "In-app"
        EMAIL = "EMAIL", "Email"
        SMS = "SMS", "SMS"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="notification_preference"
    )
    lab_result = models.BooleanField(default=True)
    low_stock = models.BooleanField(default=True)
    appointment = models.BooleanField(default=True)
    payment = models.BooleanField(default=True)
    invoice = models.BooleanField(default=True)
    system = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=False)
    sms_enabled = models.BooleanField(default=False)
    email_address = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Préférences - {self.user.username}"
