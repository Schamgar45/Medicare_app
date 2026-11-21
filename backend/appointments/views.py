from django.db import transaction
from rest_framework import viewsets

from users.roles import DOCTOR, RECEPTIONIST
from users.scoping import DoctorScopedMixin
from notifications.models import Notification
from notifications.service import send_notification

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

    @transaction.atomic
    def perform_create(self, serializer):
        self.check_doctor_write(serializer, creating=True)
        appointment = serializer.save(created_by=self.request.user)
        send_notification(
            user=appointment.doctor.user,
            title="Nouveau rendez-vous",
            message=(
                f"Un rendez-vous avec {appointment.patient.first_name} "
                f"{appointment.patient.last_name} est prévu le "
                f"{appointment.appointment_date} à {appointment.appointment_time}."
            ),
            notif_type=Notification.Type.APPOINTMENT,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        previous_doctor = serializer.instance.doctor
        appointment = serializer.save()
        doctors = {
            previous_doctor.pk: previous_doctor,
            appointment.doctor.pk: appointment.doctor,
        }
        for doctor in doctors.values():
            send_notification(
                user=doctor.user,
                title="Rendez-vous modifié",
                message=(
                    f"Le rendez-vous de {appointment.patient.first_name} "
                    f"{appointment.patient.last_name} est prévu le "
                    f"{appointment.appointment_date} à {appointment.appointment_time}."
                ),
                notif_type=Notification.Type.APPOINTMENT,
            )
