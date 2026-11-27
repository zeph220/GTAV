# Véhicules — NOVA CITY

Le module véhicule étend l'ECS existant sans ajouter de dépendance à Three.js ni modifier `src/shared`.

## Physique et commandes

`createVehicle` crée une entité avec les composants génériques `Transform` et `Velocity`, plus les composants `VehicleDynamics` et `VehicleControls`.

`VehicleDrivingSystem` est un modèle de bicyclette arcade à pas fixe. Il convertit les forces moteur, frein et traînée en accélérations à partir de la masse du véhicule. Il gère aussi la marche arrière, la résistance au roulement, la limite de vitesse et le braquage progressif. La vitesse est signée : une valeur négative indique une marche arrière.

Les commandes normalisées sont accessibles par `setVehicleControls` :

- `throttle` : -1 marche arrière, +1 accélération avant ;
- `brake` : frein de service entre 0 et 1 ;
- `steering` : -1 gauche, +1 droite ;
- `handbrake` : frein à main.

## Graphe routier et circulation

`findNearestRoadNode` rapproche une position du nœud de route le plus proche. `findShortestRoadPath` calcule un chemin Dijkstra pondéré par la longueur réelle des segments. `findRoadRoute` relie plusieurs points de passage et peut fermer une boucle.

`setVehicleRoute` affecte une séquence de nœuds à un véhicule. `RoadTrafficSystem` calcule l'angle de braquage et la demande d'accélération/freinage pour atteindre les points de passage. Il doit être enregistré avant `VehicleDrivingSystem` dans `GameSimulation`.

## Scène jouable

`createVehicleSession(city)` prépare une voiture contrôlée par le joueur et un véhicule autonome qui suit une boucle sur le réseau routier généré.

Dans la scène navigateur, les commandes sont :

- **W / Flèche haut** : accélérer ;
- **S / Flèche bas** : marche arrière ;
- **A / D ou flèches gauche / droite** : tourner ;
- **Espace** : freiner ;
- **Maj** : frein à main.

La caméra suit le véhicule pendant la conduite. Le compteur affiche la vitesse en km/h. Le rendu des voitures reste dans `src/rendering`, tandis que la simulation peut être testée indépendamment de WebGL.

## Limites de cette première itération

Le modèle est une physique arcade, pas un simulateur automobile complet. Les collisions, suspensions, glissement latéral, adhérence variable, dégâts, stationnement dynamique et trafic dense ne sont pas encore implémentés. Le trafic actuel est un premier véhicule autonome suivant un parcours en boucle.
