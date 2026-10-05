"""Serializers utilisés uniquement pour documenter la réponse du dashboard (schéma OpenAPI)."""

from rest_framework import serializers


class MonthPointSerializer(serializers.Serializer):
    month = serializers.CharField(help_text="Mois au format YYYY-MM")
    value = serializers.FloatField()


class PatientsStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    new_this_month = serializers.IntegerField()
    per_month = MonthPointSerializer(many=True)


class DoctorsStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    available = serializers.IntegerField()


class AppointmentsStatsSerializer(serializers.Serializer):
    today = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    per_month = MonthPointSerializer(many=True)


class ConsultationsStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    today = serializers.IntegerField()
    per_month = MonthPointSerializer(many=True)


class LabStatsSerializer(serializers.Serializer):
    pending_requests = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    requests_per_month = MonthPointSerializer(many=True)


class BillingStatsSerializer(serializers.Serializer):
    revenue_total = serializers.FloatField()
    revenue_this_month = serializers.FloatField()
    outstanding_balance = serializers.FloatField()
    unpaid_invoices = serializers.IntegerField()
    revenue_per_month = MonthPointSerializer(many=True)


class TopMedicationSerializer(serializers.Serializer):
    medication = serializers.CharField()
    quantity = serializers.IntegerField()


class PharmacyStatsSerializer(serializers.Serializer):
    low_stock_count = serializers.IntegerField()
    expiring_soon_count = serializers.IntegerField(help_text="Lots périmant dans les 30 jours")
    expired_count = serializers.IntegerField(help_text="Lots périmés encore en stock")
    consumed_per_month = MonthPointSerializer(many=True)
    top_consumed = TopMedicationSerializer(many=True)


class DashboardSerializer(serializers.Serializer):
    """Seules les sections autorisées pour le rôle de l'utilisateur sont présentes."""

    generated_at = serializers.DateTimeField()
    months = serializers.IntegerField()
    sections = serializers.ListField(child=serializers.CharField())
    patients = PatientsStatsSerializer(required=False)
    doctors = DoctorsStatsSerializer(required=False)
    appointments = AppointmentsStatsSerializer(required=False)
    consultations = ConsultationsStatsSerializer(required=False)
    lab = LabStatsSerializer(required=False)
    billing = BillingStatsSerializer(required=False)
    pharmacy = PharmacyStatsSerializer(required=False)
