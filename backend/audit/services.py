"""Écriture des traces d'audit (append-only, lecture seule ailleurs)."""

from .models import AuditLog

SAFE_USER_FIELDS = (
    "id",
    "username",
    "email",
    "first_name",
    "last_name",
    "role",
    "status",
    "phone",
    "gender",
    "is_superuser",
)


def snapshot_user(user):
    """Photo d'un compte sans données sensibles (jamais de password)."""
    if user is None:
        return None
    return {f: getattr(user, f, None) for f in SAFE_USER_FIELDS}


def client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_user_action(
    *, actor, action, target=None, old=None, new=None, request=None, record_id=None
):
    """Crée une ligne d'audit. Ne lève jamais (l'audit ne doit pas casser le métier)."""
    try:
        if record_id is None:
            record_id = getattr(target, "pk", None)
        return AuditLog.objects.create(
            user=actor if getattr(actor, "pk", None) else None,
            action=action,
            table_name="users.User",
            record_id=record_id,
            old_data=old,
            new_data=new if new is not None else (snapshot_user(target)),
            ip_address=client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT", "")[:500] if request else ""),
        )
    except Exception:
        return None
