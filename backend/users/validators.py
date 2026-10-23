"""Validateurs partagés (téléphone international générique, date de naissance)."""

import re
from datetime import date

from django.core.exceptions import ValidationError
from django.utils import timezone

PHONE_MESSAGE = "Numéro invalide : utilisez le format international, ex. +25779987654 (8 à 15 chiffres, + en tête optionnel)."
DATE_OF_BIRTH_MESSAGE = "La date de naissance ne peut pas être dans le futur."


def normalize_phone(value: str) -> str:
    """Retire espaces, tirets, points et parenthèses, sans toucher au + initial."""
    return re.sub(r"[\s\-().]", "", value or "")


def validate_phone(value: str | None) -> str:
    """Valide un numéro international générique : + optionnel puis 8 à 15 chiffres."""
    if value in (None, ""):
        return ""
    cleaned = normalize_phone(str(value).strip())
    if not re.fullmatch(r"\+?\d{8,15}", cleaned):
        raise ValidationError(PHONE_MESSAGE)
    return cleaned


def validate_date_of_birth(value: date | None) -> date | None:
    """Refuse une date de naissance postérieure à aujourd'hui (âge négatif)."""
    if value and value > timezone.localdate():
        raise ValidationError(DATE_OF_BIRTH_MESSAGE)
    return value
