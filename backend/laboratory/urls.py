from rest_framework.routers import DefaultRouter

from .views import (
    LabTestViewSet,
    LabRequestViewSet,
    LabResultViewSet,
)


router = DefaultRouter()

router.register(
    "lab/tests",
    LabTestViewSet,
    basename="lab-test"
)

router.register(
    "lab/requests",
    LabRequestViewSet,
    basename="lab-request"
)

router.register(
    "lab/results",
    LabResultViewSet,
    basename="lab-result"
)

urlpatterns = router.urls