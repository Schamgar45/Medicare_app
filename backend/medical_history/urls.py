from rest_framework.routers import DefaultRouter

from .views import MedicalHistoryViewSet

router = DefaultRouter()

router.register("medical-history", MedicalHistoryViewSet, basename="medical-history")

urlpatterns = router.urls
