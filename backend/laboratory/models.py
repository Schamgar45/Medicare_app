from django.db import models
from consultations.models import Consultation
from patients.models import Patient
from doctor.models import Doctor


class LabTest(models.Model):

    name = models.CharField(max_length=255, unique=True)

    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    normal_range = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class LabRequest(models.Model):

    class Priority(models.TextChoices):
        NORMAL = "NORMAL", "Normal"
        URGENT = "URGENT", "Urgent"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        SAMPLE_COLLECTED = "SAMPLE_COLLECTED", "Sample collected"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        RESULT_AVAILABLE = "RESULT_AVAILABLE", "Result available"
        VALIDATED = "VALIDATED", "Validated"
        CANCELLED = "CANCELLED", "Cancelled"

    request_number = models.CharField(max_length=50, unique=True)

    consultation = models.ForeignKey(
        Consultation, on_delete=models.CASCADE, related_name="lab_requests"
    )

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="lab_requests"
    )

    doctor = models.ForeignKey(
        Doctor, on_delete=models.RESTRICT, related_name="lab_requests"
    )

    lab_test = models.ForeignKey(
        LabTest, on_delete=models.RESTRICT, related_name="requests"
    )

    priority = models.CharField(
        max_length=20, choices=Priority.choices, default=Priority.NORMAL
    )

    clinical_information = models.TextField(blank=True)

    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.REQUESTED
    )

    requested_at = models.DateTimeField(auto_now_add=True)

    # Le résultat n'arrive pas le jour de la demande : on garde la date du prélèvement
    # (remplie par le laboratoire) et celle de la validation (completed_at, automatique).
    sample_collected_at = models.DateTimeField(null=True, blank=True)

    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.request_number


class LabResult(models.Model):

    lab_request = models.OneToOneField(
        LabRequest, on_delete=models.CASCADE, related_name="result"
    )

    result = models.TextField()

    comment = models.TextField(blank=True)

    validated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validated_lab_results",
    )

    result_date = models.DateTimeField(auto_now_add=True)

    validated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Result - {self.lab_request.request_number}"
