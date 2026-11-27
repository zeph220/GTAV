import type { TerrainMeshData, WorldBounds, WorldPoint3 } from "../world-types";

const DEFAULT_SEED = "nova-city-default";

export function sampleTerrainHeight(
  x: number,
  z: number,
  seed = DEFAULT_SEED,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new Error("Terrain coordinates must be finite");
  }

  const seedOffset = hashSeed(seed);
  const broad = valueNoise(x / 260, z / 260, seedOffset) * 2.2;
  const medium = valueNoise(x / 96, z / 96, seedOffset ^ 0x9e3779b9) * 0.8;
  const detail = valueNoise(x / 32, z / 32, seedOffset ^ 0x85ebca6b) * 0.2;

  // A broad, smooth rise gives the Residential Hills district a recognizable
  // topography without introducing abrupt height changes at road crossings.
  const hillDistance = (x - 480) ** 2 + (z - 160) ** 2;
  const residentialHill = Math.exp(-hillDistance / (2 * 155 ** 2)) * 13;
  return broad + medium + detail + residentialHill;
}

export function generateTerrainMesh(
  bounds: WorldBounds,
  segmentsX: number,
  segmentsZ: number,
  seed = DEFAULT_SEED,
): TerrainMeshData {
  validateBounds(bounds);
  validateSegments(segmentsX, "segmentsX");
  validateSegments(segmentsZ, "segmentsZ");
  if ((segmentsX + 1) * (segmentsZ + 1) > 100_000) {
    throw new Error("Terrain mesh exceeds the 100,000 vertex safety limit");
  }

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const vertices: WorldPoint3[] = [];

  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const z = bounds.minZ + (depth * zIndex) / segmentsZ;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = bounds.minX + (width * xIndex) / segmentsX;
      vertices.push({ x, y: sampleTerrainHeight(x, z, seed), z });
    }
  }

  const indices: number[] = [];
  const rowLength = segmentsX + 1;
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const topLeft = zIndex * rowLength + xIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowLength;
      const bottomRight = bottomLeft + 1;

      // Winding points upward on an X/Z ground plane.
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  return { width, depth, segmentsX, segmentsZ, vertices, indices };
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);

  const top = lerp(latticeValue(x0, z0, seed), latticeValue(x1, z0, seed), tx);
  const bottom = lerp(latticeValue(x0, z1, seed), latticeValue(x1, z1, seed), tx);
  return lerp(top, bottom, tz);
}

function latticeValue(x: number, z: number, seed: number): number {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return ((value >>> 0) / 2147483647.5) - 1;
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validateBounds(bounds: WorldBounds): void {
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minZ) ||
    !Number.isFinite(bounds.maxZ) ||
    bounds.maxX <= bounds.minX ||
    bounds.maxZ <= bounds.minZ
  ) {
    throw new Error("Terrain bounds must be finite and have positive dimensions");
  }
}

function validateSegments(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 256) {
    throw new Error(`${name} must be an integer between 1 and 256`);
  }
}
