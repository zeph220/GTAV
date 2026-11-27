import { describe, expect, it, vi } from "vitest";
import { GameSimulation } from "../game-simulation";

describe("GameSimulation", () => {
  it("runs systems at a fixed delta and in stable priority order", () => {
    const simulation = new GameSimulation(undefined, { fixedDeltaSeconds: 0.1 });
    const calls: string[] = [];
    simulation.registerSystem({ id: "late", priority: 20, system: { update: (_world, dt) => calls.push(`late:${dt}`) } });
    simulation.registerSystem({ id: "first", priority: -10, system: { update: (_world, dt) => calls.push(`first:${dt}`) } });
    simulation.registerSystem({ id: "middle", priority: 20, system: { update: (_world, dt) => calls.push(`middle:${dt}`) } });

    expect(simulation.advance(0.2)).toBe(2);
    expect(calls).toEqual([
      "first:0.1", "late:0.1", "middle:0.1",
      "first:0.1", "late:0.1", "middle:0.1",
    ]);
    expect(simulation.getSnapshot().totalSteps).toBe(2);
  });

  it("accumulates partial frames without variable-delta updates", () => {
    const simulation = new GameSimulation(undefined, { fixedDeltaSeconds: 0.1 });
    const update = vi.fn();
    simulation.registerSystem({ id: "probe", system: { update } });

    expect(simulation.advance(0.04)).toBe(0);
    expect(simulation.advance(0.05)).toBe(0);
    expect(simulation.advance(0.02)).toBe(1);
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(simulation.world, 0.1);
  });

  it("clamps long frames and caps catch-up work", () => {
    const simulation = new GameSimulation(undefined, {
      fixedDeltaSeconds: 0.1,
      maxFrameDeltaSeconds: 1,
      maxSubSteps: 3,
    });
    const update = vi.fn();
    simulation.registerSystem({ id: "probe", system: { update } });

    expect(simulation.advance(10)).toBe(3);
    expect(update).toHaveBeenCalledTimes(3);
    expect(simulation.getSnapshot().accumulatorSeconds).toBeLessThan(0.1);
  });

  it("does not advance while paused and clears accumulated time", () => {
    const simulation = new GameSimulation(undefined, { fixedDeltaSeconds: 0.1 });
    const update = vi.fn();
    simulation.registerSystem({ id: "probe", system: { update } });
    simulation.advance(0.06);
    simulation.setPaused(true);

    expect(simulation.advance(1)).toBe(0);
    expect(simulation.getSnapshot().accumulatorSeconds).toBe(0);
    simulation.setPaused(false);
    expect(simulation.advance(0.05)).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects duplicate ids and supports unregistering a system", () => {
    const simulation = new GameSimulation();
    const registration = { id: "movement", system: { update: vi.fn() } };
    const unregister = simulation.registerSystem(registration);

    expect(() => simulation.registerSystem(registration)).toThrow("already registered");
    unregister();
    expect(simulation.getSnapshot().registeredSystemIds).toEqual([]);
    expect(simulation.removeSystem("movement")).toBe(false);
  });

  it("does not run a system removed earlier in the same tick", () => {
    const simulation = new GameSimulation(undefined, { fixedDeltaSeconds: 0.1 });
    const calls: string[] = [];
    simulation.registerSystem({
      id: "remove",
      priority: 0,
      system: { update: () => { calls.push("remove"); simulation.removeSystem("later"); } },
    });
    simulation.registerSystem({
      id: "later",
      priority: 1,
      system: { update: () => calls.push("later") },
    });

    simulation.advance(0.1);
    expect(calls).toEqual(["remove"]);
  });

  it("guards against reentrant advances and always releases the guard after errors", () => {
    const simulation = new GameSimulation(undefined, { fixedDeltaSeconds: 0.1 });
    simulation.registerSystem({
      id: "reentrant",
      system: { update: () => simulation.advance(0.1) },
    });

    expect(() => simulation.advance(0.1)).toThrow("reentrantly");
    simulation.removeSystem("reentrant");
    expect(simulation.advance(0.1)).toBe(1);
  });

  it("validates scheduler configuration", () => {
    expect(() => new GameSimulation(undefined, { fixedDeltaSeconds: 0 })).toThrow();
    expect(() => new GameSimulation(undefined, { maxSubSteps: 0 })).toThrow();
  });
});
