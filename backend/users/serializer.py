from rest_framework import serializers
from .models import User
from .validators import normalize_phone, validate_phone
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import serializers as drf_serializers
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.password_validation import validate_password


class UserSerializer(serializers.ModelSerializer):

    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "gender",
            "role",
            "status",
            "is_superuser",
            "avatar",
            "created_at",
            "updated_at",
            "password_changed_at",
        ]

        read_only_fields = [
            "id",
            "is_superuser",
            "created_at",
            "updated_at",
            "password_changed_at",
        ]

    def get_avatar(self, obj):
        """URL de la photo de profil (absolue si possible, sinon relative /media/...)."""
        if not obj.avatar:
            return None
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.avatar.url

    def validate_phone(self, value):
        try:
            return validate_phone(value)
        except Exception as e:
            raise serializers.ValidationError(getattr(e, "messages", [str(e)]))


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Mise à jour du profil par l'utilisateur lui-même.

    Champs libres : prénom, nom, nom d'utilisateur, e-mail, téléphone, genre, photo.
    Le rôle et le statut ne sont PAS modifiables ici (réservés à l'admin).
    Changer l'e-mail est sensible : on exige le mot de passe actuel.
    """

    avatar = serializers.ImageField(required=False, allow_null=True)
    clear_avatar = serializers.BooleanField(write_only=True, required=False)
    current_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "gender",
            "avatar",
            "clear_avatar",
            "current_password",
        ]

    def validate_username(self, value):
        value = (value or "").strip()
        if value and User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_phone(self, value):
        try:
            return validate_phone(value)
        except Exception as e:
            raise serializers.ValidationError(getattr(e, "messages", [str(e)]))

    def validate(self, attrs):
        email = attrs.get("email")
        if email is not None:
            email = email.lower().strip()
            if User.objects.filter(email=email).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError(
                    {"email": "Un autre compte utilise déjà cette adresse e-mail."}
                )
            # L'e-mail sert d'identifiant de connexion : on le protège par mot de passe.
            if email != (self.instance.email or "").lower():
                current = attrs.get("current_password")
                if not current:
                    raise serializers.ValidationError(
                        {"current_password": "Le mot de passe actuel est requis pour changer l'e-mail."}
                    )
                if not self.instance.check_password(current):
                    raise serializers.ValidationError(
                        {"current_password": "Mot de passe actuel incorrect."}
                    )
        attrs.pop("current_password", None)
        return attrs

    def update(self, instance, validated_data):
        clear = validated_data.pop("clear_avatar", False)
        validated_data.pop("current_password", None)
        avatar = validated_data.get("avatar")

        if clear:
            # Suppression explicite de la photo (fichier + champ en base).
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None
            validated_data.pop("avatar", None)
        elif avatar and instance.avatar and instance.avatar.name:
            # Remplacement : on purge l'ancien fichier pour éviter les orphelins.
            instance.avatar.delete(save=False)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """Changement de mot de passe par l'utilisateur connecté.

    L'ancien mot de passe est exigé ; le nouveau doit être confirmé,
    différent de l'actuel et conforme aux validateurs Django. La limite
    « 1 fois / 7 jours » est vérifiée dans la vue (elle dépend de
    password_changed_at de l'utilisateur).
    """

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Les deux nouveaux mots de passe ne correspondent pas."}
            )
        if attrs["new_password"] == attrs["old_password"]:
            raise serializers.ValidationError(
                {"new_password": "Le nouveau mot de passe doit être différent de l'actuel."}
            )
        validate_password(attrs["new_password"], self.context["request"].user)
        return attrs


class CreateUserSerializer(serializers.ModelSerializer):
    """Création d'un compte par un ADMIN (voir RegisterView)."""

    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.RECEPTIONIST)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "gender",
            "role",
        ]

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_phone(self, value):
        try:
            return validate_phone(value)
        except Exception as e:
            raise serializers.ValidationError(getattr(e, "messages", [str(e)]))

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = drf_serializers.EmailField(write_only=True, required=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        return token

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            self.fields[self.username_field].required = False
        except Exception:
            pass

    def validate(self, attrs):
        email = attrs.get("email")
        if not email:
            raise drf_serializers.ValidationError({"email": "This field is required."})

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise drf_serializers.ValidationError(
                "No active account found with the given credentials"
            )

        if user.lockout_until and user.lockout_until > timezone.now():
            remaining = user.lockout_until - timezone.now()
            minutes = int(remaining.total_seconds() // 60) + 1
            raise drf_serializers.ValidationError(
                f"Account locked due to failed attempts. Try again in {minutes} minute(s)."
            )

        if user.status != user.Status.ACTIVE:
            raise drf_serializers.ValidationError("Account is not active.")

        password = attrs.get("password")
        if not user.check_password(password):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.status = user.Status.SUSPENDED
                user.lockout_until = timezone.now() + timedelta(minutes=30)
            user.save(
                update_fields=["failed_login_attempts", "status", "lockout_until"]
            )
            raise drf_serializers.ValidationError(
                "No active account found with the given credentials"
            )

        if user.failed_login_attempts or user.lockout_until:
            user.failed_login_attempts = 0
            user.lockout_until = None
            user.save(update_fields=["failed_login_attempts", "lockout_until"])

        attrs[self.username_field] = getattr(user, self.username_field)
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        token = RefreshToken(attrs["refresh"])
        user = User.objects.get(pk=token[api_settings.USER_ID_CLAIM])
        if user.status != user.Status.ACTIVE:
            raise drf_serializers.ValidationError("Account is not active.")
        return super().validate(attrs)


class LoginSerializer(drf_serializers.Serializer):
    """Serializer used only for Swagger docs to show the email/password payload."""

    email = drf_serializers.EmailField(required=True)
    password = drf_serializers.CharField(write_only=True, required=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # add custom claims
        token["role"] = user.role
        return token

    def validate(self, attrs):
        # Prefer login with email + password. If email provided, resolve user
        email = attrs.pop("email", None)
        password = attrs.get("password")

        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise drf_serializers.ValidationError(
                    "No active account found with the given credentials"
                )

            # if currently locked out, prevent login until lockout_until

            if user.lockout_until and user.lockout_until > timezone.now():
                remaining = user.lockout_until - timezone.now()
                minutes = int(remaining.total_seconds() // 60) + 1
                raise drf_serializers.ValidationError(
                    f"Account locked due to failed attempts. Try again in {minutes} minute(s)."
                )

            # reject if already suspended/inactive
            if user.status != user.Status.ACTIVE:
                raise drf_serializers.ValidationError("Account is not active.")

            # check password manually to count failed attempts
            if not user.check_password(password):
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                if user.failed_login_attempts >= 5:
                    user.status = user.Status.SUSPENDED
                    user.lockout_until = timezone.now() + timedelta(minutes=30)
                (
                    user.save(
                        update_fields=[
                            "failed_login_attempts",
                            "status",
                            "lockout_until",
                        ]
                    )
                    if user.pk
                    else user.save()
                )
                raise drf_serializers.ValidationError(
                    "No active account found with the given credentials"
                )

            # successful login: reset counter and clear lockout
            if user.failed_login_attempts or user.lockout_until:
                user.failed_login_attempts = 0
                user.lockout_until = None
                (
                    user.save(update_fields=["failed_login_attempts", "lockout_until"])
                    if user.pk
                    else user.save()
                )

            # set username field for the parent serializer auth flow
            attrs[self.username_field] = getattr(user, self.username_field)

        data = super().validate(attrs)
        # include user info
        data["user"] = UserSerializer(self.user).data
        return data


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs.get("uid")))
            from .models import User

            user = User.objects.get(pk=uid)
        except Exception:
            raise serializers.ValidationError("Invalid uid")

        token = attrs.get("token")
        if not PasswordResetTokenGenerator().check_token(user, token):
            raise serializers.ValidationError("Invalid or expired token")

        attrs["user"] = user
        return attrs
