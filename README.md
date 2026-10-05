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
| Node.js | 20 ou plus (LTS) | `node --version` |

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
python manage.py test            # 83 tests (~6 min)

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
- Les types du front sont écrits à la main dans `frontend/src/lib/types.ts` ; ils sont à maintenir
  alignés sur `backend/schema.yaml`.

## Sécurité — points connus

Ces éléments sont fonctionnels mais à traiter avant une mise en production :

1. `/api/docs/` et `/api/schema/` sont **publics** (à restreindre).
2. Le modèle `AuditLog` existe mais **aucun code n'y écrit** encore.
3. `current_stock` additionne tous les lots, y compris périmés.
4. `npm audit` remonte 9 vulnérabilités transitives (via `tailwindcss`, `vite`, `react-router`).
   Toutes exigent un changement de version majeure ; voir `frontend/README.md`.
5. Les factures et mouvements de stock ne sont pas générés automatiquement depuis une
   consultation ou une ordonnance.