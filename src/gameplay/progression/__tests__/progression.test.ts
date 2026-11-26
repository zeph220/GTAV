import { describe, expect, it, vi } from "vitest";
import { World } from "../../ecs/world";
import { Progression, Reputation } from "../progression-components";
import { ProgressionSystem } from "../progression-system";
import { ReputationSystem } from "../reputation-system";

describe("reputation", () => {
  it("clamps faction standing and reports the resulting tier", () => {
    const onChanged = vi.fn();
    const world = new World();
    const playerId = world.createEntity();
    const reputation = new ReputationSystem({ onChanged });
    reputation.initialize(world, playerId);
    expect(reputation.adjust(world, playerId, "civic", 80)?.standing).toBe("respected");
    expect(reputation.adjust(world, playerId, "civic", 80)?.value).toBe(100);
    expect(reputation.get(world, playerId, "civic")).toBe(100);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("keeps reputations isolated per player and returns defensive snapshots", () => {
    const world = new World();
    const first = world.createEntity();
    const second = world.createEntity();
    const reputation = new ReputationSystem();
    reputation.initialize(world, first);
    reputation.initialize(world, second);
    reputation.adjust(world, first, "civic", -30);
    const snapshot = reputation.getSnapshot(world, first)! as Record<string, number>;
    snapshot.civic = 100;
    expect(reputation.get(world, first, "civic")).toBe(-30);
    expect(reputation.get(world, second, "civic")).toBe(0);
    expect(world.getComponent(first, Reputation)?.factions.civic).toBe(-30);
  });
});

describe("experience progression", () => {
  it("levels up, awards skill points and emits each level transition", () => {
    const onLevelUp = vi.fn();
    const world = new World();
    const playerId = world.createEntity();
    const progression = new ProgressionSystem([], { baseExperience: 100, levelExponent: 1, onLevelUp });
    progression.initialize(world, playerId);
    const snapshot = progression.awardExperience(world, playerId, 350)!;
    expect(snapshot.level).toBe(3);
    expect(snapshot.unspentSkillPoints).toBe(2);
    expect(onLevelUp).toHaveBeenCalledTimes(2);
  });

  it("validates perk level, prerequisites and skill point cost", () => {
    const world = new World();
    const playerId = world.createEntity();
    const progression = new ProgressionSystem([
      { id: "focus", name: "Focus", description: "Improves focus.", requiredLevel: 1, skillPointCost: 1 },
      { id: "expert", name: "Expert", description: "Advanced training.", requiredLevel: 2, skillPointCost: 1, prerequisites: ["focus"] },
    ], { baseExperience: 100, levelExponent: 1 });
    progression.initialize(world, playerId);
    expect(progression.unlockPerk(world, playerId, "focus")).toEqual({ success: false, reason: "insufficient-points" });
    progression.awardExperience(world, playerId, 100);
    expect(progression.unlockPerk(world, playerId, "focus").success).toBe(true);
    expect(progression.unlockPerk(world, playerId, "expert")).toEqual({ success: false, reason: "insufficient-points" });
    progression.awardExperience(world, playerId, 200);
    expect(progression.unlockPerk(world, playerId, "expert").success).toBe(true);
    expect(world.getComponent(playerId, Progression)?.unlockedPerks).toEqual(["focus", "expert"]);
  });

  it("ignores invalid and non-positive experience awards", () => {
    const world = new World();
    const playerId = world.createEntity();
    const progression = new ProgressionSystem();
    progression.initialize(world, playerId);
    expect(progression.awardExperience(world, playerId, -5)).toBeNull();
    expect(progression.awardExperience(world, playerId, Number.NaN)).toBeNull();
    expect(world.getComponent(playerId, Progression)?.experience).toBe(0);
  });
});
