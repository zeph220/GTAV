import type { EntityId, Vec3 } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import { Transform } from "../../gameplay/ecs/components";
import type { GameSystem } from "../../gameplay/ecs/system";
import type { World } from "../../gameplay/ecs/world";
import { ReputationSystem, type ReputationStanding } from "../../gameplay/progression/reputation-system";
import { GangMember, type GangMemberRole, type GangMemberState } from "./gang-components";

export type GangRelationship = "allied" | "friendly" | "neutral" | "unfriendly" | "hostile";

export interface GangDefinition {
  id: string;
  name: string;
  homeDistrict: string;
  description: string;
}

export interface GangTerritory {
  id: string;
  gangId: string;
  districtId: string;
  center: Vec3;
  radius: number;
}

export interface GangMemberOptions {
  perceptionRadius?: number;
  aggression?: number;
}

export interface GangTerritoryEvent {
  playerId: EntityId;
  territory: GangTerritory;
  gang: GangDefinition;
  reputation: number;
  standing: ReputationStanding;
}

export interface GangMemberReaction {
  memberId: EntityId;
  playerId: EntityId | null;
  gangId: string;
  previousState: GangMemberState;
  state: GangMemberState;
  reputation: number;
}

export interface GangSystemOptions {
  reputationSystem?: ReputationSystem;
  onTerritoryEntered?: (event: GangTerritoryEvent) => void;
  onTerritoryLeft?: (event: GangTerritoryEvent) => void;
  onMemberReaction?: (event: GangMemberReaction) => void;
}

/** Gang registry, territory lookup and non-lethal ECS reactions to hostile trespass. */
export class GangSystem implements GameSystem {
  private readonly gangs = new Map<string, GangDefinition>();
  private readonly territories = new Map<string, GangTerritory>();
  private readonly relationships = new Map<string, GangRelationship>();
  private readonly trackedPlayers = new Set<EntityId>();
  private readonly playerTerritories = new Map<EntityId, string>();
  private readonly reputation: ReputationSystem;

  constructor(private readonly options: GangSystemOptions = {}) {
    this.reputation = options.reputationSystem ?? new ReputationSystem();
  }

  registerGang(definition: GangDefinition): void {
    if (!definition.id.trim() || !definition.name.trim() ||
      !definition.homeDistrict.trim() || !definition.description.trim()) {
      throw new Error("Gang definition fields must not be empty");
    }
    if (this.gangs.has(definition.id)) throw new Error("Gang already registered: " + definition.id);
    this.gangs.set(definition.id, { ...definition });
  }

  registerTerritory(territory: GangTerritory): void {
    if (!territory.id.trim() || !territory.districtId.trim() ||
      !this.gangs.has(territory.gangId) || !isFiniteVec3(territory.center) ||
      !Number.isFinite(territory.radius) || territory.radius <= 0) {
      throw new Error("Invalid gang territory");
    }
    if (this.territories.has(territory.id)) throw new Error("Territory already registered: " + territory.id);
    this.territories.set(territory.id, { ...territory, center: { ...territory.center } });
  }

  setRelationship(fromGangId: string, toGangId: string, relationship: GangRelationship): void {
    if (!this.gangs.has(fromGangId) || !this.gangs.has(toGangId) || fromGangId === toGangId) {
      throw new Error("Both distinct gangs must be registered before setting a relationship");
    }
    this.relationships.set(relationshipKey(fromGangId, toGangId), relationship);
  }

  getRelationship(fromGangId: string, toGangId: string): GangRelationship {
    if (fromGangId === toGangId) return "allied";
    return this.relationships.get(relationshipKey(fromGangId, toGangId)) ?? "neutral";
  }

  getGang(gangId: string): GangDefinition | null {
    const gang = this.gangs.get(gangId);
    return gang ? { ...gang } : null;
  }

  listGangs(): GangDefinition[] {
    return [...this.gangs.values()].map((gang) => ({ ...gang }));
  }

  listTerritories(): GangTerritory[] {
    return [...this.territories.values()].map(cloneTerritory);
  }

  territoryAt(position: Vec3): GangTerritory | null {
    if (!isFiniteVec3(position)) return null;
    const matching = [...this.territories.values()]
      .filter((territory) => distance3(position, territory.center) <= territory.radius)
      .sort((a, b) => a.radius - b.radius || a.id.localeCompare(b.id));
    return matching[0] ? cloneTerritory(matching[0]) : null;
  }

  registerMember(
    world: World,
    entityId: EntityId,
    gangId: string,
    role: GangMemberRole,
    options: GangMemberOptions = {},
  ): void {
    if (!world.hasEntity(entityId)) throw new Error("Cannot register a gang member for an unknown entity");
    if (!this.gangs.has(gangId)) throw new Error("Unknown gang: " + gangId);
    if (!Number.isFinite(options.perceptionRadius ?? 16) || (options.perceptionRadius ?? 16) <= 0 ||
      !Number.isFinite(options.aggression ?? 0.5) ||
      (options.aggression ?? 0.5) < 0 || (options.aggression ?? 0.5) > 1) {
      throw new Error("Invalid gang member tuning");
    }
    world.addComponent(entityId, GangMember, {
      gangId,
      role,
      state: "idle",
      perceptionRadius: options.perceptionRadius ?? 16,
      aggression: options.aggression ?? 0.5,
      targetPlayerId: null,
    });
  }

