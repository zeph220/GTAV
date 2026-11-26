import type { EntityId, Vec3 } from "../../shared/types";
import { defineComponent } from "../../gameplay/ecs/component";

export type DynamicEventCategory =
  | "community"
  | "infrastructure"
  | "public-gathering"
  | "lost-property"
  | "gang-tension";

export type DynamicEventState = "active" | "completed" | "expired" | "cancelled";

export interface DynamicEventComponent {
  definitionId: string;
  title: string;
  description: string;
  category: DynamicEventCategory;
  locationId: string;
  districtId: string;
  position: Vec3;
  state: DynamicEventState;
  elapsedSeconds: number;
  remainingSeconds: number;
  progress: number;
  requiredProgress: number;
  participantIds: EntityId[];
  relatedFactionIds: string[];
}

export const DynamicEvent = defineComponent<DynamicEventComponent>("DynamicEvent");
