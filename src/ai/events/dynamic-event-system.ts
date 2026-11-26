import type { EntityId, Vec3 } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import { Transform } from "../../gameplay/ecs/components";
import type { GameSystem } from "../../gameplay/ecs/system";
import type { World } from "../../gameplay/ecs/world";
import { DynamicEvent } from "./dynamic-event-components";
import type { DynamicEventComponent } from "./dynamic-event-components";
import type {
  DynamicEventDefinition,
  DynamicEventLifecycleEvent,
  DynamicEventLocation,
  DynamicEventProgressEvent,
  DynamicEventSnapshot,
} from "./dynamic-event-types";

export interface DynamicEventDirectorOptions {
  random?: () => number;
  spawnIntervalSeconds?: number;
  maxActiveEvents?: number;
  maxHistory?: number;
  onStarted?: (event: DynamicEventLifecycleEvent) => void;
  onProgress?: (event: DynamicEventProgressEvent) => void;
  onCompleted?: (event: DynamicEventLifecycleEvent) => void;
  onExpired?: (event: DynamicEventLifecycleEvent) => void;
  onCancelled?: (event: DynamicEventLifecycleEvent) => void;
}

/**
 * Weighted director for temporary district events.
 * World locations are injected by the world layer; this class never invents map coordinates.
 */
export class DynamicEventDirector implements GameSystem {
  private readonly definitions = new Map<string, DynamicEventDefinition>();
  private readonly locations = new Map<string, DynamicEventLocation>();
  private readonly cooldownUntil = new Map<string, number>();
  private readonly terminalHistory: EntityId[] = [];
  private readonly random: () => number;
  private readonly spawnIntervalSeconds: number;
  private readonly maxActiveEvents: number;
  private readonly maxHistory: number;
  private gameTimeSeconds = 0;
  private spawnTimer: number;

  constructor(private readonly options: DynamicEventDirectorOptions = {}) {
    this.random = options.random ?? Math.random;
    this.spawnIntervalSeconds = positive(options.spawnIntervalSeconds, 45);
    this.maxActiveEvents = positiveInteger(options.maxActiveEvents, 3);
    this.maxHistory = positiveInteger(options.maxHistory, 30);
    this.spawnTimer = this.spawnIntervalSeconds;
  }

  registerDefinition(definition: DynamicEventDefinition): void {
    if (!definition.id.trim() || !definition.title.trim() || !definition.description.trim() ||
      !Number.isFinite(definition.weight) || definition.weight <= 0 ||
      !Number.isFinite(definition.durationSeconds) || definition.durationSeconds <= 0 ||
      !Number.isFinite(definition.cooldownSeconds) || definition.cooldownSeconds < 0 ||
      !Number.isInteger(definition.requiredProgress) || definition.requiredProgress < 1) {
      throw new Error("Invalid dynamic event definition");
    }
    if (this.definitions.has(definition.id)) {
      throw new Error("Dynamic event already registered: " + definition.id);
    }
    this.definitions.set(definition.id, cloneDefinition(definition));
  }

  registerLocation(location: DynamicEventLocation): void {
    if (!location.id.trim() || !location.districtId.trim() || !isFiniteVec3(location.position) ||
      !Array.isArray(location.tags) || location.tags.some((tag) => !tag.trim())) {
      throw new Error("Invalid dynamic event location");
    }
    if (this.locations.has(location.id)) {
      throw new Error("Dynamic event location already registered: " + location.id);
    }
    this.locations.set(location.id, cloneLocation(location));
  }

  unregisterLocation(locationId: string): boolean {
    return this.locations.delete(locationId);
  }

  listDefinitions(): DynamicEventDefinition[] {
    return [...this.definitions.values()].map(cloneDefinition);
  }

  listLocations(): DynamicEventLocation[] {
    return [...this.locations.values()].map(cloneLocation);
  }

