# Gameplay — Project Phoenix

Ce dossier appartient à ChatGPT conformément à `plandebuild.md`.

## Itération 1 — fondations

- ECS minimal : entités, composants typés et requêtes.
- Déplacement joueur, caméra de suivi et inventaire.
- Bus d'événements typé et contrats d'intégration documentés.

## Itération 3 — combat et police

- Combat au projecteur incapacitant non létal.
- Santé plafonnée à un minimum de un, étourdissement et verrouillage temporaire.
- Niveau de recherche, poursuite et interpellation côté IA.

## Itération 5 — réputation, progression et sauvegardes

- `ReputationSystem` gère une réputation indépendante par faction, bornée par défaut entre -100 et +100 et classée en cinq niveaux.
- `ProgressionSystem` accumule l'expérience, calcule les niveaux, attribue des points de compétence et contrôle le déblocage des aptitudes.
- `SaveManager` sérialise les composants joueur pris en charge dans des emplacements versionnés. Il inclut transform, santé, inventaire, réputation, progression et journal de missions.
- `SaveStorage` est une interface asynchrone ; `InMemorySaveStorage` sert aux tests et `WebStorageSaveStorage` peut recevoir `window.localStorage` ou un stockage compatible.
- Les adaptateurs de sauvegarde sont extensibles sans modifier l'ECS. Les sections inconnues sont ignorées ; une version de format inconnue est refusée. La décision d'architecture est détaillée dans `docs/adr/0001-progression-and-save-system.md`.

Exemple d'initialisation :

```ts
const reputation = new ReputationSystem();
const progression = new ProgressionSystem();
reputation.initialize(world, playerId);
progression.initialize(world, playerId);

const saves = new SaveManager(new WebStorageSaveStorage(window.localStorage));
await saves.save(world, playerId, "manual-1");
```

Pour raccorder les récompenses de mission, appelez `progression.awardExperience(world, update.playerId, definition.reward?.experience ?? 0)` depuis le callback `onCompleted` de `MissionSystem`.

## Contrat d'intégration avec le monde et le rendu

Le module de rendu ne doit pas importer les détails internes de l'ECS. Il lit uniquement les snapshots/composants utiles et peut alimenter `PlayerInputState.current` depuis les contrôles clavier/manette.

Le repère monde utilise Y vers le haut et -Z comme direction avant initiale. Les distances sont exprimées en unités monde ; le choix de l'échelle visuelle reste du ressort de `src/world` et `src/rendering`.

Les contrats communs dans `src/shared` restent rétrocompatibles. Toute évolution architecturale doit être précédée d'un ADR.

## Itération 7 — ordonnanceur de simulation

`GameSimulation` fournit une boucle ECS commune indépendante du rendu :

- pas fixe de 60 Hz par défaut, avec accumulateur pour absorber les variations de fréquence d'affichage ;
- priorités explicites et ordre stable à priorité égale ;
- delta maximal par frame et nombre maximal de sous-étapes pour éviter les spirales de rattrapage ;
- pause, désinscription des systèmes, remise à zéro de l'horloge et snapshot de diagnostic ;
- protection contre les appels réentrants et validation des options.

Exemple :

```ts
const simulation = new GameSimulation(world);
simulation.registerSystem({ id: "movement", system: movementSystem, priority: 10 });
simulation.registerSystem({ id: "combat", system: combatSystem, priority: 20 });

// Dans la boucle de rendu, transmettre le delta en secondes.
simulation.advance(frameDeltaSeconds);
```

Le mouvement s'exécute ici avant le combat. Les systèmes ne dépendent pas du renderer et continuent à être testables avec un `World` en mémoire. Voir `docs/adr/0003-deterministic-simulation-loop.md` pour les choix de conception.

## Itération 8 — interactions contextuelles

Le module `interaction` fournit un mécanisme réutilisable pour les portes, contacts, commerces, points de mission et objets :

- `addInteractable` valide et ajoute un composant avec identifiant stable, libellé, portée, priorité, cooldown et usages optionnels ;
- `InteractionSystem.getPrompt` renvoie la meilleure cible à proximité, sélectionnée de façon déterministe (priorité, distance, identifiant d'entité) ;
- `requestInteraction(playerId)` met en file une demande ; `update` vérifie à nouveau la cible et déclenche le callback uniquement si l'interaction reste possible ;
- les interactables à usages limités sont désactivés après leur dernière utilisation.

Exemple de liaison à une mission :

```ts
const interactions = new InteractionSystem({
  onInteracted: ({ playerId, interactableId }) => {
    missions.reportEvent(world, playerId, { type: "interact", targetId: interactableId });
  },
});
```

Le système expose des données de prompt sans imposer de présentation graphique. Voir `docs/adr/0004-contextual-interactions.md`.
