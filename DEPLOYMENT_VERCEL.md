# Déploiement Vercel

Le dépôt contient deux applications et se déploie en deux projets Vercel reliés au même dépôt GitHub.

## Frontend

- Root Directory : `frontend`
- Framework : Vite
- Build : `npm run build`
- Output : `dist`
- Variable de production `VITE_API_URL` : URL publique **stable** du projet backend, sans slash final, par exemple `https://medicare-backend.vercel.app`. Ne pas utiliser une URL de déploiement contenant un hash (`...-2rhbtemp3-....vercel.app`) : elle change à chaque déploiement.

Après toute modification de cette variable, redéployer le frontend.

## Backend Django

- Root Directory : `backend`
- Framework : Django (détection automatique via `manage.py`)
- Variables à créer dans Vercel → Project Settings → Environment Variables (Production) :

| Variable | Valeur |
|---|---|
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | clé aléatoire de production, au moins 50 caractères |
| `DJANGO_ALLOWED_HOSTS` | domaine Vercel stable du backend, sans `https://`; les domaines de déploiement/preview sont ajoutés automatiquement via `VERCEL_URL` |
| `DATABASE_URL` | URI PostgreSQL de Supabase; saisir dans le tableau de bord Vercel, jamais dans Git |
| `CORS_ALLOWED_ORIGINS` | URL HTTPS exacte du frontend Vercel |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST` | `smtp.gmail.com` (ou `smtp-brevo.com`) |
| `EMAIL_PORT` | `587` |
| `EMAIL_USE_TLS` | `true` |
| `EMAIL_USE_SSL` | `false` |
| `EMAIL_HOST_USER` | adresse Gmail (ou identifiant SMTP Brevo) |
| `EMAIL_HOST_PASSWORD` | mot de passe d'application Google (ou clé SMTP Brevo) |
| `DEFAULT_FROM_EMAIL` | `MediCare Connect <adresse@gmail.com>` |
| `PASSWORD_RESET_URL` | URL HTTPS du frontend suivie de `/reset-password` |
| `DJANGO_BEHIND_HTTPS_PROXY` | `true` |

`RESEND_API_KEY` reste une alternative (avec un domaine vérifié), mais les identifiants SMTP sont prioritaires dès qu'ils sont renseignés. Un projet Vercel `*.vercel.app` ne peut pas être vérifié comme domaine Resend.

La valeur locale de `backend/.env` ne doit pas être importée telle quelle : ses paramètres de développement ne conviennent pas en production. Après avoir obtenu le domaine backend, remplacer son domaine dans `DJANGO_ALLOWED_HOSTS`, puis le domaine frontend dans CORS, `PASSWORD_RESET_URL` et `VITE_API_URL`.

## CI/CD

Le workflow `.github/workflows/ci.yml` vérifie le frontend et le backend sur les pull requests et les pushes sur `main`/`master`. Connecter chaque projet Vercel au dépôt active les déploiements automatiques : previews sur branches/PR et production sur la branche principale. Garder les variables de production hors du workflow GitHub et les gérer dans Vercel.

## Base de données et fichiers téléversés

Les migrations de schéma doivent être exécutées une fois sur la base de production avec les mêmes variables d'environnement que le backend (`python manage.py migrate`). Les fichiers sous `backend/media` sont locaux et éphémères sur les fonctions Vercel : configurer un stockage objet persistant avant d'utiliser les avatars en production.
