# NOVA CITY — AI / Itération 2

Ce module appartient au périmètre ChatGPT défini dans `plandebuild.md`.
Il ne dépend ni de Three.js ni du renderer. Les entités civiles réutilisent
l'ECS de `src/gameplay`.

## Navigation

Le monde (Mistral) fournit un graphe piéton à partir des trottoirs, passages
protégés, places et traversées. Les nœuds ont un identifiant stable, une
position monde (Y up, -Z forward) et un coût facultatif. Les arêtes sont
bidirectionnelles par défaut.

```ts
const nav = new NavGraph();
nav.addNode({ id: "plaza-west", position: { x: 0, y: 0, z: 0 } });
nav.addNode({ id: "crossing-1", position: { x: 12, y: 0, z: 0 } });
nav.addEdge({ from: "plaza-west", to: "crossing-1" });
```

A* minimise la distance pondérée par le coût de traversée. `findWorldPath`
projette les positions arbitraires sur les nœuds les plus proches puis ajoute
le point d'arrivée exact.

## Civils

`createCivilian` crée un ECS entity avec Transform, Civilian et CivilianNeeds.
Les profils commuter, resident, visitor et worker ont des vitesses, rayons de
promenade et niveaux d'alerte différents. `CivilianSpawner` permet une
population pondérée et reproductible en injectant une fonction random seedée.

`PedestrianSystem.update(world, dt)` :
- suit les waypoints à vitesse constante et oriente le personnage ;
- choisit des destinations de promenade autour de sa position ;
- marque des temps d'arrêt entre les trajets ;
- fait fuir les civils lorsqu'une menace entre dans leur rayon de perception.

Les menaces sont fournies par le moteur de jeu via l'option `threats`, ce qui
permet de connecter ultérieurement police, véhicules ou événements sans
coupler les modules.

## Horaires

`CivilianScheduleSystem` accepte l'heure de jeu (0–24) et envoie les profils
commuter/worker vers leurs nœuds domicile ou travail aux heures configurées.
L'horloge du monde reste la responsabilité de la simulation principale.

## Intégration

Mistral peut alimenter `NavGraph` depuis ses données de routes et trottoirs.
Aucun changement de contrat partagé n'est nécessaire pour cette itération.
Les systèmes doivent être exécutés dans la boucle ECS avec le delta en secondes.
