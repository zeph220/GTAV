import type { EntityId } from "../../shared/types";
import { defineComponent } from "../../gameplay/ecs/component";

export type GangMemberRole = "leader" | "lookout" | "scout" | "runner" | "patrol";
export type GangMemberState = "idle" | "alert" | "confronting" | "retreating";

export interface GangMemberComponent {
  gangId: string;
  role: GangMemberRole;
  state: GangMemberState;
  perceptionRadius: number;
  aggression: number;
  targetPlayerId: EntityId | null;
}

export const GangMember = defineComponent<GangMemberComponent>("GangMember");
