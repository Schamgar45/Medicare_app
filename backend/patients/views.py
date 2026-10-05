from rest_framework import viewsets

from users.roles import ALL_STAFF, DOCTOR, RECEPTIONIST
from users.scoping import DoctorScopedMixin

from .models import Patient
from .serializers import PatientSerializer


class PatientViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    # Un médecin ne voit que ses patients (rendez-vous ou consultation avec lui)
    # et ne crée pas de patient : l'enregistrement se fait à la réception.
    patient_lookup = "pk"
    doctor_can_create = False
    doctor_must_be_self = ()
    doctor_visible_patient_fields = ()

    read_roles = ALL_STAFF
    write_roles = [DOCTOR, RECEPTIONIST]

    filterset_fields = ["status", "gender", "blood_group"]
    search_fields = ["patient_number", "first_name", "last_name", "phone", "email"]
    ordering_fields = ["id", "patient_number", "last_name", "first_name", "created_at"]
    ordering = ["-id"]
