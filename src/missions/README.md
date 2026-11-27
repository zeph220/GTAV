# Missions et dialogues — Project Phoenix

Cette arborescence suit le périmètre ChatGPT du plan de build : missions, objectifs, dialogues et attribution des récompenses. Le monde, les commerces, l'économie locale et les intérieurs génériques restent dans le périmètre monde du projet.

## Mise en place

Les systèmes restent découplés. Le service de récompenses s'intègre au callback de fin de mission :

```ts
import {
  DialogueSystem,
  MissionRewardService,
  MissionSystem,
  NOVA_CITY_STARTER_DIALOGUES,
  NOVA_CITY_STARTER_MISSIONS,
} from "./index";
import { ProgressionSystem } from "../gameplay/progression";

const progression = new ProgressionSystem();
progression.initialize(world, playerId);

const rewards = new MissionRewardService({
  progression,
  // À connecter au futur portefeuille/registre économique.
  onCashReward: (entityId, amount, missionId) => economy.credit(entityId, amount, missionId),
});

const missions = new MissionSystem(NOVA_CITY_STARTER_MISSIONS, {
  onCompleted: (update, definition) => {
    const result = rewards.apply(world, update, definition);
    if (result) {
      // Les objets non attribués sont signalés si l'inventaire est plein.
      console.info(result.items);
    }
  },
});
missions.initializeJournal(world, playerId);

const dialogues = new DialogueSystem(NOVA_CITY_STARTER_DIALOGUES, {
  onMissionEvent: (entityId, event) => missions.reportEvent(world, entityId, event),
});

missions.startMission(world, playerId, "first-day-nova-city");
```

Le callback économique est volontairement facultatif : sans lui, la somme reste signalée par `cashAmount` avec `cashHandled: false`. Aucun portefeuille fictif n'est créé. Les récompenses d'objets indiquent les quantités demandées, attribuées et restantes ; l'inventaire n'est jamais forcé au-delà de sa capacité. Une instance de `MissionRewardService` empêche la double attribution d'une même mission pour un joueur pendant sa durée de vie.

## Objectifs

Les objectifs sont validés dans l'ordre et ciblent un identifiant stable de lieu, objet ou PNJ. Le jeu appelle `reportEvent` lorsque le joueur atteint une zone, interagit avec un objet, ramasse un objet ou termine une conversation :

```ts
missions.reportEvent(world, playerId, {
  type: "reach-location",
  targetId: "civic-plaza",
});
```

Les objectifs à quantité acceptent `amount`. Les événements ne font progresser que le prochain objectif actif, évitant de valider par erreur une étape future.

## Dialogues

`DialogueSystem.start` ouvre un dialogue pour un joueur. `choose` valide un choix du nœud courant, déclenche éventuellement un événement de mission, puis passe au nœud suivant. Un dialogue sans destination termine la conversation. Les définitions sont validées à l'enregistrement.

## Temps, abandon et récompenses

Les missions peuvent définir `timeLimitSeconds`. Ajoutez `MissionSystem.update` à la boucle ECS pour faire avancer les délais. `abandonMission` permet aussi un abandon manuel. `MissionRewardService` distribue l'expérience via `ProgressionSystem`, les objets via l'inventaire et délègue l'argent au système économique lorsqu'il est raccordé. Voir `docs/adr/0005-mission-rewards.md`.

## Intégration du monde

Les identifiants `civic-plaza`, `central-transit-hub`, `civic-coordinator`, `workshop-manager` et `workshop-dropoff` sont des contrats d'intégration. Les systèmes de monde peuvent les raccorder à leurs entités et interactions sans dépendance inverse vers cette arborescence.
