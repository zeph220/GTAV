import type { EntityId, InventorySnapshot, Vec3 } from "./types";

/**
 * Contrat d'événements du jeu. Les noms et payloads existants sont stables :
 * toute évolution doit être additive afin de préserver les consommateurs.
 */
export interface GameEventPayloads {
  "player:moved": {
    entityId: EntityId;
    position: Vec3;
  };
  "inventory:changed": InventorySnapshot;
}

export type GameEventName = keyof GameEventPayloads;
