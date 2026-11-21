from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from notifications.models import Notification

from .models import Medication, MedicationBatch, StockMovement


class MedicationExpiryStockTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.pharmacist = User.objects.create_user(
            username="expiry-pharmacist",
            email="expiry-pharmacist@example.com",
            password="test-password",
            role="PHARMACIST",
        )
        cls.medication = Medication.objects.create(
            name="Expired stock", minimum_stock=5
        )
        MedicationBatch.objects.create(
            medication=cls.medication,
            batch_number="EXPIRED",
            expiration_date=timezone.localdate() - timedelta(days=1),
            quantity=20,
        )
        MedicationBatch.objects.create(
            medication=cls.medication,
            batch_number="VALID",
            expiration_date=timezone.localdate(),
            quantity=3,
        )

    def test_expired_batches_are_not_counted_in_current_stock(self):
        self.client.force_authenticate(self.pharmacist)

        response = self.client.get("/api/medications/")

        self.assertEqual(response.status_code, 200)
        medication = next(
            row for row in response.data["results"] if row["id"] == self.medication.id
        )
        self.assertEqual(medication["current_stock"], 3)
        self.assertTrue(medication["is_low_stock"])


class MedicationBatchLedgerTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.pharmacist = User.objects.create_user(
            username="ledger-pharmacist",
            email="ledger-pharmacist@example.com",
            password="test-password",
            role="PHARMACIST",
        )
        cls.medication = Medication.objects.create(name="Ledger stock")

    def setUp(self):
        self.client.force_authenticate(self.pharmacist)

    def test_creating_and_adjusting_a_batch_records_stock_movements(self):
        created = self.client.post(
            "/api/medication-batches/",
            {
                "medication": self.medication.pk,
                "batch_number": "LOT-LEDGER",
                "quantity": 7,
                "purchase_price": "12.50",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        batch_id = created.data["id"]
        self.assertEqual(created.data["quantity"], 7)
        self.assertEqual(
            list(
                StockMovement.objects.filter(batch_id=batch_id).values_list(
                    "movement_type", "quantity"
                )
            ),
            [(StockMovement.MovementType.IN, 7)],
        )

        updated = self.client.patch(
            f"/api/medication-batches/{batch_id}/", {"quantity": 5}, format="json"
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["quantity"], 5)
        adjustment = StockMovement.objects.filter(batch_id=batch_id).order_by(
            "-pk"
        ).first()
        self.assertEqual(adjustment.movement_type, StockMovement.MovementType.OUT)
        self.assertEqual(adjustment.quantity, 2)
        self.assertEqual(adjustment.reason, "Ajustement manuel du lot")

    def test_stock_movement_requires_a_lot_and_positive_quantity(self):
        no_batch = self.client.post(
            "/api/stock-movements/",
            {
                "medication": self.medication.pk,
                "movement_type": "IN",
                "quantity": 1,
            },
            format="json",
        )
        self.assertEqual(no_batch.status_code, 400)
        self.assertIn("batch", no_batch.data)

        batch = MedicationBatch.objects.create(
            medication=self.medication, batch_number="LOT-ZERO", quantity=0
        )
        zero = self.client.post(
            "/api/stock-movements/",
            {
                "medication": self.medication.pk,
                "batch": batch.pk,
                "movement_type": "IN",
                "quantity": 0,
            },
            format="json",
        )
        self.assertEqual(zero.status_code, 400)
        self.assertIn("quantity", zero.data)

    def test_stock_notification_is_created_when_stock_crosses_below_minimum(self):
        self.medication.minimum_stock = 5
        self.medication.save(update_fields=["minimum_stock"])
        batch = self.client.post(
            "/api/medication-batches/",
            {
                "medication": self.medication.pk,
                "batch_number": "LOT-LOW-STOCK",
                "quantity": 6,
                "purchase_price": "1.00",
            },
            format="json",
        )
        self.assertEqual(batch.status_code, 201, batch.data)
        self.assertFalse(Notification.objects.filter(user=self.pharmacist).exists())

        response = self.client.post(
            "/api/stock-movements/",
            {
                "medication": self.medication.pk,
                "batch": batch.data["id"],
                "movement_type": "OUT",
                "quantity": 2,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        notification = Notification.objects.get(user=self.pharmacist)
        self.assertEqual(notification.type, Notification.Type.LOW_STOCK)
        self.assertIn("4 unité(s)", notification.message)

        still_low = self.client.post(
            "/api/stock-movements/",
            {
                "medication": self.medication.pk,
                "batch": batch.data["id"],
                "movement_type": "OUT",
                "quantity": 1,
            },
            format="json",
        )
        self.assertEqual(still_low.status_code, 201, still_low.data)
        self.assertEqual(Notification.objects.filter(user=self.pharmacist).count(), 1)
