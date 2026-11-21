import logging
import time

from django.conf import settings


logger = logging.getLogger("configs.performance")


class SlowRequestLoggingMiddleware:
    """Logue les requêtes lentes sans inclure URL complète ni données métier."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - started) * 1000
        threshold_ms = int(getattr(settings, "DJANGO_SLOW_REQUEST_MS", 1000))
        if duration_ms >= threshold_ms:
            route = getattr(getattr(request, "resolver_match", None), "route", "unknown")
            logger.warning(
                "Slow API request: route=%s method=%s status=%s duration_ms=%.1f",
                route,
                request.method,
                response.status_code,
                duration_ms,
            )
        return response
