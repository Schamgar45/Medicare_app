"""Cloisonnement des données par médecin.

Un utilisateur DOCTOR ne voit que ses propres données :
 - rendez-vous, consultations, ordonnances, demandes d'examens : ceux dont il est le médecin ;
 - patients : ceux qui ont un rendez-vous ou une consultation avec lui ;
 - historique médical : celui de ses patients.

Les autres rôles (ADMIN, RECEPTIONIST, PHARMACIST...) ne sont pas concernés ici : leur accès
est réglé par RoleMatrixPermission. Le lien entre un compte DOCTOR et sa fiche Doctor est
`user.doctor_profile`.
"""

from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from .permissions import is_admin
from .roles import DOCTOR


def scoped_doctor(user):
    """Retourne (est_médecin_cloisonné, fiche Doctor ou None)."""
    if getattr(user, "role", None) != DOCTOR or is_admin(user):
        return False, None
    return True, getattr(user, "doctor_profile", None)


def visible_patients(profile):
    """Patients d'un médecin : ceux avec qui il a un rendez-vous ou une consultation."""
    from appointments.models import Appointment
    from consultations.models import Consultation
    from patients.models import Patient

    return Patient.objects.filter(
        Q(pk__in=Appointment.objects.filter(doctor=profile).values("patient_id"))
        | Q(pk__in=Consultation.objects.filter(doctor=profile).values("patient_id"))
    )


class DoctorScopedMixin:
    """À placer avant ModelViewSet. Réglages déclaratifs par vue :

    doctor_lookup         chemin ORM vers le Doctor propriétaire ("doctor", "prescription__doctor"...)
    patient_lookup        sinon, chemin ORM vers le Patient ("patient", ou "pk" pour Patient lui-même)
    doctor_can_create     False : un médecin ne peut pas créer cet objet (ex. patient, rendez-vous)
    doctor_update_fields  si défini, seuls ces champs sont modifiables par un médecin
    doctor_must_be_self   champs « médecin » qui doivent désigner le médecin connecté
    doctor_visible_patient_fields  champs « patient » qui doivent désigner l'un de ses patients
    doctor_owned_relations  {champ: attribut} : l'objet référencé doit appartenir au médecin
    """

    doctor_lookup = None
    patient_lookup = None
    doctor_can_create = True
    doctor_update_fields = None
    doctor_must_be_self = ("doctor",)
    doctor_visible_patient_fields = ("patient",)
    doctor_owned_relations = {}

    # ---- lecture : on restreint le queryset (un objet d'un autre médecin répond 404) ----
    def get_queryset(self):
        queryset = super().get_queryset()
        is_doctor, profile = scoped_doctor(self.request.user)
        if not is_doctor:
            return queryset
        if profile is None:
            return queryset.none()
        if self.doctor_lookup:
            return queryset.filter(**{self.doctor_lookup: profile})
        if self.patient_lookup:
            ids = visible_patients(profile).values("pk")
            return queryset.filter(**{f"{self.patient_lookup}__in": ids})
        return queryset

    # ---- écriture : on contrôle ce que le médecin envoie ----
    def check_doctor_write(self, serializer, creating):
        is_doctor, profile = scoped_doctor(self.request.user)
        if not is_doctor:
            return
        if profile is None:
            raise PermissionDenied("Aucune fiche médecin n'est associée à ce compte.")
        if creating and not self.doctor_can_create:
            raise PermissionDenied("Votre rôle ne permet pas de créer cet élément.")

        data = serializer.validated_data
        if not creating and self.doctor_update_fields is not None:
            forbidden = set(data) - set(self.doctor_update_fields)
            if forbidden:
                allowed = ", ".join(sorted(self.doctor_update_fields))
                raise PermissionDenied(f"Un médecin ne peut modifier que : {allowed}.")

        for field in self.doctor_must_be_self:
            if field in data and data[field] != profile:
                raise PermissionDenied("Vous ne pouvez agir qu'en votre propre nom.")

        for field in self.doctor_visible_patient_fields:
            patient = data.get(field)
            if (
                patient is not None
                and not visible_patients(profile).filter(pk=patient.pk).exists()
            ):
                raise PermissionDenied(
                    "Ce patient n'est pas dans votre liste de patients."
                )

        for field, attribute in self.doctor_owned_relations.items():
            related = data.get(field)
            if (
                related is not None
                and getattr(related, f"{attribute}_id") != profile.pk
            ):
                raise PermissionDenied("Cet élément appartient à un autre médecin.")

    def perform_create(self, serializer):
        self.check_doctor_write(serializer, creating=True)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self.check_doctor_write(serializer, creating=False)
        super().perform_update(serializer)
