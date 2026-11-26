import { defineComponent } from "../ecs/component";

export interface ProgressionComponent {
  experience: number;
  level: number;
  unspentSkillPoints: number;
  unlockedPerks: string[];
}

export interface ReputationComponent {
  /** Faction scores are clamped to [-100, 100]. */
  factions: Record<string, number>;
}

export const Progression = defineComponent<ProgressionComponent>("Progression");
export const Reputation = defineComponent<ReputationComponent>("Reputation");
