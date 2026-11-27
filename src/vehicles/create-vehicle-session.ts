import { Transform } from "../gameplay/ecs/components";
import { World } from "../gameplay/ecs/world";
import { GameSimulation } from "../gameplay/simulation/game-simulation";
import type { GeneratedCity } from "../world/world-types";
import { sampleTerrainHeight } from "../world/terrain/terrain-generator";
import { createVehicle } from "./create-vehicle";
import { findRoadRoute } from "./road-navigation";
import { RoadTrafficSystem, setVehicleRoute } from "./road-traffic-system";
import { VehicleDrivingSystem } from "./vehicle-driving-system";

export interface VehicleSession {
  world: World;
  simulation: GameSimulation;
  playerVehicleId: number;
  trafficVehicleIds: readonly number[];
}

export function createVehicleSession(city: GeneratedCity): VehicleSession {
  const world = new World();
  const simulation = new GameSimulation(world);
  const playerPosition = {
    x: 40,
    y: sampleTerrainHeight(40, 0, city.seed) + 0.22,
    z: 0,
  };
  const playerVehicleId = createVehicle(world, {
    position: playerPosition,
    rotationY: Math.PI / 2,
  });

  const trafficRoute = findRoadRoute(
    city.roadNetwork,
    [
      { x: -80, z: 80 },
      { x: 80, z: 80 },
      { x: 80, z: -80 },
      { x: -80, z: -80 },
    ],
    true,
  );
  const nodesById = new Map(city.roadNetwork.nodes.map((node) => [node.id, node]));
  const firstNode = nodesById.get(trafficRoute.nodeIds[0]!);
  const secondNode = nodesById.get(trafficRoute.nodeIds[1]!);
  if (!firstNode || !secondNode) {
    throw new Error("Generated traffic route contains an unknown spawn node");
  }

  const initialHeading = Math.atan2(
    secondNode.position.x - firstNode.position.x,
    -(secondNode.position.z - firstNode.position.z),
  );
  const trafficVehicleId = createVehicle(world, {
    position: {
      x: firstNode.position.x,
      y: firstNode.position.y + 0.14,
      z: firstNode.position.z,
    },
    rotationY: initialHeading,
  });
  setVehicleRoute(world, trafficVehicleId, {
    nodeIds: trafficRoute.nodeIds,
    targetIndex: 1,
    cruiseSpeedMps: 11,
    arrivalRadiusMeters: 7,
    loop: true,
  });

  simulation.registerSystem({
    id: "road-traffic",
    priority: 0,
    system: new RoadTrafficSystem(city.roadNetwork),
  });
  simulation.registerSystem({
    id: "vehicle-driving",
    priority: 10,
    system: new VehicleDrivingSystem(),
  });

  // Ensure the runtime starts with a valid, finite pose for both cars.
  for (const entityId of [playerVehicleId, trafficVehicleId]) {
    const transform = world.getComponent(entityId, Transform);
    if (!transform) throw new Error("Vehicle session failed to create a transform");
  }

  return {
    world,
    simulation,
    playerVehicleId,
    trafficVehicleIds: [trafficVehicleId],
  };
}
