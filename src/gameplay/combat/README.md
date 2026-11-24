# Combat — Itération 3

Le système de combat de cette itération est volontairement non létal.

## Mise en place

Ajoutez la santé aux entités pouvant être touchées et équipez le joueur :

```ts
initializeHealth(world, playerId, 100);
equipStunProjector(world, playerId);
initializeHealth(world, civilianId, 100);
```

Le projecteur incapacitant est configurable (dégâts, portée, cadence et durée
d'étourdissement). Les dégâts ne peuvent jamais réduire la santé sous 1.

## Ordre des systèmes

La boucle ECS doit exécuter `CombatSystem` avant `DamageSystem` :

```ts
const damage = new DamageSystem();
const police = new PoliceSystem(navGraph);
const combat = new CombatSystem(damage, {
  onAssault: (event) => police.reportIncident(world, {
    suspectId: event.attackerId,
    position: event.attackerPosition,
    severity: "assault",
  }),
});

combat.requestAttack(playerId, civilianId);
// À chaque frame :
combat.update(world, deltaSeconds);
damage.update(world, deltaSeconds);
police.update(world, deltaSeconds);
```

`requestAttack` valide les entités, transforms, la portée, l'état incapacitant
et le cooldown. `onAssault` raccorde les agressions réussies au système de police.
