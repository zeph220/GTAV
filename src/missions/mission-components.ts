import { defineComponent } from "../gameplay/ecs/component";
import type { MissionProgress } from "./mission-types";

export interface MissionJournalComponent {
  activeMissionIds: string[];
  completedMissionIds: string[];
  failedMissionIds: string[];
  missions: Record<string, MissionProgress>;
}

export const MissionJournal = defineComponent<MissionJournalComponent>("MissionJournal");
