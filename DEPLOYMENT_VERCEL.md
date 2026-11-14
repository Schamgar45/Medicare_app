# Déploiement Vercel

Le dépôt contient deux applications et se déploie en deux projets Vercel reliés au même dépôt GitHub.

## Frontend

- Root Directory : `frontend`
- Framework : Vite
- Build : `npm run build`
- Output : `dist`
- Variable de production `VITE_API_URL` : URL publique du projet backend, sans slash final, par exemple `https://<api>.vercel.app`.

Après toute modification de cette variable, redéployer le frontend.

## Backend Django

- Root Directory : `backend`
- Framework : Django (détection automatique via `manage.py`)
- Variables à créer dans Vercel → Project Settings → Environment Variables (Production) :

| Variable | Valeur |
|---|---|
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | clé aléatoire de production, au moins 50 caractères |
| `DJANGO_ALLOWED_HOSTS` | domaine Vercel du backend, sans `https://` |
| `DATABASE_URL` | URI PostgreSQL de Supabase; saisir dans le tableau de bord Vercel, jamais dans Git |
| `CORS_ALLOWED_ORIGINS` | URL HTTPS exacte du frontend Vercel |
| `RESEND_API_KEY` | clé API Resend, saisie directement dans Vercel |
| `DEFAULT_FROM_EMAIL` | expéditeur vérifié dans Resend |
| `PASSWORD_RESET_URL` | URL HTTPS du frontend suivie de `/reset-password` |
| `DJANGO_BEHIND_HTTPS_PROXY` | `true` |

La valeur locale de `backend/.env` ne doit pas être importée telle quelle : ses paramètres de développement ne conviennent pas en production. Après avoir obtenu le domaine backend, remplacer son domaine dans `DJANGO_ALLOWED_HOSTS`, puis le domaine frontend dans CORS, `PASSWORD_RESET_URL` et `VITE_API_URL`.

## CI/CD

Le workflow `.github/workflows/ci.yml` vérifie le frontend et le backend sur les pull requests et les pushes sur `main`/`master`. Connecter chaque projet Vercel au dépôt active les déploiements automatiques : previews sur branches/PR et production sur la branche principale. Garder les variables de production hors du workflow GitHub et les gérer dans Vercel.

## Base de données et fichiers téléversés

Les migrations de schéma doivent être exécutées une fois sur la base de production avec les mêmes variables d'environnement que le backend (`python manage.py migrate`). Les fichiers sous `backend/media` sont locaux et éphémères sur les fonctions Vercel : configurer un stockage objet persistant avant d'utiliser les avatars en production.
