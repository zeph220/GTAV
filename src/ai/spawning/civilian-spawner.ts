import type { Vec3 } from "../../shared/types";
import { World } from "../../gameplay/ecs/world";
import { createCivilian, type CreateCivilianOptions } from "../civilian/create-civilian";
import type { CivilianArchetype } from "../civilian/civilian-components";

export interface CivilianSpawnPoint {
  position: Vec3;
  weight?: number;
  archetype?: CivilianArchetype;
  options?: Omit<CreateCivilianOptions, "archetype">;
}

/** Weighted, seeded-friendly civilian population helper. */
export class CivilianSpawner {
  constructor(private readonly random: () => number = Math.random) {}

  spawn(world: World, points: readonly CivilianSpawnPoint[], count: number): number[] {
    if (!points.length || !Number.isFinite(count) || count <= 0) return [];
    const valid = points.filter((point) =>
      Number.isFinite(point.position.x) && Number.isFinite(point.position.y) &&
      Number.isFinite(point.position.z) && (point.weight ?? 1) > 0
    );
    if (!valid.length) return [];
    const totalWeight = valid.reduce((sum, point) => sum + (point.weight ?? 1), 0);
    const ids: number[] = [];
    for (let i = 0; i < Math.floor(count); i += 1) {
      let ticket = this.random() * totalWeight;
      let selected = valid[valid.length - 1]!;
      for (const point of valid) {
        ticket -= point.weight ?? 1;
        if (ticket <= 0) { selected = point; break; }
      }
      ids.push(createCivilian(world, selected.position, {
        ...selected.options,
        archetype: selected.archetype,
        random: this.random,
      }));
    }
    return ids;
  }
}
