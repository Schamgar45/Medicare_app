from rest_framework import viewsets

from users.roles import DOCTOR
from users.scoping import DoctorScopedMixin

from .models import Consultation
from .serializers import ConsultationSerializer


class ConsultationViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = Consultation.objects.select_related(
        "patient", "doctor__user", "doctor__service"
    )

    serializer_class = ConsultationSerializer

    doctor_lookup = "doctor"
    doctor_owned_relations = {"appointment": "doctor"}

    # Données cliniques : médecins uniquement (+ ADMIN).
    read_roles = [DOCTOR]
    write_roles = [DOCTOR]

    filterset_fields = {
        "status": ["exact"],
        "doctor": ["exact"],
        "patient": ["exact"],
        "appointment": ["exact"],
        "consultation_date": ["gte", "lte"],
    }
    search_fields = [
        "consultation_number",
        "patient__first_name",
        "patient__last_name",
        "diagnosis",
    ]
    ordering_fields = ["id", "consultation_date"]
    ordering = ["-consultation_date"]
