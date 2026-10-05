# Changelog — Medicare Hospital (front)

Versionnage sémantique : `MAJEUR.MINEUR.CORRECTIF`. Pour publier une nouvelle version : modifier `"version"` dans
`package.json` (elle s'affiche automatiquement dans le menu et sur la page de connexion) puis ajouter une entrée ici.

## 1.0.0 — 2026-10-05

- Connexion par email, mot de passe oublié / réinitialisation, session renouvelée automatiquement.
- Écran de démarrage, squelettes de chargement, mode clair / sombre, affichage adapté mobile.
- Tableau de bord par rôle (cartes + graphiques).
- Patients (fiche détaillée), médecins, rendez-vous, consultations, ordonnances.
- Laboratoire : suivi demande → prélèvement → résultat → validation (notification au médecin).
- Pharmacie (médicaments, lots, mouvements), facturation (factures, paiements, reçus, actes).
- Administration : utilisateurs, départements, spécialités, journal d'audit.
- Impressions : facture (A5), reçu (A6), ordonnance (A5), compte rendu (A5), résultats Labo (A4), bandeau dossier patient,
  avec cachet du département (nom et couleur lus dans l'API) ; passage automatique en A4 si le document est long.
