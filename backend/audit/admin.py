from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Lecture seule, même pour le superadmin (traçabilité)."""

    list_display = ("id", "action", "table_name", "record_id", "user", "ip_address", "created_at")
    list_filter = ("action", "table_name")
    search_fields = ("action", "table_name")
    ordering = ("-created_at",)
    readonly_fields = (
        "user",
        "action",
        "table_name",
        "record_id",
        "old_data",
        "new_data",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
