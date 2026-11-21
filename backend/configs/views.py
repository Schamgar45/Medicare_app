from django.http import JsonResponse
from django.db import connection
from django.db.utils import DatabaseError
from django.views.decorators.http import require_GET


@require_GET
def health_check(request):
    return JsonResponse({"status": "ok"})


@require_GET
def readiness_check(request):
    """Readiness check: répond OK seulement si la base de données est joignable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})
