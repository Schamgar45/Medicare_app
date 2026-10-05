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
- `npm audit` : **0 vulnérabilité**.

### Versions et particularités

| Paquet              | Version | Note                                                                                                                                                   |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vite`              | 8.x     | Bundler **Rolldown**. `rollupOptions.output.manualChunks` n'existe plus : le découpage se déclare via `advancedChunks.groups` (voir `vite.config.ts`). |
| `@tailwindcss/vite` | 4.x     | Remplace `postcss.config.js` + `autoprefixer` (supprimés).                                                                                             |
| `tailwindcss`       | 4.x     | **Plus de `tailwind.config.js`** : le thème est déclaré en CSS dans `src/index.css` via `@theme`.                                                      |
| `react-router-dom`  | 7.x     | Les API déclaratives (`BrowserRouter`, `Routes`, `useNavigate`…) sont inchangées.                                                                      |

⚠️ En Tailwind 4, `<alpha-value>` n'existe plus : les couleurs de `@theme` s'écrivent
`rgb(var(--ma-couleur))` et les modificateurs d'opacité (`/20`) passent par `color-mix()`.
Les variables de thème restent définies en `:root` et `[data-theme='dark']`.

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
