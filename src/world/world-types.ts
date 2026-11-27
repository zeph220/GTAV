export type DistrictId =
  | "downtown"
  | "financial-district"
  | "industrial-sector"
  | "harbor"
  | "university-zone"
  | "residential-hills"
  | "airport"
  | "old-town";

export type BuildingStyle =
  | "residential"
  | "office"
  | "warehouse"
  | "campus"
  | "hangar"
  | "historic"
  | "civic"
  | "retail";

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldPoint3 {
  x: number;
  y: number;
  z: number;
}

export interface DistrictDefinition {
  id: DistrictId;
  name: string;
  gridColumn: number;
  gridRow: number;
  buildingDensity: number;
  minBuildingHeight: number;
  maxBuildingHeight: number;
  buildingStyles: readonly BuildingStyle[];
}

export interface DistrictRegion extends DistrictDefinition {
  bounds: WorldBounds;
}

export interface CityBlock {
  id: string;
  districtId: DistrictId;
  bounds: WorldBounds;
}

export interface RoadNode {
  id: string;
  position: WorldPoint3;
}

export type RoadKind = "arterial" | "local";

export interface RoadSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  districtId: DistrictId;
  kind: RoadKind;
  width: number;
}

export interface BuildingLot {
  id: string;
  blockId: string;
  districtId: DistrictId;
  style: BuildingStyle;
  position: WorldPoint3;
  footprint: {
    width: number;
    depth: number;
  };
  height: number;
  rotationY: number;
}

export interface RoadNetwork {
  nodes: readonly RoadNode[];
  segments: readonly RoadSegment[];
}

export interface TerrainMeshData {
  width: number;
  depth: number;
  segmentsX: number;
  segmentsZ: number;
  /** Row-major grid of positions; X/Z are horizontal and Y is elevation. */
  vertices: readonly WorldPoint3[];
  /** Three indices per triangle, suitable for a non-index-restricted geometry. */
  indices: readonly number[];
}

export interface GeneratedCity {
  seed: string;
  bounds: WorldBounds;
  districts: readonly DistrictRegion[];
  blocks: readonly CityBlock[];
  roadNetwork: RoadNetwork;
  buildings: readonly BuildingLot[];
  terrain: TerrainMeshData;
}

export interface CityGenerationOptions {
  /** String or numeric seed. Identical inputs always produce identical output. */
  seed?: string | number;
  /** Number of blocks along each side of every district; integer in [2, 8]. */
  blocksPerDistrict?: number;
  /** Terrain mesh subdivisions per district edge; integer in [1, 16]. */
  terrainSegmentsPerDistrict?: number;
}
