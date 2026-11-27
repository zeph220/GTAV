import type { DistrictDefinition, DistrictRegion } from "./world-types";

export const NOVA_CITY_DISTRICTS: readonly DistrictDefinition[] = [
  {
    id: "airport",
    name: "Airport",
    gridColumn: 0,
    gridRow: 0,
    buildingDensity: 0.38,
    minBuildingHeight: 8,
    maxBuildingHeight: 28,
    buildingStyles: ["hangar", "warehouse", "office"],
  },
  {
    id: "university-zone",
    name: "University Zone",
    gridColumn: 1,
    gridRow: 0,
    buildingDensity: 0.72,
    minBuildingHeight: 12,
    maxBuildingHeight: 48,
    buildingStyles: ["campus", "civic", "residential"],
  },
  {
    id: "downtown",
    name: "Downtown",
    gridColumn: 2,
    gridRow: 0,
    buildingDensity: 0.92,
    minBuildingHeight: 24,
    maxBuildingHeight: 150,
    buildingStyles: ["office", "retail", "residential"],
  },
  {
    id: "financial-district",
    name: "Financial District",
    gridColumn: 3,
    gridRow: 0,
    buildingDensity: 0.88,
    minBuildingHeight: 35,
    maxBuildingHeight: 190,
    buildingStyles: ["office", "office", "civic"],
  },
  {
    id: "industrial-sector",
    name: "Industrial Sector",
    gridColumn: 0,
    gridRow: 1,
    buildingDensity: 0.64,
    minBuildingHeight: 9,
    maxBuildingHeight: 42,
    buildingStyles: ["warehouse", "warehouse", "office"],
  },
  {
    id: "harbor",
    name: "Harbor",
    gridColumn: 1,
    gridRow: 1,
    buildingDensity: 0.52,
    minBuildingHeight: 8,
    maxBuildingHeight: 36,
    buildingStyles: ["warehouse", "retail", "office"],
  },
  {
    id: "old-town",
    name: "Old Town",
    gridColumn: 2,
    gridRow: 1,
    buildingDensity: 0.84,
    minBuildingHeight: 7,
    maxBuildingHeight: 24,
    buildingStyles: ["historic", "retail", "residential"],
  },
  {
    id: "residential-hills",
    name: "Residential Hills",
    gridColumn: 3,
    gridRow: 1,
    buildingDensity: 0.58,
    minBuildingHeight: 6,
    maxBuildingHeight: 32,
    buildingStyles: ["residential", "residential", "civic"],
  },
] as const;

export function createDistrictRegions(
  districtWidth: number,
  districtDepth: number,
): DistrictRegion[] {
  return NOVA_CITY_DISTRICTS.map((district) => {
    const minX = -2 * districtWidth + district.gridColumn * districtWidth;
    const minZ = -districtDepth + district.gridRow * districtDepth;
    return {
      ...district,
      bounds: {
        minX,
        maxX: minX + districtWidth,
        minZ,
        maxZ: minZ + districtDepth,
      },
    };
  });
}
