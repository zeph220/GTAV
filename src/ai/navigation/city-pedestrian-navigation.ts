import type { Vec3 } from "../../shared/types";
import { sampleTerrainHeight } from "../../world/terrain/terrain-generator";
import type { GeneratedCity, RoadNode } from "../../world/world-types";
import { NavGraph } from "./nav-graph";

export interface CityPedestrianNavigationOptions {
  /** Clear space between the edge of the road and the walking line. */
  sidewalkOffset?: number;
  /** Height offset above sampled terrain to avoid z-fighting with surfaces. */
  verticalOffset?: number;
}

export interface CityPedestrianNavigation {
  graph: NavGraph;
  /** Unique sidewalk graph nodes suitable for weighted civilian spawning. */
  spawnPoints: Vec3[];
}

interface IntersectionEndpoint {
  nodeId: string;
  orientation: "horizontal" | "vertical";
}

interface SidewalkPoint {
  id: string;
  position: Vec3;
}

/**
 * Builds a pedestrian graph by offsetting each road segment on both sides.
 * Sidewalk endpoints are joined at intersections so citizens can turn around
 * city blocks without walking along the middle of vehicle lanes.
 */
export function createCityPedestrianNavigation(
  city: GeneratedCity,
  options: CityPedestrianNavigationOptions = {},
): CityPedestrianNavigation {
  const sidewalkOffset = options.sidewalkOffset ?? 2.2;
  const verticalOffset = options.verticalOffset ?? 0.08;
  if (!Number.isFinite(sidewalkOffset) || sidewalkOffset <= 0) {
    throw new Error("Sidewalk offset must be positive and finite");
  }
  if (!Number.isFinite(verticalOffset) || verticalOffset < 0) {
    throw new Error("Sidewalk vertical offset must be finite and non-negative");
  }

  const graph = new NavGraph();
  const roadNodes = new Map(city.roadNetwork.nodes.map((node) => [node.id, node]));
  const sidewalkPoints = new Map<string, SidewalkPoint>();
  const intersectionEndpoints = new Map<string, IntersectionEndpoint[]>();

  const ensureSidewalkPoint = (x: number, z: number): string => {
    const keyX = coordinateKey(x);
    const keyZ = coordinateKey(z);
    const id = `sidewalk:${keyX}:${keyZ}`;
    if (!sidewalkPoints.has(id)) {
      const position = {
        x: Number(keyX),
        y: sampleTerrainHeight(Number(keyX), Number(keyZ), city.seed) + verticalOffset,
        z: Number(keyZ),
      };
      graph.addNode({ id, position });
      sidewalkPoints.set(id, { id, position });
    }
    return id;
  };

  const addEndpoint = (
    roadNodeId: string,
    nodeId: string,
    orientation: "horizontal" | "vertical",
  ) => {
    const endpoints = intersectionEndpoints.get(roadNodeId) ?? [];
    endpoints.push({ nodeId, orientation });
    intersectionEndpoints.set(roadNodeId, endpoints);
  };

  for (const segment of city.roadNetwork.segments) {
    const from = roadNodes.get(segment.fromNodeId);
    const to = roadNodes.get(segment.toNodeId);
    if (!from || !to) {
      throw new Error(`Road segment ${segment.id} references an unknown node`);
    }
    if (!Number.isFinite(segment.width) || segment.width <= 0) {
      throw new Error(`Road segment ${segment.id} has an invalid width`);
    }

    const dx = to.position.x - from.position.x;
    const dz = to.position.z - from.position.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0.001) continue;

    const normalX = -dz / length;
    const normalZ = dx / length;
    const offset = segment.width / 2 + sidewalkOffset;
    const orientation = Math.abs(dx) >= Math.abs(dz) ? "horizontal" : "vertical";

    for (const side of [-1, 1]) {
      const shiftX = normalX * offset * side;
      const shiftZ = normalZ * offset * side;
      const startId = ensureSidewalkPoint(
        from.position.x + shiftX,
        from.position.z + shiftZ,
      );
      const endId = ensureSidewalkPoint(
        to.position.x + shiftX,
        to.position.z + shiftZ,
      );
      if (startId !== endId) graph.addEdge({ from: startId, to: endId });
      addEndpoint(from.id, startId, orientation);
      addEndpoint(to.id, endId, orientation);
    }
  }

  for (const endpoints of intersectionEndpoints.values()) {
    const horizontal = uniqueIds(endpoints
      .filter((endpoint) => endpoint.orientation === "horizontal")
      .map((endpoint) => endpoint.nodeId));
    const vertical = uniqueIds(endpoints
      .filter((endpoint) => endpoint.orientation === "vertical")
      .map((endpoint) => endpoint.nodeId));

    // The four combinations describe the four walkable corners at a grid
    // intersection. Dijkstra/A* chooses the appropriate corner per route.
    for (const horizontalId of horizontal) {
      for (const verticalId of vertical) {
        if (horizontalId !== verticalId) {
          graph.addEdge({ from: horizontalId, to: verticalId });
        }
      }
    }
  }

  const spawnPoints = [...sidewalkPoints.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((point) => ({ ...point.position }));

  return { graph, spawnPoints };
}

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function coordinateKey(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
