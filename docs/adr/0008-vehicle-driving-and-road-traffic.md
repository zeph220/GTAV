# ADR 0008 — Conduite ECS et circulation sur le graphe routier

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/vehicles/**` et raccordement client dans `src/rendering/**`

## Contexte

Le monde fournit un réseau routier déterministe et le gameplay possède déjà un ECS et une boucle de simulation à pas fixe. Il faut ajouter des véhicules conduisibles et une première circulation autonome sans introduire de dépendance au moteur 3D dans la physique.

## Décision

- Réutiliser `World`, `Transform`, `Velocity`, `GameSystem` et `GameSimulation` existants ; les composants spécifiques aux véhicules restent dans `src/vehicles`.
- Simuler la conduite avec un modèle cinématique de bicyclette : accélération, freinage, résistance au roulement, traînée aérodynamique, angle de braquage progressif et vitesse signée pour la marche arrière.
- Borner le delta de mise à jour et valider les paramètres physiques.
- Fournir un graphe routier non dépendant de Three.js, la recherche de plus court chemin et un système de suivi de waypoints pour une première circulation autonome.
- Garder les commandes clavier et la représentation Three.js dans la couche de présentation ; la physique et le trafic restent testables sans navigateur ni WebGL.
- Ne pas modifier `src/shared/**` : les systèmes véhicules réutilisent les composants ECS génériques existants.

## Conséquences

- Une voiture contrôlable au clavier partage la même simulation fixe que le trafic.
- Les véhicules autonomes suivent des itinéraires calculés sur les routes réellement générées.
- Le modèle reste une première approximation arcade ; collisions, suspensions, adhérence latérale, stationnement dynamique et trafic dense restent des étapes ultérieures.
