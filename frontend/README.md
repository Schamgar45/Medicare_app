# Medicare Hospital — Front (React + TypeScript)

## Démarrage

```bash
npm install
copy .env.example .env      # Windows (Linux/Mac : cp)  — puis vérifier VITE_API_URL
npm run dev                 # http://localhost:5173
npm run build               # production -> dossier dist/
```

Prérequis : Node.js 20.19+ ou 22.12+. L'API Django doit tourner (`VITE_API_URL`, par défaut `http://127.0.0.1:8000`) et
`CORS_ALLOWED_ORIGINS` du backend doit contenir l'adresse du front.

## Structure

- `src/lib` : client API (JWT + refresh), authentification, formats, thème.
- `src/components` : composants communs (tableaux, formulaires, modales), `ResourcePage` (liste + formulaire générique).
- `src/features` : modules métier (cliniques, labo, pharmacie, facturation, administration).
- `src/print` : modèles d'impression (formats, cachet, documents).
- `src/lib/center.ts` : coordonnées de l'établissement imprimées sur les documents (le NIF est absent tant qu'il n'existe pas).

## Règles

- Aucune donnée métier n'est inventée : tout vient de l'API. Le cachet = nom + couleur du département (`/api/services/`).
- Le cachet du laboratoire utilise le département dont le nom contient « labo » (à remplacer si un lien examen → département est ajouté).
- Le menu et les actions dépendent du rôle ; le backend reste l'autorité (403/404).
