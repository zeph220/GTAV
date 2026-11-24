import { defineComponent } from "../ecs/component";

export interface HealthComponent {
  /** Health is clamped to [1, maximum]; this iteration has no lethal damage. */
  current: number;
  maximum: number;
}

export interface NonLethalWeaponComponent {
  kind: "stun-projector";
  damage: number;
  range: number;
  cooldownSeconds: number;
  cooldownRemaining: number;
  stunDurationSeconds: number;
}

export interface StunnedComponent {
  remainingSeconds: number;
}

export const Health = defineComponent<HealthComponent>("Health");
export const NonLethalWeapon = defineComponent<NonLethalWeaponComponent>("NonLethalWeapon");
export const Stunned = defineComponent<StunnedComponent>("Stunned");
