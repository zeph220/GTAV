import type { EntityId } from "../shared/types";
import type { World } from "../gameplay/ecs/world";
import { addItem } from "../gameplay/inventory/inventory";
import type { ProgressionSystem } from "../gameplay/progression/progression-system";
import type { MissionDefinition, MissionUpdate } from "./mission-types";

export interface MissionRewardItemResult {
  itemId: string;
  requested: number;
  awarded: number;
  remaining: number;
}

export interface MissionRewardResult {
  playerId: EntityId;
  missionId: string;
  experienceAwarded: number;
  items: MissionRewardItemResult[];
  cashAmount: number;
  cashHandled: boolean;
}

export interface MissionRewardServiceOptions {
  progression?: ProgressionSystem;
  /** Connect this to the economy/ledger when that module is available. */
  onCashReward?: (playerId: EntityId, amount: number, missionId: string) => void;
}

/**
 * Applies completed mission rewards without coupling missions to the economy.
 * Connect through MissionSystem.onCompleted; one service instance applies a
 * given player's mission reward at most once.
 */
export class MissionRewardService {
  private readonly appliedRewards = new Set<string>();

  constructor(private readonly options: MissionRewardServiceOptions = {}) {}

  apply(
    world: World,
    update: MissionUpdate,
    definition: MissionDefinition,
  ): MissionRewardResult | null {
    if (update.progress.status !== "completed" || update.missionId !== definition.id) return null;

    const rewardKey = `${update.playerId}:${definition.id}`;
    if (this.appliedRewards.has(rewardKey)) return null;

    const reward = definition.reward;
    const experience = wholeNonNegative(reward?.experience);
    const cashAmount = wholeNonNegative(reward?.cash);
    const experienceAwarded = experience > 0 && this.options.progression
      ? (this.options.progression.awardExperience(world, update.playerId, experience) ? experience : 0)
      : 0;

    const items = (reward?.items ?? []).map(({ itemId, quantity }) => {
      const normalizedId = itemId.trim();
      const requested = wholeNonNegative(quantity);
      const awarded = normalizedId && requested > 0
        ? addItem(world, update.playerId, normalizedId, requested)
        : 0;
      return {
        itemId: normalizedId,
        requested,
        awarded,
        remaining: requested - awarded,
      };
    });

    let cashHandled = false;
    if (cashAmount > 0 && this.options.onCashReward) {
      this.options.onCashReward(update.playerId, cashAmount, definition.id);
      cashHandled = true;
    }

    this.appliedRewards.add(rewardKey);
    return {
      playerId: update.playerId,
      missionId: definition.id,
      experienceAwarded,
      items,
      cashAmount,
      cashHandled,
    };
  }
}

function wholeNonNegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}