  startEvent(world: World, definitionId: string, locationId: string): EntityId | null {
    const definition = this.definitions.get(definitionId);
    const location = this.locations.get(locationId);
    if (!definition || !location || !this.isLocationEligible(definition, location)) return null;
    if (this.activeCount(world) >= this.maxActiveEvents) return null;
    if ((this.cooldownUntil.get(definitionId) ?? 0) > this.gameTimeSeconds) return null;
    if (this.isLocationOccupied(world, locationId)) return null;

    const entityId = world.createEntity();
    const component: DynamicEventComponent = {
      definitionId: definition.id,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      locationId: location.id,
      districtId: location.districtId,
      position: { ...location.position },
      state: "active",
      elapsedSeconds: 0,
      remainingSeconds: definition.durationSeconds,
      progress: 0,
      requiredProgress: definition.requiredProgress,
      participantIds: [],
      relatedFactionIds: [...(definition.relatedFactionIds ?? [])],
    };
    world.addComponent(entityId, Transform, {
      position: { ...location.position },
      rotationY: 0,
    });
    world.addComponent(entityId, DynamicEvent, component);
    this.cooldownUntil.set(definitionId, this.gameTimeSeconds + definition.cooldownSeconds);
    this.options.onStarted?.({ entityId, event: snapshot(entityId, component) });
    return entityId;
  }

  contribute(
    world: World,
    eventEntityId: EntityId,
    playerId: EntityId,
    amount = 1,
  ): DynamicEventSnapshot | null {
    const event = world.getComponent(eventEntityId, DynamicEvent);
    if (!event || event.state !== "active" || !world.hasEntity(playerId) ||
      !Number.isFinite(amount) || amount <= 0) return null;

    const contribution = Math.floor(amount);
    if (contribution < 1) return null;
    event.progress = Math.min(event.requiredProgress, event.progress + contribution);
    if (!event.participantIds.includes(playerId)) event.participantIds.push(playerId);

    const currentSnapshot = snapshot(eventEntityId, event);
    this.options.onProgress?.({
      entityId: eventEntityId,
      event: currentSnapshot,
      playerId,
      contribution,
    });

    if (event.progress >= event.requiredProgress) this.complete(world, eventEntityId, event);
    return snapshot(eventEntityId, event);
  }

  cancelEvent(world: World, eventEntityId: EntityId): DynamicEventSnapshot | null {
    const event = world.getComponent(eventEntityId, DynamicEvent);
    if (!event || event.state !== "active") return null;
    event.state = "cancelled";
    event.remainingSeconds = 0;
    this.rememberTerminal(world, eventEntityId);
    const result = snapshot(eventEntityId, event);
    this.options.onCancelled?.({ entityId: eventEntityId, event: result });
    return result;
  }

  getSnapshot(world: World, eventEntityId: EntityId): DynamicEventSnapshot | null {
    const event = world.getComponent(eventEntityId, DynamicEvent);
    return event ? snapshot(eventEntityId, event) : null;
  }

