from django.urls import path

from .views import DashboardView

urlpatterns = [
    path("stats/dashboard/", DashboardView.as_view(), name="stats-dashboard"),
]
