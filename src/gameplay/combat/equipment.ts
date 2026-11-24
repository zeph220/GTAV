import type { EntityId } from "../../shared/types";
import { Health, NonLethalWeapon } from "./combat-components";
import type { World } from "../ecs/world";

export function initializeHealth(world: World, entityId: EntityId, maximum = 100): void {
  if (!Number.isFinite(maximum) || maximum < 1) {
    throw new Error("Health maximum must be a finite number greater than or equal to 1");
  }
  world.addComponent(entityId, Health, { current: maximum, maximum });
}

export type StunProjectorConfig = Partial<{
  damage: number;
  range: number;
  cooldownSeconds: number;
  stunDurationSeconds: number;
}>;

export function equipStunProjector(
  world: World,
  entityId: EntityId,
  config: StunProjectorConfig = {},
): void {
  const weapon = {
    kind: "stun-projector" as const,
    damage: config.damage ?? 24,
    range: config.range ?? 18,
    cooldownSeconds: config.cooldownSeconds ?? 0.8,
    cooldownRemaining: 0,
    stunDurationSeconds: config.stunDurationSeconds ?? 2.5,
  };
  if (
    !Number.isFinite(weapon.damage) || weapon.damage <= 0 ||
    !Number.isFinite(weapon.range) || weapon.range <= 0 ||
    !Number.isFinite(weapon.cooldownSeconds) || weapon.cooldownSeconds < 0 ||
    !Number.isFinite(weapon.stunDurationSeconds) || weapon.stunDurationSeconds < 0
  ) {
    throw new Error("Invalid stun-projector configuration");
  }
  world.addComponent(entityId, NonLethalWeapon, weapon);
}
