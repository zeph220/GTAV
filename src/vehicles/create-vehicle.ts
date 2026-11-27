import type { Vec3 } from "../shared/types";
import { Transform, Velocity } from "../gameplay/ecs/components";
import type { World } from "../gameplay/ecs/world";
import {
  DEFAULT_VEHICLE_HANDLING,
  VehicleControls,
  VehicleDynamics,
} from "./vehicle-components";

export type VehicleHandlingOptions = Partial<typeof DEFAULT_VEHICLE_HANDLING>;

export interface CreateVehicleOptions {
  position?: Vec3;
  rotationY?: number;
  handling?: VehicleHandlingOptions;
}

export function createVehicle(world: World, options: CreateVehicleOptions = {}): number {
  const position = options.position ?? { x: 0, y: 0, z: 0 };
  const rotationY = options.rotationY ?? 0;
  validatePosition(position);
  if (!Number.isFinite(rotationY)) {
    throw new Error("Vehicle rotationY must be finite");
  }

  const handling = { ...DEFAULT_VEHICLE_HANDLING, ...options.handling };
  validateHandling(handling);

  const entityId = world.createEntity();
  try {
    world.addComponent(entityId, Transform, {
      position: { ...position },
      rotationY,
    });
    world.addComponent(entityId, Velocity, {
      linear: { x: 0, y: 0, z: 0 },
    });
    world.addComponent(entityId, VehicleDynamics, {
      ...handling,
      speedMps: 0,
      steeringAngleRadians: 0,
      gear: "neutral",
    });
    world.addComponent(entityId, VehicleControls, {
      throttle: 0,
      brake: 0,
      steering: 0,
      handbrake: false,
    });
    return entityId;
  } catch (error) {
    world.destroyEntity(entityId);
    throw error;
  }
}

export function setVehicleControls(
  world: World,
  entityId: number,
  controls: Partial<{
    throttle: number;
    brake: number;
    steering: number;
    handbrake: boolean;
  }>,
): void {
  const current = world.getComponent(entityId, VehicleControls);
  if (!current || !world.hasComponent(entityId, VehicleDynamics)) {
    throw new Error(`Entity ${entityId} is not a vehicle`);
  }

  if (controls.throttle !== undefined) current.throttle = clampAxis(controls.throttle);
  if (controls.brake !== undefined) current.brake = clampUnit(controls.brake);
  if (controls.steering !== undefined) current.steering = clampAxis(controls.steering);
  if (controls.handbrake !== undefined) current.handbrake = controls.handbrake;
}

function validatePosition(position: Vec3): void {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    throw new Error("Vehicle spawn position must contain finite coordinates");
  }
}

function validateHandling(handling: typeof DEFAULT_VEHICLE_HANDLING): void {
  for (const [name, value] of Object.entries(handling)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Vehicle handling ${name} must be a positive finite number`);
    }
  }
  if (handling.maxReverseSpeedMps > handling.maxForwardSpeedMps) {
    throw new Error("Vehicle reverse speed cannot exceed forward speed");
  }
  if (handling.maxSteeringAngleRadians >= Math.PI / 2) {
    throw new Error("Vehicle steering angle must be below 90 degrees");
  }
}

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
