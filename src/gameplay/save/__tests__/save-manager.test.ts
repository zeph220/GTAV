import { describe, expect, it } from "vitest";
import { Health } from "../../combat/combat-components";
import { Inventory, Transform } from "../../ecs/components";
import { MissionJournal } from "../../../missions/mission-components";
import { World } from "../../ecs/world";
import { Progression, Reputation } from "../../progression/progression-components";
import { InMemorySaveStorage } from "../save-storage";
import { SaveManager } from "../save-manager";

describe("save manager", () => {
  it("saves and restores supported player components into another entity", async () => {
    const storage = new InMemorySaveStorage();
    const saves = new SaveManager(storage, undefined, () => new Date("2026-11-26T10:00:00.000Z"));
    const sourceWorld = new World();
    const sourcePlayer = sourceWorld.createEntity();
    sourceWorld.addComponent(sourcePlayer, Transform, { position: { x: 12, y: 0, z: -4 }, rotationY: 1.25 });
    sourceWorld.addComponent(sourcePlayer, Health, { current: 75, maximum: 100 });
    sourceWorld.addComponent(sourcePlayer, Inventory, { capacity: 4, slots: [{ itemId: "spare-part", quantity: 3 }] });
    sourceWorld.addComponent(sourcePlayer, Reputation, { factions: { civic: 45 } });
    sourceWorld.addComponent(sourcePlayer, Progression, {
      experience: 250, level: 2, unspentSkillPoints: 1, unlockedPerks: ["steady-hands"],
    });
    sourceWorld.addComponent(sourcePlayer, MissionJournal, {
      activeMissionIds: ["neighbourhood-helper"], completedMissionIds: ["first-day-nova-city"],
      failedMissionIds: [], missions: {
        "neighbourhood-helper": { missionId: "neighbourhood-helper", status: "active", elapsedSeconds: 12,
          objectives: [{ objectiveId: "parts", currentCount: 2, requiredCount: 3, completed: false }] },
      },
    });
    await saves.save(sourceWorld, sourcePlayer, "slot-1");

    const targetWorld = new World();
    const targetPlayer = targetWorld.createEntity();
    targetWorld.addComponent(targetPlayer, Transform, { position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const result = await saves.load(targetWorld, targetPlayer, "slot-1");
    expect(result.ok).toBe(true);
    expect(targetWorld.getComponent(targetPlayer, Transform)?.position).toEqual({ x: 12, y: 0, z: -4 });
    expect(targetWorld.getComponent(targetPlayer, Health)?.current).toBe(75);
    expect(targetWorld.getComponent(targetPlayer, Inventory)?.slots).toEqual([{ itemId: "spare-part", quantity: 3 }]);
    expect(targetWorld.getComponent(targetPlayer, Reputation)?.factions.civic).toBe(45);
    expect(targetWorld.getComponent(targetPlayer, Progression)?.unlockedPerks).toEqual(["steady-hands"]);
    expect(targetWorld.getComponent(targetPlayer, MissionJournal)?.missions["neighbourhood-helper"]?.objectives[0]?.currentCount).toBe(2);
  });

  it("rejects malformed save data before applying it", async () => {
    const storage = new InMemorySaveStorage();
    const saves = new SaveManager(storage);
    const world = new World();
    const playerId = world.createEntity();
    world.addComponent(playerId, Transform, { position: { x: 3, y: 0, z: 0 }, rotationY: 0 });
    await storage.set("nova-city:save:broken", JSON.stringify({
      schema: "nova-city.save", version: 1, slotId: "broken",
      savedAt: "2026-11-26T10:00:00.000Z", sourcePlayerId: 99,
      sections: { "player.transform": { position: { x: "bad", y: 0, z: 0 }, rotationY: 0 } },
    }));
    expect(await saves.load(world, playerId, "broken")).toEqual({ ok: false, reason: "invalid" });
    expect(world.getComponent(playerId, Transform)?.position.x).toBe(3);
  });

  it("lists and deletes slots while validating identifiers", async () => {
    const storage = new InMemorySaveStorage();
    const saves = new SaveManager(storage);
    const world = new World();
    const playerId = world.createEntity();
    await expect(saves.save(world, playerId, "../bad")).rejects.toThrow("Save slot id");
    await saves.save(world, playerId, "manual_1");
    expect((await saves.listSlots()).map((slot) => slot.slotId)).toEqual(["manual_1"]);
    expect(await saves.deleteSlot("manual_1")).toBe(true);
    expect(await saves.deleteSlot("manual_1")).toBe(false);
  });
});
