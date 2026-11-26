import type { EntityId } from "../shared/types";

export type MissionObjectiveType =
  | "reach-location"
  | "interact"
  | "collect-item"
  | "talk-to";

export type MissionEvent =
  | { type: "reach-location"; targetId: string; amount?: number }
  | { type: "interact"; targetId: string; amount?: number }
  | { type: "collect-item"; targetId: string; amount?: number }
  | { type: "talk-to"; targetId: string; amount?: number };

export interface MissionObjectiveDefinition {
  id: string;
  type: MissionObjectiveType;
  targetId: string;
  description: string;
  requiredCount?: number;
}

export interface MissionReward {
  /** Kept as mission metadata; the economy/progression systems consume it later. */
  cash?: number;
  experience?: number;
  items?: ReadonlyArray<{ itemId: string; quantity: number }>;
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  objectives: readonly MissionObjectiveDefinition[];
  prerequisites?: readonly string[];
  contactId?: string;
  timeLimitSeconds?: number;
  reward?: MissionReward;
}

export type MissionStatus = "active" | "completed" | "failed";

export interface MissionObjectiveProgress {
  objectiveId: string;
  currentCount: number;
  requiredCount: number;
  completed: boolean;
}

export interface MissionProgress {
  missionId: string;
  status: MissionStatus;
  objectives: MissionObjectiveProgress[];
  elapsedSeconds: number;
}

export interface MissionJournalSnapshot {
  playerId: EntityId;
  activeMissionIds: readonly string[];
  completedMissionIds: readonly string[];
  failedMissionIds: readonly string[];
  missions: Readonly<Record<string, MissionProgress>>;
}

export interface MissionUpdate {
  playerId: EntityId;
  missionId: string;
  progress: MissionProgress;
}
