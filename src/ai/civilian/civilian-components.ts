import type { Vec3 } from "../../shared/types";
import { defineComponent } from "../../gameplay/ecs/component";

export type CivilianState = "idle" | "walking" | "waiting" | "fleeing";
export type CivilianArchetype = "commuter" | "resident" | "visitor" | "worker";

export interface CivilianComponent {
  archetype: CivilianArchetype;
  state: CivilianState;
  walkSpeed: number;
  destination: Vec3 | null;
  path: Vec3[];
  waypointIndex: number;
  waitRemaining: number;
  decisionTimer: number;
  preferredWanderRadius: number;
  alertness: number;
  homeNodeId?: string;
  workNodeId?: string;
  schedulePhase: "off-duty" | "commuting-to-work" | "at-work" | "commuting-home";
}

export interface CivilianNeedsComponent {
  energy: number;
  social: number;
  purpose: number;
}

export const Civilian = defineComponent<CivilianComponent>("Civilian");
export const CivilianNeeds = defineComponent<CivilianNeedsComponent>("CivilianNeeds");
