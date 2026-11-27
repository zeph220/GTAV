import { createDistrictRegions } from "../districts";
import { createSeededRandom } from "./seeded-random";
import { generateTerrainMesh, sampleTerrainHeight } from "../terrain/terrain-generator";
import type {
  BuildingLot,
  CityBlock,
  CityGenerationOptions,
  DistrictId,
  DistrictRegion,
  GeneratedCity,
  RoadNode,
  RoadSegment,
  WorldBounds,
} from "../world-types";

const DISTRICT_COLUMNS = 4;
const DISTRICT_ROWS = 2;
const DISTRICT_WIDTH = 320;
const DISTRICT_DEPTH = 320;
const DEFAULT_SEED = "nova-city-default";
const ARTERIAL_ROAD_WIDTH = 14;
const LOCAL_ROAD_WIDTH = 8;

export function generateCity(options: CityGenerationOptions = {}): GeneratedCity {
  const seed = normalizeSeed(options.seed ?? DEFAULT_SEED);
  const blocksPerDistrict = validateIntegerOption(
    options.blocksPerDistrict ?? 4,
    "blocksPerDistrict",
    2,
    8,
  );
  const terrainSegmentsPerDistrict = validateIntegerOption(
    options.terrainSegmentsPerDistrict ?? 8,
    "terrainSegmentsPerDistrict",
    1,
    16,
  );

  const bounds: WorldBounds = {
    minX: -(DISTRICT_COLUMNS * DISTRICT_WIDTH) / 2,
    maxX: (DISTRICT_COLUMNS * DISTRICT_WIDTH) / 2,
    minZ: -(DISTRICT_ROWS * DISTRICT_DEPTH) / 2,
    maxZ: (DISTRICT_ROWS * DISTRICT_DEPTH) / 2,
  };
  const districts = createDistrictRegions(DISTRICT_WIDTH, DISTRICT_DEPTH);
  const random = createSeededRandom(seed);
  const blocks = generateBlocks(districts, blocksPerDistrict);
  const roadNetwork = generateRoadNetwork(
    bounds,
    districts,
    blocksPerDistrict,
    seed,
  );
  const buildings = generateBuildings(blocks, districts, random, seed);
  const terrain = generateTerrainMesh(
    bounds,
    DISTRICT_COLUMNS * terrainSegmentsPerDistrict,
    DISTRICT_ROWS * terrainSegmentsPerDistrict,
    seed,
  );

  return { seed, bounds, districts, blocks, roadNetwork, buildings, terrain };
}

function generateBlocks(
  districts: readonly DistrictRegion[],
  blocksPerDistrict: number,
): CityBlock[] {
  const blocks: CityBlock[] = [];
  const blockWidth = DISTRICT_WIDTH / blocksPerDistrict;
  const blockDepth = DISTRICT_DEPTH / blocksPerDistrict;

  for (const district of districts) {
    for (let zIndex = 0; zIndex < blocksPerDistrict; zIndex += 1) {
      for (let xIndex = 0; xIndex < blocksPerDistrict; xIndex += 1) {
        const minX = district.bounds.minX + xIndex * blockWidth;
        const minZ = district.bounds.minZ + zIndex * blockDepth;
        blocks.push({
          id: `block-${district.id}-${xIndex}-${zIndex}`,
          districtId: district.id,
          bounds: {
            minX,
            maxX: minX + blockWidth,
            minZ,
            maxZ: minZ + blockDepth,
          },
        });
      }
    }
  }

  return blocks;
}

