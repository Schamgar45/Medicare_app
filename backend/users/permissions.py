from rest_framework.permissions import SAFE_METHODS, BasePermission

ADMIN = "ADMIN"


def is_admin(user):
    """Un superuser Django est traité comme ADMIN, même si son champ role est vide."""
    return bool(
        user and user.is_authenticated and (user.is_superuser or user.role == ADMIN)
    )


class RolePermission(BasePermission):
    """Permission that checks if the user has one of the allowed roles.

    Usage: set `required_roles = ["ADMIN", "DOCTOR"]` on the view class or pass via init.
    """

    def __init__(self, required_roles=None):
        self.required_roles = required_roles or []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        required_roles = self.required_roles or getattr(view, "required_roles", [])
        if not required_roles:
            return True
        # Un superuser est toujours traité comme ADMIN (cohérent avec is_admin).
        if "ADMIN" in required_roles and is_admin(request.user):
            return True
        return request.user.role in required_roles


class RoleMatrixPermission(BasePermission):
    """Permissions par rôle, déclarées sur chaque vue.

    Chaque vue déclare trois listes de rôles :

    - ``read_roles``   : GET / HEAD / OPTIONS
    - ``write_roles``  : POST / PUT / PATCH
    - ``delete_roles`` : DELETE (réservé à l'ADMIN si non déclaré)

    L'ADMIN a toujours accès. Une vue qui ne déclare rien est donc réservée à
    l'ADMIN : on oublie d'ouvrir un accès, jamais d'en fermer un.
    """

    message = "Votre rôle ne permet pas cette action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_admin(user):
            return True

        if request.method in SAFE_METHODS:
            roles = getattr(view, "read_roles", [])
        elif request.method == "DELETE":
            roles = getattr(view, "delete_roles", [])
        else:
            roles = getattr(view, "write_roles", [])
        return user.role in roles


class IsAdminRole(BasePermission):
    """Réservé aux utilisateurs dont le rôle est ADMIN (ou superuser)."""

    def has_permission(self, request, view):
        return is_admin(request.user)
