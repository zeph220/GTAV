import type { EntityId } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import type { GameSystem } from "../ecs/system";
import { ControlLock } from "../ecs/components";
import { Health, Stunned } from "./combat-components";
import type { World } from "../ecs/world";

export interface DamageRequest {
  sourceId: EntityId;
  targetId: EntityId;
  amount: number;
  stunDurationSeconds?: number;
}

export interface DamageResult extends DamageRequest {
  appliedDamage: number;
  remainingHealth: number;
}

export interface DamageSystemOptions {
  onDamage?: (result: DamageResult) => void;
}

/** Resolves queued non-lethal damage. Health can never fall below one. */
export class DamageSystem implements GameSystem {
  private readonly pending: DamageRequest[] = [];

  constructor(private readonly options: DamageSystemOptions = {}) {}

  enqueueDamage(request: DamageRequest): void {
    if (
      !Number.isFinite(request.amount) || request.amount <= 0 ||
      !Number.isFinite(request.stunDurationSeconds ?? 0) ||
      (request.stunDurationSeconds ?? 0) < 0
    ) {
      throw new Error("Invalid non-lethal damage request");
    }
    this.pending.push({ ...request });
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;

    for (const entityId of world.query(Stunned)) {
      const stunned = world.getComponent(entityId, Stunned);
      if (!stunned) continue;
      stunned.remainingSeconds = Math.max(0, stunned.remainingSeconds - dt);
      if (stunned.remainingSeconds === 0) world.removeComponent(entityId, Stunned);
    }
    for (const entityId of world.query(ControlLock)) {
      const lock = world.getComponent(entityId, ControlLock);
      if (!lock || lock.remainingSeconds === null) continue;
      lock.remainingSeconds = Math.max(0, lock.remainingSeconds - dt);
      if (lock.remainingSeconds === 0) world.removeComponent(entityId, ControlLock);
    }

    const requests = this.pending.splice(0);
    for (const request of requests) {
      const health = world.getComponent(request.targetId, Health);
      if (!health) continue;

      health.maximum = Math.max(1, Number.isFinite(health.maximum) ? health.maximum : 1);
      health.current = Math.min(
        health.maximum,
        Math.max(1, Number.isFinite(health.current) ? health.current : 1),
      );
      const appliedDamage = Math.min(request.amount, Math.max(0, health.current - 1));
      health.current = Math.max(1, health.current - appliedDamage);

      const stunDuration = request.stunDurationSeconds ?? 0;
      if (stunDuration > 0) {
        const existingStun = world.getComponent(request.targetId, Stunned);
        if (existingStun) existingStun.remainingSeconds = Math.max(existingStun.remainingSeconds, stunDuration);
        else world.addComponent(request.targetId, Stunned, { remainingSeconds: stunDuration });

        const lock = world.getComponent(request.targetId, ControlLock);
        if (!lock || lock.reason !== "detained") {
          const remaining = lock?.remainingSeconds ?? 0;
          world.addComponent(request.targetId, ControlLock, {
            reason: "stunned",
            remainingSeconds: Math.max(remaining, stunDuration),
          });
        }
      }

      this.options.onDamage?.({
        ...request,
        appliedDamage,
        remainingHealth: health.current,
      });
    }
  }
}
