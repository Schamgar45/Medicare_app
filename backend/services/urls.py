from rest_framework.routers import DefaultRouter

from .views import MedicalServiceViewSet

router = DefaultRouter()

router.register("services", MedicalServiceViewSet, basename="medical-service")

urlpatterns = router.urls
