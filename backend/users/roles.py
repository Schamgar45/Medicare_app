"""Constantes de rôles et groupes réutilisés par les permissions des vues."""

ADMIN = "ADMIN"
DOCTOR = "DOCTOR"
RECEPTIONIST = "RECEPTIONIST"
LABORANT = "LABORANT"
PHARMACIST = "PHARMACIST"
CASHIER = "CASHIER"

# Tout le personnel connecté (hors ADMIN, qui a toujours accès).
ALL_STAFF = [DOCTOR, RECEPTIONIST, LABORANT, PHARMACIST, CASHIER]
