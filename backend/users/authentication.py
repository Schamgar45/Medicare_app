from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class StatusJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.status != user.Status.ACTIVE:
            raise AuthenticationFailed(
                "User account is not active.", code="user_inactive"
            )
        return user
