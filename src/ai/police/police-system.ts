import type { EntityId, Vec3 } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import { Transform } from "../../gameplay/ecs/components";
import type { GameSystem } from "../../gameplay/ecs/system";
import type { World } from "../../gameplay/ecs/world";
import { NavGraph } from "../navigation/nav-graph";
import { findWorldPath } from "../navigation/pathfinding";
import { createPoliceOfficer } from "./create-police-officer";
import { PoliceOfficer, WantedStatus } from "./police-components";

export type CrimeSeverity = "minor-assault" | "assault" | "weapon-discharge";

export interface PoliceIncident {
  suspectId: EntityId;
  position: Vec3;
  severity: CrimeSeverity;
}

export interface PoliceSystemOptions {
  spawnPoints?: readonly Vec3[];
  officerSpeed?: number;
  pursuitRadius?: number;
  arrestRadius?: number;
  arrestDurationSeconds?: number;
  repathIntervalSeconds?: number;
  searchRadius?: number;
  heatDecayDelaySeconds?: number;
  heatDecayPerSecond?: number;
}

const HEAT_BY_SEVERITY: Record<CrimeSeverity, number> = {
  "minor-assault": 18,
  assault: 32,
  "weapon-discharge": 48,
};
const WANTED_THRESHOLDS = [20, 45, 75, 110, 150];

/** Wanted heat, officer dispatch, navigation, pursuit and non-violent detention. */
export class PoliceSystem implements GameSystem {
  private spawnCursor = 0;
  private readonly spawnPoints: readonly Vec3[];
  private readonly officerSpeed: number;
  private readonly pursuitRadius: number;
  private readonly arrestRadius: number;
  private readonly arrestDurationSeconds: number;
  private readonly repathIntervalSeconds: number;
  private readonly searchRadius: number;
  private readonly heatDecayDelaySeconds: number;
  private readonly heatDecayPerSecond: number;

  constructor(
    private readonly navigation: NavGraph,
    options: PoliceSystemOptions = {},
  ) {
    this.spawnPoints = (options.spawnPoints ?? []).map((point) => ({ ...point }));
    this.officerSpeed = positive(options.officerSpeed, 6.5, 0.1);
    this.pursuitRadius = positive(options.pursuitRadius, 18, 1);
    this.arrestRadius = positive(options.arrestRadius, 1.6, 0.5);
    this.arrestDurationSeconds = positive(options.arrestDurationSeconds, 2, 0.1);
    this.repathIntervalSeconds = positive(options.repathIntervalSeconds, 1.25, 0.2);
    this.searchRadius = positive(options.searchRadius, 80, this.pursuitRadius);
    this.heatDecayDelaySeconds = Math.max(0, finite(options.heatDecayDelaySeconds, 15));
    this.heatDecayPerSecond = Math.max(0, finite(options.heatDecayPerSecond, 3));
  }

  reportIncident(world: World, incident: PoliceIncident): void {
    if (!world.hasEntity(incident.suspectId)) return;
    const existing = world.getComponent(incident.suspectId, WantedStatus);
    const status = existing ?? {
      heat: 0,
      level: 0,
      secondsSinceIncident: 0,
      lastKnownPosition: { ...incident.position },
      detained: false,
    };
    if (status.detained) return;
    status.heat = Math.min(200, status.heat + HEAT_BY_SEVERITY[incident.severity]);
    status.level = calculateWantedLevel(status.heat);
    status.secondsSinceIncident = 0;
    status.lastKnownPosition = { ...incident.position };
    if (!existing) world.addComponent(incident.suspectId, WantedStatus, status);
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;
    if (dt === 0) return;

    for (const suspectId of world.query(WantedStatus, Transform)) {
      const status = world.getComponent(suspectId, WantedStatus);
      const suspectTransform = world.getComponent(suspectId, Transform);
      if (!status || !suspectTransform || status.detained) continue;

      status.secondsSinceIncident += dt;
      const officers = world.query(PoliceOfficer, Transform)
        .filter((id) => world.getComponent(id, PoliceOfficer)?.targetEntityId === suspectId);
      const officersNearby = officers.some((id) => {
        const position = world.getComponent(id, Transform)?.position;
        return position ? distance3(position, suspectTransform.position) <= this.searchRadius : false;
      });
      if (!officersNearby && status.secondsSinceIncident > this.heatDecayDelaySeconds) {
        status.heat = Math.max(0, status.heat - this.heatDecayPerSecond * dt);
        status.level = calculateWantedLevel(status.heat);
      }

      while (officers.length > status.level) {
        const excess = officers.pop();
        if (excess !== undefined) world.destroyEntity(excess);
      }
      if (status.level <= 0) continue;
      while (officers.length < status.level) {
        const position = this.nextSpawnPosition(suspectTransform.position);
        officers.push(createPoliceOfficer(world, position, suspectId, this.officerSpeed));
      }
    }

    for (const officerId of world.query(PoliceOfficer, Transform)) {
      this.updateOfficer(world, officerId, dt);
    }
  }

