import type { EntityId, Vec3 } from "../../shared/types";
import type {
  DynamicEventCategory,
  DynamicEventComponent,
  DynamicEventState,
} from "./dynamic-event-components";

export interface DynamicEventDefinition {
  id: string;
  title: string;
  description: string;
  category: DynamicEventCategory;
  weight: number;
  durationSeconds: number;
  cooldownSeconds: number;
  requiredProgress: number;
  requiredLocationTags?: readonly string[];
  allowedDistrictIds?: readonly string[];
  relatedFactionIds?: readonly string[];
}

export interface DynamicEventLocation {
  id: string;
  districtId: string;
  position: Vec3;
  tags: readonly string[];
}

export interface DynamicEventSnapshot extends Omit<DynamicEventComponent, "participantIds" | "relatedFactionIds"> {
  entityId: EntityId;
  participantIds: readonly EntityId[];
  relatedFactionIds: readonly string[];
}

export interface DynamicEventLifecycleEvent {
  entityId: EntityId;
  event: DynamicEventSnapshot;
}

export interface DynamicEventProgressEvent extends DynamicEventLifecycleEvent {
  playerId: EntityId;
  contribution: number;
}

export type DynamicEventTerminalState = Extract<DynamicEventState, "completed" | "expired" | "cancelled">;
