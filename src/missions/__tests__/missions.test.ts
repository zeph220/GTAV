import { describe, expect, it, vi } from "vitest";
import { World } from "../../gameplay/ecs/world";
import { DialogueSystem } from "../dialogue-system";
import { MissionJournal } from "../mission-components";
import type { DialogueDefinition } from "../dialogue-system";
import type { MissionDefinition } from "../mission-types";
import { MissionSystem } from "../mission-system";

const missionA: MissionDefinition = {
  id: "intro",
  title: "Introduction",
  description: "Découvrir le quartier.",
  objectives: [
    { id: "visit", type: "reach-location", targetId: "plaza", description: "Visiter la place" },
    { id: "talk", type: "talk-to", targetId: "guide", description: "Parler au guide" },
    { id: "parts", type: "collect-item", targetId: "part", description: "Trouver deux pièces", requiredCount: 2 },
  ],
  reward: { experience: 100 },
};

const missionB: MissionDefinition = {
  id: "follow-up",
  title: "Suite",
  description: "Mission débloquée après l'introduction.",
  prerequisites: ["intro"],
  objectives: [
    { id: "interact", type: "interact", targetId: "terminal", description: "Utiliser le terminal" },
  ],
};

function setup() {
  const world = new World();
  const playerId = world.createEntity();
  const missions = new MissionSystem([missionA, missionB]);
  missions.initializeJournal(world, playerId);
  return { world, playerId, missions };
}

describe("mission progression", () => {
  it("requires prerequisites and validates ordered objectives", () => {
    const { world, playerId, missions } = setup();
    expect(missions.startMission(world, playerId, "follow-up")).toBe(false);
    expect(missions.startMission(world, playerId, "intro")).toBe(true);
    expect(missions.reportEvent(world, playerId, { type: "talk-to", targetId: "guide" })).toBe(0);
    expect(missions.reportEvent(world, playerId, { type: "reach-location", targetId: "plaza", amount: 0 })).toBe(0);
    missions.reportEvent(world, playerId, { type: "reach-location", targetId: "plaza" });
    missions.reportEvent(world, playerId, { type: "talk-to", targetId: "guide" });
    missions.reportEvent(world, playerId, { type: "collect-item", targetId: "part", amount: 2 });
    expect(missions.getSnapshot(world, playerId)?.completedMissionIds).toEqual(["intro"]);
    expect(missions.startMission(world, playerId, "follow-up")).toBe(true);
  });

  it("does not mutate internal journal state through returned snapshots", () => {
    const { world, playerId, missions } = setup();
    missions.startMission(world, playerId, "intro");
    const snapshot = missions.getSnapshot(world, playerId)!;
    snapshot.activeMissionIds.splice(0);
    snapshot.missions.intro!.objectives[0]!.currentCount = 99;
    expect(world.getComponent(playerId, MissionJournal)?.activeMissionIds).toEqual(["intro"]);
    expect(world.getComponent(playerId, MissionJournal)?.missions.intro?.objectives[0]?.currentCount).toBe(0);
  });

  it("fails a timed mission when its time limit expires", () => {
    const timed: MissionDefinition = { ...missionB, id: "timed", prerequisites: [], timeLimitSeconds: 0.15 };
    const world = new World();
    const playerId = world.createEntity();
    const missions = new MissionSystem([timed]);
    missions.initializeJournal(world, playerId);
    missions.startMission(world, playerId, "timed");
    missions.update(world, 0.1);
    missions.update(world, 0.1);
    expect(missions.getSnapshot(world, playerId)?.failedMissionIds).toEqual(["timed"]);
  });

  it("notifies completion callbacks once", () => {
    const onCompleted = vi.fn();
    const world = new World();
    const playerId = world.createEntity();
    const missions = new MissionSystem([{
      ...missionA,
      objectives: [missionA.objectives[0]!],
    }], { onCompleted });
    missions.initializeJournal(world, playerId);
    missions.startMission(world, playerId, "intro");
    missions.reportEvent(world, playerId, { type: "reach-location", targetId: "plaza" });
    missions.reportEvent(world, playerId, { type: "reach-location", targetId: "plaza" });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate objective identifiers", () => {
    expect(() => new MissionSystem([{
      ...missionA,
      objectives: [missionA.objectives[0]!, missionA.objectives[0]!],
    }])).toThrow("Duplicate objective id");
  });
});

describe("NPC dialogue", () => {
  const dialogue: DialogueDefinition = {
    id: "guide-intro",
    startNodeId: "start",
    nodes: {
      start: {
        id: "start",
        speaker: "Guide",
        text: "Besoin d'aide ?",
        choices: [
          { id: "yes", text: "Oui", nextNodeId: "end", missionEvent: { type: "talk-to", targetId: "guide" } },
          { id: "no", text: "Non" },
        ],
      },
      end: { id: "end", speaker: "Guide", text: "Bonne visite.", end: true },
    },
  };

  it("supports branches and emits a mission event only for the selected choice", () => {
    const onMissionEvent = vi.fn();
    const dialogues = new DialogueSystem([dialogue], { onMissionEvent });
    expect(dialogues.start(1, "guide-intro")?.id).toBe("start");
    expect(dialogues.choose(1, "invalid")).toBeNull();
    expect(onMissionEvent).not.toHaveBeenCalled();
    expect(dialogues.choose(1, "yes")?.id).toBe("end");
    expect(onMissionEvent).toHaveBeenCalledWith(1, { type: "talk-to", targetId: "guide" });
  });

  it("ends a conversation when a choice has no next node", () => {
    const onEnded = vi.fn();
    const dialogues = new DialogueSystem([dialogue], { onEnded });
    dialogues.start(5, "guide-intro");
    expect(dialogues.choose(5, "no")).toBeNull();
    expect(dialogues.getSession(5)).toBeNull();
    expect(onEnded).toHaveBeenCalledWith(5, "guide-intro");
  });

  it("rejects dialogue definitions with missing branches", () => {
    expect(() => new DialogueSystem([{
      id: "broken",
      startNodeId: "start",
      nodes: {
        start: {
          id: "start",
          speaker: "Guide",
          text: "Hello",
          choices: [{ id: "go", text: "Go", nextNodeId: "missing" }],
        },
      },
    }])).toThrow("Unknown next dialogue node");
  });
});
