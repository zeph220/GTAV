import type { EntityId, Vec3 } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import type { GameSystem } from "../ecs/system";
import { Transform } from "../ecs/components";
import type { World } from "../ecs/world";
import { Health, NonLethalWeapon, Stunned } from "./combat-components";
import type { DamageSystem } from "./damage-system";

export type AttackFailure =
  | "missing-attacker"
  | "missing-target"
  | "missing-weapon"
  | "missing-transform"
  | "out-of-range"
  | "cooldown"
  | "attacker-stunned";

export interface AttackResolution {
  attackerId: EntityId;
  targetId: EntityId;
  success: boolean;
  reason?: AttackFailure;
}

export interface AssaultEvent {
  attackerId: EntityId;
  targetId: EntityId;
  attackerPosition: Vec3;
  targetPosition: Vec3;
  weapon: "stun-projector";
}

export interface CombatSystemOptions {
  onAttackResolved?: (result: AttackResolution) => void;
  onAssault?: (event: AssaultEvent) => void;
}

/** Handles target validation and weapon cadence; DamageSystem applies the hit. */
export class CombatSystem implements GameSystem {
  private readonly requests: Array<{ attackerId: EntityId; targetId: EntityId }> = [];

  constructor(
    private readonly damageSystem: DamageSystem,
    private readonly options: CombatSystemOptions = {},
  ) {}

  requestAttack(attackerId: EntityId, targetId: EntityId): void {
    this.requests.push({ attackerId, targetId });
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;

    for (const entityId of world.query(NonLethalWeapon)) {
      const weapon = world.getComponent(entityId, NonLethalWeapon);
      if (weapon) weapon.cooldownRemaining = Math.max(0, weapon.cooldownRemaining - dt);
    }

    for (const request of this.requests.splice(0)) {
      this.options.onAttackResolved?.(
        this.resolve(world, request.attackerId, request.targetId),
      );
    }
  }

  private resolve(world: World, attackerId: EntityId, targetId: EntityId): AttackResolution {
    const fail = (reason: AttackFailure): AttackResolution => ({
      attackerId, targetId, success: false, reason,
    });

    if (!world.hasEntity(attackerId)) return fail("missing-attacker");
    if (attackerId === targetId || !world.hasEntity(targetId) || !world.hasComponent(targetId, Health)) {
      return fail("missing-target");
    }
    if (world.hasComponent(attackerId, Stunned)) return fail("attacker-stunned");

    const weapon = world.getComponent(attackerId, NonLethalWeapon);
    if (!weapon) return fail("missing-weapon");
    if (weapon.cooldownRemaining > 0) return fail("cooldown");

    const attackerTransform = world.getComponent(attackerId, Transform);
    const targetTransform = world.getComponent(targetId, Transform);
    if (!attackerTransform || !targetTransform) return fail("missing-transform");
    if (distance3(attackerTransform.position, targetTransform.position) > weapon.range) {
      return fail("out-of-range");
    }

    weapon.cooldownRemaining = weapon.cooldownSeconds;
    this.damageSystem.enqueueDamage({
      sourceId: attackerId,
      targetId,
      amount: weapon.damage,
      stunDurationSeconds: weapon.stunDurationSeconds,
    });
    this.options.onAssault?.({
      attackerId,
      targetId,
      attackerPosition: { ...attackerTransform.position },
      targetPosition: { ...targetTransform.position },
      weapon: weapon.kind,
    });
    return { attackerId, targetId, success: true };
  }
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
