from rest_framework.routers import DefaultRouter

from .views import (
    PrescriptionViewSet,
    PrescriptionItemViewSet,
)


router = DefaultRouter()

router.register(
    "prescriptions",
    PrescriptionViewSet,
    basename="prescription"
)

router.register(
    "prescription-items",
    PrescriptionItemViewSet,
    basename="prescription-item"
)


urlpatterns = router.urls