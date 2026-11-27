import type { EntityId, Vec3 } from "../../shared/types";
import type { GameSystem } from "../ecs/system";
import { Transform } from "../ecs/components";
import type { World } from "../ecs/world";
import { Interactable } from "./interactable-components";

export interface InteractionPrompt {
  playerId: EntityId;
  targetId: EntityId;
  interactableId: string;
  label: string;
  distance: number;
}

export interface InteractionResult extends InteractionPrompt {
  remainingUses: number | null;
}

export interface InteractionSystemOptions {
  onInteracted?: (result: InteractionResult) => void;
}

/** Deterministic proximity-based interaction selection and execution. */
export class InteractionSystem implements GameSystem {
  private readonly requests: EntityId[] = [];

  constructor(private readonly options: InteractionSystemOptions = {}) {}

  requestInteraction(playerId: EntityId): void {
    if (!this.requests.includes(playerId)) this.requests.push(playerId);
  }

  getPrompt(world: World, playerId: EntityId): InteractionPrompt | null {
    const player = world.getComponent(playerId, Transform);
    if (!player) return null;

    let best: InteractionPrompt | null = null;
    let bestPriority = Number.NEGATIVE_INFINITY;
    for (const targetId of world.query(Transform, Interactable)) {
      if (targetId === playerId) continue;
      const target = world.getComponent(targetId, Transform);
      const item = world.getComponent(targetId, Interactable);
      if (!target || !item || !item.enabled || item.remainingUses === 0) continue;

      const distance = distance3(player.position, target.position);
      if (distance > item.range) continue;
      const candidate = {
        playerId, targetId, interactableId: item.id, label: item.label, distance,
      };
      if (!best || comparePrompt(candidate, best, item.priority, bestPriority) < 0) {
        best = candidate;
        bestPriority = item.priority;
      }
    }
    return best;
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    if (dt > 0) {
      for (const targetId of world.query(Interactable)) {
        const item = world.getComponent(targetId, Interactable);
        if (item) item.cooldownRemaining = Math.max(0, item.cooldownRemaining - dt);
      }
    }

    for (const playerId of this.requests.splice(0)) {
      const prompt = this.getPrompt(world, playerId);
      if (!prompt) continue;
      const item = world.getComponent(prompt.targetId, Interactable);
      if (!item || item.cooldownRemaining > 0) continue;

      if (item.remainingUses !== null) {
        item.remainingUses -= 1;
        if (item.remainingUses === 0) item.enabled = false;
      }
      item.cooldownRemaining = item.cooldownSeconds;
      this.options.onInteracted?.({ ...prompt, remainingUses: item.remainingUses });
    }
  }
}

function comparePrompt(a: InteractionPrompt, b: InteractionPrompt, aPriority: number, bPriority: number): number {
  if (aPriority !== bPriority) return bPriority - aPriority;
  if (Math.abs(a.distance - b.distance) > 1e-9) return a.distance - b.distance;
  return a.targetId - b.targetId;
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
