/**
 * Types partagés entre le gameplay, le monde et le rendu.
 * Les ajouts à ce fichier doivent rester rétrocompatibles.
 */

export type EntityId = number;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface PlayerInput {
  /** Axe horizontal normalisé : -1 (gauche) à 1 (droite). */
  moveX: number;
  /** Axe vertical normalisé : -1 (arrière) à 1 (avant). */
  moveY: number;
  sprint: boolean;
}

export interface InventorySnapshot {
  entityId: EntityId;
  slots: readonly ItemStack[];
}
