import { MissionJournal } from "../../missions/mission-components";
import type { MissionJournalComponent } from "../../missions/mission-components";
import { Health } from "../combat/combat-components";
import type { HealthComponent } from "../combat/combat-components";
import { Inventory, Transform } from "../ecs/components";
import type { InventoryComponent, TransformComponent } from "../ecs/components";
import { Progression, Reputation } from "../progression/progression-components";
import type { ProgressionComponent, ReputationComponent } from "../progression/progression-components";
import type { SaveSectionAdapter } from "./save-types";

export function createDefaultSaveAdapters(): SaveSectionAdapter[] {
  return [
    { id: "player.transform",
      capture: (w, id) => cloneTransform(w.getComponent(id, Transform)),
      validate: isTransform,
      restore: (w, id, v) => w.addComponent(id, Transform, cloneTransform(v as TransformComponent)!) },
    { id: "player.health",
      capture: (w, id) => cloneHealth(w.getComponent(id, Health)),
      validate: isHealth,
      restore: (w, id, v) => w.addComponent(id, Health, { ...(v as HealthComponent) }) },
    { id: "player.inventory",
      capture: (w, id) => cloneInventory(w.getComponent(id, Inventory)),
      validate: isInventory,
      restore: (w, id, v) => w.addComponent(id, Inventory, cloneInventory(v as InventoryComponent)!) },
    { id: "player.reputation",
      capture: (w, id) => cloneReputation(w.getComponent(id, Reputation)),
      validate: isReputation,
      restore: (w, id, v) => w.addComponent(id, Reputation, cloneReputation(v as ReputationComponent)!) },
    { id: "player.progression",
      capture: (w, id) => cloneProgression(w.getComponent(id, Progression)),
      validate: isProgression,
      restore: (w, id, v) => w.addComponent(id, Progression, cloneProgression(v as ProgressionComponent)!) },
    { id: "player.missions",
      capture: (w, id) => cloneMissionJournal(w.getComponent(id, MissionJournal)),
      validate: isMissionJournal,
      restore: (w, id, v) => w.addComponent(id, MissionJournal, cloneMissionJournal(v as MissionJournalComponent)!) },
  ];
}

function cloneTransform(v: TransformComponent | undefined): TransformComponent | undefined {
  return v ? { position: { ...v.position }, rotationY: v.rotationY } : undefined;
}
function cloneHealth(v: HealthComponent | undefined): HealthComponent | undefined {
  return v ? { current: v.current, maximum: v.maximum } : undefined;
}
function cloneInventory(v: InventoryComponent | undefined): InventoryComponent | undefined {
  return v ? { capacity: v.capacity, slots: v.slots.map((slot) => ({ ...slot })) } : undefined;
}
function cloneReputation(v: ReputationComponent | undefined): ReputationComponent | undefined {
  return v ? { factions: { ...v.factions } } : undefined;
}
function cloneProgression(v: ProgressionComponent | undefined): ProgressionComponent | undefined {
  return v ? { ...v, unlockedPerks: [...v.unlockedPerks] } : undefined;
}
function cloneMissionJournal(v: MissionJournalComponent | undefined): MissionJournalComponent | undefined {
  return v ? JSON.parse(JSON.stringify(v)) as MissionJournalComponent : undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function finite(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }
function isVec3(v: unknown): boolean {
  return isRecord(v) && finite(v.x) && finite(v.y) && finite(v.z);
}
function isTransform(v: unknown): v is TransformComponent {
  return isRecord(v) && isVec3(v.position) && finite(v.rotationY);
}
function isHealth(v: unknown): v is HealthComponent {
  return isRecord(v) && finite(v.current) && finite(v.maximum) &&
    v.maximum >= 1 && v.current >= 1 && v.current <= v.maximum;
}
function isInventory(v: unknown): v is InventoryComponent {
  if (!isRecord(v) || !Number.isInteger(v.capacity) || (v.capacity as number) < 1 ||
    !Array.isArray(v.slots) || v.slots.length > (v.capacity as number)) return false;
  return v.slots.every((slot) => isRecord(slot) && typeof slot.itemId === "string" &&
    slot.itemId.trim().length > 0 && Number.isInteger(slot.quantity) && (slot.quantity as number) > 0);
}
function isReputation(v: unknown): v is ReputationComponent {
  return isRecord(v) && isRecord(v.factions) &&
    Object.values(v.factions).every((score) => finite(score) && score >= -100 && score <= 100);
}
function isProgression(v: unknown): v is ProgressionComponent {
  return isRecord(v) && Number.isInteger(v.experience) && (v.experience as number) >= 0 &&
    Number.isInteger(v.level) && (v.level as number) >= 1 &&
    Number.isInteger(v.unspentSkillPoints) && (v.unspentSkillPoints as number) >= 0 &&
    Array.isArray(v.unlockedPerks) && v.unlockedPerks.every((perk) => typeof perk === "string" && perk.length > 0);
}
function isMissionJournal(v: unknown): v is MissionJournalComponent {
  if (!isRecord(v) || !Array.isArray(v.activeMissionIds) || !Array.isArray(v.completedMissionIds) ||
    !Array.isArray(v.failedMissionIds) || !isRecord(v.missions)) return false;
  const stringIds = (ids: unknown[]) => ids.every((id) => typeof id === "string");
  if (!stringIds(v.activeMissionIds) || !stringIds(v.completedMissionIds) || !stringIds(v.failedMissionIds)) return false;
  return Object.values(v.missions).every((mission) => {
    if (!isRecord(mission) || typeof mission.missionId !== "string" ||
      !["active", "completed", "failed"].includes(String(mission.status)) ||
      !finite(mission.elapsedSeconds) || mission.elapsedSeconds < 0 || !Array.isArray(mission.objectives)) return false;
    return mission.objectives.every((objective) => isRecord(objective) &&
      typeof objective.objectiveId === "string" &&
      Number.isInteger(objective.currentCount) && (objective.currentCount as number) >= 0 &&
      Number.isInteger(objective.requiredCount) && (objective.requiredCount as number) >= 1 &&
      typeof objective.completed === "boolean");
  });
}
