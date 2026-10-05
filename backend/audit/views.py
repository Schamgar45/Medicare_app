from rest_framework import viewsets

from users.permissions import IsAdminRole

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):

    queryset = AuditLog.objects.select_related("user").order_by("-created_at")

    serializer_class = AuditLogSerializer

    # Réservé au rôle ADMIN (l'ancien IsAdminUser testait is_staff, pas le rôle).
    permission_classes = [IsAdminRole]

    filterset_fields = ["user", "action", "table_name"]
    search_fields = ["action", "table_name"]
    ordering_fields = ["id", "created_at"]
    ordering = ["-created_at"]
