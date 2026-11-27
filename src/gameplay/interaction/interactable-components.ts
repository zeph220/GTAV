import type { EntityId } from "../../shared/types";
import { defineComponent } from "../ecs/component";
import type { World } from "../ecs/world";

export interface InteractableComponent {
  id: string;
  label: string;
  range: number;
  priority: number;
  enabled: boolean;
  cooldownSeconds: number;
  cooldownRemaining: number;
  remainingUses: number | null;
}

export interface InteractableDefinition {
  id: string;
  label: string;
  range?: number;
  priority?: number;
  enabled?: boolean;
  cooldownSeconds?: number;
  uses?: number | null;
}

export const Interactable = defineComponent<InteractableComponent>("Interactable");

export function addInteractable(world: World, entityId: EntityId, definition: InteractableDefinition): void {
  const id = definition.id.trim();
  const label = definition.label.trim();
  const range = definition.range ?? 2.5;
  const priority = definition.priority ?? 0;
  const cooldownSeconds = definition.cooldownSeconds ?? 0;
  const uses = definition.uses ?? null;

  if (!id || !label) throw new Error("Interactable id and label are required");
  if (!Number.isFinite(range) || range <= 0) throw new Error("Interactable range must be positive");
  if (!Number.isFinite(priority)) throw new Error("Interactable priority must be finite");
  if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) throw new Error("Interactable cooldown must be non-negative");
  if (uses !== null && (!Number.isInteger(uses) || uses < 1)) throw new Error("Interactable uses must be a positive integer or null");

  world.addComponent(entityId, Interactable, {
    id, label, range, priority, enabled: definition.enabled ?? true,
    cooldownSeconds, cooldownRemaining: 0, remainingUses: uses,
  });
}
