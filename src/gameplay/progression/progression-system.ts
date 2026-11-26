import type { EntityId } from "../../shared/types";
import type { GameSystem } from "../ecs/system";
import type { World } from "../ecs/world";
import { Progression } from "./progression-components";
import type { ProgressionComponent } from "./progression-components";

export interface ProgressionOptions {
  baseExperience?: number;
  levelExponent?: number;
  skillPointsPerLevel?: number;
  maximumLevel?: number;
  onLevelUp?: (playerId: EntityId, previousLevel: number, level: number) => void;
}

export interface ProgressionSnapshot extends ProgressionComponent {
  experienceIntoLevel: number;
  experienceForNextLevel: number;
}

export interface PerkDefinition {
  id: string;
  name: string;
  description: string;
  requiredLevel: number;
  skillPointCost: number;
  prerequisites?: readonly string[];
}

export type PerkUnlockFailure =
  | "unknown-player" | "unknown-perk" | "already-unlocked"
  | "level-too-low" | "missing-prerequisite" | "insufficient-points";

export type PerkUnlockResult =
  | { success: true; progression: ProgressionSnapshot }
  | { success: false; reason: PerkUnlockFailure };

/** Event-driven XP, level and perk progression. */
export class ProgressionSystem implements GameSystem {
  private readonly perks = new Map<string, PerkDefinition>();
  private readonly baseExperience: number;
  private readonly levelExponent: number;
  private readonly skillPointsPerLevel: number;
  private readonly maximumLevel: number;

  constructor(perks: readonly PerkDefinition[] = [], private readonly options: ProgressionOptions = {}) {
    this.baseExperience = positiveNumber(options.baseExperience, 100);
    this.levelExponent = positiveNumber(options.levelExponent, 1.35);
    this.skillPointsPerLevel = positiveInteger(options.skillPointsPerLevel, 1);
    this.maximumLevel = positiveInteger(options.maximumLevel, 100);
    for (const perk of perks) this.registerPerk(perk);
  }

  initialize(world: World, playerId: EntityId): void {
    if (!world.hasEntity(playerId)) throw new Error("Cannot initialize progression for an unknown entity");
    if (!world.hasComponent(playerId, Progression)) {
      world.addComponent(playerId, Progression, {
        experience: 0, level: 1, unspentSkillPoints: 0, unlockedPerks: [],
      });
    }
  }

  registerPerk(perk: PerkDefinition): void {
    if (!perk.id.trim() || !perk.name.trim() || !perk.description.trim() ||
      !Number.isInteger(perk.requiredLevel) || perk.requiredLevel < 1 ||
      !Number.isInteger(perk.skillPointCost) || perk.skillPointCost < 0) {
      throw new Error("Invalid perk definition");
    }
    if (this.perks.has(perk.id)) throw new Error("Perk already registered: " + perk.id);
    this.perks.set(perk.id, { ...perk, prerequisites: perk.prerequisites ? [...perk.prerequisites] : undefined });
  }

  awardExperience(world: World, playerId: EntityId, amount: number): ProgressionSnapshot | null {
    const component = world.getComponent(playerId, Progression);
    if (!component || !Number.isFinite(amount) || amount <= 0) return null;
    const gained = Math.floor(amount);
    if (gained < 1) return null;
    const previousLevel = component.level;
    component.experience += gained;
    const nextLevel = this.levelForExperience(component.experience);
    if (nextLevel > previousLevel) {
      component.level = nextLevel;
      component.unspentSkillPoints += (nextLevel - previousLevel) * this.skillPointsPerLevel;
      for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
        this.options.onLevelUp?.(playerId, level - 1, level);
      }
    }
    return this.getSnapshot(world, playerId);
  }

  unlockPerk(world: World, playerId: EntityId, perkId: string): PerkUnlockResult {
    const component = world.getComponent(playerId, Progression);
    if (!component) return { success: false, reason: "unknown-player" };
    const perk = this.perks.get(perkId);
    if (!perk) return { success: false, reason: "unknown-perk" };
    if (component.unlockedPerks.includes(perkId)) return { success: false, reason: "already-unlocked" };
    if (component.level < perk.requiredLevel) return { success: false, reason: "level-too-low" };
    if (!(perk.prerequisites ?? []).every((id) => component.unlockedPerks.includes(id))) {
      return { success: false, reason: "missing-prerequisite" };
    }
    if (component.unspentSkillPoints < perk.skillPointCost) return { success: false, reason: "insufficient-points" };
    component.unspentSkillPoints -= perk.skillPointCost;
    component.unlockedPerks.push(perkId);
    return { success: true, progression: this.getSnapshot(world, playerId)! };
  }

  getSnapshot(world: World, playerId: EntityId): ProgressionSnapshot | null {
    const component = world.getComponent(playerId, Progression);
    if (!component) return null;
    const start = this.totalExperienceForLevel(component.level);
    const next = this.totalExperienceForLevel(Math.min(this.maximumLevel, component.level + 1));
    return {
      ...component,
      unlockedPerks: [...component.unlockedPerks],
      experienceIntoLevel: Math.max(0, component.experience - start),
      experienceForNextLevel: component.level >= this.maximumLevel ? 0 : Math.max(0, next - start),
    };
  }

  update(_world: World, _deltaSeconds: number): void {
    // All progression changes are driven by gameplay events.
  }

  private levelForExperience(experience: number): number {
    let level = 1;
    while (level < this.maximumLevel && experience >= this.totalExperienceForLevel(level + 1)) level += 1;
    return level;
  }

  private totalExperienceForLevel(level: number): number {
    let total = 0;
    for (let current = 1; current < level; current += 1) {
      total += Math.floor(this.baseExperience * Math.pow(current, this.levelExponent));
    }
    return total;
  }
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}
function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}