  spawnMember(
    world: World,
    gangId: string,
    role: GangMemberRole,
    position: Vec3,
    options: GangMemberOptions = {},
  ): EntityId {
    if (!isFiniteVec3(position)) throw new Error("Gang member position must be finite");
    const entityId = world.createEntity();
    world.addComponent(entityId, Transform, { position: { ...position }, rotationY: 0 });
    this.registerMember(world, entityId, gangId, role, options);
    return entityId;
  }

  trackPlayer(playerId: EntityId): () => void {
    this.trackedPlayers.add(playerId);
    return () => {
      this.trackedPlayers.delete(playerId);
      this.playerTerritories.delete(playerId);
    };
  }

  getPlayerReputation(world: World, playerId: EntityId, gangId: string): number {
    return this.reputation.get(world, playerId, gangId);
  }

  getPlayerStanding(world: World, playerId: EntityId, gangId: string): ReputationStanding {
    return this.reputation.getStanding(this.getPlayerReputation(world, playerId, gangId));
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;

    for (const playerId of [...this.trackedPlayers]) {
      if (!world.hasEntity(playerId)) {
        this.trackedPlayers.delete(playerId);
        this.playerTerritories.delete(playerId);
        continue;
      }
      const position = world.getComponent(playerId, Transform)?.position;
      if (!position) continue;
      this.updatePlayerTerritory(world, playerId, position);
    }

    this.updateMemberReactions(world);
    void dt;
  }

  private updatePlayerTerritory(world: World, playerId: EntityId, position: Vec3): void {
    const territory = this.territoryAt(position);
    const previousTerritoryId = this.playerTerritories.get(playerId);
    const nextTerritoryId = territory?.id;

    if (previousTerritoryId === nextTerritoryId) return;

    if (previousTerritoryId) {
      const previous = this.territories.get(previousTerritoryId);
      const gang = previous ? this.gangs.get(previous.gangId) : undefined;
      if (previous && gang) this.options.onTerritoryLeft?.(
        this.createTerritoryEvent(world, playerId, previous, gang),
      );
    }

    if (nextTerritoryId && territory) {
      this.playerTerritories.set(playerId, nextTerritoryId);
      const gang = this.gangs.get(territory.gangId);
      if (gang) this.options.onTerritoryEntered?.(
        this.createTerritoryEvent(world, playerId, territory, gang),
      );
    } else {
      this.playerTerritories.delete(playerId);
    }
  }

  private createTerritoryEvent(
    world: World,
    playerId: EntityId,
    territory: GangTerritory,
    gang: GangDefinition,
  ): GangTerritoryEvent {
    const reputation = this.reputation.get(world, playerId, gang.id);
    return {
      playerId,
      territory: cloneTerritory(territory),
      gang: { ...gang },
      reputation,
      standing: this.reputation.getStanding(reputation),
    };
  }

  private updateMemberReactions(world: World): void {
    for (const memberId of world.query(GangMember, Transform)) {
      const member = world.getComponent(memberId, GangMember);
      const memberPosition = world.getComponent(memberId, Transform)?.position;
      if (!member || !memberPosition) continue;

      let target: { playerId: EntityId; distance: number; reputation: number } | null = null;
      for (const playerId of this.trackedPlayers) {
        if (this.playerTerritories.get(playerId) === undefined) continue;
        const territory = this.territories.get(this.playerTerritories.get(playerId)!);
        if (!territory || territory.gangId !== member.gangId) continue;
        const playerPosition = world.getComponent(playerId, Transform)?.position;
        if (!playerPosition) continue;
        const distance = distance3(memberPosition, playerPosition);
        if (distance > member.perceptionRadius) continue;
        const reputation = this.reputation.get(world, playerId, member.gangId);
        if (reputation > -25) continue;
        if (!target || distance < target.distance) target = { playerId, distance, reputation };
      }

      const nextState: GangMemberState = target
        ? target.reputation <= -75 && member.aggression >= 0.55 ? "confronting" : "alert"
        : "idle";
      const nextTarget = target?.playerId ?? null;
      if (member.state === nextState && member.targetPlayerId === nextTarget) continue;

      const previousState = member.state;
      member.state = nextState;
      member.targetPlayerId = nextTarget;
      this.options.onMemberReaction?.({
        memberId,
        playerId: nextTarget,
        gangId: member.gangId,
        previousState,
        state: nextState,
        reputation: target?.reputation ?? 0,
      });
    }
  }
}

function relationshipKey(from: string, to: string): string {
  return from.localeCompare(to) <= 0 ? from + "|" + to : to + "|" + from;
}

function cloneTerritory(territory: GangTerritory): GangTerritory {
  return { ...territory, center: { ...territory.center } };
}

function isFiniteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
