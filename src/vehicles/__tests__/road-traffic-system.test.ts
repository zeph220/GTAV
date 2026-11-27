import { describe, expect, it } from "vitest";
import { Transform } from "../../gameplay/ecs/components";
import { GameSimulation } from "../../gameplay/simulation/game-simulation";
import { World } from "../../gameplay/ecs/world";
import type { RoadNetwork } from "../../world/world-types";
import { createVehicle } from "../create-vehicle";
import { VehicleControls, VehicleDynamics } from "../vehicle-components";
import { findRoadRoute } from "../road-navigation";
import { RoadTrafficSystem, setVehicleRoute } from "../road-traffic-system";
import { VehicleDrivingSystem } from "../vehicle-driving-system";

const network: RoadNetwork = {
  nodes: [
    { id: "a", position: { x: 0, y: 0, z: 0 } },
    { id: "b", position: { x: 40, y: 0, z: 0 } },
    { id: "c", position: { x: 40, y: 0, z: 40 } },
    { id: "d", position: { x: 0, y: 0, z: 40 } },
  ],
  segments: [
    { id: "ab", fromNodeId: "a", toNodeId: "b", districtId: "downtown", kind: "local", width: 8 },
    { id: "bc", fromNodeId: "b", toNodeId: "c", districtId: "downtown", kind: "local", width: 8 },
    { id: "cd", fromNodeId: "c", toNodeId: "d", districtId: "downtown", kind: "local", width: 8 },
    { id: "da", fromNodeId: "d", toNodeId: "a", districtId: "downtown", kind: "local", width: 8 },
  ],
};

describe("RoadTrafficSystem", () => {
  it("assigns steering and throttle to a vehicle following a road route", () => {
    const world = new World();
    const vehicle = createVehicle(world, {
      position: { x: 0, y: 0, z: 0 },
      rotationY: Math.PI / 2,
    });
    const route = findRoadRoute(network, [{ x: 0, z: 0 }, { x: 40, z: 40 }], true);
    setVehicleRoute(world, vehicle, {
      nodeIds: route.nodeIds,
      targetIndex: 1,
      cruiseSpeedMps: 10,
      loop: true,
    });

    new RoadTrafficSystem(network).update(world);

    const controls = world.getComponent(vehicle, VehicleControls)!;
    expect(controls.throttle).toBeGreaterThan(0);
    expect(controls.steering).toBeCloseTo(0, 6);
  });

  it("runs autonomous traffic and vehicle physics in the fixed ECS simulation", () => {
    const world = new World();
    const simulation = new GameSimulation(world);
    const vehicle = createVehicle(world, {
      position: { x: 0, y: 0, z: 0 },
      rotationY: Math.PI / 2,
    });
    const route = findRoadRoute(network, [{ x: 0, z: 0 }, { x: 40, z: 40 }], true);
    setVehicleRoute(world, vehicle, {
      nodeIds: route.nodeIds,
      targetIndex: 1,
      cruiseSpeedMps: 8,
      loop: true,
    });

    simulation.registerSystem({
      id: "road-traffic",
      priority: 0,
      system: new RoadTrafficSystem(network),
    });
    simulation.registerSystem({
      id: "vehicle-driving",
      priority: 10,
      system: new VehicleDrivingSystem(),
    });
    for (let index = 0; index < 120; index += 1) simulation.advance(1 / 60);

    const transform = world.getComponent(vehicle, Transform)!;
    const dynamics = world.getComponent(vehicle, VehicleDynamics)!;
    expect(transform.position.x).toBeGreaterThan(1);
    expect(dynamics.speedMps).toBeGreaterThan(0);
  });

  it("rejects routes on entities without vehicle control components", () => {
    const world = new World();
    const entity = world.createEntity();
    expect(() => setVehicleRoute(world, entity, { nodeIds: ["a", "b"] }))
      .toThrow(/not a drivable vehicle/);
  });
});
