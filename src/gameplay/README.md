# Gameplay — Project Phoenix

Ce dossier appartient à ChatGPT conformément à `plandebuild.md`.

## Itération 1

- **ECS** : `World` gère les entités et leurs composants typés.
- **Déplacement** : `PlayerMovementSystem` lit `PlayerInputState`, met à jour
  `Transform` et `Velocity`, puis émet `player:moved`.
- **Caméra** : `ThirdPersonCameraSystem` calcule une pose indépendante de Three.js.
  L'adaptateur R3F doit recopier `CameraRig.position` et `CameraRig.target`.
- **Inventaire** : ajout, retrait atomique, comptage des objets et événement
  `inventory:changed`.
- **Joueur** : `createPlayer` instancie les composants par défaut.

## Contrat d'intégration avec le monde et le rendu

Le module de rendu ne doit pas importer les détails internes de l'ECS. Il lit
uniquement les snapshots/composants utiles et peut alimenter
`PlayerInputState.current` depuis les contrôles clavier/manette.

Le repère monde utilise Y vers le haut et -Z comme direction avant initiale.
Les distances sont exprimées en unités monde ; le choix de l'échelle visuelle
reste du ressort de `src/world` et `src/rendering`.

## Exemple d'initialisation

```ts
const world = new World();
const events = new GameEventBus();
const playerId = createPlayer(world);
const movement = new PlayerMovementSystem(events);
const camera = new ThirdPersonCameraSystem();

const input = world.getComponent(playerId, PlayerInputState);
if (input) input.current = { moveX: 0, moveY: 1, sprint: false };

movement.update(world, 1 / 60);
camera.update(world, 1 / 60);
```

Les composants partagés et événements se trouvent dans `src/shared`.
Toute évolution de ces contrats doit être additive et documentée.
