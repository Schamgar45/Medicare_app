from rest_framework import serializers
from .models import User
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
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


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
