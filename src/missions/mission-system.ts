import { MAX_SIMULATION_DELTA_SECONDS } from "../shared/constants";
import type { EntityId } from "../shared/types";
import type { GameSystem } from "../gameplay/ecs/system";
import type { World } from "../gameplay/ecs/world";
import { MissionJournal } from "./mission-components";
import type {
  MissionDefinition,
  MissionEvent,
  MissionJournalSnapshot,
  MissionProgress,
  MissionUpdate,
} from "./mission-types";

export interface MissionSystemOptions {
  onUpdated?: (update: MissionUpdate) => void;
  onCompleted?: (update: MissionUpdate, definition: MissionDefinition) => void;
  onFailed?: (update: MissionUpdate, definition: MissionDefinition) => void;
}

/** Quest journal and deterministic, event-driven objective progression. */
export class MissionSystem implements GameSystem {
  private readonly definitions = new Map<string, MissionDefinition>();

  constructor(
    definitions: readonly MissionDefinition[] = [],
    private readonly options: MissionSystemOptions = {},
  ) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: MissionDefinition): void {
    validateDefinition(definition);
    if (this.definitions.has(definition.id)) {
      throw new Error(`Mission already registered: ${definition.id}`);
    }
    this.definitions.set(definition.id, cloneDefinition(definition));
  }

  initializeJournal(world: World, playerId: EntityId): void {
    if (!world.hasEntity(playerId)) throw new Error(`Unknown player entity: ${playerId}`);
    if (!world.hasComponent(playerId, MissionJournal)) {
      world.addComponent(playerId, MissionJournal, {
        activeMissionIds: [],
        completedMissionIds: [],
        failedMissionIds: [],
        missions: {},
      });
    }
  }

  startMission(world: World, playerId: EntityId, missionId: string): boolean {
    const definition = this.definitions.get(missionId);
    const journal = world.getComponent(playerId, MissionJournal);
    if (!definition || !journal || journal.missions[missionId]) return false;
    if (!(definition.prerequisites ?? []).every((id) => journal.completedMissionIds.includes(id))) {
      return false;
    }

    const progress: MissionProgress = {
      missionId,
      status: "active",
      elapsedSeconds: 0,
      objectives: definition.objectives.map((objective) => ({
        objectiveId: objective.id,
        currentCount: 0,
        requiredCount: objective.requiredCount ?? 1,
        completed: false,
      })),
    };
    journal.missions[missionId] = progress;
    journal.activeMissionIds.push(missionId);
    this.notify(this.options.onUpdated, playerId, missionId, progress);
    return true;
  }

  reportEvent(world: World, playerId: EntityId, event: MissionEvent): number {
    const journal = world.getComponent(playerId, MissionJournal);
    if (!journal) return 0;
    const amount = event.amount === undefined
      ? 1
      : Number.isFinite(event.amount)
        ? Math.max(0, Math.floor(event.amount))
        : 0;
    if (amount === 0) return 0;
    let changed = 0;

    for (const missionId of [...journal.activeMissionIds]) {
      const definition = this.definitions.get(missionId);
      const progress = journal.missions[missionId];
      if (!definition || !progress || progress.status !== "active") continue;

      const nextIndex = progress.objectives.findIndex((objective) => !objective.completed);
      if (nextIndex < 0) continue;
      const objectiveProgress = progress.objectives[nextIndex]!;
      const objectiveDefinition = definition.objectives[nextIndex]!;
      if (objectiveDefinition.type !== event.type || objectiveDefinition.targetId !== event.targetId) continue;

      objectiveProgress.currentCount = Math.min(
        objectiveProgress.requiredCount,
        objectiveProgress.currentCount + amount,
      );
      objectiveProgress.completed = objectiveProgress.currentCount >= objectiveProgress.requiredCount;
      changed += 1;

      if (progress.objectives.every((objective) => objective.completed)) {
        progress.status = "completed";
        journal.activeMissionIds = journal.activeMissionIds.filter((id) => id !== missionId);
        journal.completedMissionIds.push(missionId);
        const update = this.notify(this.options.onUpdated, playerId, missionId, progress);
        if (update) this.options.onCompleted?.(update, definition);
      } else {
        this.notify(this.options.onUpdated, playerId, missionId, progress);
      }
    }
    return changed;
  }

  abandonMission(world: World, playerId: EntityId, missionId: string): boolean {
    const journal = world.getComponent(playerId, MissionJournal);
    const progress = journal?.missions[missionId];
    if (!journal || !progress || progress.status !== "active") return false;
    progress.status = "failed";
    journal.activeMissionIds = journal.activeMissionIds.filter((id) => id !== missionId);
    journal.failedMissionIds.push(missionId);
    const definition = this.definitions.get(missionId);
    const update = this.notify(this.options.onUpdated, playerId, missionId, progress);
    if (definition && update) this.options.onFailed?.(update, definition);
    return true;
  }

  getSnapshot(world: World, playerId: EntityId): MissionJournalSnapshot | null {
    const journal = world.getComponent(playerId, MissionJournal);
    if (!journal) return null;
    const missions: Record<string, MissionProgress> = {};
    for (const [id, progress] of Object.entries(journal.missions)) {
      missions[id] = cloneProgress(progress);
    }
    return {
      playerId,
      activeMissionIds: [...journal.activeMissionIds],
      completedMissionIds: [...journal.completedMissionIds],
      failedMissionIds: [...journal.failedMissionIds],
      missions,
    };
  }

  getDefinition(missionId: string): MissionDefinition | undefined {
    const definition = this.definitions.get(missionId);
    return definition ? cloneDefinition(definition) : undefined;
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;
    if (dt === 0) return;

    for (const playerId of world.query(MissionJournal)) {
      const journal = world.getComponent(playerId, MissionJournal);
      if (!journal) continue;
      for (const missionId of [...journal.activeMissionIds]) {
        const definition = this.definitions.get(missionId);
        const progress = journal.missions[missionId];
        if (!definition?.timeLimitSeconds || !progress || progress.status !== "active") continue;
        progress.elapsedSeconds += dt;
        if (progress.elapsedSeconds >= definition.timeLimitSeconds) {
          this.abandonMission(world, playerId, missionId);
        }
      }
    }
  }

  private notify(
    callback: ((update: MissionUpdate) => void) | undefined,
    playerId: EntityId,
    missionId: string,
    progress: MissionProgress,
  ): MissionUpdate {
    const update = { playerId, missionId, progress: cloneProgress(progress) };
    callback?.(update);
    return update;
  }
}

