from rest_framework.routers import DefaultRouter

from .views import (
    MedicationViewSet,
    MedicationBatchViewSet,
    StockMovementViewSet,
)

router = DefaultRouter()

router.register("medications", MedicationViewSet, basename="medication")

router.register(
    "medication-batches", MedicationBatchViewSet, basename="medication-batch"
)

router.register("stock-movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = router.urls
