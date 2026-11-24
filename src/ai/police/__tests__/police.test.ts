import { describe, expect, it } from "vitest";
import { Transform } from "../../../gameplay/ecs/components";
import { World } from "../../../gameplay/ecs/world";
import { NavGraph } from "../../navigation/nav-graph";
import { PoliceOfficer, WantedStatus } from "../police-components";
import { PoliceSystem } from "../police-system";

function makeNavigation(): NavGraph {
  const graph = new NavGraph();
  graph.addNode({ id: "west", position: { x: -20, y: 0, z: 0 } });
  graph.addNode({ id: "east", position: { x: 20, y: 0, z: 0 } });
  graph.addEdge({ from: "west", to: "east" });
  return graph;
}

function makeSuspect(world: World): number {
  const id = world.createEntity();
  world.addComponent(id, Transform, { position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
  return id;
}

describe("NOVA CITY police response", () => {
  it("raises wanted heat and dispatches officers", () => {
    const world = new World();
    const suspectId = makeSuspect(world);
    const police = new PoliceSystem(makeNavigation(), {
      spawnPoints: [{ x: 12, y: 0, z: 0 }],
      pursuitRadius: 20,
    });
    police.reportIncident(world, {
      suspectId,
      position: { x: 0, y: 0, z: 0 },
      severity: "assault",
    });
    expect(world.getComponent(suspectId, WantedStatus)?.level).toBe(1);
    police.update(world, 0.1);
    expect(world.query(PoliceOfficer, Transform)).toHaveLength(1);
    expect(world.getComponent(world.query(PoliceOfficer)[0]!, PoliceOfficer)?.state).toBe("pursuing");
  });

  it("increases the response level for repeated incidents", () => {
    const world = new World();
    const suspectId = makeSuspect(world);
    const police = new PoliceSystem(makeNavigation());
    police.reportIncident(world, { suspectId, position: { x: 0, y: 0, z: 0 }, severity: "assault" });
    police.reportIncident(world, { suspectId, position: { x: 0, y: 0, z: 0 }, severity: "weapon-discharge" });
    expect(world.getComponent(suspectId, WantedStatus)?.level).toBe(3);
    police.update(world, 0.1);
    expect(world.query(PoliceOfficer)).toHaveLength(3);
  });

  it("detains a suspect after officers hold them at close range", () => {
    const world = new World();
    const suspectId = makeSuspect(world);
    const police = new PoliceSystem(makeNavigation(), {
      spawnPoints: [{ x: 0, y: 0, z: 0 }],
      arrestDurationSeconds: 0.3,
    });
    police.reportIncident(world, {
      suspectId,
      position: { x: 0, y: 0, z: 0 },
      severity: "assault",
    });
    for (let index = 0; index < 4; index += 1) police.update(world, 0.1);
    expect(world.getComponent(suspectId, WantedStatus)?.detained).toBe(true);
    expect(world.getComponent(suspectId, WantedStatus)?.level).toBe(0);
    expect(world.query(PoliceOfficer)).toHaveLength(0);
  });
});
