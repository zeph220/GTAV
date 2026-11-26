import type { EntityId } from "../../shared/types";
import type { GameSystem } from "../ecs/system";
import type { World } from "../ecs/world";
import { Reputation } from "./progression-components";

export type ReputationStanding = "hostile" | "unfriendly" | "neutral" | "friendly" | "respected";
export interface ReputationChange {
  playerId: EntityId;
  factionId: string;
  previousValue: number;
  value: number;
  delta: number;
  standing: ReputationStanding;
  reason?: string;
}
export interface ReputationSystemOptions {
  minimum?: number;
  maximum?: number;
  onChanged?: (change: ReputationChange) => void;
}

/** Bounded, per-player standing for each stable faction ID. */
export class ReputationSystem implements GameSystem {
  private readonly minimum: number;
  private readonly maximum: number;

  constructor(private readonly options: ReputationSystemOptions = {}) {
    this.minimum = finiteBound(options.minimum, -100);
    this.maximum = finiteBound(options.maximum, 100);
    if (this.minimum >= this.maximum) throw new Error("Reputation minimum must be lower than maximum");
  }

  initialize(world: World, playerId: EntityId): void {
    if (!world.hasEntity(playerId)) throw new Error("Cannot initialize reputation for an unknown entity");
    if (!world.hasComponent(playerId, Reputation)) world.addComponent(playerId, Reputation, { factions: {} });
  }

  adjust(world: World, playerId: EntityId, factionId: string, amount: number, reason?: string): ReputationChange | null {
    if (!factionId.trim() || !Number.isFinite(amount) || amount === 0) return null;
    const component = world.getComponent(playerId, Reputation);
    if (!component) return null;
    const previousValue = component.factions[factionId] ?? 0;
    const value = clamp(previousValue + amount, this.minimum, this.maximum);
    if (value === previousValue) return null;
    component.factions[factionId] = value;
    const change: ReputationChange = {
      playerId, factionId, previousValue, value, delta: value - previousValue,
      standing: this.getStanding(value), reason,
    };
    this.options.onChanged?.({ ...change });
    return change;
  }

  set(world: World, playerId: EntityId, factionId: string, value: number): ReputationChange | null {
    const component = world.getComponent(playerId, Reputation);
    if (!component || !factionId.trim() || !Number.isFinite(value)) return null;
    return this.adjust(world, playerId, factionId, value - (component.factions[factionId] ?? 0), "set");
  }

  get(world: World, playerId: EntityId, factionId: string): number {
    return world.getComponent(playerId, Reputation)?.factions[factionId] ?? 0;
  }

  getStanding(value: number): ReputationStanding {
    if (value <= -75) return "hostile";
    if (value <= -25) return "unfriendly";
    if (value < 25) return "neutral";
    if (value < 75) return "friendly";
    return "respected";
  }

  getSnapshot(world: World, playerId: EntityId): Readonly<Record<string, number>> | null {
    const component = world.getComponent(playerId, Reputation);
    return component ? { ...component.factions } : null;
  }

  update(_world: World, _deltaSeconds: number): void {
    // Standing changes only on explicit gameplay events.
  }
}

function finiteBound(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
