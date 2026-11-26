import type { EntityId } from "../../shared/types";
import type { World } from "../ecs/world";
import { createDefaultSaveAdapters } from "./save-adapters";
import type { SaveDocument, SaveLoadResult, SaveSectionAdapter, SaveSlotSummary } from "./save-types";
import { SAVE_SCHEMA, SAVE_VERSION } from "./save-types";
import type { SaveStorage } from "./save-storage";

const SAVE_PREFIX = "nova-city:save:";

/** Versioned save slots with pluggable storage and component serializers. */
export class SaveManager {
  private readonly adapters = new Map<string, SaveSectionAdapter>();

  constructor(
    private readonly storage: SaveStorage,
    adapters: readonly SaveSectionAdapter[] = createDefaultSaveAdapters(),
    private readonly clock: () => Date = () => new Date(),
  ) {
    for (const adapter of adapters) this.registerAdapter(adapter);
  }

  registerAdapter(adapter: SaveSectionAdapter): void {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(adapter.id)) throw new Error("Invalid save section id: " + adapter.id);
    if (this.adapters.has(adapter.id)) throw new Error("Save adapter already registered: " + adapter.id);
    this.adapters.set(adapter.id, adapter);
  }

  async save(world: World, playerId: EntityId, slotId: string): Promise<SaveDocument> {
    validateSlotId(slotId);
    if (!world.hasEntity(playerId)) throw new Error("Cannot save an unknown player entity");
    const sections: Record<string, unknown> = {};
    for (const adapter of this.adapters.values()) {
      const value = adapter.capture(world, playerId);
      if (value !== undefined) {
        if (!adapter.validate(value)) throw new Error("Invalid save section produced by adapter: " + adapter.id);
        sections[adapter.id] = value;
      }
    }
    const document: SaveDocument = {
      schema: SAVE_SCHEMA, version: SAVE_VERSION, slotId,
      savedAt: this.clock().toISOString(), sourcePlayerId: playerId, sections,
    };
    const serialized = JSON.stringify(document);
    if (serialized.length > 2_000_000) throw new Error("Save slot exceeds the 2 MB limit");
    await this.storage.set(this.key(slotId), serialized);
    return document;
  }

  async load(world: World, playerId: EntityId, slotId: string): Promise<SaveLoadResult> {
    validateSlotId(slotId);
    if (!world.hasEntity(playerId)) return { ok: false, reason: "unknown-player" };
    const serialized = await this.storage.get(this.key(slotId));
    if (serialized === null) return { ok: false, reason: "missing" };
    let parsed: unknown;
    try { parsed = JSON.parse(serialized); } catch { return { ok: false, reason: "invalid" }; }
    if (!isRecord(parsed) || parsed.schema !== SAVE_SCHEMA || parsed.slotId !== slotId ||
      typeof parsed.savedAt !== "string" || !Number.isFinite(Date.parse(parsed.savedAt)) ||
      !Number.isInteger(parsed.sourcePlayerId) || !isRecord(parsed.sections)) {
      return { ok: false, reason: "invalid" };
    }
    if (parsed.version !== SAVE_VERSION) return { ok: false, reason: "unsupported-version" };
    for (const [id, value] of Object.entries(parsed.sections)) {
      const adapter = this.adapters.get(id);
      if (adapter && !adapter.validate(value)) return { ok: false, reason: "invalid" };
    }
    const document = parsed as unknown as SaveDocument;
    for (const [id, value] of Object.entries(document.sections)) this.adapters.get(id)?.restore(world, playerId, value);
    return { ok: true, document };
  }

  async deleteSlot(slotId: string): Promise<boolean> {
    validateSlotId(slotId);
    const key = this.key(slotId);
    const existed = (await this.storage.get(key)) !== null;
    if (existed) await this.storage.remove(key);
    return existed;
  }

  async listSlots(): Promise<SaveSlotSummary[]> {
    const keys = await this.storage.keys(SAVE_PREFIX);
    const slots: SaveSlotSummary[] = [];
    for (const key of keys) {
      const serialized = await this.storage.get(key);
      if (serialized === null) continue;
      try {
        const value: unknown = JSON.parse(serialized);
        if (!isRecord(value) || value.schema !== SAVE_SCHEMA || value.version !== SAVE_VERSION ||
          typeof value.slotId !== "string" || typeof value.savedAt !== "string" ||
          !Number.isInteger(value.sourcePlayerId)) continue;
        slots.push({ slotId: value.slotId, savedAt: value.savedAt, sourcePlayerId: value.sourcePlayerId as EntityId });
      } catch {
        // Corrupt slots remain visible through load(), but are omitted from this summary.
      }
    }
    return slots.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  private key(slotId: string): string { return SAVE_PREFIX + slotId; }
}

function validateSlotId(slotId: string): void {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(slotId)) {
    throw new Error("Save slot id must contain 1-32 letters, numbers, underscores or hyphens");
  }
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
