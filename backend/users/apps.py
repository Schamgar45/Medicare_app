from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from . import schema  # noqa: F401  (enregistre l'extension OpenAPI)
