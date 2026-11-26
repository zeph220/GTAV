import { describe, expect, it, vi } from "vitest";
import { World } from "../../../gameplay/ecs/world";
import { DynamicEvent } from "../dynamic-event-components";
import { DynamicEventDirector } from "../dynamic-event-system";
import type { DynamicEventDefinition } from "../dynamic-event-types";

const definition: DynamicEventDefinition = {
  id: "community-repair",
  title: "Community repair",
  description: "Help local residents repair a public notice board.",
  category: "community",
  weight: 2,
  durationSeconds: 10,
  cooldownSeconds: 30,
  requiredProgress: 3,
  requiredLocationTags: ["public-square"],
  allowedDistrictIds: ["Downtown"],
};

function registerTestLocation(director: DynamicEventDirector, id = "plaza"): void {
  director.registerLocation({
    id,
    districtId: "Downtown",
    position: { x: 10, y: 0, z: 5 },
    tags: ["public-square", "community-space"],
  });
}

describe("dynamic event director", () => {
  it("starts an eligible event at a world-provided location", () => {
    const onStarted = vi.fn();
    const director = new DynamicEventDirector({ onStarted });
    director.registerDefinition(definition);
    registerTestLocation(director);
    const world = new World();

    const eventId = director.startEvent(world, definition.id, "plaza");
    expect(eventId).not.toBeNull();
    expect(world.getComponent(eventId!, DynamicEvent)).toMatchObject({
      definitionId: "community-repair",
      locationId: "plaza",
      districtId: "Downtown",
      state: "active",
      requiredProgress: 3,
      position: { x: 10, y: 0, z: 5 },
    });
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it("requires matching tags and district and does not invent locations", () => {
    const director = new DynamicEventDirector();
    director.registerDefinition(definition);
    const world = new World();

    expect(director.startEvent(world, definition.id, "missing")).toBeNull();
    director.registerLocation({
      id: "campus",
      districtId: "University Zone",
      position: { x: 0, y: 0, z: 0 },
      tags: ["public-square"],
    });
    expect(director.startEvent(world, definition.id, "campus")).toBeNull();
    expect(director.getActiveEvents(world)).toHaveLength(0);
  });

  it("tracks contributions and completes once the target is reached", () => {
    const onProgress = vi.fn();
    const onCompleted = vi.fn();
    const director = new DynamicEventDirector({ onProgress, onCompleted });
    director.registerDefinition(definition);
    registerTestLocation(director);
    const world = new World();
    const playerId = world.createEntity();
    const eventId = director.startEvent(world, definition.id, "plaza")!;

    expect(director.contribute(world, eventId, playerId, 2)?.progress).toBe(2);
    const completed = director.contribute(world, eventId, playerId, 1);
    expect(completed).toMatchObject({
      state: "completed",
      progress: 3,
      participantIds: [playerId],
    });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(director.getActiveEvents(world)).toHaveLength(0);
    expect(director.contribute(world, eventId, playerId)).toBeNull();
  });

  it("expires an event when its timer reaches zero", () => {
    const onExpired = vi.fn();
    const director = new DynamicEventDirector({ onExpired, spawnIntervalSeconds: 5000 });
    director.registerDefinition({ ...definition, durationSeconds: 0.2 });
    registerTestLocation(director);
    const world = new World();
    const eventId = director.startEvent(world, definition.id, "plaza")!;

    director.update(world, 0.1);
    director.update(world, 0.1);
    expect(director.getSnapshot(world, eventId)?.state).toBe("expired");
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("does not start a second instance of a definition that is already active", () => {
    const director = new DynamicEventDirector({ spawnIntervalSeconds: 5000 });
    director.registerDefinition({ ...definition, cooldownSeconds: 0 });
    registerTestLocation(director);
    registerTestLocation(director, "second-plaza");
    const world = new World();

    expect(director.startEvent(world, definition.id, "plaza")).not.toBeNull();
    expect(director.startEvent(world, definition.id, "second-plaza")).toBeNull();
    expect(director.getActiveEvents(world)).toHaveLength(1);
  });

  it("uses the injected random source for deterministic automatic scheduling", () => {
    const onStarted = vi.fn();
    const director = new DynamicEventDirector({
      random: () => 0,
      spawnIntervalSeconds: 0.1,
      maxActiveEvents: 1,
      onStarted,
    });
    director.registerDefinition(definition);
    director.registerDefinition({
      ...definition,
      id: "infrastructure-repair",
      category: "infrastructure",
      requiredLocationTags: ["utility-access"],
    });
    registerTestLocation(director);
    const world = new World();

    director.update(world, 0.1);
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(director.getActiveEvents(world)).toHaveLength(1);
    expect(director.getActiveEvents(world)[0]?.definitionId).toBe(definition.id);
  });

  it("enforces cooldowns and location exclusivity", () => {
    const director = new DynamicEventDirector({ spawnIntervalSeconds: 5000 });
    director.registerDefinition(definition);
    registerTestLocation(director);
    registerTestLocation(director, "second-plaza");
    const world = new World();

    const eventId = director.startEvent(world, definition.id, "plaza");
    expect(eventId).not.toBeNull();
    expect(director.startEvent(world, definition.id, "second-plaza")).toBeNull();
    expect(director.startEvent(world, definition.id, "plaza")).toBeNull();
  });

  it("returns defensive copies of event snapshots", () => {
    const director = new DynamicEventDirector();
    director.registerDefinition({ ...definition, relatedFactionIds: ["northbank-circle"] });
    registerTestLocation(director);
    const world = new World();
    const eventId = director.startEvent(world, definition.id, "plaza")!;
    const snapshot = director.getSnapshot(world, eventId)!;

    (snapshot.participantIds as number[]).push(999);
    (snapshot.relatedFactionIds as string[]).push("corrupted");
    snapshot.position.x = 999;

    expect(director.getSnapshot(world, eventId)).toMatchObject({
      participantIds: [],
      relatedFactionIds: ["northbank-circle"],
      position: { x: 10, y: 0, z: 5 },
    });
  });
});
