import logging

from datetime import timedelta

from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
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
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
)
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from .models import User
from .permissions import IsAdminRole
from audit.models import AuditLog
from audit.services import log_user_action, snapshot_user

logger = logging.getLogger("users.auth")

# Réponse générique {"detail": "..."} partagée par plusieurs endpoints (un seul composant OpenAPI).
DETAIL_RESPONSE = inline_serializer(
    "DetailResponse", {"detail": drf_serializers.CharField()}
)


def _active_admin_count():
    """Nombre de comptes ADMIN actifs (superusers inclus)."""
    from django.db.models import Q

    return User.objects.filter(
        Q(is_superuser=True) | Q(role=User.Role.ADMIN),
        status=User.Status.ACTIVE,
    ).count()


def _target_is_protected_admin(target):
    """True si la cible est un ADMIN ou le superuser (createsuperuser)."""
    return bool(target.is_superuser or target.role == User.Role.ADMIN)


def _ensure_not_last_active_admin(target, next_role=None, next_status=None):
    """On ne supprime/désactive/rétrograde jamais le dernier ADMIN actif."""
    # La garde ne concerne que les cibles qui sont (encore) un ADMIN actif.
    if not (
        (target.is_superuser or target.role == User.Role.ADMIN)
        and target.status == User.Status.ACTIVE
    ):
        return
    role_after = next_role if next_role is not None else target.role
    status_after = next_status if next_status is not None else target.status
    still_admin = (
        target.is_superuser or role_after == User.Role.ADMIN
    ) and status_after == User.Status.ACTIVE
    if not still_admin and _active_admin_count() <= 1:
        raise ValidationError("Dernier administrateur actif : action interdite.")


