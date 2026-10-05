from drf_spectacular.extensions import OpenApiAuthenticationExtension


class StatusJWTScheme(OpenApiAuthenticationExtension):
    """Déclare le schéma Bearer JWT pour notre authentification personnalisée."""

    target_class = "users.authentication.StatusJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
