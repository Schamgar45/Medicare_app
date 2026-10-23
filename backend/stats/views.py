from datetime import date, datetime, time, timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from billing.models import Invoice, Payment
from consultations.models import Consultation
from doctor.models import Doctor
from laboratory.models import LabRequest
from patients.models import Patient
from pharmacy.models import Medication, MedicationBatch, StockMovement
from users.roles import ALL_STAFF, CASHIER, DOCTOR, LABORANT, PHARMACIST, RECEPTIONIST
from users.scoping import scoped_doctor, visible_patients

from .serializers import DashboardSerializer

DEFAULT_MONTHS = 12
MAX_MONTHS = 24

# Sections du dashboard visibles par rôle (l'ADMIN voit tout).
SECTIONS_BY_ROLE = {
    DOCTOR: ["patients", "appointments", "consultations", "lab"],
    RECEPTIONIST: ["patients", "doctors", "appointments", "billing"],
    CASHIER: ["billing"],
    LABORANT: ["lab"],
    PHARMACIST: ["pharmacy"],
}
ALL_SECTIONS = [
    "patients",
    "doctors",
    "appointments",
    "consultations",
    "lab",
    "billing",
    "pharmacy",
]


def _aware(d: date) -> datetime:
    return timezone.make_aware(datetime.combine(d, time.min))


def _month_starts(months: int) -> list[date]:
    """Premiers jours des `months` derniers mois, du plus ancien au mois courant."""
    today = timezone.localdate()
    year, month = today.year, today.month
    starts = []
    for _ in range(months):
        starts.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return starts[::-1]


def _monthly(queryset, field, starts, aggregate, is_date=False):
    """Série mensuelle complète : les mois sans donnée valent 0."""
    bound = starts[0] if is_date else _aware(starts[0])
    rows = (
        queryset.filter(**{f"{field}__gte": bound})
        .annotate(m=TruncMonth(field))
        .values("m")
        .annotate(v=aggregate)
        .order_by("m")
    )
    by_month = {r["m"].strftime("%Y-%m"): float(r["v"] or 0) for r in rows}
    return [
        {"month": s.strftime("%Y-%m"), "value": by_month.get(s.strftime("%Y-%m"), 0.0)}
        for s in starts
    ]


def _mine(ctx, queryset, field="doctor"):
    """Restreint un queryset aux données du médecin connecté (inchangé pour les autres rôles)."""
    if not ctx["doctor_scope"]:
        return queryset
    if ctx["profile"] is None:
        return queryset.none()
    return queryset.filter(**{field: ctx["profile"]})


def _my_patients(ctx):
    if not ctx["doctor_scope"]:
        return Patient.objects.all()
    if ctx["profile"] is None:
        return Patient.objects.none()
    return visible_patients(ctx["profile"])


def _patients(ctx):
    patients = _my_patients(ctx)
    return {
        "total": patients.count(),
        "new_this_month": patients.filter(
            created_at__gte=_aware(ctx["month_start"])
        ).count(),
        "per_month": _monthly(patients, "created_at", ctx["starts"], Count("id")),
    }


def _doctors(ctx):
    return {
        "total": Doctor.objects.count(),
        "available": Doctor.objects.filter(is_available=True).count(),
    }


def _appointments(ctx):
    appointments = _mine(ctx, Appointment.objects.all())
    by_status = dict(
        appointments.values_list("status").annotate(n=Count("id")).order_by()
    )
    return {
        "today": appointments.filter(appointment_date=ctx["today"]).count(),
        "by_status": by_status,
        "per_month": _monthly(
            appointments, "appointment_date", ctx["starts"], Count("id"), is_date=True
        ),
    }


def _consultations(ctx):
    consultations = _mine(ctx, Consultation.objects.all())
    return {
        "total": consultations.count(),
        "today": consultations.filter(consultation_date__date=ctx["today"]).count(),
        "per_month": _monthly(
            consultations, "consultation_date", ctx["starts"], Count("id")
        ),
    }


