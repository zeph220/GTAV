import type { EntityId, Vec3 } from "../../shared/types";
import { defineComponent } from "../../gameplay/ecs/component";

export type PoliceOfficerState = "responding" | "pursuing" | "detaining";

export interface PoliceOfficerComponent {
  targetEntityId: EntityId;
  state: PoliceOfficerState;
  moveSpeed: number;
  path: Vec3[];
  waypointIndex: number;
  repathRemaining: number;
  detainProgress: number;
}

export interface WantedStatusComponent {
  heat: number;
  level: number;
  secondsSinceIncident: number;
  lastKnownPosition: Vec3;
  detained: boolean;
}

export const PoliceOfficer = defineComponent<PoliceOfficerComponent>("PoliceOfficer");
export const WantedStatus = defineComponent<WantedStatusComponent>("WantedStatus");
