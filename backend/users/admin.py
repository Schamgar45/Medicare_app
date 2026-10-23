from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "role", "status", "is_staff", "is_superuser")
    list_filter = ("role", "status", "is_staff", "is_superuser")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("-id",)
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Profil", {"fields": ("role", "status", "phone", "gender")}),
        ("Sécurité", {"fields": ("failed_login_attempts", "lockout_until")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            "Profil",
            {"fields": ("email", "role", "status", "phone", "gender")},
        ),
    )

    # Hiérarchie : seul un superuser connecté peut gérer un compte ADMIN
    # (mêmes règles que l'API). Le superuser reste intouchable.
    def _can_manage(self, request, obj):
        if obj is None:
            return True
        if obj.is_superuser:
            return False
        if (
            obj.role == User.Role.ADMIN or obj.is_superuser
        ) and not request.user.is_superuser:
            return False
        return True

    def has_delete_permission(self, request, obj=None):
        if obj is not None and not self._can_manage(request, obj):
            return False
        return super().has_delete_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if obj is not None and not self._can_manage(request, obj):
            return False
        return super().has_change_permission(request, obj)