def _lab(ctx):
    requests = _mine(ctx, LabRequest.objects.all())
    pending = [
        LabRequest.Status.REQUESTED,
        LabRequest.Status.SAMPLE_COLLECTED,
        LabRequest.Status.IN_PROGRESS,
    ]
    by_status = dict(requests.values_list("status").annotate(n=Count("id")).order_by())
    return {
        "pending_requests": requests.filter(status__in=pending).count(),
        "by_status": by_status,
        "requests_per_month": _monthly(
            requests, "requested_at", ctx["starts"], Count("id")
        ),
    }


def _sum(queryset, field):
    """Somme d'un champ décimal, 0.0 si aucune ligne."""
    return float(queryset.aggregate(t=Sum(field))["t"] or 0)


def _billing(ctx):
    completed = Payment.objects.filter(status=Payment.Status.COMPLETED)
    open_invoices = Invoice.objects.exclude(status=Invoice.Status.CANCELLED)
    unpaid = open_invoices.exclude(status=Invoice.Status.PAID)
    return {
        "revenue_total": _sum(completed, "amount"),
        "revenue_this_month": _sum(
            completed.filter(payment_date__gte=_aware(ctx["month_start"])), "amount"
        ),
        "outstanding_balance": _sum(unpaid, "balance"),
        "unpaid_invoices": unpaid.count(),
        "revenue_per_month": _monthly(
            completed, "payment_date", ctx["starts"], Sum("amount")
        ),
    }


def _pharmacy(ctx):
    today = ctx["today"]
    in_stock = MedicationBatch.objects.filter(
        quantity__gt=0, expiration_date__isnull=False
    )
    low_stock = (
        Medication.objects.filter(is_active=True)
        .annotate(current_stock=Coalesce(Sum("batches__quantity"), 0))
        .filter(current_stock__lte=F("minimum_stock"))
        .count()
    )
    consumed = StockMovement.objects.filter(
        movement_type=StockMovement.MovementType.OUT
    )
    top = (
        consumed.filter(movement_date__gte=_aware(ctx["starts"][0]))
        .values("medication__name")
        .annotate(q=Sum("quantity"))
        .order_by("-q")[:5]
    )
    return {
        "low_stock_count": low_stock,
        "expiring_soon_count": in_stock.filter(
            expiration_date__gte=today, expiration_date__lte=today + timedelta(days=30)
        ).count(),
        "expired_count": in_stock.filter(expiration_date__lt=today).count(),
        "consumed_per_month": _monthly(
            consumed, "movement_date", ctx["starts"], Sum("quantity")
        ),
        "top_consumed": [
            {"medication": r["medication__name"], "quantity": r["q"]} for r in top
        ],
    }


BUILDERS = {
    "patients": _patients,
    "doctors": _doctors,
    "appointments": _appointments,
    "consultations": _consultations,
    "lab": _lab,
    "billing": _billing,
    "pharmacy": _pharmacy,
}


class DashboardView(APIView):
    """Chiffres clés et séries mensuelles du tableau de bord, filtrés selon le rôle."""

    read_roles = (
        ALL_STAFF  # l'ADMIN passe toujours ; chaque rôle ne reçoit que ses sections
    )

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "months",
                int,
                description=f"Nombre de mois des séries (1 à {MAX_MONTHS}, défaut {DEFAULT_MONTHS}).",
            )
        ],
        responses=DashboardSerializer,
    )
    def get(self, request):
        try:
            months = int(request.query_params.get("months", DEFAULT_MONTHS))
        except (TypeError, ValueError):
            months = DEFAULT_MONTHS
        months = max(1, min(months, MAX_MONTHS))

        user = request.user
        is_admin = user.is_superuser or user.role == "ADMIN"
        sections = ALL_SECTIONS if is_admin else SECTIONS_BY_ROLE.get(user.role, [])

        today = timezone.localdate()
        doctor_scope, profile = scoped_doctor(user)
        ctx = {
            "doctor_scope": doctor_scope,  # un médecin ne voit que ses propres chiffres
            "profile": profile,
            "today": today,
            "month_start": today.replace(day=1),
            "starts": _month_starts(months),
        }

        data = {
            "generated_at": timezone.now(),
            "months": months,
            "sections": sections,
        }
        for name in sections:
            data[name] = BUILDERS[name](ctx)
        return Response(data)
