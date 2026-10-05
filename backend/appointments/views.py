from rest_framework import viewsets

from users.roles import DOCTOR, RECEPTIONIST
from users.scoping import DoctorScopedMixin

from .models import Appointment
from .serializers import AppointmentSerializer


class AppointmentViewSet(DoctorScopedMixin, viewsets.ModelViewSet):

    queryset = Appointment.objects.select_related(
        "patient", "doctor__user", "doctor__service", "service"
    )

    serializer_class = AppointmentSerializer

    # Le médecin voit ses rendez-vous, ne les crée pas (réception) et ne peut changer que
    # leur avancement : sinon il pourrait se faire attribuer n'importe quel patient.
    doctor_lookup = "doctor"
    doctor_can_create = False
    doctor_update_fields = {"status", "notes"}
    doctor_must_be_self = ()
    doctor_visible_patient_fields = ()

    read_roles = [DOCTOR, RECEPTIONIST]
    write_roles = [DOCTOR, RECEPTIONIST]

    filterset_fields = {
        "status": ["exact"],
        "doctor": ["exact"],
        "patient": ["exact"],
        "service": ["exact"],
        "appointment_date": ["exact", "gte", "lte"],
    }
    search_fields = [
        "appointment_number",
        "patient__first_name",
        "patient__last_name",
        "patient__patient_number",
    ]
    ordering_fields = ["id", "appointment_date", "appointment_time", "created_at"]
    ordering = ["-appointment_date", "-appointment_time"]

    def perform_create(self, serializer):
        self.check_doctor_write(serializer, creating=True)
        serializer.save(created_by=self.request.user)
