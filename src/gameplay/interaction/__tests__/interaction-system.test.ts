import { describe, expect, it, vi } from "vitest";
import { Transform } from "../../ecs/components";
import { World } from "../../ecs/world";
import { addInteractable, Interactable } from "../interactable-components";
import { InteractionSystem } from "../interaction-system";

function makeTarget(world: World, id: string, x: number, options: Parameters<typeof addInteractable>[2] = { id, label: id }) {
  const entity = world.createEntity();
  world.addComponent(entity, Transform, { position: { x, y: 0, z: 0 }, rotationY: 0 });
  addInteractable(world, entity, options);
  return entity;
}

function makePlayer(world: World): number {
  const player = world.createEntity();
  world.addComponent(player, Transform, { position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
  return player;
}

describe("InteractionSystem", () => {
  it("selects the nearest enabled interactable in range", () => {
    const world = new World();
    const player = makePlayer(world);
    const far = makeTarget(world, "far", 2);
    const near = makeTarget(world, "near", 1);
    const system = new InteractionSystem();
    expect(system.getPrompt(world, player)?.targetId).toBe(near);
    expect(system.getPrompt(world, player)?.targetId).not.toBe(far);
  });

  it("uses priority before distance, then entity id for stable ties", () => {
    const world = new World();
    const player = makePlayer(world);
    const first = makeTarget(world, "first", 1, { id: "first", label: "First", priority: 2 });
    makeTarget(world, "higher", 2, { id: "higher", label: "Higher", priority: 3 });
    const system = new InteractionSystem();
    expect(system.getPrompt(world, player)?.interactableId).toBe("higher");
    const tied = makeTarget(world, "tie", 1, { id: "tie", label: "Tie", priority: 2 });
    expect(system.getPrompt(world, player)?.targetId).toBe(first);
    expect(tied).toBeGreaterThan(first);
  });

  it("returns no prompt without a player transform or in-range target", () => {
    const world = new World();
    const player = world.createEntity();
    const system = new InteractionSystem();
    expect(system.getPrompt(world, player)).toBeNull();
    world.addComponent(player, Transform, { position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    makeTarget(world, "distant", 10);
    expect(system.getPrompt(world, player)).toBeNull();
  });

  it("executes a queued interaction and reports a mission-friendly id", () => {
    const world = new World();
    const player = makePlayer(world);
    makeTarget(world, "contact", 1, { id: "mission-contact", label: "Parler" });
    const onInteracted = vi.fn();
    const system = new InteractionSystem({ onInteracted });
    system.requestInteraction(player);
    system.update(world, 1 / 60);
    expect(onInteracted).toHaveBeenCalledWith(expect.objectContaining({
      playerId: player, interactableId: "mission-contact", label: "Parler",
    }));
  });

  it("deduplicates repeated requests from one player in a tick", () => {
    const world = new World();
    const player = makePlayer(world);
    makeTarget(world, "door", 1);
    const callback = vi.fn();
    const system = new InteractionSystem({ onInteracted: callback });
    system.requestInteraction(player);
    system.requestInteraction(player);
    system.update(world, 0);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("honors cooldowns and resets them over fixed updates", () => {
    const world = new World();
    const player = makePlayer(world);
    makeTarget(world, "terminal", 1, { id: "terminal", label: "Utiliser", cooldownSeconds: 1 });
    const callback = vi.fn();
    const system = new InteractionSystem({ onInteracted: callback });
    system.requestInteraction(player);
    system.update(world, 0);
    system.requestInteraction(player);
    system.update(world, 0);
    expect(callback).toHaveBeenCalledOnce();
    system.requestInteraction(player);
    system.update(world, 1);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("supports limited-use interactables and disables them when exhausted", () => {
    const world = new World();
    const player = makePlayer(world);
    const target = makeTarget(world, "pickup", 1, { id: "pickup", label: "Ramasser", uses: 1 });
    const system = new InteractionSystem();
    system.requestInteraction(player);
    system.update(world, 0);
    expect(world.getComponent(target, Interactable)?.enabled).toBe(false);
    expect(system.getPrompt(world, player)).toBeNull();
  });

  it("validates interactable definitions", () => {
    const world = new World();
    const entity = world.createEntity();
    expect(() => addInteractable(world, entity, { id: "", label: "Door" })).toThrow();
    expect(() => addInteractable(world, entity, { id: "door", label: "Door", range: 0 })).toThrow();
    expect(() => addInteractable(world, entity, { id: "door", label: "Door", uses: 0 })).toThrow();
  });
});
