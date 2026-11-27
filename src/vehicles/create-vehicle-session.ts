import { Transform } from "../gameplay/ecs/components";
import { World } from "../gameplay/ecs/world";
import { GameSimulation } from "../gameplay/simulation/game-simulation";
import type { GeneratedCity, RoadNode } from "../world/world-types";
import { createVehicle } from "./create-vehicle";
import { findNearestRoadNode, findRoadRoute } from "./road-navigation";
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
  const playerSpawn = findPlayerRoadSpawn(city);
  const playerVehicleId = createVehicle(world, {
    position: playerSpawn.position,
    rotationY: playerSpawn.heading,
  });

  const center = cityCenter(city);
  const roadSpacingX = minimumRoadSpacing(
    city.roadNetwork.nodes.map((node) => node.position.x),
  );
  const roadSpacingZ = minimumRoadSpacing(
    city.roadNetwork.nodes.map((node) => node.position.z),
  );
  const trafficRoute = findRoadRoute(
    city.roadNetwork,
    [
      { x: center.x - roadSpacingX, z: center.z + roadSpacingZ },
      { x: center.x + roadSpacingX, z: center.z + roadSpacingZ },
      { x: center.x + roadSpacingX, z: center.z - roadSpacingZ },
      { x: center.x - roadSpacingX, z: center.z - roadSpacingZ },
    ],
    true,
  );
  const nodesById = new Map(city.roadNetwork.nodes.map((node) => [node.id, node]));
  const firstNode = nodesById.get(trafficRoute.nodeIds[0]!);
  const secondNode = nodesById.get(trafficRoute.nodeIds[1]!);
  if (!firstNode || !secondNode) {
    throw new Error("Generated traffic route contains an unknown spawn node");
  }

  const initialHeading = headingBetween(firstNode, secondNode);
  const trafficVehicleId = createVehicle(world, {
    position: {
      x: firstNode.position.x,
      y: firstNode.position.y + 0.22,
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

function findPlayerRoadSpawn(city: GeneratedCity): {
  position: { x: number; y: number; z: number };
  heading: number;
} {
  const centerNode = findNearestRoadNode(city.roadNetwork, { x: 0, z: 0 });
  const nodes = new Map(city.roadNetwork.nodes.map((node) => [node.id, node]));
  const candidates = city.roadNetwork.segments.flatMap((segment) => {
    const otherId = segment.fromNodeId === centerNode.id
      ? segment.toNodeId
      : segment.toNodeId === centerNode.id
        ? segment.fromNodeId
        : null;
    const other = otherId ? nodes.get(otherId) : undefined;
    if (!other) return [];

    const heading = headingBetween(centerNode, other);
    return [{
      other,
      heading,
      preference: angularDistance(heading, Math.PI / 2),
      segmentId: segment.id,
    }];
  }).sort((a, b) =>
    a.preference - b.preference || a.segmentId.localeCompare(b.segmentId)
  );

  const road = candidates[0];
  if (!road) throw new Error("Generated road network has no segment near the player spawn");
  return {
    position: {
      x: (centerNode.position.x + road.other.position.x) / 2,
      y: (centerNode.position.y + road.other.position.y) / 2 + 0.22,
      z: (centerNode.position.z + road.other.position.z) / 2,
    },
    heading: road.heading,
  };
}

function headingBetween(from: RoadNode, to: RoadNode): number {
  return Math.atan2(
    to.position.x - from.position.x,
    -(to.position.z - from.position.z),
  );
}

function angularDistance(from: number, to: number): number {
  const tau = Math.PI * 2;
  const difference = ((from - to + Math.PI) % tau + tau) % tau - Math.PI;
  return Math.abs(difference);
}

function cityCenter(city: GeneratedCity): { x: number; z: number } {
  return {
    x: (city.bounds.minX + city.bounds.maxX) / 2,
    z: (city.bounds.minZ + city.bounds.maxZ) / 2,
  };
}

function minimumRoadSpacing(values: readonly number[]): number {
  const coordinates = [...new Set(values)].sort((a, b) => a - b);
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index += 1) {
    const spacing = coordinates[index]! - coordinates[index - 1]!;
    if (spacing > 0) minimum = Math.min(minimum, spacing);
  }
  if (!Number.isFinite(minimum)) {
    throw new Error("Vehicle session requires a regular road grid with at least two nodes per axis");
  }
  return minimum;
}