  private updateOfficer(world: World, officerId: EntityId, dt: number): void {
    const officer = world.getComponent(officerId, PoliceOfficer);
    const transform = world.getComponent(officerId, Transform);
    if (!officer || !transform) return;

    const wanted = world.getComponent(officer.targetEntityId, WantedStatus);
    const targetTransform = world.getComponent(officer.targetEntityId, Transform);
    if (!wanted || !targetTransform || wanted.detained || wanted.level <= 0) {
      world.destroyEntity(officerId);
      return;
    }

    const position = transform.position;
    const target = targetTransform.position;
    const distance = distance3(position, target);

    if (distance <= this.arrestRadius) {
      officer.state = "detaining";
      officer.detainProgress += dt;
      if (officer.detainProgress >= this.arrestDurationSeconds) {
        wanted.detained = true;
        wanted.heat = 0;
        wanted.level = 0;
        for (const id of world.query(PoliceOfficer)) {
          if (world.getComponent(id, PoliceOfficer)?.targetEntityId === officer.targetEntityId) {
            world.destroyEntity(id);
          }
        }
      }
      return;
    }

    officer.detainProgress = 0;
    if (distance <= this.pursuitRadius) {
      officer.state = "pursuing";
      officer.path = [];
      officer.waypointIndex = 0;
      moveTowards(position, target, officer.moveSpeed * dt, transform);
      return;
    }

    officer.state = "responding";
    officer.repathRemaining -= dt;
    if (officer.repathRemaining <= 0 || officer.waypointIndex >= officer.path.length) {
      officer.path = findWorldPath(this.navigation, position, target) ?? [{ ...target }];
      officer.waypointIndex = 0;
      officer.repathRemaining = this.repathIntervalSeconds;
    }

    const waypoint = officer.path[officer.waypointIndex];
    if (!waypoint) return;
    if (distance3(position, waypoint) <= 0.35) {
      officer.waypointIndex += 1;
      return;
    }
    moveTowards(position, waypoint, officer.moveSpeed * dt, transform);
  }

  private nextSpawnPosition(target: Vec3): Vec3 {
    const index = this.spawnCursor++;
    if (this.spawnPoints.length > 0) {
      return { ...this.spawnPoints[index % this.spawnPoints.length]! };
    }
    const angle = index * 2.399963229728653;
    return {
      x: target.x + Math.cos(angle) * 28,
      y: target.y,
      z: target.z + Math.sin(angle) * 28,
    };
  }
}

function calculateWantedLevel(heat: number): number {
  let level = 0;
  for (const threshold of WANTED_THRESHOLDS) {
    if (heat >= threshold) level += 1;
  }
  return level;
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function moveTowards(
  position: Vec3,
  destination: Vec3,
  maximumStep: number,
  transform: { rotationY: number },
): void {
  const dx = destination.x - position.x;
  const dz = destination.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.0001) return;
  const step = Math.min(distance, maximumStep);
  position.x += (dx / distance) * step;
  position.z += (dz / distance) * step;
  transform.rotationY = Math.atan2(dx, dz);
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback;
}

function positive(value: number | undefined, fallback: number, minimum: number): number {
  return Math.max(minimum, finite(value, fallback));
}
