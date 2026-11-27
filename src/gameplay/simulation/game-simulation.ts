import type { GameSystem } from "../ecs/system";
import { World } from "../ecs/world";

export interface GameSimulationOptions {
  /** Duration of one deterministic simulation step, in seconds. */
  fixedDeltaSeconds?: number;
  /** Maximum wall-clock delta accepted from one rendered frame. */
  maxFrameDeltaSeconds?: number;
  /** Maximum fixed updates performed during one rendered frame. */
  maxSubSteps?: number;
}

export interface SimulationSystemRegistration {
  id: string;
  system: GameSystem;
  /** Lower priorities run first. Equal priorities retain registration order. */
  priority?: number;
}

interface RegisteredSystem extends SimulationSystemRegistration {
  priority: number;
  sequence: number;
}

export interface SimulationSnapshot {
  paused: boolean;
  fixedDeltaSeconds: number;
  accumulatorSeconds: number;
  registeredSystemIds: string[];
  totalSteps: number;
}

/**
 * Deterministic ECS scheduler for browser-driven games.
 *
 * Rendering may run at any frame rate; gameplay systems always receive the
 * same bounded fixed delta. The scheduler intentionally knows nothing about
 * Three.js, browser APIs, or presentation state.
 */
export class GameSimulation {
  readonly world: World;

  private readonly fixedDeltaSeconds: number;
  private readonly maxFrameDeltaSeconds: number;
  private readonly maxSubSteps: number;
  private readonly systems = new Map<string, RegisteredSystem>();
  private nextSequence = 0;
  private accumulatorSeconds = 0;
  private totalSteps = 0;
  private paused = false;
  private advancing = false;

  constructor(world = new World(), options: GameSimulationOptions = {}) {
    this.world = world;
    this.fixedDeltaSeconds = positiveOption(options.fixedDeltaSeconds, 1 / 60, "fixedDeltaSeconds");
    this.maxFrameDeltaSeconds = positiveOption(options.maxFrameDeltaSeconds, 0.25, "maxFrameDeltaSeconds");
    this.maxSubSteps = integerOption(options.maxSubSteps, 5, "maxSubSteps");
  }

  registerSystem(registration: SimulationSystemRegistration): () => void {
    const id = registration.id.trim();
    if (!id) throw new Error("A simulation system id is required");
    if (this.systems.has(id)) throw new Error(`Simulation system already registered: ${id}`);
    if (!registration.system || typeof registration.system.update !== "function") {
      throw new Error(`Invalid simulation system: ${id}`);
    }
    const priority = registration.priority ?? 0;
    if (!Number.isFinite(priority)) throw new Error(`Invalid priority for simulation system: ${id}`);

    const entry: RegisteredSystem = {
      id,
      system: registration.system,
      priority,
      sequence: this.nextSequence++,
    };
    this.systems.set(id, entry);

    return () => {
      if (this.systems.get(id) === entry) this.systems.delete(id);
    };
  }

  removeSystem(id: string): boolean {
    return this.systems.delete(id);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.accumulatorSeconds = 0;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Advances zero or more fixed steps and returns the number executed. */
  advance(frameDeltaSeconds: number): number {
    if (this.advancing) throw new Error("GameSimulation.advance cannot be called reentrantly");
    if (this.paused || !Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds <= 0) return 0;

    this.accumulatorSeconds += Math.min(frameDeltaSeconds, this.maxFrameDeltaSeconds);
    let steps = 0;
    this.advancing = true;
    try {
      while (
        this.accumulatorSeconds + Number.EPSILON >= this.fixedDeltaSeconds &&
        steps < this.maxSubSteps
      ) {
        this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - this.fixedDeltaSeconds);
        const orderedSystems = [...this.systems.values()].sort(
          (a, b) => a.priority - b.priority || a.sequence - b.sequence,
        );
        for (const entry of orderedSystems) {
          if (this.systems.get(entry.id) === entry) {
            entry.system.update(this.world, this.fixedDeltaSeconds);
          }
        }
        steps += 1;
        this.totalSteps += 1;
      }

      // Drop excessive backlog rather than causing a spiral of death after a
      // background-tab pause or a severely overloaded frame.
      if (steps === this.maxSubSteps && this.accumulatorSeconds >= this.fixedDeltaSeconds) {
        this.accumulatorSeconds %= this.fixedDeltaSeconds;
      }
      return steps;
    } finally {
      this.advancing = false;
    }
  }

  resetClock(): void {
    if (this.advancing) throw new Error("Cannot reset the simulation clock while advancing");
    this.accumulatorSeconds = 0;
  }

  getSnapshot(): SimulationSnapshot {
    return {
      paused: this.paused,
      fixedDeltaSeconds: this.fixedDeltaSeconds,
      accumulatorSeconds: this.accumulatorSeconds,
      registeredSystemIds: [...this.systems.values()]
        .sort((a, b) => a.priority - b.priority || a.sequence - b.sequence)
        .map((entry) => entry.id),
      totalSteps: this.totalSteps,
    };
  }
}

function positiveOption(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return resolved;
}

function integerOption(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return resolved;
}
