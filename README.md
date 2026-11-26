# NOVA CITY — Project Phoenix

Jeu navigateur open-world original. Le projet suit les périmètres et les étapes décrits dans [`plandebuild.md`](./plandebuild.md).

## Prérequis

- Node.js 24 ou plus récent dans la plage prise en charge par Vite.
- npm 10 ou plus récent.

## Démarrage

```bash
npm install
npm run dev:all
```

Le client Vite est servi sur `http://127.0.0.1:5173`. L'API Fastify écoute sur `http://127.0.0.1:3001`. Vite relaie les appels `/api` vers l'API locale.

Pour lancer les deux services séparément :

```bash
npm run dev
npm run dev:server
```

La base SQLite de développement est créée dans `data/nova-city.sqlite`. Le chemin peut être remplacé avec `SQLITE_PATH`.

## Vérifications

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` vérifie les types, compile l'API et construit le client Vite. Les tests utilisent Vitest ; le workflow GitHub Actions exécute les mêmes vérifications à chaque push et pull request.

## Architecture de démarrage

- `src/main.tsx` : point d'entrée React.
- `src/app` : état d'interface avec Zustand.
- `src/gameplay`, `src/ai`, `src/missions` : logique de jeu indépendante du rendu.
- `src/server` : API Fastify et persistance de développement SQLite.
- `src/world`, `src/rendering`, `src/vehicles` : périmètre monde/rendu/véhicules attribué à Mistral conformément au plan.

Les routes de sauvegarde de l'API sont destinées au développement local. Une mise en production devra ajouter une authentification et des règles d'autorisation par joueur avant toute exposition réseau.
