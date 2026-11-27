import { describe, expect, it, vi } from "vitest";
import { Inventory } from "../../gameplay/ecs/components";
import { World } from "../../gameplay/ecs/world";
import { ProgressionSystem } from "../../gameplay/progression/progression-system";
import type { MissionDefinition, MissionUpdate } from "../mission-types";
import { MissionRewardService } from "../mission-rewards";

const definition: MissionDefinition = {
  id: "repair-delivery",
  title: "Livraison de pièces",
  description: "Livrer les pièces à l'atelier.",
  objectives: [{ id: "drop", type: "interact", targetId: "workshop", description: "Livrer" }],
  reward: {
    experience: 125,
    cash: 250,
    items: [{ itemId: "repair-kit", quantity: 2 }],
  },
};

function completedUpdate(playerId: number): MissionUpdate {
  return {
    playerId,
    missionId: definition.id,
    progress: {
      missionId: definition.id,
      status: "completed",
      elapsedSeconds: 12,
      objectives: [{ objectiveId: "drop", currentCount: 1, requiredCount: 1, completed: true }],
    },
  };
}

describe("mission reward service", () => {
  it("grants XP, inventory items and delegates cash to the economy adapter", () => {
    const world = new World();
    const playerId = world.createEntity();
    world.addComponent(playerId, Inventory, { capacity: 4, slots: [] });
    const progression = new ProgressionSystem();
    progression.initialize(world, playerId);
    const onCashReward = vi.fn();
    const rewards = new MissionRewardService({ progression, onCashReward });

    const result = rewards.apply(world, completedUpdate(playerId), definition);

    expect(result).toMatchObject({
      playerId,
      missionId: definition.id,
      experienceAwarded: 125,
      cashAmount: 250,
      cashHandled: true,
      items: [{ itemId: "repair-kit", requested: 2, awarded: 2, remaining: 0 }],
    });
    expect(progression.getSnapshot(world, playerId)?.experience).toBe(125);
    expect(world.getComponent(playerId, Inventory)?.slots).toEqual([{ itemId: "repair-kit", quantity: 2 }]);
    expect(onCashReward).toHaveBeenCalledWith(playerId, 250, definition.id);
  });

  it("reports unhandled cash and partial item delivery when inventory is full", () => {
    const world = new World();
    const playerId = world.createEntity();
    world.addComponent(playerId, Inventory, {
      capacity: 1,
      slots: [{ itemId: "existing", quantity: 1 }],
    });
    const rewards = new MissionRewardService();

    const result = rewards.apply(world, completedUpdate(playerId), definition);

    expect(result?.cashHandled).toBe(false);
    expect(result?.items[0]).toMatchObject({ requested: 2, awarded: 0, remaining: 2 });
  });

  it("does not reward unfinished, mismatched or already rewarded missions", () => {
    const world = new World();
    const playerId = world.createEntity();
    const progression = new ProgressionSystem();
    progression.initialize(world, playerId);
    const rewards = new MissionRewardService({ progression });
    const update = completedUpdate(playerId);

    expect(rewards.apply(world, { ...update, progress: { ...update.progress, status: "active" } }, definition)).toBeNull();
    expect(rewards.apply(world, update, { ...definition, id: "another-mission" })).toBeNull();
    expect(rewards.apply(world, update, definition)).not.toBeNull();
    expect(rewards.apply(world, update, definition)).toBeNull();
    expect(progression.getSnapshot(world, playerId)?.experience).toBe(125);
  });

  it("safely ignores invalid reward quantities", () => {
    const world = new World();
    const playerId = world.createEntity();
    const rewards = new MissionRewardService();
    const invalidDefinition: MissionDefinition = {
      ...definition,
      reward: { experience: Number.NaN, cash: -5, items: [{ itemId: " ", quantity: 3.5 }] },
    };

    const result = rewards.apply(world, completedUpdate(playerId), invalidDefinition);

    expect(result).toMatchObject({
      experienceAwarded: 0,
      cashAmount: 0,
      cashHandled: false,
      items: [{ itemId: "", requested: 3, awarded: 0, remaining: 3 }],
    });
  });
});
