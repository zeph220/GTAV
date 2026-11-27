import type { RoadNetwork, RoadNode, WorldPoint3 } from "../world/world-types";

export interface RoadPath {
  nodeIds: string[];
  distanceMeters: number;
}

interface RoadEdge {
  nodeId: string;
  distanceMeters: number;
}

export function findNearestRoadNode(
  network: RoadNetwork,
  position: Pick<WorldPoint3, "x" | "z">,
): RoadNode {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
    throw new Error("Road lookup position must be finite");
  }
  if (network.nodes.length === 0) throw new Error("Road network has no nodes");

  let nearest = network.nodes[0]!;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of network.nodes) {
    const dx = node.position.x - position.x;
    const dz = node.position.z - position.z;
    const distance = dx * dx + dz * dz;
    if (
      distance < nearestDistance ||
      (distance === nearestDistance && node.id.localeCompare(nearest.id) < 0)
    ) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Dijkstra shortest path, weighted by actual road-segment length. */
export function findShortestRoadPath(
  network: RoadNetwork,
  startNodeId: string,
  endNodeId: string,
): RoadPath | null {
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
  if (!nodeById.has(startNodeId)) throw new Error(`Unknown road node: ${startNodeId}`);
  if (!nodeById.has(endNodeId)) throw new Error(`Unknown road node: ${endNodeId}`);
  if (startNodeId === endNodeId) {
    return { nodeIds: [startNodeId], distanceMeters: 0 };
  }

  const adjacency = new Map<string, RoadEdge[]>();
  for (const node of network.nodes) adjacency.set(node.id, []);
  for (const segment of network.segments) {
    const from = nodeById.get(segment.fromNodeId);
    const to = nodeById.get(segment.toNodeId);
    if (!from || !to) continue;
    const distanceMeters = Math.hypot(
      to.position.x - from.position.x,
      to.position.z - from.position.z,
    );
    adjacency.get(from.id)!.push({ nodeId: to.id, distanceMeters });
    adjacency.get(to.id)!.push({ nodeId: from.id, distanceMeters });
  }
  for (const edges of adjacency.values()) {
    edges.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  const distances = new Map<string, number>([[startNodeId, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set(nodeById.keys());
  const visited = new Set<string>();

  while (pending.size > 0) {
    let current: string | undefined;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const candidate of pending) {
      const distance = distances.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (
        distance < currentDistance ||
        (distance === currentDistance &&
          current !== undefined &&
          candidate.localeCompare(current) < 0)
      ) {
        current = candidate;
        currentDistance = distance;
      }
    }

    if (current === undefined || !Number.isFinite(currentDistance)) break;
    pending.delete(current);
    visited.add(current);
    if (current === endNodeId) break;

    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.nodeId)) continue;
      const candidateDistance = currentDistance + edge.distanceMeters;
      const knownDistance = distances.get(edge.nodeId) ?? Number.POSITIVE_INFINITY;
      const knownPrevious = previous.get(edge.nodeId);
      if (
        candidateDistance < knownDistance ||
        (candidateDistance === knownDistance &&
          (knownPrevious === undefined || current.localeCompare(knownPrevious) < 0))
      ) {
        distances.set(edge.nodeId, candidateDistance);
        previous.set(edge.nodeId, current);
      }
    }
  }

  const totalDistance = distances.get(endNodeId);
  if (totalDistance === undefined) return null;

  const nodeIds = [endNodeId];
  let cursor = endNodeId;
  while (cursor !== startNodeId) {
    const parent = previous.get(cursor);
    if (!parent) return null;
    nodeIds.push(parent);
    cursor = parent;
  }
  nodeIds.reverse();
  return { nodeIds, distanceMeters: totalDistance };
}

/**
 * Connects nearby road nodes into a path through the supplied positions.
 * With loop=true, the final waypoint is connected back to the first one.
 */
export function findRoadRoute(
  network: RoadNetwork,
  waypoints: readonly Pick<WorldPoint3, "x" | "z">[],
  loop = false,
): RoadPath {
  if (waypoints.length < 2) {
    throw new Error("A road route requires at least two waypoints");
  }

  const waypointNodes = waypoints.map((point) => findNearestRoadNode(network, point).id);
  const legs = loop ? waypointNodes.length : waypointNodes.length - 1;
  const nodeIds: string[] = [];
  let distanceMeters = 0;

  for (let index = 0; index < legs; index += 1) {
    const start = waypointNodes[index]!;
    const end = waypointNodes[(index + 1) % waypointNodes.length]!;
    const leg = findShortestRoadPath(network, start, end);
    if (!leg) throw new Error(`No road path exists between ${start} and ${end}`);
    if (nodeIds.length === 0) nodeIds.push(...leg.nodeIds);
    else nodeIds.push(...leg.nodeIds.slice(1));
    distanceMeters += leg.distanceMeters;
  }

  if (loop && nodeIds.length > 1 && nodeIds[nodeIds.length - 1] === nodeIds[0]) {
    nodeIds.pop();
  }
  if (nodeIds.length < 2) throw new Error("The requested road route is degenerate");
  return { nodeIds, distanceMeters };
}
