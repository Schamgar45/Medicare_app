from rest_framework import viewsets

from users.roles import DOCTOR, PHARMACIST
from users.scoping import DoctorScopedMixin

from .models import Prescription, PrescriptionItem
from .serializers import (
    PrescriptionSerializer,
    PrescriptionItemSerializer,
)

# Le pharmacien doit pouvoir marquer une ordonnance comme délivrée
# (status, dispensed_quantity), d'où son droit d'écriture.
PRESCRIPTION_READ = [DOCTOR, PHARMACIST]
PRESCRIPTION_WRITE = [DOCTOR, PHARMACIST]


class PrescriptionViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = Prescription.objects.select_related(
        "patient", "doctor__user", "doctor__service"
    ).prefetch_related("items__medication")

    serializer_class = PrescriptionSerializer

    doctor_lookup = "doctor"
    doctor_owned_relations = {"consultation": "doctor"}

    read_roles = PRESCRIPTION_READ
    write_roles = PRESCRIPTION_WRITE

    filterset_fields = ["status", "doctor", "patient", "consultation"]
    search_fields = [
        "prescription_number",
        "patient__first_name",
        "patient__last_name",
    ]
    ordering_fields = ["id", "prescription_date"]
    ordering = ["-prescription_date"]


class PrescriptionItemViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = PrescriptionItem.objects.select_related("medication")

    serializer_class = PrescriptionItemSerializer

    doctor_lookup = "prescription__doctor"
    doctor_owned_relations = {"prescription": "doctor"}
    doctor_must_be_self = ()
    doctor_visible_patient_fields = ()

    read_roles = PRESCRIPTION_READ
    write_roles = PRESCRIPTION_WRITE

    filterset_fields = ["prescription", "medication"]
    ordering = ["id"]
