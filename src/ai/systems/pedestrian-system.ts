import type { Vec3 } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import type { GameSystem } from "../../gameplay/ecs/system";
import { ControlLock, Transform } from "../../gameplay/ecs/components";
import { World } from "../../gameplay/ecs/world";
import { Civilian } from "../civilian/civilian-components";
import { NavGraph } from "../navigation/nav-graph";
import { distance3 } from "../navigation/pathfinding";

export interface PedestrianThreat {
  position: Vec3;
  /** Radius at which civilians consider this entity dangerous. */
  radius: number;
}
export interface PedestrianSystemOptions {
  random?: () => number;
  decisionInterval?: number;
  arrivalRadius?: number;
  threats?: () => readonly PedestrianThreat[];
}

/**
 * Civilian locomotion and high-level decisions.
 * It follows sidewalk graph paths, pauses at destinations, wanders locally,
 * and reacts to nearby threats by choosing a route away from danger.
 */
export class PedestrianSystem implements GameSystem {
  private readonly random: () => number;
  private readonly decisionInterval: number;
  private readonly arrivalRadius: number;
  private readonly threats: () => readonly PedestrianThreat[];

  constructor(private readonly navigation: NavGraph, options: PedestrianSystemOptions = {}) {
    this.random = options.random ?? Math.random;
    this.decisionInterval = Math.max(0.25, options.decisionInterval ?? 2.5);
    this.arrivalRadius = Math.max(0.15, options.arrivalRadius ?? 0.65);
    this.threats = options.threats ?? (() => []);
  }

  update(world: World, deltaSeconds: number): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(deltaSeconds, MAX_SIMULATION_DELTA_SECONDS))
      : 0;
    if (!dt) return;

    const threats = this.threats();
    for (const id of world.query(Transform, Civilian)) {
      const transform = world.getComponent(id, Transform);
      const civilian = world.getComponent(id, Civilian);
      if (!transform || !civilian || world.hasComponent(id, ControlLock)) continue;

      const position = transform.position;
      const threat = this.findThreat(position, threats, civilian.alertness);
      if (threat && civilian.state !== "fleeing") this.startFleeing(position, civilian, threat.position);

      if (civilian.state === "waiting" || civilian.state === "idle") {
        civilian.waitRemaining = Math.max(0, civilian.waitRemaining - dt);
        civilian.decisionTimer -= dt;
        if (civilian.waitRemaining <= 0 && civilian.decisionTimer <= 0) {
          this.chooseWanderDestination(position, civilian);
        }
        continue;
      }

      if (!civilian.destination || civilian.waypointIndex >= civilian.path.length) {
        this.arrive(civilian);
        continue;
      }

      const waypoint = civilian.path[civilian.waypointIndex]!;
      const dx = waypoint.x - position.x;
      const dz = waypoint.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= this.arrivalRadius) {
        civilian.waypointIndex += 1;
        if (civilian.waypointIndex >= civilian.path.length) this.arrive(civilian);
        continue;
      }

      const step = Math.min(distance, civilian.walkSpeed * dt);
      position.x += (dx / distance) * step;
      position.z += (dz / distance) * step;
      transform.rotationY = Math.atan2(dx, -dz);
    }
  }

  private findThreat(position: Vec3, threats: readonly PedestrianThreat[], alertness: number): PedestrianThreat | undefined {
    let nearest: PedestrianThreat | undefined;
    let best = Infinity;
    for (const threat of threats) {
      const d = distance3(position, threat.position);
      const radius = Math.max(0, threat.radius) * Math.max(0.25, alertness);
      if (d < radius && d < best) { nearest = threat; best = d; }
    }
    return nearest;
  }

  private startFleeing(
    position: Vec3,
    civilian: import("../civilian/civilian-components").CivilianComponent,
    threat: Vec3,
  ): void {
    const start = this.navigation.nearestNode(position);
    if (!start) return;

    const currentThreatDistance = distance3(position, threat);
    const candidates = this.navigation.nodesWithin(
      position,
      Math.max(12, civilian.preferredWanderRadius * 1.5),
    )
      .filter((node) =>
        node.id !== start.id &&
        distance3(node.position, threat) > currentThreatDistance + 1.5
      )
      .sort((a, b) =>
        distance3(b.position, threat) - distance3(a.position, threat) ||
        distance3(position, a.position) - distance3(position, b.position) ||
        a.id.localeCompare(b.id)
      );

    for (const candidate of candidates) {
      const path = this.navigation.findPath(start.id, candidate.id);
      if (!path?.length) continue;
      civilian.state = "fleeing";
      civilian.destination = { ...candidate.position };
      civilian.path = path;
      civilian.waypointIndex = 0;
      civilian.waitRemaining = 0;
      return;
    }
  }

  private chooseWanderDestination(
    position: Vec3,
    civilian: import("../civilian/civilian-components").CivilianComponent,
  ): void {
    const start = this.navigation.nearestNode(position);
    const candidates = this.navigation.nodesWithin(
      position,
      civilian.preferredWanderRadius,
    ).filter((node) =>
      (!start || node.id !== start.id) &&
      distance3(position, node.position) > this.arrivalRadius
    );

    civilian.decisionTimer = this.decisionInterval;
    if (!start || !candidates.length) {
      civilian.state = "waiting";
      civilian.waitRemaining = 1 + this.random() * 2;
      return;
    }

    // Rotate the deterministic, distance-sorted candidate list by a seeded
    // random offset, then take the first reachable sidewalk destination.
    const firstCandidate = Math.floor(this.random() * candidates.length);
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const candidate = candidates[(firstCandidate + offset) % candidates.length]!;
      const path = this.navigation.findPath(start.id, candidate.id);
      if (!path?.length) continue;
      civilian.destination = { ...candidate.position };
      civilian.path = path;
      civilian.waypointIndex = 0;
      civilian.state = "walking";
      return;
    }

    civilian.state = "waiting";
    civilian.waitRemaining = 1 + this.random() * 2;
  }

  private arrive(civilian: import("../civilian/civilian-components").CivilianComponent): void {
    const wasFleeing = civilian.state === "fleeing";
    civilian.destination = null;
    civilian.path = [];
    civilian.waypointIndex = 0;
    civilian.state = "waiting";
    civilian.waitRemaining = wasFleeing ? 0.2 : 1 + this.random() * 4;
    civilian.decisionTimer = this.decisionInterval;
    if (civilian.schedulePhase === "commuting-to-work") civilian.schedulePhase = "at-work";
    else if (civilian.schedulePhase === "commuting-home") civilian.schedulePhase = "off-duty";
  }
}
