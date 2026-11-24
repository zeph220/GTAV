import { describe, expect, it, vi } from "vitest";
import { GameEventBus } from "../events/game-event-bus";
import {
  CameraRig,
  Inventory,
  PlayerInputState,
  Transform,
} from "../ecs/components";
import { World } from "../ecs/world";
import { addItem, getItemQuantity, removeItem } from "../inventory/inventory";
import { createPlayer } from "../player/create-player";
import { PlayerMovementSystem } from "../systems/player-movement-system";
import { ThirdPersonCameraSystem } from "../systems/third-person-camera-system";

describe("Project Phoenix gameplay foundations", () => {
  it("creates a player with the iteration 1 components", () => {
    const world = new World();
    const playerId = createPlayer(world, { x: 2, y: 0, z: 3 });

    expect(world.hasComponent(playerId, Transform)).toBe(true);
    expect(world.hasComponent(playerId, Inventory)).toBe(true);
    expect(world.getComponent(playerId, Transform)?.position).toEqual({
      x: 2,
      y: 0,
      z: 3,
    });
  });

  it("moves forward at walking speed and reports the new position", () => {
    const world = new World();
    const playerId = createPlayer(world);
    const input = world.getComponent(playerId, PlayerInputState);
    const onMoved = vi.fn();
    const events = new GameEventBus();
    events.on("player:moved", onMoved);
    if (!input) throw new Error("Player input component missing");

    input.current = { moveX: 0, moveY: 1, sprint: false };
    new PlayerMovementSystem(events).update(world, 1 / 60);

    const transform = world.getComponent(playerId, Transform);
    expect(transform?.position.z).toBeCloseTo(-4.5 / 60);
    expect(onMoved).toHaveBeenCalledTimes(1);
  });

  it("does not emit movement events while the player is idle", () => {
    const world = new World();
    createPlayer(world);
    const onMoved = vi.fn();
    const events = new GameEventBus();
    events.on("player:moved", onMoved);

    new PlayerMovementSystem(events).update(world, 1 / 60);
    expect(onMoved).not.toHaveBeenCalled();
  });

  it("adds and removes inventory quantities and emits changes", () => {
    const world = new World();
    const playerId = createPlayer(world);
    const events = new GameEventBus();
    const onChanged = vi.fn();
    events.on("inventory:changed", onChanged);

    expect(addItem(world, playerId, "first-aid-kit", 3, events)).toBe(3);
    expect(getItemQuantity(world, playerId, "first-aid-kit")).toBe(3);
    expect(removeItem(world, playerId, "first-aid-kit", 2, events)).toBe(true);
    expect(getItemQuantity(world, playerId, "first-aid-kit")).toBe(1);
    expect(removeItem(world, playerId, "first-aid-kit", 2, events)).toBe(false);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("updates a third-person camera rig from the player transform", () => {
    const world = new World();
    const playerId = createPlayer(world);

    new ThirdPersonCameraSystem().update(world, 1 / 60);

    const cameraRig = world.getComponent(playerId, CameraRig);
    expect(cameraRig?.target.y).toBeGreaterThan(0);
    expect(cameraRig?.position.z).toBeGreaterThan(0);
  });
});
