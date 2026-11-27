import { describe, expect, it } from "vitest";
import { Transform, Velocity } from "../../gameplay/ecs/components";
import { World } from "../../gameplay/ecs/world";
import { createVehicle, setVehicleControls } from "../create-vehicle";
import { VehicleControls, VehicleDynamics } from "../vehicle-components";
import { VehicleDrivingSystem } from "../vehicle-driving-system";

function createTestVehicle() {
  const world = new World();
  const entityId = createVehicle(world);
  return { world, entityId, system: new VehicleDrivingSystem() };
}

function step(system: VehicleDrivingSystem, world: World, count: number): void {
  for (let index = 0; index < count; index += 1) system.update(world, 1 / 60);
}

describe("VehicleDrivingSystem", () => {
  it("accelerates along the forward -Z axis and respects the speed cap", () => {
    const { world, entityId, system } = createTestVehicle();
    setVehicleControls(world, entityId, { throttle: 1 });

    step(system, world, 180);

    const dynamics = world.getComponent(entityId, VehicleDynamics)!;
    const transform = world.getComponent(entityId, Transform)!;
    const velocity = world.getComponent(entityId, Velocity)!;
    expect(dynamics.speedMps).toBeGreaterThan(0);
    expect(dynamics.speedMps).toBeLessThanOrEqual(dynamics.maxForwardSpeedMps);
    expect(dynamics.gear).toBe("forward");
    expect(transform.position.z).toBeLessThan(0);
    expect(velocity.linear.z).toBeLessThan(0);
  });

  it("brakes to a stop without rolling through into reverse", () => {
    const { world, entityId, system } = createTestVehicle();
    setVehicleControls(world, entityId, { throttle: 1 });
    step(system, world, 90);
    const speedBeforeBraking = world.getComponent(entityId, VehicleDynamics)!.speedMps;
    setVehicleControls(world, entityId, { throttle: 0, brake: 1 });
    step(system, world, 90);

    const dynamics = world.getComponent(entityId, VehicleDynamics)!;
    expect(speedBeforeBraking).toBeGreaterThan(0);
    expect(dynamics.speedMps).toBe(0);
    expect(dynamics.gear).toBe("neutral");
  });

  it("selects reverse and moves backward when reverse is requested from rest", () => {
    const { world, entityId, system } = createTestVehicle();
    setVehicleControls(world, entityId, { throttle: -1 });

    step(system, world, 60);

    const dynamics = world.getComponent(entityId, VehicleDynamics)!;
    const transform = world.getComponent(entityId, Transform)!;
    expect(dynamics.speedMps).toBeLessThan(0);
    expect(dynamics.gear).toBe("reverse");
    expect(transform.position.z).toBeGreaterThan(0);
  });

  it("steers with a speed-sensitive bicycle model", () => {
    const { world, entityId, system } = createTestVehicle();
    setVehicleControls(world, entityId, { throttle: 0.8, steering: 1 });

    step(system, world, 90);

    const transform = world.getComponent(entityId, Transform)!;
    const dynamics = world.getComponent(entityId, VehicleDynamics)!;
    expect(transform.rotationY).toBeGreaterThan(0);
    expect(transform.position.x).toBeGreaterThan(0);
    expect(dynamics.steeringAngleRadians).toBeGreaterThan(0);
    expect(dynamics.steeringAngleRadians).toBeLessThan(dynamics.maxSteeringAngleRadians);
  });

  it("clamps oversized frame deltas and sanitizes control input", () => {
    const { world, entityId, system } = createTestVehicle();
    setVehicleControls(world, entityId, {
      throttle: Number.POSITIVE_INFINITY,
      brake: 4,
      steering: -5,
    });
    const controls = world.getComponent(entityId, VehicleControls)!;
    expect(controls.throttle).toBe(0);
    expect(controls.brake).toBe(1);
    expect(controls.steering).toBe(-1);

    setVehicleControls(world, entityId, { throttle: 1, brake: 0 });
    system.update(world, 10);
    expect(world.getComponent(entityId, VehicleDynamics)!.speedMps).toBeLessThan(1);
  });

  it("rejects invalid handling without leaving a partial ECS entity", () => {
    const world = new World();

    expect(() => createVehicle(world, { handling: { massKg: 0 } })).toThrow(/massKg/);
    expect(world.entityCount).toBe(0);
  });

  it("rejects invalid spawn coordinates and non-finite rotation", () => {
    const world = new World();
    expect(() => createVehicle(world, {
      position: { x: Number.NaN, y: 0, z: 0 },
    })).toThrow(/spawn position/);
    expect(() => createVehicle(world, { rotationY: Number.POSITIVE_INFINITY }))
      .toThrow(/rotationY/);
    expect(world.entityCount).toBe(0);
  });
});
