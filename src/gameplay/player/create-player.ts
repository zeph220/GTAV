import {
  DEFAULT_INVENTORY_CAPACITY,
  PLAYER_CAMERA_DISTANCE,
  PLAYER_CAMERA_FOLLOW_SPEED,
  PLAYER_CAMERA_LOOK_AT_HEIGHT,
  PLAYER_CAMERA_PITCH,
  PLAYER_SPRINT_MULTIPLIER,
  PLAYER_WALK_SPEED,
} from "../../shared/constants";
import type { Vec3 } from "../../shared/types";
import {
  CameraFollow,
  CameraRig,
  CharacterMotor,
  Inventory,
  PlayerInputState,
  Transform,
  Velocity,
} from "../ecs/components";
import { World } from "../ecs/world";

/** Crée une entité joueur prête pour les systèmes de l'itération 1. */
export function createPlayer(
  world: World,
  spawnPosition: Vec3 = { x: 0, y: 0, z: 0 },
): number {
  const player = world.createEntity();

  world.addComponent(player, Transform, {
    position: { ...spawnPosition },
    rotationY: 0,
  });
  world.addComponent(player, Velocity, {
    linear: { x: 0, y: 0, z: 0 },
  });
  world.addComponent(player, PlayerInputState, {
    current: { moveX: 0, moveY: 0, sprint: false },
  });
  world.addComponent(player, CharacterMotor, {
    walkSpeed: PLAYER_WALK_SPEED,
    sprintMultiplier: PLAYER_SPRINT_MULTIPLIER,
  });
  world.addComponent(player, CameraFollow, {
    yaw: 0,
    pitch: PLAYER_CAMERA_PITCH,
    distance: PLAYER_CAMERA_DISTANCE,
    lookAtHeight: PLAYER_CAMERA_LOOK_AT_HEIGHT,
    followSpeed: PLAYER_CAMERA_FOLLOW_SPEED,
  });
  world.addComponent(player, CameraRig, {
    position: {
      x: spawnPosition.x,
      y: spawnPosition.y + 2,
      z: spawnPosition.z + PLAYER_CAMERA_DISTANCE,
    },
    target: {
      x: spawnPosition.x,
      y: spawnPosition.y + PLAYER_CAMERA_LOOK_AT_HEIGHT,
      z: spawnPosition.z,
    },
  });
  world.addComponent(player, Inventory, {
    capacity: DEFAULT_INVENTORY_CAPACITY,
    slots: [],
  });

  return player;
}
