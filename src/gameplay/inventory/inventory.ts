import {
  DEFAULT_ITEM_MAX_STACK,
} from "../../shared/constants";
import { GameEventBus } from "../events/game-event-bus";
import { Inventory } from "../ecs/components";
import { World } from "../ecs/world";

/**
 * Ajoute autant d'unités que possible. Retourne la quantité réellement ajoutée.
 * Les piles existantes sont remplies avant la création de nouveaux emplacements.
 */
export function addItem(
  world: World,
  entityId: number,
  itemId: string,
  quantity: number,
  events?: GameEventBus,
  maxStack = DEFAULT_ITEM_MAX_STACK,
): number {
  const inventory = world.getComponent(entityId, Inventory);
  if (!inventory || !itemId.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  const stackLimit = Math.max(1, Math.floor(maxStack));
  let remaining = Math.floor(quantity);
  const initial = remaining;

  for (const slot of inventory.slots) {
    if (slot.itemId !== itemId || slot.quantity >= stackLimit) continue;
    const added = Math.min(stackLimit - slot.quantity, remaining);
    slot.quantity += added;
    remaining -= added;
    if (remaining === 0) break;
  }

  while (remaining > 0 && inventory.slots.length < inventory.capacity) {
    const added = Math.min(stackLimit, remaining);
    inventory.slots.push({ itemId, quantity: added });
    remaining -= added;
  }

  const addedQuantity = initial - remaining;
  if (addedQuantity > 0) emitInventoryChanged(events, entityId, inventory.slots);
  return addedQuantity;
}

/** Retire une quantité exacte ; ne modifie rien si le stock est insuffisant. */
export function removeItem(
  world: World,
  entityId: number,
  itemId: string,
  quantity: number,
  events?: GameEventBus,
): boolean {
  const inventory = world.getComponent(entityId, Inventory);
  if (!inventory || !Number.isFinite(quantity) || quantity <= 0) return false;

  const requested = Math.floor(quantity);
  if (requested <= 0) return false;

  const available = getItemQuantity(world, entityId, itemId);
  if (available < requested) return false;

  let remaining = requested;
  for (let index = inventory.slots.length - 1; index >= 0; index -= 1) {
    const slot = inventory.slots[index];
    if (!slot || slot.itemId !== itemId) continue;

    const removed = Math.min(slot.quantity, remaining);
    slot.quantity -= removed;
    remaining -= removed;
    if (slot.quantity === 0) inventory.slots.splice(index, 1);
    if (remaining === 0) break;
  }

  emitInventoryChanged(events, entityId, inventory.slots);
  return true;
}

export function getItemQuantity(
  world: World,
  entityId: number,
  itemId: string,
): number {
  const inventory = world.getComponent(entityId, Inventory);
  if (!inventory) return 0;

  return inventory.slots.reduce(
    (total, slot) => total + (slot.itemId === itemId ? slot.quantity : 0),
    0,
  );
}

function emitInventoryChanged(
  events: GameEventBus | undefined,
  entityId: number,
  slots: readonly { itemId: string; quantity: number }[],
): void {
  events?.emit("inventory:changed", {
    entityId,
    slots: slots.map((slot) => ({ ...slot })),
  });
}
