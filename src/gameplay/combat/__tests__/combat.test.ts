import { describe, expect, it, vi } from "vitest";
import { ControlLock, PlayerInputState, Transform } from "../../ecs/components";
import { World } from "../../ecs/world";
import { createPlayer } from "../../player/create-player";
import { PlayerMovementSystem } from "../../systems/player-movement-system";
import { CombatSystem } from "../combat-system";
import { DamageSystem } from "../damage-system";
import { equipStunProjector, initializeHealth } from "../equipment";
import { Health, NonLethalWeapon, Stunned } from "../combat-components";

function makeCombatants(distance = 4) {
  const world = new World();
  const attackerId = world.createEntity();
  const targetId = world.createEntity();
  world.addComponent(attackerId, Transform, { position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
  world.addComponent(targetId, Transform, { position: { x: distance, y: 0, z: 0 }, rotationY: 0 });
  initializeHealth(world, attackerId);
  initializeHealth(world, targetId);
  equipStunProjector(world, attackerId, { damage: 30, range: 10, cooldownSeconds: 0.5 });
  return { world, attackerId, targetId };
}

describe("non-lethal combat", () => {
  it("applies damage and an incapacitating status to a valid target", () => {
    const { world, attackerId, targetId } = makeCombatants();
    const applied: Array<{ appliedDamage: number; remainingHealth: number }> = [];
    const damage = new DamageSystem({ onDamage: (result) => applied.push(result) });
    const enqueue = vi.spyOn(damage, "enqueueDamage");
    const resolutions: Array<{ success: boolean; reason?: string }> = [];
    const combat = new CombatSystem(damage, {
      onAttackResolved: (result) => resolutions.push(result),
    });
    combat.requestAttack(attackerId, targetId);
    combat.update(world, 1 / 60);
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0]?.success).toBe(true);
    expect(enqueue).toHaveBeenCalledTimes(1);
    damage.update(world, 1 / 60);
    expect(applied).toMatchObject([{ appliedDamage: 30, remainingHealth: 70 }]);
    expect(world.getComponent(targetId, Health)?.current).toBe(70);
    expect(world.getComponent(targetId, Stunned)?.remainingSeconds).toBe(2.5);
    expect(world.getComponent(targetId, ControlLock)?.reason).toBe("stunned");
  });

  it("applies directly queued damage to an entity with health", () => {
    const { world, attackerId, targetId } = makeCombatants();
    const applied: Array<{ appliedDamage: number; remainingHealth: number }> = [];
    const damage = new DamageSystem({ onDamage: (result) => applied.push(result) });
    damage.enqueueDamage({ sourceId: attackerId, targetId, amount: 30 });
    damage.update(world, 1 / 60);
    expect(applied).toMatchObject([{ appliedDamage: 30, remainingHealth: 70 }]);
    expect(world.getComponent(targetId, Health)?.current).toBe(70);
  });

  it("never reduces health below one, even after repeated hits", () => {
    const { world, attackerId, targetId } = makeCombatants();
    const damage = new DamageSystem();
    const resolutions: Array<{ success: boolean; reason?: string }> = [];
    const damageResults: Array<{ appliedDamage: number; remainingHealth: number }> = [];
    const damage = new DamageSystem({ onDamage: (result) => damageResults.push(result) });
    const combat = new CombatSystem(damage, { onAttackResolved: (result) => resolutions.push(result) });
    world.getComponent(attackerId, NonLethalWeapon)!.cooldownSeconds = 0;
    world.getComponent(targetId, Health)!.current = 20;
    for (let index = 0; index < 4; index += 1) {
      combat.requestAttack(attackerId, targetId);
      combat.update(world, 0.1);
      damage.update(world, 0.1);
    }
    expect(resolutions).toHaveLength(4);
    expect(resolutions.every((result) => result.success)).toBe(true);
    expect(damageResults).toHaveLength(4);
    expect(world.getComponent(targetId, Health)?.current).toBe(1);
  });

  it("rejects attacks outside the weapon range", () => {
    const { world, attackerId, targetId } = makeCombatants(20);
    const results: Array<{ success: boolean; reason?: string }> = [];
    const combat = new CombatSystem(new DamageSystem(), {
      onAttackResolved: (result) => results.push(result),
    });
    combat.requestAttack(attackerId, targetId);
    combat.update(world, 1 / 60);
    expect(results[0]).toMatchObject({ success: false, reason: "out-of-range" });
  });

  it("enforces the weapon cooldown between attacks", () => {
    const { world, attackerId, targetId } = makeCombatants();
    const results: Array<{ success: boolean; reason?: string }> = [];
    const damage = new DamageSystem();
    const combat = new CombatSystem(damage, {
      onAttackResolved: (result) => results.push(result),
    });
    combat.requestAttack(attackerId, targetId);
    combat.update(world, 0.1);
    combat.requestAttack(attackerId, targetId);
    combat.update(world, 0.1);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.reason).toBe("cooldown");
  });

  it("emits an assault report only for a successful hit", () => {
    const { world, attackerId, targetId } = makeCombatants();
    const reports: number[] = [];
    const results: Array<{ success: boolean; reason?: string }> = [];
    const combat = new CombatSystem(new DamageSystem(), {
      onAssault: (event) => reports.push(event.attackerId),
      onAttackResolved: (result) => results.push(result),
    });
    combat.requestAttack(attackerId, targetId);
    combat.update(world, 0.1);
    expect(results).toEqual([{ attackerId, targetId, success: true }]);
    expect(reports).toEqual([attackerId]);
  });

  it("blocks player movement for the duration of a control lock", () => {
    const world = new World();
    const playerId = createPlayer(world);
    const input = world.getComponent(playerId, PlayerInputState)!;
    input.current = { moveX: 0, moveY: 1, sprint: false };
    world.addComponent(playerId, ControlLock, { reason: "stunned", remainingSeconds: 1 });
    new PlayerMovementSystem().update(world, 1 / 60);
    expect(world.getComponent(playerId, Transform)?.position.z).toBe(0);
  });
});
