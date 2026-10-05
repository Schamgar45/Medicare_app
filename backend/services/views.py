from rest_framework import viewsets

from users.roles import ALL_STAFF

from .models import MedicalService
from .serializers import MedicalServiceSerializer


class MedicalServiceViewSet(viewsets.ModelViewSet):

    queryset = MedicalService.objects.all()

    serializer_class = MedicalServiceSerializer

    read_roles = ALL_STAFF
    write_roles = []  # ADMIN uniquement

    filterset_fields = ["is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["id", "name", "price"]
    ordering = ["name"]
