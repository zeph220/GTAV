import {
  MAX_SIMULATION_DELTA_SECONDS,
} from "../../shared/constants";
import type { Vec3 } from "../../shared/types";
import { GameEventBus } from "../events/game-event-bus";
import type { GameSystem } from "../ecs/system";
import {
  CharacterMotor,
  PlayerInputState,
  Transform,
  Velocity,
} from "../ecs/components";
import { World } from "../ecs/world";

/**
 * Déplacement au sol indépendant de Three.js. L'orientation est exprimée
 * autour de Y ; l'axe avant du personnage est -Z.
 */
export class PlayerMovementSystem implements GameSystem {
  constructor(private readonly events?: GameEventBus) {}

  update(world: World, deltaSeconds: number): void {
    const delta = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;
    if (delta === 0) return;

    for (const entityId of world.query(
      Transform,
      Velocity,
      PlayerInputState,
      CharacterMotor,
    )) {
      const transform = world.getComponent(entityId, Transform);
      const velocity = world.getComponent(entityId, Velocity);
      const inputState = world.getComponent(entityId, PlayerInputState);
      const motor = world.getComponent(entityId, CharacterMotor);
      if (!transform || !velocity || !inputState || !motor) continue;

      const inputX = clampAxis(inputState.current.moveX);
      const inputY = clampAxis(inputState.current.moveY);
      const magnitude = Math.hypot(inputX, inputY);
      const scale = magnitude > 1 ? 1 / magnitude : 1;
      const isMoving = magnitude > 0.0001;
      const directionX = isMoving ? inputX * scale : 0;
      const directionZ = isMoving ? -inputY * scale : 0;

      const speed =
        motor.walkSpeed *
        (inputState.current.sprint ? motor.sprintMultiplier : 1);

      velocity.linear.x = directionX * speed;
      velocity.linear.y = 0;
      velocity.linear.z = directionZ * speed;

      transform.position.x += velocity.linear.x * delta;
      transform.position.z += velocity.linear.z * delta;

      if (isMoving) {
        transform.rotationY = Math.atan2(directionX, -directionZ);
      }

      if (isMoving) {
        this.events?.emit("player:moved", {
          entityId,
          position: copyVec3(transform.position),
        });
      }
    }
  }
}

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function copyVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}
