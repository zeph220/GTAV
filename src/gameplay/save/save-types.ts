import type { EntityId } from "../../shared/types";
import type { World } from "../ecs/world";

export const SAVE_SCHEMA = "nova-city.save";
export const SAVE_VERSION = 1;

export interface SaveDocument {
  schema: typeof SAVE_SCHEMA;
  version: typeof SAVE_VERSION;
  slotId: string;
  savedAt: string;
  sourcePlayerId: EntityId;
  sections: Record<string, unknown>;
}
export interface SaveSectionAdapter {
  id: string;
  capture(world: World, playerId: EntityId): unknown | undefined;
  validate(value: unknown): boolean;
  restore(world: World, playerId: EntityId, value: unknown): void;
}
export interface SaveSlotSummary {
  slotId: string;
  savedAt: string;
  sourcePlayerId: EntityId;
}
export type SaveLoadResult =
  | { ok: true; document: SaveDocument }
  | { ok: false; reason: "missing" | "invalid" | "unsupported-version" | "unknown-player" };
