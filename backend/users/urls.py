from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    RegisterView,
    RefreshTokenView,
    LogoutView,
    PasswordResetView,
    PasswordResetConfirmView,
    ProfileView,
    ToggleUserActiveView,
    UserStatusToggleView,
    UserViewSet,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="token_obtain_pair"),
    path("refresh/", RefreshTokenView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="auth_logout"),
    path("password-reset/", PasswordResetView.as_view(), name="password_reset"),
    path(
        "password-reset-confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("profile/", ProfileView.as_view(), name="profile"),
    path(
        "profile/toggle-active/", ToggleUserActiveView.as_view(), name="toggle_active"
    ),
    path(
        "<int:user_id>/status/",
        UserStatusToggleView.as_view(),
        name="user_status_toggle",
    ),
]

# /api/auth/users/  (ADMIN) : liste et modification des comptes
router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
urlpatterns += router.urls
