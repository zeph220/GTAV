import {
  MAX_SIMULATION_DELTA_SECONDS,
} from "../../shared/constants";
import {
  CameraFollow,
  CameraRig,
  Transform,
} from "../ecs/components";
import { World } from "../ecs/world";

/**
 * Calcule la pose d'une caméra orbitale à la troisième personne.
 * Le rendu (Three.js / R3F) n'a qu'à recopier position et target dans sa caméra.
 */
export class ThirdPersonCameraSystem {
  update(world: World, deltaSeconds: number): void {
    const delta = Math.max(
      0,
      Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS),
    );
    if (delta === 0) return;

    for (const entityId of world.query(Transform, CameraFollow, CameraRig)) {
      const transform = world.getComponent(entityId, Transform);
      const follow = world.getComponent(entityId, CameraFollow);
      const rig = world.getComponent(entityId, CameraRig);
      if (!transform || !follow || !rig) continue;

      const pitch = Math.max(-0.2, Math.min(1.1, follow.pitch));
      const distance = Math.max(1, follow.distance);
      const horizontal = Math.cos(pitch) * distance;
      const desiredTarget = {
        x: transform.position.x,
        y: transform.position.y + follow.lookAtHeight,
        z: transform.position.z,
      };
      const desiredPosition = {
        x: desiredTarget.x + Math.sin(follow.yaw) * horizontal,
        y: desiredTarget.y + Math.sin(pitch) * distance,
        z: desiredTarget.z + Math.cos(follow.yaw) * horizontal,
      };

      const blend = 1 - Math.exp(-Math.max(0, follow.followSpeed) * delta);
      rig.position.x = lerp(rig.position.x, desiredPosition.x, blend);
      rig.position.y = lerp(rig.position.y, desiredPosition.y, blend);
      rig.position.z = lerp(rig.position.z, desiredPosition.z, blend);
      rig.target.x = lerp(rig.target.x, desiredTarget.x, blend);
      rig.target.y = lerp(rig.target.y, desiredTarget.y, blend);
      rig.target.z = lerp(rig.target.z, desiredTarget.z, blend);
    }
  }
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
