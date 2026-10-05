from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from billing.models import Invoice, InvoiceItem, Payment
from patients.models import Patient
from pharmacy.models import Medication, MedicationBatch, StockMovement

User = get_user_model()

URL = "/api/stats/dashboard/"


def make_user(role):
    return User.objects.create_user(
        username=role.lower(), email=f"{role.lower()}@example.com", password="pass1234", role=role
    )


class DashboardTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = {r: make_user(r) for r in ["ADMIN", "DOCTOR", "RECEPTIONIST", "LABORANT", "PHARMACIST", "CASHIER"]}

        patient = Patient.objects.create(patient_number="P1", first_name="Jean", last_name="Ndaye")
        invoice = Invoice.objects.create(invoice_number="FAC-1", patient=patient)
        InvoiceItem.objects.create(invoice=invoice, description="Consultation", quantity=2, unit_price=500)
        Payment.objects.create(payment_number="PAY-1", invoice=invoice, amount=300, payment_method="CASH")
        invoice.recalculate_totals()

        med = Medication.objects.create(name="Paracétamol", minimum_stock=50)
        batch = MedicationBatch.objects.create(medication=med, batch_number="B1", quantity=10)
        StockMovement.objects.create(medication=med, batch=batch, movement_type="OUT", quantity=7)

    def get(self, role, query=""):
        self.client.force_authenticate(self.users[role])
        return self.client.get(URL + query)

    def test_requires_authentication(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_admin_receives_all_sections(self):
        data = self.get("ADMIN").data
        self.assertEqual(
            data["sections"],
            ["patients", "doctors", "appointments", "consultations", "lab", "billing", "pharmacy"],
        )
        for section in data["sections"]:
            self.assertIn(section, data)

    def test_sections_are_limited_by_role(self):
        expected = {
            "DOCTOR": ["patients", "appointments", "consultations", "lab"],
            "RECEPTIONIST": ["patients", "doctors", "appointments", "billing"],
            "CASHIER": ["billing"],
            "LABORANT": ["lab"],
            "PHARMACIST": ["pharmacy"],
        }
        for role, sections in expected.items():
            with self.subTest(role=role):
                data = self.get(role).data
                self.assertEqual(data["sections"], sections)
                leaked = {"patients", "doctors", "appointments", "consultations", "lab", "billing", "pharmacy"} - set(sections)
                self.assertFalse(leaked & set(data), f"{role} reçoit des sections interdites")

    def test_billing_figures(self):
        billing = self.get("CASHIER").data["billing"]
        self.assertEqual(billing["revenue_total"], 300.0)
        self.assertEqual(billing["revenue_this_month"], 300.0)
        self.assertEqual(billing["outstanding_balance"], 700.0)  # 1000 facturé - 300 payé
        self.assertEqual(billing["unpaid_invoices"], 1)
        self.assertEqual(billing["revenue_per_month"][-1]["value"], 300.0)

    def test_pharmacy_figures(self):
        pharmacy = self.get("PHARMACIST").data["pharmacy"]
        self.assertEqual(pharmacy["low_stock_count"], 1)
        self.assertEqual(pharmacy["top_consumed"], [{"medication": "Paracétamol", "quantity": 7}])
        self.assertEqual(pharmacy["consumed_per_month"][-1]["value"], 7.0)

    def test_monthly_series_are_complete_and_ordered(self):
        data = self.get("ADMIN", "?months=6").data
        series = data["patients"]["per_month"]
        self.assertEqual(len(series), 6)
        months = [p["month"] for p in series]
        self.assertEqual(months, sorted(months))
        self.assertEqual(series[-1]["value"], 1.0)  # le patient créé ce mois-ci
        self.assertEqual(sum(p["value"] for p in series[:-1]), 0.0)  # mois vides = 0

    def test_months_parameter_is_clamped(self):
        self.assertEqual(self.get("ADMIN", "?months=999").data["months"], 24)
        self.assertEqual(self.get("ADMIN", "?months=0").data["months"], 1)
        self.assertEqual(self.get("ADMIN", "?months=abc").data["months"], 12)

    def test_empty_database_does_not_crash(self):
        Payment.objects.all().delete()
        Invoice.objects.all().delete()
        Patient.objects.all().delete()
        StockMovement.objects.all().delete()
        MedicationBatch.objects.all().delete()
        Medication.objects.all().delete()
        data = self.get("ADMIN").data
        self.assertEqual(data["billing"]["revenue_total"], 0.0)
        self.assertEqual(data["patients"]["total"], 0)
        self.assertEqual(data["pharmacy"]["top_consumed"], [])