function validateDefinition(definition: MissionDefinition): void {
  if (!definition.id.trim() || !definition.title.trim() || !definition.description.trim()) {
    throw new Error("Mission id, title and description are required");
  }
  if (definition.objectives.length === 0) throw new Error("A mission needs at least one objective");
  const ids = new Set<string>();
  for (const objective of definition.objectives) {
    if (!objective.id.trim() || !objective.targetId.trim() || !objective.description.trim()) {
      throw new Error(`Invalid objective in mission ${definition.id}`);
    }
    if (ids.has(objective.id)) throw new Error(`Duplicate objective id: ${objective.id}`);
    ids.add(objective.id);
    if (objective.requiredCount !== undefined &&
      (!Number.isInteger(objective.requiredCount) || objective.requiredCount < 1)) {
      throw new Error(`Invalid requiredCount for objective ${objective.id}`);
    }
  }
  if (definition.timeLimitSeconds !== undefined &&
    (!Number.isFinite(definition.timeLimitSeconds) || definition.timeLimitSeconds <= 0)) {
    throw new Error(`Invalid time limit for mission ${definition.id}`);
  }
}

function cloneDefinition(definition: MissionDefinition): MissionDefinition {
  return {
    ...definition,
    objectives: definition.objectives.map((objective) => ({ ...objective })),
    prerequisites: definition.prerequisites ? [...definition.prerequisites] : undefined,
    reward: definition.reward ? {
      ...definition.reward,
      items: definition.reward.items?.map((item) => ({ ...item })),
    } : undefined,
  };
}

function cloneProgress(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    objectives: progress.objectives.map((objective) => ({ ...objective })),
  };
}