@extend_schema(request=LoginSerializer)
class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@extend_schema(request=CreateUserSerializer, responses={201: UserSerializer})
class RegisterView(APIView):
    """Création d'un compte. ADMIN=staff réservée au superuser ; le reste à l'ADMIN."""

    permission_classes = (IsAdminRole,)

    def post(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Hiérarchie : seul le superuser (createsuperuser) crée un autre ADMIN.
        if (
            serializer.validated_data.get("role") == User.Role.ADMIN
            and not request.user.is_superuser
        ):
            raise PermissionDenied(
                "Seul le super-administrateur peut créer un administrateur."
            )
        user = serializer.save()
        log_user_action(
            actor=request.user,
            action=AuditLog.Action.CREATE,
            target=user,
            old=None,
            new=snapshot_user(user),
            request=request,
        )
        logger.info(
            "Account created: %s (role=%s) by %s",
            user.username,
            user.role,
            request.user,
        )
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
        # On passe le request pour que l'URL de l'avatar soit absolue.
        return Response(UserSerializer(request.user, context={"request": request}).data)


# Fréquence minimale entre deux changements de mot de passe.
PASSWORD_CHANGE_COOLDOWN = timedelta(days=7)


@extend_schema(request=ProfileUpdateSerializer, responses=UserSerializer)
class ProfileUpdateView(APIView):
    """Met à jour le profil de l'utilisateur connecté.

    PATCH /api/auth/profile/update/ — données libres (prénom, nom, username,
    e-mail, téléphone, genre, photo). Le rôle et le statut ne sont PAS
    modifiables ici. Le changement d'e-mail exige le mot de passe actuel.
    """

    permission_classes = (IsAuthenticated,)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        old = snapshot_user(request.user)
        serializer.save()
        log_user_action(
            actor=request.user,
            action=AuditLog.Action.UPDATE,
            target=request.user,
            old=old,
            new=snapshot_user(request.user),
            request=request,
        )
        logger.info("Profile updated: %s", request.user.username)
        return Response(UserSerializer(request.user, context={"request": request}).data)


@extend_schema(request=ChangePasswordSerializer, responses={200: DETAIL_RESPONSE, 400: DETAIL_RESPONSE})
class ChangePasswordView(APIView):
    """Change le mot de passe de l'utilisateur connecté.

    POST /api/auth/change-password/ {"old_password", "new_password", "confirm_password"}
    L'ancien mot de passe est vérifié, et le changement n'est possible qu'une
    seule fois par période de 7 jours (contrôlé côté serveur).
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user = request.user
        # Limite « 1 fois / 7 jours », vérifiée côté serveur.
        if user.password_changed_at:
            elapsed = timezone.now() - user.password_changed_at
            if elapsed < PASSWORD_CHANGE_COOLDOWN:
                next_allowed = user.password_changed_at + PASSWORD_CHANGE_COOLDOWN
                return Response(
                    {
                        "detail": (
                            "Vous avez déjà changé votre mot de passe récemment. "
                            f"Nouveau changement possible à partir du {timezone.localtime(next_allowed).strftime('%d/%m/%Y à %H:%M')}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user.set_password(serializer.validated_data["new_password"])
        user.password_changed_at = timezone.now()
        # Réinitialise aussi le compteur de verrouillage par précaution.
        user.failed_login_attempts = 0
        user.lockout_until = None
        user.save(update_fields=["password", "password_changed_at", "failed_login_attempts", "lockout_until"])
        logger.info("Password changed for user %s", user.id)
        return Response({"detail": "Mot de passe modifié avec succès."})


@extend_schema(
    responses=inline_serializer(
        "ServerTimeResponse",
        {
            "now": drf_serializers.DateTimeField(),
            "timezone": drf_serializers.CharField(),
        },
    ),
)
class ServerTimeView(APIView):
    """Heure courante du serveur (pour salutation/horloge côté client).

    Le client ne doit PAS se fier à l'horloge de l'appareil, qui peut être mal
    réglée ou dans un autre fuseau. On renvoie l'instant serveur (avec son
    offset) et le fuseau serveur pour l'affichage/la salutation.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(
            {
                "now": timezone.localtime(timezone.now()).isoformat(),
                "timezone": settings.TIME_ZONE,
            }
        )


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
    (Historique, gardé pour compatibilité) Active/désactive un compte.

    POST payload: { "user_id": int, "action": "deactivate"|"reactivate" }
    Préférez PATCH /api/auth/users/<id>/ ou POST .../deactivate|activate.
    """

    permission_classes = (IsAdminRole,)

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

        # Garde-fous : hiérarchie + pas d'auto-désactivation.
        if action == "deactivate":
            if user.pk == request.user.pk:
                return Response(
                    {"detail": "Vous ne pouvez pas désactiver votre propre compte."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.is_superuser:
                return Response(
                    {
                        "detail": "Le compte super-administrateur ne peut pas être désactivé via l'API."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if _target_is_protected_admin(user) and not request.user.is_superuser:
                return Response(
                    {
                        "detail": "Action réservée au super-administrateur : un ADMIN ne peut pas désactiver un autre administrateur."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            try:
                _ensure_not_last_active_admin(user, next_status=User.Status.INACTIVE)
            except ValidationError as e:
                return Response({"detail": e.detail}, status=status.HTTP_400_BAD_REQUEST)

        old = snapshot_user(user)
        if action == "deactivate":
            user.status = user.Status.INACTIVE
        else:
            user.status = user.Status.ACTIVE
            user.failed_login_attempts = 0
            user.lockout_until = None

        user.save()
        log_user_action(
            actor=request.user,
            action=(
                AuditLog.Action.DEACTIVATE if action == "deactivate" else AuditLog.Action.ACTIVATE
            ),
            target=user,
            old=old,
            new=snapshot_user(user),
            request=request,
        )
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
    """(Historique, gardé pour compatibilité) Définit le statut d'un compte.

    POST /api/auth/<user_id>/status/ {"status": "ACTIVE"|"INACTIVE"|"SUSPENDED"}
    Préférez PATCH /api/auth/users/<id>/ ou POST .../deactivate|activate.
    """

    permission_classes = (IsAdminRole,)

    def post(self, request, user_id):
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

        # Garde-fous : hiérarchie + pas d'auto-changement de statut.
        if new_status != User.Status.ACTIVE:
            if user.pk == request.user.pk:
                return Response(
                    {"detail": "Vous ne pouvez pas modifier votre propre statut."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.is_superuser:
                return Response(
                    {
                        "detail": "Le compte super-administrateur ne peut pas changer de statut via l'API."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if _target_is_protected_admin(user) and not request.user.is_superuser:
                return Response(
                    {
                        "detail": "Action réservée au super-administrateur : un ADMIN ne peut pas changer le statut d'un autre administrateur."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            try:
                _ensure_not_last_active_admin(user, next_status=new_status)
            except ValidationError as e:
                return Response({"detail": e.detail}, status=status.HTTP_400_BAD_REQUEST)

        old = snapshot_user(user)
        user.status = new_status
        if new_status == User.Status.ACTIVE:
            user.failed_login_attempts = 0
            user.lockout_until = None
        user.save()
        log_user_action(
            actor=request.user,
            action={
                User.Status.INACTIVE: AuditLog.Action.DEACTIVATE,
                User.Status.ACTIVE: AuditLog.Action.ACTIVATE,
                User.Status.SUSPENDED: AuditLog.Action.SUSPEND,
            }.get(new_status, AuditLog.Action.UPDATE),
            target=user,
            old=old,
            new=snapshot_user(user),
            request=request,
        )
        return Response(UserSerializer(user).data)


class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Gestion des comptes (ADMIN) : liste, détail, modification, suppression.

    La création passe par POST /api/auth/register/.
    La désactivation (soft-delete) passe par PATCH {"status": "INACTIVE"}
    ou POST .../deactivate|activate. DELETE supprime définitivement.
    """

    queryset = User.objects.all().order_by("-id")
    serializer_class = UserSerializer
    permission_classes = (IsAdminRole,)
    filterset_fields = ["role", "status"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["id", "username", "created_at", "role"]
    ordering = ["-id"]

    def perform_update(self, serializer):
        target = serializer.instance
        data = serializer.validated_data
        action_name = AuditLog.Action.UPDATE

        # Changement de rôle (promotion/rétrogradation).
        next_role = data.get("role", target.role)
        if next_role != target.role:
            # Ne jamais rétrograder un superuser.
            if target.is_superuser:
                raise PermissionDenied(
                    "Le compte super-administrateur ne peut pas être rétrogradé via l'API."
                )
            if target.pk == self.request.user.pk:
                raise ValidationError("Vous ne pouvez pas modifier votre propre rôle.")
            # Seul le superuser touche à un rôle ADMIN (cible ou résultat).
            if (_target_is_protected_admin(target) or next_role == User.Role.ADMIN) and not (
                self.request.user.is_superuser
            ):
                raise PermissionDenied(
                    "Action réservée au super-administrateur : gestion des rôles d'administrateur."
                )
            if next_role != User.Role.ADMIN:
                _ensure_not_last_active_admin(target, next_role=next_role)
            action_name = (
                AuditLog.Action.PROMOTE
                if next_role == User.Role.ADMIN
                else AuditLog.Action.DEMOTE
            )
        elif "status" in data and data["status"] != target.status:
            self.check_status_change(target, data["status"])
            action_name = {
                User.Status.INACTIVE: AuditLog.Action.DEACTIVATE,
                User.Status.ACTIVE: AuditLog.Action.ACTIVATE,
                User.Status.SUSPENDED: AuditLog.Action.SUSPEND,
            }.get(data["status"], AuditLog.Action.UPDATE)

        old = snapshot_user(target)
        user = serializer.save()
        # Réactivation : on réinitialise le compteur d'échecs et le verrou.
        if data.get("status") == User.Status.ACTIVE and (
            user.failed_login_attempts or user.lockout_until
        ):
            user.failed_login_attempts = 0
            user.lockout_until = None
            user.save(update_fields=["failed_login_attempts", "lockout_until"])
        log_user_action(
            actor=self.request.user,
            action=action_name,
            target=user,
            old=old,
            new=snapshot_user(user),
            request=self.request,
        )

    def check_status_change(self, target, new_status):
        """Règles pour un changement de statut via PATCH."""
        if target.pk == self.request.user.pk:
            raise ValidationError("Vous ne pouvez pas modifier votre propre statut.")
        if target.is_superuser:
            raise PermissionDenied(
                "Le compte super-administrateur ne peut pas changer de statut via l'API."
            )
        if _target_is_protected_admin(target) and not self.request.user.is_superuser:
            raise PermissionDenied(
                "Action réservée au super-administrateur : un ADMIN ne peut pas changer le statut d'un autre administrateur."
            )
        if new_status != User.Status.ACTIVE:
            _ensure_not_last_active_admin(target, next_status=new_status)

    def perform_destroy(self, instance):
        # Hiérarchie : jamais le superuser, pas d'auto-suppression, jamais un autre ADMIN.
        if instance.is_superuser:
            raise PermissionDenied(
                "Le compte super-administrateur (createsuperuser) ne peut pas être supprimé via l'API."
            )
        if instance.pk == self.request.user.pk:
            raise ValidationError("Vous ne pouvez pas supprimer votre propre compte.")
        if _target_is_protected_admin(instance) and not self.request.user.is_superuser:
            raise PermissionDenied(
                "Action réservée au super-administrateur : un ADMIN ne peut pas supprimer un autre administrateur."
            )
        _ensure_not_last_active_admin(instance)
        old = snapshot_user(instance)
        old_pk = instance.pk
        instance.delete()
        log_user_action(
            actor=self.request.user,
            action=AuditLog.Action.DELETE,
            target=instance,
            old=old,
            new=None,
            request=self.request,
            record_id=old_pk,
        )

    @extend_schema(responses=UserSerializer)
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        """Désactive un compte (status=INACTIVE)."""
        user = self.get_object()
        # Ordre : d'abord la protection superuser (403), puis l'auto-désactivation (400).
        if user.is_superuser:
            raise PermissionDenied(
                "Le compte super-administrateur (createsuperuser) ne peut pas être désactivé via l'API."
            )
        if user.pk == request.user.pk:
            raise ValidationError("Vous ne pouvez pas désactiver votre propre compte.")
        if _target_is_protected_admin(user) and not request.user.is_superuser:
            raise PermissionDenied(
                "Action réservée au super-administrateur : un ADMIN ne peut pas désactiver un autre administrateur."
            )
        _ensure_not_last_active_admin(user, next_status=User.Status.INACTIVE)
        old = snapshot_user(user)
        user.status = User.Status.INACTIVE
        user.save(update_fields=["status", "updated_at"])
        log_user_action(
            actor=request.user,
            action=AuditLog.Action.DEACTIVATE,
            target=user,
            old=old,
            new=snapshot_user(user),
            request=request,
        )
        return Response(UserSerializer(user).data)

    @extend_schema(responses=UserSerializer)
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        """Réactive un compte (status=ACTIVE + reset lockout)."""
        user = self.get_object()
        old = snapshot_user(user)
        user.status = User.Status.ACTIVE
        user.failed_login_attempts = 0
        user.lockout_until = None
        user.save(update_fields=["status", "failed_login_attempts", "lockout_until", "updated_at"])
        log_user_action(
            actor=request.user,
            action=AuditLog.Action.ACTIVATE,
            target=user,
            old=old,
            new=snapshot_user(user),
            request=request,
        )
        return Response(UserSerializer(user).data)
