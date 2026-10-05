from rest_framework import viewsets

from users.roles import ALL_STAFF

from .models import Specialty
from .serializers import SpecialtySerializer


class SpecialtyViewSet(viewsets.ModelViewSet):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer

    read_roles = ALL_STAFF
    write_roles = []  # ADMIN uniquement

    search_fields = ["name", "description"]
    ordering_fields = ["id", "name"]
    ordering = ["name"]