function generateRoadNetwork(
  bounds: WorldBounds,
  districts: readonly DistrictRegion[],
  blocksPerDistrict: number,
  seed: string,
): { nodes: RoadNode[]; segments: RoadSegment[] } {
  const totalBlocksX = DISTRICT_COLUMNS * blocksPerDistrict;
  const totalBlocksZ = DISTRICT_ROWS * blocksPerDistrict;
  const blockWidth = (bounds.maxX - bounds.minX) / totalBlocksX;
  const blockDepth = (bounds.maxZ - bounds.minZ) / totalBlocksZ;
  const nodes: RoadNode[] = [];
  const nodeIds: string[][] = [];

  for (let zIndex = 0; zIndex <= totalBlocksZ; zIndex += 1) {
    const row: string[] = [];
    const z = bounds.minZ + zIndex * blockDepth;
    for (let xIndex = 0; xIndex <= totalBlocksX; xIndex += 1) {
      const x = bounds.minX + xIndex * blockWidth;
      const id = `intersection-${xIndex}-${zIndex}`;
      row.push(id);
      nodes.push({
        id,
        position: { x, y: sampleTerrainHeight(x, z, seed) + 0.08, z },
      });
    }
    nodeIds.push(row);
  }

  const segments: RoadSegment[] = [];
  for (let zIndex = 0; zIndex <= totalBlocksZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < totalBlocksX; xIndex += 1) {
      const fromNodeId = nodeIds[zIndex]![xIndex]!;
      const toNodeId = nodeIds[zIndex]![xIndex + 1]!;
      const midpointX = bounds.minX + (xIndex + 0.5) * blockWidth;
      const midpointZ = bounds.minZ + zIndex * blockDepth;
      const kind = zIndex % blocksPerDistrict === 0 ? "arterial" : "local";
      segments.push({
        id: `road-h-${xIndex}-${zIndex}`,
        fromNodeId,
        toNodeId,
        districtId: districtAt(midpointX, midpointZ, districts),
        kind,
        width: kind === "arterial" ? ARTERIAL_ROAD_WIDTH : LOCAL_ROAD_WIDTH,
      });
    }
  }

  for (let zIndex = 0; zIndex < totalBlocksZ; zIndex += 1) {
    for (let xIndex = 0; xIndex <= totalBlocksX; xIndex += 1) {
      const fromNodeId = nodeIds[zIndex]![xIndex]!;
      const toNodeId = nodeIds[zIndex + 1]![xIndex]!;
      const midpointX = bounds.minX + xIndex * blockWidth;
      const midpointZ = bounds.minZ + (zIndex + 0.5) * blockDepth;
      const kind = xIndex % blocksPerDistrict === 0 ? "arterial" : "local";
      segments.push({
        id: `road-v-${xIndex}-${zIndex}`,
        fromNodeId,
        toNodeId,
        districtId: districtAt(midpointX, midpointZ, districts),
        kind,
        width: kind === "arterial" ? ARTERIAL_ROAD_WIDTH : LOCAL_ROAD_WIDTH,
      });
    }
  }

  return { nodes, segments };
}

function generateBuildings(
  blocks: readonly CityBlock[],
  districts: readonly DistrictRegion[],
  random: () => number,
  seed: string,
): BuildingLot[] {
  const districtById = new Map(districts.map((district) => [district.id, district]));
  const buildings: BuildingLot[] = [];

  for (const block of blocks) {
    const district = districtById.get(block.districtId);
    if (!district) continue;

    const blockWidth = block.bounds.maxX - block.bounds.minX;
    const blockDepth = block.bounds.maxZ - block.bounds.minZ;
    for (let lotZ = 0; lotZ < 2; lotZ += 1) {
      for (let lotX = 0; lotX < 2; lotX += 1) {
        if (random() > district.buildingDensity) continue;

        const centerX = block.bounds.minX + blockWidth * (lotX === 0 ? 0.25 : 0.75);
        const centerZ = block.bounds.minZ + blockDepth * (lotZ === 0 ? 0.25 : 0.75);
        const width = blockWidth * (0.3 + random() * 0.08);
        const depth = blockDepth * (0.3 + random() * 0.08);
        const styleIndex = Math.floor(random() * district.buildingStyles.length);
        const style = district.buildingStyles[styleIndex]!;
        const height = district.minBuildingHeight +
          random() * (district.maxBuildingHeight - district.minBuildingHeight);
        const id = `building-${block.id}-${lotX}-${lotZ}`;

        buildings.push({
          id,
          blockId: block.id,
          districtId: block.districtId,
          style,
          position: {
            x: centerX,
            y: sampleTerrainHeight(centerX, centerZ, seed),
            z: centerZ,
          },
          footprint: { width, depth },
          height,
          rotationY: random() < 0.5 ? 0 : Math.PI / 2,
        });
      }
    }
  }

  return buildings;
}

function districtAt(
  x: number,
  z: number,
  districts: readonly DistrictRegion[],
): DistrictId {
  const cityMaxX = Math.max(...districts.map((district) => district.bounds.maxX));
  const cityMaxZ = Math.max(...districts.map((district) => district.bounds.maxZ));
  const safeX = Math.min(x, cityMaxX - Number.EPSILON * Math.abs(cityMaxX));
  const safeZ = Math.min(z, cityMaxZ - Number.EPSILON * Math.abs(cityMaxZ));
  const district = districts.find(({ bounds: area }) =>
    safeX >= area.minX &&
    safeX < area.maxX &&
    safeZ >= area.minZ &&
    safeZ < area.maxZ
  );

  if (!district) throw new Error("NOVA CITY district layout is empty");
  return district.id;
}

function normalizeSeed(seed: string | number): string {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) throw new Error("City seed must be finite");
    return String(seed);
  }

  const normalized = seed.trim();
  if (!normalized) throw new Error("City seed cannot be empty");
  return normalized;
}

function validateIntegerOption(
  value: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}
