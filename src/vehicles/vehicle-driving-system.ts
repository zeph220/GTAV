import { MAX_SIMULATION_DELTA_SECONDS } from "../shared/constants";
import { Transform, Velocity } from "../gameplay/ecs/components";
import type { GameSystem } from "../gameplay/ecs/system";
import type { World } from "../gameplay/ecs/world";
import {
  VehicleControls,
  VehicleDynamics,
} from "./vehicle-components";

/**
 * Arcade-ready bicycle model, independent of Three.js.
 *
 * Positive yaw points the vehicle toward +X; its forward axis is -Z.
 * Speed is signed, so negative values represent reverse motion.
 */
export class VehicleDrivingSystem implements GameSystem {
  update(world: World, deltaSeconds: number): void {
    const delta = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;
    if (delta === 0) return;

    for (const entityId of world.query(Transform, Velocity, VehicleDynamics, VehicleControls)) {
      const transform = world.getComponent(entityId, Transform);
      const velocity = world.getComponent(entityId, Velocity);
      const dynamics = world.getComponent(entityId, VehicleDynamics);
      const controls = world.getComponent(entityId, VehicleControls);
      if (!transform || !velocity || !dynamics || !controls) continue;

      let speed = dynamics.speedMps;
      const brakeInput = Math.max(controls.brake, controls.handbrake ? 1 : 0);
      const reversingAgainstMotion = speed * controls.throttle < -0.15;

      if (brakeInput > 0) {
        const braking = controls.handbrake
          ? dynamics.handbrakeAccelerationMps2
          : dynamics.brakingAccelerationMps2;
        speed = approachZero(speed, braking * brakeInput * delta);
      } else if (reversingAgainstMotion && Math.abs(speed) > 0.4) {
        speed = approachZero(
          speed,
          dynamics.brakingAccelerationMps2 * 0.55 * Math.abs(controls.throttle) * delta,
        );
      } else {
        speed += controls.throttle * dynamics.engineAccelerationMps2 * delta;
      }

      const drag = dynamics.rollingResistanceMps2 +
        dynamics.aerodynamicDrag * speed * Math.abs(speed);
      speed = approachZero(speed, Math.max(0, drag) * delta);
      speed = Math.max(
        -dynamics.maxReverseSpeedMps,
        Math.min(dynamics.maxForwardSpeedMps, speed),
      );
      if (Math.abs(speed) < 0.01) speed = 0;

      const speedRatio = Math.min(1, Math.abs(speed) / dynamics.maxForwardSpeedMps);
      const steeringScale = 1 - speedRatio * 0.48;
      const desiredSteering =
        controls.steering * dynamics.maxSteeringAngleRadians * steeringScale;
      const steeringBlend = 1 - Math.exp(-dynamics.steeringResponse * delta);
      dynamics.steeringAngleRadians +=
        (desiredSteering - dynamics.steeringAngleRadians) * steeringBlend;

      const yawRate =
        (speed / dynamics.wheelBaseMeters) * Math.tan(dynamics.steeringAngleRadians);
      transform.rotationY = normalizeAngle(transform.rotationY + yawRate * delta);

      velocity.linear.x = Math.sin(transform.rotationY) * speed;
      velocity.linear.y = 0;
      velocity.linear.z = -Math.cos(transform.rotationY) * speed;

      transform.position.x += velocity.linear.x * delta;
      transform.position.z += velocity.linear.z * delta;

      dynamics.speedMps = speed;
      dynamics.gear = speed > 0.12
        ? "forward"
        : speed < -0.12
          ? "reverse"
          : "neutral";
    }
  }
}

function approachZero(value: number, amount: number): number {
  if (value > 0) return Math.max(0, value - amount);
  if (value < 0) return Math.min(0, value + amount);
  return 0;
}

function normalizeAngle(angle: number): number {
  const tau = Math.PI * 2;
  return ((angle + Math.PI) % tau + tau) % tau - Math.PI;
}
