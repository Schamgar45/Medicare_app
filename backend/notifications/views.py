from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer


class NotificationViewSet(viewsets.ModelViewSet):

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    filterset_fields = ["is_read", "type"]
    ordering_fields = ["id", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # génération du schéma OpenAPI
            return Notification.objects.none()
        return Notification.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True
        )
        return Response({"ok": True})

    @action(detail=False, methods=["get"], url_path="preferences")
    def preferences(self, request):
        pref, created = NotificationPreference.objects.get_or_create(
            user=request.user,
            defaults={
                "lab_result": True,
                "low_stock": True,
                "appointment": True,
                "payment": True,
                "invoice": True,
                "system": True,
                "email_enabled": False,
                "sms_enabled": False,
                "email_address": "",
                "phone_number": "",
            },
        )
        return Response(NotificationPreferenceSerializer(pref).data)

    @action(detail=False, methods=["patch"], url_path="preferences")
    def update_preferences(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(
            user=request.user,
        )
        for key in [
            "lab_result",
            "low_stock",
            "appointment",
            "payment",
            "invoice",
            "system",
            "email_enabled",
            "sms_enabled",
            "email_address",
            "phone_number",
        ]:
            if key in request.data:
                setattr(pref, key, request.data[key])
        pref.save()
        return Response(NotificationPreferenceSerializer(pref).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="send-test",
        permission_classes=[],
    )
    def send_test(self, request, pk=None):
        try:
            from .service import send_notification

            user = request.user if request.user.is_authenticated else None
            if not user:
                return Response({"error": "Utilisateur non identifié"}, status=401)
            created = send_notification(
                user=user,
                title="Test de notification",
                message=(
                    "Ceci est un test d'envoi. Si vous voyez ce message, "
                    "l'envoi fonctionne."
                ),
                notif_type="SYSTEM",
            )
            return Response(
                {
                    "ok": True,
                    "message": "Test envoyé",
                    "notifications_created": len(created),
                }
            )
        except Exception as exc:
            return Response({"error": str(exc)}, status=500)


    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
