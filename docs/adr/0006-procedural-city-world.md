# ADR 0006 — Génération procédurale déterministe du monde

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/world/**`

## Contexte

Le dépôt ne contient encore aucun module monde, rendu ou véhicule. La scène React Three Fiber est uniquement une scène de démarrage. Le moteur de jeu a besoin d'une représentation du monde indépendante de Three.js afin que la génération, les tests et les futures couches de rendu partagent les mêmes données.

## Décision

Créer un générateur de monde pur TypeScript, déterministe à graine identique, qui produit :
- les huit quartiers NOVA CITY avec leurs emprises et profils de construction ;
- un graphe routier en grille, avec nœuds d'intersection et segments typés ;
- des empreintes de bâtiments placées dans les îlots, avec styles et hauteurs adaptés au quartier ;
- un maillage de terrain triangulé et un échantillonneur de hauteur continu.

Les données sont des coordonnées monde (X/Z au sol, Y vers le haut). Les identifiants générés sont stables pour une graine et une configuration données. Ce module n'importe ni Three.js, ni React, ni l'ECS gameplay. Le rendu convertira ultérieurement ces données en objets GPU ; la conduite pourra réutiliser le graphe routier.

Les options de génération sont validées et bornées pour éviter des allocations excessives. Aucune interface dans `src/shared` n'est modifiée.

## Conséquences

- Le monde peut être testé sans WebGL ni navigateur.
- Un même seed permet de reproduire le même plan de ville dans les outils, le rendu et les tests.
- Les systèmes de rendu et de véhicules consomment les données du monde sans couplage inversé.
- Cette première étape crée la géométrie logique ; elle ne prétend pas encore fournir les matériaux, éclairages, textures ou modèles 3D.
