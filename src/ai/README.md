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

## Itération 6 — gangs fictifs

Le registre `GangSystem` charge les factions originales de `NOVA_CITY_GANGS` :
`northbank-circle`, `harbor-line` et `orchard-crew`. Les positions de territoires
ne sont pas codées en dur : le monde les fournit à l'exécution avec
`registerTerritory({ id, gangId, districtId, center, radius })`.

Les membres restent des entités ECS. `spawnMember` crée une entité avec
`Transform` et `GangMember`, tandis que `registerMember` permet d'attacher
le composant à une entité existante. Après `trackPlayer(playerId)`, le système
signale l'entrée/sortie de territoire et expose les réactions de proximité.
Les attitudes s'appuient sur `ReputationSystem` : un score inférieur ou égal à
-25 alerte les membres proches ; à -75 ou moins, les membres avec une agressivité
suffisante passent à l'état `confronting`. Ces états sont des signaux non létaux ;
aucun mouvement, dégât ou rendu n'est déclenché directement.

## Itération 6 — événements dynamiques

`DynamicEventDirector` sélectionne des situations par poids, limite le nombre
d'événements simultanés et applique un délai de réapparition par définition.
Il reçoit les lieux du monde via `registerLocation({ id, districtId, position, tags })`.
Aucun événement n'est créé si aucun lieu ne correspond aux tags et quartiers
requis. Le catalogue `NOVA_CITY_DYNAMIC_EVENTS` comprend notamment une action
communautaire, une intervention d'infrastructure, une démonstration universitaire,
une recherche d'animal perdu et une médiation entre groupes de quartier.

Les événements sont des entités ECS portant `DynamicEvent` et `Transform`.
Le joueur contribue explicitement avec `contribute(world, eventEntityId, playerId, amount)`.
Les callbacks `onStarted`, `onProgress`, `onCompleted`, `onExpired` et
`onCancelled` permettent de raccorder missions, progression, économie ou
réactions de la ville sans coupler ces systèmes au directeur.

Exemple de raccordement :

```ts
const gangs = new GangSystem({
  onTerritoryEntered: (event) => ui.showTerritoryNotice(event.gang.name),
});
for (const gang of NOVA_CITY_GANGS) gangs.registerGang(gang);
gangs.registerTerritory({
  id: "northbank-core",
  gangId: "northbank-circle",
  districtId: "Downtown",
  center: worldSuppliedCenter,
  radius: worldSuppliedRadius,
});
gangs.trackPlayer(playerId);

// Les points et étiquettes de lieux proviennent des données de monde.
const events = new DynamicEventDirector({
  onCompleted: ({ event }) => progression.awardExperience(world, playerId, 25),
});
for (const definition of NOVA_CITY_DYNAMIC_EVENTS) events.registerDefinition(definition);
events.registerLocation(worldSuppliedPublicSquare);
```

Le monde et le rendu ne doivent pas importer les détails des membres ou de la
simulation des événements. Ils fournissent uniquement les données de territoire
et les points de lieux ; les conséquences durables restent déléguées aux
systèmes de progression, missions et économie via callbacks.
