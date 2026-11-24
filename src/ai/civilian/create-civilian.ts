import type { Vec3 } from "../../shared/types";
import { World } from "../../gameplay/ecs/world";
import { Transform } from "../../gameplay/ecs/components";
import { Civilian, CivilianNeeds, type CivilianArchetype } from "./civilian-components";

export interface CreateCivilianOptions {
  archetype?: CivilianArchetype;
  walkSpeed?: number;
  wanderRadius?: number;
  alertness?: number;
  homeNodeId?: string;
  workNodeId?: string;
  random?: () => number;
}

/** Creates a civilian entity with sensible archetype-specific traits. */
export function createCivilian(
  world: World,
  position: Vec3,
  options: CreateCivilianOptions = {},
): number {
  const random = options.random ?? Math.random;
  const archetype = options.archetype ?? "resident";
  const defaults = {
    commuter: { speed: 1.45, radius: 28, alertness: 1.15 },
    resident: { speed: 1.15, radius: 18, alertness: 1 },
    visitor: { speed: 0.95, radius: 12, alertness: 0.9 },
    worker: { speed: 1.25, radius: 22, alertness: 1.05 },
  }[archetype];
  const id = world.createEntity();
  world.addComponent(id, Transform, { position: { ...position }, rotationY: random() * Math.PI * 2 });
  world.addComponent(id, Civilian, {
    archetype,
    state: "waiting",
    walkSpeed: Math.max(0.2, options.walkSpeed ?? defaults.speed),
    destination: null,
    path: [],
    waypointIndex: 0,
    waitRemaining: random() * 2,
    decisionTimer: random() * 0.5,
    preferredWanderRadius: Math.max(2, options.wanderRadius ?? defaults.radius),
    alertness: Math.max(0.1, options.alertness ?? defaults.alertness),
    homeNodeId: options.homeNodeId,
    workNodeId: options.workNodeId,
    schedulePhase: "off-duty",
  });
  world.addComponent(id, CivilianNeeds, {
    energy: 0.65 + random() * 0.35,
    social: 0.25 + random() * 0.5,
    purpose: 0.4 + random() * 0.6,
  });
  return id;
}
