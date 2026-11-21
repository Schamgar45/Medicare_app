# MediCare Connect

Application de gestion d'un centre médical : **API Django** + **front React**.

```
.
├── backend/     # API Django 6 + DRF  (voir backend/README.md)
├── frontend/    # React 18 + TypeScript + Vite + Tailwind  (voir frontend/README.md)
├── BACKEND_CHANGES.md   # changements d'API intended pour le front (référence)
├── .vscode/     # réglages partagés (interpréteur Python, ESLint, Prettier)
└── .gitignore   # unique, couvre backend/ et frontend/
```

## Prérequis

| Outil | Version | Où le vérifier |
|---|---|---|
| Python | 3.12 | `python --version` |
| Node.js | 20.19+ ou 22.12+ (LTS) | `node --version` |

## Démarrage

Les deux terminaux se lancent depuis la racine.

**1. Backend** — <http://127.0.0.1:8000/api/docs/>

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Linux/Mac : source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # Linux/Mac : cp .env.example .env
python manage.py migrate
python manage.py createsuperuser  # rôle ADMIN automatique
python manage.py runserver
```

**2. Front** — <http://localhost:5173>

```bash
cd frontend
npm ci
copy .env.example .env            # Linux/Mac : cp .env.example .env
npm run dev
```

Le front appelle l'API via `VITE_API_URL` (`http://127.0.0.1:8000` par défaut).
Il n'y a pas de proxy Vite : les appels sont cross-origin, donc vérifie que
`CORS_ALLOWED_ORIGINS` du backend contient bien l'origine du front.

## Vérifications

```bash
cd backend
python manage.py check           # configuration
python manage.py test            # suite backend complète

cd ../frontend
npm run typecheck                # tsc -b
npm run lint                     # ESLint
npm run format:check             # Prettier
npm run build                    # tsc -b && vite build
```

## Règles du dépôt

- **Une seule source de vérité pour les dépendances** : `backend/requirements.txt` (versions
  épinglées) et `frontend/package-lock.json`. Ne pas éditer `package-lock.json` à la main.
- **Le `.gitignore` est à la racine** et couvre les deux dossiers. `.vscode/settings.json`
  est suivi, le reste de `.vscode/` est ignoré.
- **Le virtualenv est dans `backend/.venv`**, jamais à la racine.
- **Aucun secret commité** : tout passe par `.env`, lui-même ignoré.
- Les types métier du front sont générés depuis `backend/schema.yaml` dans
  `frontend/src/lib/api-schema.d.ts`. Après une modification d'API, régénère le schéma backend
  puis lance `npm run api:types` dans `frontend/` ; la CI contrôle qu'aucun fichier généré ne dérive.

## Déploiement — contrôles et limites métier

En production, `DEBUG=false` active HTTPS, les cookies sécurisés et HSTS. L'API refuse de
démarrer sans clé secrète forte, hôtes autorisés, PostgreSQL, origine CORS, Resend et URL
HTTPS de réinitialisation correctement configurés. La documentation OpenAPI est réservée
aux comptes staff hors développement.

Avant d'ouvrir le service au public, configure le reverse proxy pour transmettre
`X-Forwarded-Proto: https` si TLS s'arrête au proxy, fais les sauvegardes PostgreSQL et
vérifie les domaines, CORS et l'expéditeur Resend du vrai environnement.

Points métier à valider avec l'équipe du centre avant utilisation réelle :

1. `current_stock` ignore les lots expirés et les changements de quantité des lots sont historisés.
   La délivrance d'une ordonnance ne décrémente pas encore les lots : le choix de lot et les règles
   de délivrance doivent être validés avec le pharmacien avant d'automatiser cette étape.
2. La création d'une facture importe les actes éligibles; elle n'est pas déclenchée
   automatiquement à la fin d'une consultation ou d'un examen.
3. `npm audit --omit=dev --audit-level=high` : **0 vulnérabilité de production** (après migration `vite` 5→8, `tailwindcss` 3→4,
   `react-router-dom` 6→7). Les détails de ces migrations sont dans `frontend/README.md`.
