# Medicare Hospital — Front (React + TypeScript)

## Démarrage

```bash
npm ci                        # installation reproductible depuis package-lock.json
copy .env.example .env        # Windows (Linux/Mac : cp)  — puis vérifier VITE_API_URL
npm run dev                   # http://localhost:5173
npm run build                 # production -> dossier dist/
```

Prérequis : Node.js 20 ou plus. L'API Django doit tourner (`VITE_API_URL`, par défaut `http://127.0.0.1:8000`) et
`CORS_ALLOWED_ORIGINS` du backend doit contenir l'adresse du front.

## Vérifications

```bash
npm run typecheck     # tsc -b --noEmit
npm run lint          # ESLint — 0 erreur attendue, les warnings sont tolérés
npm run lint:fix      # ESLint --fix
npm run format        # Prettier --write
npm run format:check  # Prettier --check
```

## Dépendances

- `package-lock.json` fait foi : utiliser `npm ci` et non `npm install` pour reproduire l'environnement.
- **9 vulnérabilités transitives** sont connues (`npm audit`) et ne sont **pas** corrigées : chacune
  exige une version majeure — `tailwindcss` 3→4, `vite` 5→8, `react-router-dom` 6→7. Ces migrations
  sont à planifier séparément ; ne pas lancer `npm audit fix --force` sans migrer le code front.

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
