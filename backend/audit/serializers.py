from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import AuditLog

# Traduction des actions et des champs en français simple (phrases lisibles).
ACTION_LABELS = {
    "CREATE": "a créé",
    "UPDATE": "a modifié",
    "PROMOTE": "a promu",
    "DEMOTE": "a rétrogradé",
    "DEACTIVATE": "a désactivé",
    "ACTIVATE": "a réactivé",
    "SUSPEND": "a suspendu",
    "DELETE": "a supprimé",
}

FIELD_LABELS = {
    "username": "nom d'utilisateur",
    "email": "email",
    "first_name": "prénom",
    "last_name": "nom",
    "role": "rôle",
    "status": "statut",
    "phone": "téléphone",
    "gender": "genre",
    "is_superuser": "super-administrateur",
}


class AuditLogSerializer(serializers.ModelSerializer):
    """Journal d'audit en français lisible : « Schamgar a désactivé le compte Jean »."""

    actor = serializers.SerializerMethodField()
    action_label = serializers.SerializerMethodField()
    target_label = serializers.SerializerMethodField()
    changes = serializers.SerializerMethodField(
        help_text="Liste des champs modifiés, avec leurs anciennes et nouvelles valeurs."
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "actor",
            "action",
            "action_label",
            "target_label",
            "changes",
            "table_name",
            "record_id",
            "old_data",
            "new_data",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor(self, obj) -> str:
        """Qui a fait l'action : nom complet ou nom d'utilisateur."""
        if not obj.user_id:
            return "Système"
        u = obj.user
        if u is None:
            return f"Utilisateur #{obj.user_id}"
        name = (u.get_full_name() or u.username or "").strip()
        return name or f"Utilisateur #{obj.user_id}"

    def get_action_label(self, obj) -> str:
        return ACTION_LABELS.get(obj.action, obj.action)

    def _snapshot(self, obj) -> dict:
        for snap in (obj.new_data, obj.old_data):
            if isinstance(snap, dict) and snap:
                return snap
        return {}

    def get_target_label(self, obj) -> str:
        """Cible de l'action : « le compte Jean Mukendi » plutôt que users.User #7."""
        snap = self._snapshot(obj)
        if obj.table_name == "users.User":
            name = " ".join(
                p for p in (snap.get("first_name"), snap.get("last_name")) if p
            ).strip()
            who = name or snap.get("username") or snap.get("email") or ""
            if who:
                return f"le compte {who}"
            if obj.action == "CREATE":
                return "un compte"
            return f"le compte #{obj.record_id}"
        if obj.record_id:
            return f"{obj.table_name} #{obj.record_id}"
        return obj.table_name or "—"

    @extend_schema_field(
        {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string"},
                    "old": {},
                    "new": {},
                },
                "required": ["field", "old", "new"],
            },
        }
    )
    def get_changes(self, obj) -> list[dict[str, object]]:
        """Champs modifiés : [{"field": "statut", "old": "Actif", "new": "Inactif"}]."""
        if not isinstance(obj.old_data, dict) or not isinstance(obj.new_data, dict):
            return []

        changes = []
        for field, old in obj.old_data.items():
            if field in ("id", "created_at", "updated_at", "password"):
                continue
            if field not in obj.new_data:
                continue

            new = obj.new_data[field]
            if old != new:
                changes.append(
                    {
                        "field": FIELD_LABELS.get(field, field),
                        "old": old,
                        "new": new,
                    }
                )

        return changes
