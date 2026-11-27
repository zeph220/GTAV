import * as THREE from "three";
import type {
  BuildingLot,
  RoadNetwork,
  RoadSegment,
  TerrainMeshData,
  WorldPoint3,
} from "../world/world-types";

export interface BuildingWindowInstance {
  position: WorldPoint3;
  rotationY: number;
  width: number;
  height: number;
  depth: number;
}

export function createTerrainGeometry(data: TerrainMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(data.vertices.length * 3);
  const colors = new Float32Array(data.vertices.length * 3);
  const lowest = Math.min(...data.vertices.map((point) => point.y));
  const highest = Math.max(...data.vertices.map((point) => point.y));
  const lowColor = new THREE.Color("#263e35");
  const meadowColor = new THREE.Color("#56764a");
  const highColor = new THREE.Color("#9b9a78");

  data.vertices.forEach((point, index) => {
    const offset = index * 3;
    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;

    const elevation = highest === lowest ? 0 : (point.y - lowest) / (highest - lowest);
    const color = elevation < 0.58
      ? lowColor.clone().lerp(meadowColor, elevation / 0.58)
      : meadowColor.clone().lerp(highColor, (elevation - 0.58) / 0.42);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex([...data.indices]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createRoadBedGeometry(
  network: RoadNetwork,
  widthExtra = 3.2,
  heightOffset = 0.16,
): THREE.BufferGeometry {
  const nodes = indexRoadNodes(network);
  const builder = new RibbonBuilder();

  for (const segment of network.segments) {
    builder.add(
      nodes.get(segment.fromNodeId)!,
      nodes.get(segment.toNodeId)!,
      segment.width + widthExtra,
      heightOffset,
    );
  }

  return builder.toGeometry();
}

export function createAsphaltGeometry(network: RoadNetwork): THREE.BufferGeometry {
  const nodes = indexRoadNodes(network);
  const builder = new RibbonBuilder();

  for (const segment of network.segments) {
    builder.add(
      nodes.get(segment.fromNodeId)!,
      nodes.get(segment.toNodeId)!,
      segment.width,
      0.22,
    );
  }

  return builder.toGeometry();
}

export function createRoadMarkingGeometry(
  network: RoadNetwork,
  kind: RoadSegment["kind"],
): THREE.BufferGeometry {
  const nodes = indexRoadNodes(network);
  const builder = new RibbonBuilder();

  for (const segment of network.segments) {
    if (segment.kind !== kind) continue;
    const from = nodes.get(segment.fromNodeId)!;
    const to = nodes.get(segment.toNodeId)!;
    const dx = to.position.x - from.position.x;
    const dz = to.position.z - from.position.z;
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;

    const perpendicularX = -dz / length;
    const perpendicularZ = dx / length;
    const offsets = kind === "arterial" ? [-0.65, 0.65] : [0];
    const dashLength = kind === "arterial" ? 5.2 : 3.2;
    const dashGap = kind === "arterial" ? 7.5 : 10.5;

    for (const lateralOffset of offsets) {
      for (let distance = 8; distance < length - 5; distance += dashLength + dashGap) {
        const start = distance / length;
        const end = Math.min(distance + dashLength, length - 3) / length;
        const startPoint = interpolatePoint(from.position, to.position, start);
        const endPoint = interpolatePoint(from.position, to.position, end);
        startPoint.x += perpendicularX * lateralOffset;
        startPoint.z += perpendicularZ * lateralOffset;
        endPoint.x += perpendicularX * lateralOffset;
        endPoint.z += perpendicularZ * lateralOffset;
        builder.addBetween(startPoint, endPoint, kind === "arterial" ? 0.24 : 0.18, 0.245);
      }
    }
  }

  return builder.toGeometry();
}

export function createBuildingWindowInstances(
  buildings: readonly BuildingLot[],
): BuildingWindowInstance[] {
  const instances: BuildingWindowInstance[] = [];

  for (const building of buildings) {
    const floorCount = Math.min(32, Math.max(1, Math.floor(building.height / 4.2)));
    const columns = Math.max(2, Math.min(5, Math.floor(building.footprint.width / 5.5)));
    const rows = Math.max(2, Math.min(5, Math.floor(building.footprint.depth / 5.5)));
    const floorSpacing = building.height / (floorCount + 1);
    const localPoints: Array<{ x: number; z: number; width: number; depth: number }> = [];

    for (let column = 0; column < columns; column += 1) {
      const localX = -building.footprint.width / 2 +
        ((column + 0.5) * building.footprint.width) / columns;
      localPoints.push({
        x: localX,
        z: building.footprint.depth / 2 + 0.08,
        width: Math.min(1.65, building.footprint.width / columns * 0.55),
        depth: 0.08,
      });
    }

    for (let row = 0; row < rows; row += 1) {
      const localZ = -building.footprint.depth / 2 +
        ((row + 0.5) * building.footprint.depth) / rows;
      localPoints.push({
        x: building.footprint.width / 2 + 0.08,
        z: localZ,
        width: 0.08,
        depth: Math.min(1.65, building.footprint.depth / rows * 0.55),
      });
    }

    const cos = Math.cos(building.rotationY);
    const sin = Math.sin(building.rotationY);
    for (let floor = 0; floor < floorCount; floor += 1) {
      const y = building.position.y + (floor + 0.72) * floorSpacing;
      for (const point of localPoints) {
        instances.push({
          position: {
            x: building.position.x + point.x * cos + point.z * sin,
            y,
            z: building.position.z - point.x * sin + point.z * cos,
          },
          rotationY: building.rotationY,
          width: point.width,
          height: Math.min(1.65, floorSpacing * 0.48),
          depth: point.depth,
        });
      }
    }
  }

  return instances;
}

export function createStreetTreePositions(network: RoadNetwork): WorldPoint3[] {
  const nodes = indexRoadNodes(network);
  const positions: WorldPoint3[] = [];

  for (const segment of network.segments) {
    if (segment.kind !== "local") continue;
    const from = nodes.get(segment.fromNodeId)!;
    const to = nodes.get(segment.toNodeId)!;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;

    const perpendicularX = -dz / length;
    const perpendicularZ = dx / length;
    for (const side of [-1, 1]) {
      const t = 0.5;
      positions.push({
        x: from.x + dx * t + perpendicularX * (segment.width / 2 + 2.1) * side,
        y: from.y + (to.y - from.y) * t + 0.04,
        z: from.z + dz * t + perpendicularZ * (segment.width / 2 + 2.1) * side,
      });
    }
  }

  return positions;
}

class RibbonBuilder {
  private readonly positions: number[] = [];
  private readonly indices: number[] = [];

  add(from: WorldPoint3, to: WorldPoint3, width: number, heightOffset: number): void {
    this.addBetween(from, to, width, heightOffset);
  }

  addBetween(from: WorldPoint3, to: WorldPoint3, width: number, heightOffset: number): void {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length === 0 || width <= 0) return;

    const halfWidth = width / 2;
    const perpendicularX = (-dz / length) * halfWidth;
    const perpendicularZ = (dx / length) * halfWidth;
    const start = this.positions.length / 3;

    this.positions.push(
      from.x + perpendicularX, from.y + heightOffset, from.z + perpendicularZ,
      from.x - perpendicularX, from.y + heightOffset, from.z - perpendicularZ,
      to.x + perpendicularX, to.y + heightOffset, to.z + perpendicularZ,
      to.x - perpendicularX, to.y + heightOffset, to.z - perpendicularZ,
    );
    this.indices.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
  }

  toGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function indexRoadNodes(network: RoadNetwork): Map<string, WorldPoint3> {
  return new Map(network.nodes.map((node) => [node.id, node.position]));
}

function interpolatePoint(from: WorldPoint3, to: WorldPoint3, amount: number): WorldPoint3 {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    z: from.z + (to.z - from.z) * amount,
  };
}
