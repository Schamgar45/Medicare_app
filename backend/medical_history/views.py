from rest_framework import viewsets

from users.roles import DOCTOR
from users.scoping import DoctorScopedMixin

from .models import MedicalHistory
from .serializers import MedicalHistorySerializer


class MedicalHistoryViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = MedicalHistory.objects.select_related("patient")

    serializer_class = MedicalHistorySerializer

    patient_lookup = "patient"  # historique de ses patients
    doctor_must_be_self = ()

    read_roles = [DOCTOR]
    write_roles = [DOCTOR]

    filterset_fields = ["patient"]
    search_fields = ["title", "description"]
    ordering_fields = ["id", "diagnosed_date", "created_at"]
    ordering = ["-id"]
