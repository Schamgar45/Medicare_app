# Changelog — Medicare Hospital (front)

Versionnage sémantique : `MAJEUR.MINEUR.CORRECTIF`. Pour publier une nouvelle version : modifier `"version"` dans
`package.json` (elle s'affiche automatiquement dans le menu et sur la page de connexion) puis ajouter une entrée ici.

## 1.3.0 — 2026-10-12
- Page « Mon profil » (`/mon-profil`) complète et professionnelle : modification du prénom, nom, nom d'utilisateur, e-mail, téléphone, genre et photo de profil (upload avec aperçu, 5 Mo max). Le rôle et le statut restent gérés par l'administrateur.
- Photo de profil : `ImageField` + Pillow côté serveur, servie via `MEDIA_URL` ; l'avatar (photo ou initiales) s'affiche dans la barre latérale et l'en-tête.
- Sécurité : changement de mot de passe (ancien / nouveau / confirmation) via `POST /api/auth/change-password/`, limité à une fois par 7 jours côté serveur (`password_changed_at`). Changer son e-mail exige le mot de passe actuel.
- Points d'entrée cliquables vers la page profil depuis le bloc en bas de la barre latérale et le bloc utilisateur de l'en-tête.

## 1.2.0 — 2026-10-12
- Hiérarchie des comptes appliquée de bout en bout : le superuser (créé via `createsuperuser`) est protégé — il ne peut pas être supprimé, désactivé ni rétrogradé ; un administrateur ne peut pas supprimer/désactiver un autre administrateur ni le superuser.
- Administration → Utilisateurs : les boutons « Supprimer / Désactiver / Modifier » sont masqués selon le rang (par ligne) ; seul le superuser peut créer ou promouvoir un administrateur, un admin gère uniquement les profils staff. Le champ `is_superuser` est exposé par l'API.
- Tableau de bord : salutation dynamique selon l'heure réelle du serveur (Bonjour / Bonne après-midi / Bonsoir) et horloge synchronisée serveur, via le nouvel endpoint `GET /api/auth/server-time/`.

## 1.1.0 — 2026-10-07
- Nouveau design (police Josefin Sans, bleu vif/vert, très lisible en mode clair) : menu groupé avec compteurs, barre « circuit patient », bannière de bienvenue avec actions rapides.
- Tableau de bord : cartes KPI colorées, courbes, anneau par statut, file d'attente du jour (données de l'API).
- Facturation plus claire : après création on arrive sur la facture, 3 étapes (Lignes → Encaisser → Reçu), résumé Total / Payé / Reste avec barre de progression.
- Recherche patient dans la barre du haut ; `?new=1` ouvre directement le formulaire de création.
- Correction de la page de connexion.

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
