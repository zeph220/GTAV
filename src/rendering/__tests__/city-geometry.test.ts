import { describe, expect, it } from "vitest";
import {
  createAsphaltGeometry,
  createBuildingWindowInstances,
  createRoadBedGeometry,
  createRoadMarkingGeometry,
  createStreetTreePositions,
  createTerrainGeometry,
} from "../city-geometry";
import type { BuildingLot, RoadNetwork, TerrainMeshData } from "../../world/world-types";

const terrain: TerrainMeshData = {
  width: 100,
  depth: 100,
  segmentsX: 1,
  segmentsZ: 1,
  vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 1, z: 0 },
    { x: 0, y: 0.5, z: 100 },
    { x: 100, y: 8, z: 100 },
  ],
  indices: [0, 2, 1, 1, 2, 3],
};

const roadNetwork: RoadNetwork = {
  nodes: [
    { id: "a", position: { x: 0, y: 0, z: 0 } },
    { id: "b", position: { x: 80, y: 0.6, z: 0 } },
  ],
  segments: [
    {
      id: "arterial-1",
      fromNodeId: "a",
      toNodeId: "b",
      districtId: "downtown",
      kind: "arterial",
      width: 14,
    },
    {
      id: "local-1",
      fromNodeId: "a",
      toNodeId: "b",
      districtId: "downtown",
      kind: "local",
      width: 8,
    },
  ],
};

const buildings: BuildingLot[] = [{
  id: "building-test",
  blockId: "block-test",
  districtId: "downtown",
  style: "office",
  position: { x: 12, y: 1.2, z: 24 },
  footprint: { width: 22, depth: 18 },
  height: 48,
  rotationY: Math.PI / 2,
}];

describe("procedural city render geometry", () => {
  it("converts terrain vertices, colors and triangle indices into a lit geometry", () => {
    const geometry = createTerrainGeometry(terrain);

    expect(geometry.getAttribute("position").count).toBe(4);
    expect(geometry.getAttribute("color").count).toBe(4);
    expect(geometry.getIndex()?.count).toBe(6);
    expect(geometry.getAttribute("normal").count).toBe(4);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
    geometry.dispose();
  });

  it("creates separate road beds and asphalt ribbons for every road segment", () => {
    const bed = createRoadBedGeometry(roadNetwork);
    const asphalt = createAsphaltGeometry(roadNetwork);

    expect(bed.getAttribute("position").count).toBe(8);
    expect(asphalt.getAttribute("position").count).toBe(8);
    expect(bed.getIndex()?.count).toBe(12);
    expect(asphalt.getIndex()?.count).toBe(12);
    bed.dispose();
    asphalt.dispose();
  });

  it("adds distinct dashed markings to arterial and local roads", () => {
    const arterial = createRoadMarkingGeometry(roadNetwork, "arterial");
    const local = createRoadMarkingGeometry(roadNetwork, "local");

    expect(arterial.getAttribute("position").count).toBeGreaterThan(0);
    expect(local.getAttribute("position").count).toBeGreaterThan(0);
    expect(arterial.getAttribute("position").count).toBeGreaterThan(
      local.getAttribute("position").count,
    );
    arterial.dispose();
    local.dispose();
  });

  it("places facade windows on rotated building faces", () => {
    const windows = createBuildingWindowInstances(buildings);

    expect(windows.length).toBeGreaterThan(20);
    expect(windows.every((window) =>
      Number.isFinite(window.position.x) &&
      Number.isFinite(window.position.y) &&
      Number.isFinite(window.position.z)
    )).toBe(true);
    expect(windows.some((window) => window.position.x < 12)).toBe(true);
    expect(windows.some((window) => window.position.z > 24)).toBe(true);
  });

  it("places a pair of roadside trees beside a local street", () => {
    const positions = createStreetTreePositions(roadNetwork);

    expect(positions).toHaveLength(2);
    for (const position of positions) {
      expect(position.x).toBeCloseTo(40, 8);
      expect(Math.abs(position.z)).toBeCloseTo(6.1, 8);
      expect(position.y).toBeCloseTo(0.34, 8);
    }
  });
});
