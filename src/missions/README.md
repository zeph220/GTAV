# Missions et dialogues — Itération 4

Cette arborescence suit le périmètre ChatGPT du plan de build : missions, objectifs et dialogues. Le monde, les commerces, l'économie locale et les intérieurs génériques restent dans le périmètre Mistral (`src/world/interiors`).

## Mise en place

```ts
const progression = new ProgressionSystem();
progression.initialize(world, playerId);

const missions = new MissionSystem(NOVA_CITY_STARTER_MISSIONS, {
  onCompleted: (update, definition) => {
    progression.awardExperience(
      world,
      update.playerId,
      definition.reward?.experience ?? 0,
    );
  },
});
missions.initializeJournal(world, playerId);

const dialogues = new DialogueSystem(NOVA_CITY_STARTER_DIALOGUES, {
  onMissionEvent: (entityId, event) => missions.reportEvent(world, entityId, event),
});

missions.startMission(world, playerId, "first-day-nova-city");
```

## Objectifs

Les objectifs sont validés dans l'ordre et ciblent un identifiant stable de lieu, objet ou PNJ. Le jeu appelle `reportEvent` lorsque le joueur atteint une zone, interagit avec un objet, ramasse un objet ou termine une conversation :

```ts
missions.reportEvent(world, playerId, {
  type: "reach-location",
  targetId: "civic-plaza",
});
```

Les objectifs à quantité (par exemple trois pièces) acceptent `amount`. Les événements ne font progresser que le prochain objectif actif, évitant de valider par erreur une étape future.

## Dialogues

`DialogueSystem.start` ouvre un dialogue pour un joueur. `choose` valide un choix du nœud courant, déclenche éventuellement un événement de mission, puis passe au nœud suivant. Un dialogue sans destination termine la conversation. Les définitions sont validées à l'enregistrement.

## Temps, abandon et récompenses

Les missions peuvent définir `timeLimitSeconds`. Ajoutez `MissionSystem.update` à la boucle ECS pour faire avancer les délais. `abandonMission` permet aussi un abandon manuel. Les récompenses d'expérience sont distribuées depuis `onCompleted` via `ProgressionSystem.awardExperience`. Les récompenses monétaires et les objets restent des métadonnées tant que les systèmes correspondants ne sont pas raccordés.

## Intégration du monde

Les identifiants `civic-plaza`, `central-transit-hub`, `civic-coordinator`, `workshop-manager` et `workshop-dropoff` sont des contrats d'intégration. Mistral pourra les raccorder à ses entités de monde et à ses interactions sans modifier cette arborescence.
