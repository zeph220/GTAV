import { describe, expect, it } from "vitest";
import { NOVA_CITY_DISTRICTS } from "../districts";
import { generateCity } from "../generation/city-generator";
import { generateTerrainMesh, sampleTerrainHeight } from "../terrain/terrain-generator";

describe("NOVA CITY procedural world", () => {
  it("creates all eight districts with a connected road grid", () => {
    const city = generateCity({ seed: "layout-check" });

    expect(city.districts).toHaveLength(8);
    expect(city.districts.map((district) => district.id)).toEqual(
      NOVA_CITY_DISTRICTS.map((district) => district.id),
    );
    expect(city.blocks).toHaveLength(8 * 4 * 4);
    expect(city.roadNetwork.nodes).toHaveLength(17 * 9);
    expect(city.roadNetwork.segments).toHaveLength(9 * 16 + 8 * 17);

    const nodeIds = new Set(city.roadNetwork.nodes.map((node) => node.id));
    const segmentIds = new Set(city.roadNetwork.segments.map((segment) => segment.id));
    expect(segmentIds.size).toBe(city.roadNetwork.segments.length);
    for (const segment of city.roadNetwork.segments) {
      expect(nodeIds.has(segment.fromNodeId)).toBe(true);
      expect(nodeIds.has(segment.toNodeId)).toBe(true);
      expect(segment.width).toBeGreaterThan(0);
      expect(["arterial", "local"]).toContain(segment.kind);
    }

    const nodes = new Map(city.roadNetwork.nodes.map((node) => [node.id, node]));
    for (const segment of city.roadNetwork.segments) {
      const from = nodes.get(segment.fromNodeId)!;
      const to = nodes.get(segment.toNodeId)!;
      const distance = Math.hypot(
        to.position.x - from.position.x,
        to.position.z - from.position.z,
      );
      expect(distance).toBeCloseTo(80, 8);
    }
  });

  it("produces identical output for an identical seed and configuration", () => {
    const first = generateCity({
      seed: "repeatable-city",
      blocksPerDistrict: 3,
      terrainSegmentsPerDistrict: 5,
    });
    const second = generateCity({
      seed: "repeatable-city",
      blocksPerDistrict: 3,
      terrainSegmentsPerDistrict: 5,
    });

    expect(second).toEqual(first);
  });

  it("changes procedural placements and terrain when the seed changes", () => {
    const first = generateCity({ seed: "seed-one" });
    const second = generateCity({ seed: "seed-two" });

    expect(second.buildings).not.toEqual(first.buildings);
    expect(second.terrain.vertices).not.toEqual(first.terrain.vertices);
  });

  it("keeps every building footprint inside its assigned city block", () => {
    const city = generateCity({ seed: "building-containment" });
    const blocks = new Map(city.blocks.map((block) => [block.id, block]));
    const districts = new Map(city.districts.map((district) => [district.id, district]));

    expect(city.buildings.length).toBeGreaterThan(100);
    for (const building of city.buildings) {
      const block = blocks.get(building.blockId)!;
      const district = districts.get(building.districtId)!;
      const halfWidth = building.footprint.width / 2;
      const halfDepth = building.footprint.depth / 2;

      expect(block.districtId).toBe(building.districtId);
      expect(building.position.x - halfWidth).toBeGreaterThanOrEqual(block.bounds.minX);
      expect(building.position.x + halfWidth).toBeLessThanOrEqual(block.bounds.maxX);
      expect(building.position.z - halfDepth).toBeGreaterThanOrEqual(block.bounds.minZ);
      expect(building.position.z + halfDepth).toBeLessThanOrEqual(block.bounds.maxZ);
      expect(building.height).toBeGreaterThanOrEqual(district.minBuildingHeight);
      expect(building.height).toBeLessThanOrEqual(district.maxBuildingHeight);
      expect(district.buildingStyles).toContain(building.style);
      expect(building.position.y).toBeCloseTo(
        sampleTerrainHeight(building.position.x, building.position.z, city.seed),
        8,
      );
    }
  });

  it("builds a valid indexed terrain surface and samples smooth finite heights", () => {
    const city = generateCity({ seed: "terrain-check" });
    const terrain = city.terrain;

    expect(terrain.vertices).toHaveLength((terrain.segmentsX + 1) * (terrain.segmentsZ + 1));
    expect(terrain.indices).toHaveLength(terrain.segmentsX * terrain.segmentsZ * 6);
    expect(Math.max(...terrain.indices)).toBeLessThan(terrain.vertices.length);
    expect(terrain.vertices.every((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
    )).toBe(true);
    expect(Number.isFinite(sampleTerrainHeight(0, 0, city.seed))).toBe(true);
    expect(Math.abs(
      sampleTerrainHeight(100, 100, city.seed) -
      sampleTerrainHeight(100.01, 100, city.seed)
    )).toBeLessThan(0.1);
  });

  it("supports a smaller district grid and rejects unsafe generation options", () => {
    const compact = generateCity({
      seed: 42,
      blocksPerDistrict: 2,
      terrainSegmentsPerDistrict: 3,
    });
    expect(compact.blocks).toHaveLength(8 * 2 * 2);
    expect(compact.roadNetwork.nodes).toHaveLength(9 * 5);
    expect(compact.terrain.segmentsX).toBe(12);
    expect(compact.terrain.segmentsZ).toBe(6);

    expect(() => generateCity({ seed: "" })).toThrow("City seed cannot be empty");
    expect(() => generateCity({ seed: Number.NaN })).toThrow("City seed must be finite");
    expect(() => generateCity({ blocksPerDistrict: 1 })).toThrow("blocksPerDistrict");
    expect(() => generateCity({ terrainSegmentsPerDistrict: 17 })).toThrow("terrainSegmentsPerDistrict");
  });

  it("rejects invalid terrain dimensions and excessive meshes", () => {
    const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    expect(() => generateTerrainMesh(bounds, 0, 2)).toThrow("segmentsX");
    expect(() => generateTerrainMesh(bounds, 257, 257)).toThrow("safety limit");
    expect(() => generateTerrainMesh({ ...bounds, maxX: -10 }, 2, 2)).toThrow("positive dimensions");
    expect(() => sampleTerrainHeight(Number.POSITIVE_INFINITY, 0)).toThrow("finite");
  });
});
