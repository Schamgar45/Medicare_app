# MediCare Connect — API Django

API REST de gestion d'un centre médical : patients, rendez-vous, consultations, ordonnances,
laboratoire, pharmacie, facturation, notifications et tableau de bord.

- **Framework** : Django 6 + Django REST Framework
- **Base de données** : SQLite en développement (`db.sqlite3`), PostgreSQL en production
- **Auth** : JWT (email + mot de passe), refresh court, blacklist au logout
- **Docs interactives** : `/api/docs/` (Swagger UI) et `/api/schema/` (OpenAPI)
- **Langue / fuseau** : `fr`, `Africa/Bujumbura`

> Le détail des changements d'API destinés au front est dans [`../BACKEND_CHANGES.md`](../BACKEND_CHANGES.md).

## Prérequis

- **Python 3.12** ([python.org](https://www.python.org/downloads/))
- PostgreSQL uniquement si `USE_POSTGRES=true`

## Installation

Toutes les commandes se lancent depuis `backend/` :

```bash
cd backend

python -m venv .venv
.venv\Scripts\activate            # Linux/Mac : source .venv/bin/activate
pip install -r requirements.txt

copy .env.example .env            # Linux/Mac : cp .env.example .env
python manage.py migrate
python manage.py createsuperuser  # le compte reçoit automatiquement le rôle ADMIN
python manage.py runserver
```

L'API répond sur <http://127.0.0.1:8000/api/> et Swagger sur <http://127.0.0.1:8000/api/docs/>.

## Configuration (`.env`)

| Variable | Défaut | Rôle |
|---|---|---|
| `DJANGO_SECRET_KEY` | clé de dev | **obligatoire** si `DJANGO_DEBUG=false` |
| `DJANGO_DEBUG` | `true` | `false` en production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,...` | hôtes servis, séparés par des virgules |
| `CORS_ALLOWED_ORIGINS` | `localhost:5173`, `127.0.0.1:5173`, `localhost:3000` | origines du front autorisées |
| `DATABASE_URL` | vide | URI PostgreSQL complète (ex. URI de connexion Supabase); active PostgreSQL si renseignée |
| `USE_POSTGRES` | `false` | `true` pour utiliser PostgreSQL avec les variables `DB_*` |
| `DB_NAME` `DB_USER` `DB_PASSWORD` `DB_HOST` | — | requis si `USE_POSTGRES=true` et `DATABASE_URL` vide |
| `DB_PORT` | `5432` | port PostgreSQL |
| `RESEND_API_KEY` | vide en développement | clé API Resend; obligatoire en production pour créer un compte ou réinitialiser un mot de passe |
| `DEFAULT_FROM_EMAIL` | `onboarding@resend.dev` en développement | adresse expéditrice vérifiée dans Resend; obligatoire en production |
| `PASSWORD_RESET_URL` | `http://localhost:5173/reset-password` | page du front qui reçoit le lien de réinitialisation |
| `DJANGO_SECURE_SSL_REDIRECT` | `true` hors DEBUG | redirige les requêtes HTTP vers HTTPS |
| `DJANGO_SESSION_COOKIE_SECURE` `DJANGO_CSRF_COOKIE_SECURE` | `true` hors DEBUG | cookies transmis uniquement en HTTPS |
| `DJANGO_SECURE_HSTS_SECONDS` | `31536000` hors DEBUG | durée HSTS; ne pas activer avant que HTTPS fonctionne partout |
| `DJANGO_BEHIND_HTTPS_PROXY` | `false` | `true` si le reverse proxy fixe `X-Forwarded-Proto` |

En production, définis aussi explicitement `DJANGO_SECRET_KEY` (au moins 50 caractères aléatoires), `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL` ou `USE_POSTGRES=true` avec les paramètres PostgreSQL, `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL` et `PASSWORD_RESET_URL` en HTTPS. L'application refuse de démarrer si ces paramètres requis manquent.

### Utiliser Supabase

1. Dans le tableau de bord Supabase, ouvre **Connect** et copie l'URI PostgreSQL
   (le pooler de session est conseillé si le réseau de l'hébergeur ne prend pas en charge IPv6).
2. Colle cette URI dans `DATABASE_URL` dans `backend/.env`. Elle contient un mot de passe :
   ne la partage pas et ne la commite jamais. La connexion exige SSL.
3. Depuis `backend/`, lance `python manage.py migrate` pour créer les tables de l'application
   dans le projet Supabase, puis `python manage.py createsuperuser` pour créer le premier compte.

Cette configuration utilise la base PostgreSQL de Supabase avec l'authentification Django ;
elle n'utilise pas Supabase Auth. Les données existantes dans `db.sqlite3` ne sont pas copiées
par `migrate` : cette commande crée uniquement le schéma.

## Tests

```bash
python manage.py test                    # 122 tests
python manage.py test users              # une app
python manage.py test users.test_rbac    # un module
```

Les tests couvrent l'authentification (login par email, verrouillage après 5 échecs, logout),
la matrice de permissions par rôle, le cloisonnement des données par médecin, le cycle
laboratoire, la facturation et le tableau de bord.

## Régénérer le schéma OpenAPI

Après toute modification de l'API :

```bash
python manage.py spectacular --file schema.yaml --validate
```

## Structure

```
backend/
├── configs/          # settings, urls, wsgi/asgi, pagination
├── users/            # modèle User (rôles), JWT, permissions, cloisonnement médecin
├── services/         # départements de l'hôpital (nom + couleur du cachet)
├── speciality/       # spécialités des médecins
├── doctor/           # fiches médecins
├── patients/         # dossier patient
├── medical_history/  # antécédents
├── appointments/     # rendez-vous
├── consultations/    # consultations
├── prescriptions/    # ordonnances + lignes
├── pharmacy/         # médicaments, lots, mouvements de stock
├── laboratory/       # examens, demandes, résultats
├── billing/          # articles, factures, lignes, paiements
├── notifications/    # notifications utilisateur
├── audit/            # journal d'audit (lecture seule, ADMIN)
└── stats/            # agrégats du tableau de bord (sans modèle)
```

## Rôles

`ADMIN`, `DOCTOR`, `RECEPTIONIST`, `LABORANT`, `PHARMACIST`, `CASHIER`.
Les permissions sont **refusées par défaut** : chaque endpoint déclare explicitement les rôles
autorisés en lecture et en écriture. Voir le tableau détaillé dans
[`../BACKEND_CHANGES.md`](../BACKEND_CHANGES.md) §4.
