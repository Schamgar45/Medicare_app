from rest_framework.routers import DefaultRouter

from .views import ConsultationViewSet


router = DefaultRouter()

router.register(
    "consultations",
    ConsultationViewSet,
    basename="consultation"
)

urlpatterns = router.urls