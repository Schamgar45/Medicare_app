"""
URL configuration for configs project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/auth/", include("users.urls")),
    path("api/", include("services.urls")),
    path(
        "api/",
        include("speciality.urls"),
    ),
    path(
        "api/",
        include("doctor.urls"),
    ),
    path(
        "api/",
        include("patients.urls"),
    ),
    path(
        "api/",
        include("medical_history.urls"),
    ),
    path(
        "api/",
        include("appointments.urls"),
    ),
    path(
        "api/",
        include("consultations.urls"),
    ),
    path(
        "api/",
        include("prescriptions.urls"),
    ),
    path(
        "api/",
        include("pharmacy.urls"),
    ),
    path(
        "api/",
        include("laboratory.urls"),
    ),
    path(
        "api/",
        include("billing.urls"),
    ),
    path(
        "api/",
        include("notifications.urls"),
    ),
    path(
        "api/",
        include("audit.urls"),
    ),
    path(
        "api/",
        include("stats.urls"),
    ),
]