  getActiveEvents(world: World): DynamicEventSnapshot[] {
    return world.query(DynamicEvent)
      .map((entityId) => {
        const event = world.getComponent(entityId, DynamicEvent);
        return event?.state === "active" ? snapshot(entityId, event) : null;
      })
      .filter((event): event is DynamicEventSnapshot => event !== null);
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;
    if (dt <= 0) return;
    this.gameTimeSeconds += dt;

    for (const entityId of world.query(DynamicEvent)) {
      const event = world.getComponent(entityId, DynamicEvent);
      if (!event || event.state !== "active") continue;
      event.elapsedSeconds += dt;
      event.remainingSeconds = Math.max(0, event.remainingSeconds - dt);
      if (event.remainingSeconds <= 0) {
        event.state = "expired";
        this.rememberTerminal(world, entityId);
        this.options.onExpired?.({ entityId, event: snapshot(entityId, event) });
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnIntervalSeconds;
      this.tryStartWeightedEvent(world);
    }
  }

  private complete(world: World, entityId: EntityId, event: DynamicEventComponent): void {
    event.state = "completed";
    event.remainingSeconds = 0;
    this.rememberTerminal(world, entityId);
    this.options.onCompleted?.({ entityId, event: snapshot(entityId, event) });
  }

  private tryStartWeightedEvent(world: World): void {
    if (this.activeCount(world) >= this.maxActiveEvents) return;
    const candidates = [...this.definitions.values()].filter((definition) => {
      if ((this.cooldownUntil.get(definition.id) ?? 0) > this.gameTimeSeconds) return false;
      return [...this.locations.values()].some((location) =>
        this.isLocationEligible(definition, location) && !this.isLocationOccupied(world, location.id),
      );
    });
    if (candidates.length === 0) return;

    const selected = weightedChoice(candidates, this.random());
    if (!selected) return;
    const eligibleLocations = [...this.locations.values()].filter((location) =>
      this.isLocationEligible(selected, location) && !this.isLocationOccupied(world, location.id),
    );
    if (eligibleLocations.length === 0) return;
    const location = eligibleLocations[randomIndex(this.random(), eligibleLocations.length)];
    if (location) this.startEvent(world, selected.id, location.id);
  }

  private isLocationEligible(definition: DynamicEventDefinition, location: DynamicEventLocation): boolean {
    const requiredTags = definition.requiredLocationTags ?? [];
    const allowedDistricts = definition.allowedDistrictIds;
    return requiredTags.every((tag) => location.tags.includes(tag)) &&
      (!allowedDistricts || allowedDistricts.includes(location.districtId));
  }

  private isLocationOccupied(world: World, locationId: string): boolean {
    return world.query(DynamicEvent).some((entityId) =>
      world.getComponent(entityId, DynamicEvent)?.state === "active" &&
      world.getComponent(entityId, DynamicEvent)?.locationId === locationId,
    );
  }

  private activeCount(world: World): number {
    return world.query(DynamicEvent).filter((entityId) =>
      world.getComponent(entityId, DynamicEvent)?.state === "active",
    ).length;
  }

  private rememberTerminal(world: World, entityId: EntityId): void {
    this.terminalHistory.push(entityId);
    while (this.terminalHistory.length > this.maxHistory) {
      const oldest = this.terminalHistory.shift();
      if (oldest !== undefined) world.destroyEntity(oldest);
    }
  }
}

function snapshot(entityId: EntityId, event: DynamicEventComponent): DynamicEventSnapshot {
  return {
    entityId,
    ...event,
    position: { ...event.position },
    participantIds: [...event.participantIds],
    relatedFactionIds: [...event.relatedFactionIds],
  };
}

function cloneDefinition(definition: DynamicEventDefinition): DynamicEventDefinition {
  return {
    ...definition,
    requiredLocationTags: definition.requiredLocationTags ? [...definition.requiredLocationTags] : undefined,
    allowedDistrictIds: definition.allowedDistrictIds ? [...definition.allowedDistrictIds] : undefined,
    relatedFactionIds: definition.relatedFactionIds ? [...definition.relatedFactionIds] : undefined,
  };
}

function cloneLocation(location: DynamicEventLocation): DynamicEventLocation {
  return { ...location, position: { ...location.position }, tags: [...location.tags] };
}

function weightedChoice<T extends { weight: number }>(items: readonly T[], randomValue: number): T | null {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  let remaining = clampRandom(randomValue) * totalWeight;
  for (const item of items) {
    remaining -= item.weight;
    if (remaining < 0) return item;
  }
  return items[items.length - 1] ?? null;
}

function randomIndex(randomValue: number, length: number): number {
  return Math.min(length - 1, Math.floor(clampRandom(randomValue) * length));
}

function clampRandom(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0;
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isFiniteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}
