"""Numéros de documents générés par l'API (PAT-2026-000001, FAC-2026-000001...).

Le client peut encore en fournir un ; s'il l'omet, le serveur en attribue un unique.
"""

from django.utils import timezone


def next_number(model, field, prefix):
    stem = f"{prefix}-{timezone.localdate().year}-"
    n = model.objects.filter(**{f"{field}__startswith": stem}).count() + 1
    while model.objects.filter(**{field: f"{stem}{n:06d}"}).exists():
        n += 1
    return f"{stem}{n:06d}"


class AutoNumberMixin:
    """Mixin de serializer : number_field / number_prefix, champ facultatif à la création."""

    number_field = None
    number_prefix = None

    def get_extra_kwargs(self):
        kwargs = super().get_extra_kwargs()
        kwargs.setdefault(self.number_field, {}).update(
            required=False, allow_blank=True
        )
        return kwargs

    def create(self, validated_data):
        if not validated_data.get(self.number_field):
            validated_data[self.number_field] = next_number(
                self.Meta.model, self.number_field, self.number_prefix
            )
        return super().create(validated_data)
