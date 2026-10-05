import logging

from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializer import (
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    PasswordResetSerializer,
    PasswordResetConfirmSerializer,
    UserSerializer,
    LoginSerializer,
    CreateUserSerializer,
)
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from .models import User
from .permissions import IsAdminRole, RolePermission

logger = logging.getLogger("users.auth")

# Réponse générique {"detail": "..."} partagée par plusieurs endpoints (un seul composant OpenAPI).
DETAIL_RESPONSE = inline_serializer(
    "DetailResponse", {"detail": drf_serializers.CharField()}
)


@extend_schema(request=LoginSerializer)
class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@extend_schema(request=CreateUserSerializer, responses={201: UserSerializer})
class RegisterView(APIView):
    """Création d'un compte du personnel. Réservé à l'ADMIN : le rôle est choisi par l'admin."""

    permission_classes = (IsAdminRole,)

    def post(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class RefreshTokenView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer


@extend_schema(
    request=inline_serializer("LogoutRequest", {"refresh": drf_serializers.CharField()}),
    responses={205: None, 400: DETAIL_RESPONSE},
)
class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            if str(token.get("user_id")) != str(request.user.pk):
                return Response(
                    {"detail": "Invalid token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token.blacklist()
            logger.info(
                f"User {request.user.id} logged out and refresh token blacklisted"
            )
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            logger.warning(f"Failed to blacklist token: {e}")
            return Response(
                {"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST
            )


@extend_schema(request=PasswordResetSerializer, responses={200: DETAIL_RESPONSE})
class PasswordResetView(APIView):
    permission_classes = ()
    authentication_classes = ()

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        from django.contrib.auth import get_user_model
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.contrib.auth.tokens import PasswordResetTokenGenerator

        User = get_user_model()
        users = User.objects.filter(email__iexact=email)
        if not users.exists():
            # do not reveal whether the email exists
            return Response({"detail": "If an account exists, a reset email was sent."})

        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = PasswordResetTokenGenerator().make_token(user)
            reset_link = f"{settings.PASSWORD_RESET_URL}?uid={uid}&token={token}"
            message = f"Use the link to reset your password: {reset_link}"
            send_mail(
                subject="Password reset",
                message=message,
                from_email=(
                    settings.DEFAULT_FROM_EMAIL
                    if hasattr(settings, "DEFAULT_FROM_EMAIL")
                    else None
                ),
                recipient_list=[user.email],
                fail_silently=False,
            )
            logger.info(f"Password reset requested for user {user.id}")

        return Response({"detail": "If an account exists, a reset email was sent."})


@extend_schema(request=PasswordResetConfirmSerializer, responses={200: DETAIL_RESPONSE})
class PasswordResetConfirmView(APIView):
    permission_classes = ()
    authentication_classes = ()

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.save()
        logger.info(f"Password reset completed for user {user.id}")
        return Response({"detail": "Password has been reset."})


@extend_schema(responses=UserSerializer)
class ProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user).data)


@extend_schema(
    request=inline_serializer(
        "ToggleUserActiveRequest",
        {
            "user_id": drf_serializers.IntegerField(),
            "action": drf_serializers.ChoiceField(choices=["deactivate", "reactivate"]),
        },
    ),
    responses=inline_serializer(
        "ToggleUserActiveResponse",
        {"detail": drf_serializers.CharField(), "user": UserSerializer()},
    ),
)
class ToggleUserActiveView(APIView):
    """
    Toggle a user's active status using the `status` field.

    POST payload: { "user_id": int, "action": "deactivate"|"reactivate" }
    """

    permission_classes = (RolePermission,)
    required_roles = ["ADMIN"]

    def post(self, request):
        user_id = request.data.get("user_id")
        action = request.data.get("action")

        if not user_id or action not in ("deactivate", "reactivate"):
            return Response(
                {
                    "detail": "Provide user_id and action ('deactivate' or 'reactivate')."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if action == "deactivate":
            user.status = user.Status.INACTIVE
        else:
            user.status = user.Status.ACTIVE

        user.save()
        return Response(
            {
                "detail": f"User {action}d successfully.",
                "user": UserSerializer(user).data,
            }
        )


@extend_schema(
    request=inline_serializer(
        "UserStatusRequest",
        {"status": drf_serializers.ChoiceField(choices=User.Status.choices)},
    ),
    responses=UserSerializer,
)
class UserStatusToggleView(APIView):
    """Enable admins to set a user's status to ACTIVE or INACTIVE."""

    permission_classes = (RolePermission,)
    required_roles = ["ADMIN"]

    def post(self, request, user_id):
        # only allow admins
        if not getattr(request.user, "role", None) == "ADMIN":
            return Response(
                {"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN
            )

        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        new_status = request.data.get("status")
        if new_status not in dict(User.Status.choices).keys():
            return Response(
                {"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST
            )

        user.status = new_status
        user.save()
        return Response(UserSerializer(user).data)


class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestion des comptes (ADMIN) : liste, détail, modification (rôle, statut, profil).

    La création passe par POST /api/auth/register/ ; il n'y a pas de suppression :
    on désactive un compte en passant son statut à INACTIVE.
    """

    queryset = User.objects.all().order_by("-id")
    serializer_class = UserSerializer
    permission_classes = (IsAdminRole,)
    filterset_fields = ["role", "status"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["id", "username", "created_at", "role"]
    ordering = ["-id"]

    def perform_update(self, serializer):
        # Garde-fou : un admin ne peut pas se retirer ses propres droits ni se désactiver.
        if serializer.instance.pk == self.request.user.pk:
            data = serializer.validated_data
            if data.get("role", serializer.instance.role) != User.Role.ADMIN or data.get(
                "status", serializer.instance.status
            ) != User.Status.ACTIVE:
                raise ValidationError(
                    "Vous ne pouvez pas modifier votre propre rôle ou désactiver votre compte."
                )
        serializer.save()
