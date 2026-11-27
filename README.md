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
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm run build` vérifie les types, compile l'API et construit le client Vite. Les tests utilisent Vitest ; le workflow GitHub Actions exécute les mêmes vérifications à chaque push et pull request.

## Architecture

- `src/main.tsx` : point d'entrée React et composition de la scène.
- `src/app` : état d'interface avec Zustand.
- `src/gameplay`, `src/ai`, `src/missions` : logique de jeu indépendante du rendu.
- `src/server` : API Fastify et persistance de développement SQLite.
- `src/world` : génération déterministe des huit quartiers, îlots, routes, bâtiments et terrain.
- `src/rendering` : scène urbaine React Three Fiber, façades instanciées, végétation, éclairage, ombres, piétons animés, caméra orbitale et modèles de véhicules.
- `src/vehicles` : composants ECS de conduite, physique arcade à forces et masse, itinéraires routiers et première circulation autonome.

## Population piétonne

La scène présente une population déterministe de 24 piétons. Ils circulent sur des cheminements dérivés des routes et réagissent aux positions des voitures du joueur et du trafic autonome : à proximité, ils s'écartent en empruntant les trottoirs.

## Conduite

Cliquer sur **Prendre le volant**, puis utiliser W/S ou les flèches pour accélérer/reculer, A/D ou les flèches pour tourner, Espace pour freiner et Maj pour le frein à main. La vitesse est affichée dans le HUD.

Les routes de sauvegarde de l'API sont destinées au développement local. Une mise en production devra ajouter une authentification et des règles d'autorisation par joueur avant toute exposition réseau.
