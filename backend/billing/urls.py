from rest_framework.routers import DefaultRouter

from .views import (
    BillingItemViewSet,
    InvoiceViewSet,
    InvoiceItemViewSet,
    PaymentViewSet,
)


router = DefaultRouter()

router.register(
    "billing-items",
    BillingItemViewSet,
    basename="billing-item"
)

router.register(
    "invoices",
    InvoiceViewSet,
    basename="invoice"
)

router.register(
    "invoice-items",
    InvoiceItemViewSet,
    basename="invoice-item"
)

router.register(
    "payments",
    PaymentViewSet,
    basename="payment"
)


urlpatterns = router.urls