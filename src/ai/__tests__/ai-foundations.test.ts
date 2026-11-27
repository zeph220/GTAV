import { describe, expect, it } from "vitest";
import { World } from "../../gameplay/ecs/world";
import { Transform } from "../../gameplay/ecs/components";
import { NavGraph } from "../navigation/nav-graph";
import { findWorldPath } from "../navigation/pathfinding";
import { createCivilian } from "../civilian/create-civilian";
import { Civilian } from "../civilian/civilian-components";
import { PedestrianSystem } from "../systems/pedestrian-system";
import { CivilianScheduleSystem } from "../systems/civilian-schedule-system";
import { CivilianSpawner } from "../spawning/civilian-spawner";

function makeLineGraph(): NavGraph {
  const graph = new NavGraph();
  graph.addNode({ id: "a", position: { x: 0, y: 0, z: 0 } });
  graph.addNode({ id: "b", position: { x: 5, y: 0, z: 0 } });
  graph.addNode({ id: "c", position: { x: 10, y: 0, z: 0 } });
  graph.addEdge({ from: "a", to: "b" });
  graph.addEdge({ from: "b", to: "c" });
  return graph;
}

describe("NOVA CITY pedestrian AI", () => {
  it("finds a shortest path over connected sidewalk nodes", () => {
    const graph = makeLineGraph();
    expect(graph.findPath("a", "c")).toEqual([
      { x: 5, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ]);
    expect(graph.findPath("a", "missing")).toBeNull();
  });

  it("projects arbitrary positions and preserves the exact destination", () => {
    const path = findWorldPath(makeLineGraph(), { x: 0, y: 0, z: 0 }, { x: 9, y: 0, z: 2 });
    expect(path?.[path.length - 1]).toEqual({ x: 9, y: 0, z: 2 });
  });

  it("returns defensive, distance-sorted navigation node queries", () => {
    const graph = makeLineGraph();
    const nodes = graph.nodesWithin({ x: 4, y: 0, z: 0 }, 7);
    expect(nodes.map((node) => node.id)).toEqual(["b", "a", "c"]);
    nodes[0]!.position.x = 999;
    expect(graph.getNode("b")?.position.x).toBe(5);
  });

  it("creates a civilian with archetype traits and ECS components", () => {
    const world = new World();
    const id = createCivilian(world, { x: 1, y: 0, z: 2 }, { archetype: "commuter", random: () => 0.5 });
    expect(world.getComponent(id, Transform)?.position).toEqual({ x: 1, y: 0, z: 2 });
    expect(world.getComponent(id, Civilian)?.walkSpeed).toBeGreaterThan(1);
  });

  it("moves civilians along a route without exceeding the speed budget", () => {
    const graph = makeLineGraph();
    const world = new World();
    const id = createCivilian(world, { x: 0, y: 0, z: 0 }, { walkSpeed: 2, random: () => 0 });
    const civilian = world.getComponent(id, Civilian)!;
    civilian.path = [{ x: 5, y: 0, z: 0 }];
    civilian.destination = { x: 5, y: 0, z: 0 };
    civilian.state = "walking";
    new PedestrianSystem(graph).update(world, 0.1);
    expect(world.getComponent(id, Transform)?.position.x).toBeCloseTo(0.2);
  });

  it("chooses wander destinations from the sidewalk graph", () => {
    const graph = makeLineGraph();
    const world = new World();
    const id = createCivilian(world, { x: 0, y: 0, z: 0 }, { random: () => 0 });
    const civilian = world.getComponent(id, Civilian)!;
    civilian.waitRemaining = 0;
    civilian.decisionTimer = 0;

    new PedestrianSystem(graph, { random: () => 0 }).update(world, 0.1);

    expect(civilian.state).toBe("walking");
    expect(graph.getNodes().some((node) =>
      node.position.x === civilian.destination?.x &&
      node.position.y === civilian.destination?.y &&
      node.position.z === civilian.destination?.z
    )).toBe(true);
  });

  it("interpolates pedestrian height while walking along a slope", () => {
    const world = new World();
    const id = createCivilian(world, { x: 0, y: 0, z: 0 }, {
      walkSpeed: 2,
      random: () => 0,
    });
    const civilian = world.getComponent(id, Civilian)!;
    civilian.path = [{ x: 5, y: 10, z: 0 }];
    civilian.destination = { x: 5, y: 10, z: 0 };
    civilian.waypointIndex = 0;
    civilian.state = "walking";

    new PedestrianSystem(makeLineGraph()).update(world, 0.1);

    expect(world.getComponent(id, Transform)?.position.y).toBeCloseTo(0.4, 8);
  });

  it("makes civilians flee from a nearby threat", () => {
    const graph = makeLineGraph();
    const world = new World();
    const id = createCivilian(world, { x: 0, y: 0, z: 0 }, { random: () => 0 });
    const system = new PedestrianSystem(graph, {
      random: () => 0.5,
      threats: () => [{ position: { x: 1, y: 0, z: 0 }, radius: 8 }],
    });
    system.update(world, 1 / 60);
    const civilian = world.getComponent(id, Civilian)!;
    expect(civilian.state).toBe("fleeing");
    expect(graph.getNodes().some((node) =>
      node.position.x === civilian.destination?.x &&
      node.position.y === civilian.destination?.y &&
      node.position.z === civilian.destination?.z
    )).toBe(true);
  });

  it("assigns commuter routes only once per schedule phase", () => {
    const graph = makeLineGraph();
    const world = new World();
    const id = createCivilian(world, { x: 0, y: 0, z: 0 }, {
      archetype: "commuter",
      homeNodeId: "a",
      workNodeId: "c",
      random: () => 0,
    });
    const schedules = new CivilianScheduleSystem(graph);
    schedules.update(world, 8);
    const civilian = world.getComponent(id, Civilian)!;
    expect(civilian.schedulePhase).toBe("commuting-to-work");
    expect(civilian.path).toHaveLength(2);
    schedules.update(world, 8.1);
    expect(civilian.path).toHaveLength(2);
  });

  it("uses deterministic weighted spawn points", () => {
    const world = new World();
    const spawner = new CivilianSpawner(() => 0.99);
    const ids = spawner.spawn(world, [
      { position: { x: 0, y: 0, z: 0 }, weight: 1 },
      { position: { x: 20, y: 0, z: 0 }, weight: 3 },
    ], 4);
    expect(ids).toHaveLength(4);
    expect(world.getComponent(ids[0]!, Transform)?.position.x).toBe(20);
  });
});
