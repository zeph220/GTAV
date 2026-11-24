import type { Vec3 } from "../../shared/types";
import { MAX_SIMULATION_DELTA_SECONDS } from "../../shared/constants";
import type { GameSystem } from "../../gameplay/ecs/system";
import { Transform } from "../../gameplay/ecs/components";
import { World } from "../../gameplay/ecs/world";
import { Civilian } from "../civilian/civilian-components";
import { NavGraph } from "../navigation/nav-graph";
import { distance3, findWorldPath } from "../navigation/pathfinding";

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
      if (!transform || !civilian) continue;

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
      transform.rotationY = Math.atan2(dx, dz);
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

  private startFleeing(position: Vec3, civilian: import("../civilian/civilian-components").CivilianComponent, threat: Vec3): void {
    const dx = position.x - threat.x;
    const dz = position.z - threat.z;
    const length = Math.hypot(dx, dz) || 1;
    const distance = Math.max(12, civilian.preferredWanderRadius * 1.5);
    const destination = { x: position.x + dx / length * distance, y: position.y, z: position.z + dz / length * distance };
    const path = findWorldPath(this.navigation, position, destination);
    if (!path?.length) return;
    civilian.state = "fleeing";
    civilian.destination = destination;
    civilian.path = path;
    civilian.waypointIndex = 0;
    civilian.waitRemaining = 0;
  }

  private chooseWanderDestination(position: Vec3, civilian: import("../civilian/civilian-components").CivilianComponent): void {
    const angle = this.random() * Math.PI * 2;
    const radius = civilian.preferredWanderRadius * (0.35 + this.random() * 0.65);
    const destination = {
      x: position.x + Math.cos(angle) * radius,
      y: position.y,
      z: position.z + Math.sin(angle) * radius,
    };
    const path = findWorldPath(this.navigation, position, destination);
    civilian.decisionTimer = this.decisionInterval;
    if (!path?.length) {
      civilian.state = "waiting";
      civilian.waitRemaining = 1 + this.random() * 2;
      return;
    }
    civilian.destination = destination;
    civilian.path = path;
    civilian.waypointIndex = 0;
    civilian.state = "walking";
  }

  private arrive(civilian: import("../civilian/civilian-components").CivilianComponent): void {
    civilian.destination = null;
    civilian.path = [];
    civilian.waypointIndex = 0;
    civilian.state = "waiting";
    civilian.waitRemaining = civilian.state === "fleeing" ? 0.2 : 1 + this.random() * 4;
    civilian.decisionTimer = this.decisionInterval;
    civilian.schedulePhase = "off-duty";
  }
}
