from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from users.roles import ALL_STAFF

from .models import Doctor
from .serializers import DoctorSerializer


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related("user", "specialty", "service")
    serializer_class = DoctorSerializer

    read_roles = ALL_STAFF
    write_roles = []  # création / modification : ADMIN uniquement

    filterset_fields = ["user", "specialty", "service", "is_available"]
    search_fields = ["user__first_name", "user__last_name", "registration_number"]
    ordering_fields = ["id", "created_at", "consultation_fee"]
    ordering = ["-id"]

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Fiche médecin du compte connecté (404 si le compte n'est pas un médecin)."""
        profile = getattr(request.user, "doctor_profile", None)
        if profile is None:
            raise NotFound("Aucune fiche médecin n'est associée à ce compte.")
        return Response(self.get_serializer(profile).data)
