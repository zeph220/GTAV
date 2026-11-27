import { describe, expect, it } from "vitest";
import { Transform } from "../../gameplay/ecs/components";
import { Civilian } from "../civilian/civilian-components";
import { generateCity } from "../../world";
import { createCityPedestrianNavigation } from "../navigation/city-pedestrian-navigation";
import { createPedestrianSession } from "../session/create-pedestrian-session";

describe("NOVA CITY pedestrian integration", () => {
  it("derives connected sidewalk paths on both sides of generated roads", () => {
    const city = generateCity({
      seed: "pedestrian-sidewalk-test",
      blocksPerDistrict: 2,
      terrainSegmentsPerDistrict: 2,
    });
    const navigation = createCityPedestrianNavigation(city);

    expect(navigation.graph.size).toBeGreaterThan(city.roadNetwork.nodes.length);
    expect(navigation.spawnPoints).toHaveLength(navigation.graph.size);
    expect(navigation.spawnPoints.every((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
    )).toBe(true);

    const points = navigation.graph.getNodes();
    const first = points[0]!;
    const last = points[points.length - 1]!;
    expect(navigation.graph.findPath(first.id, last.id)).not.toBeNull();
  });

  it("creates a reproducible population with archetype variety", () => {
    const city = generateCity({
      seed: "pedestrian-population-test",
      blocksPerDistrict: 2,
      terrainSegmentsPerDistrict: 2,
    });
    const first = createPedestrianSession(city, { population: 32 });
    const second = createPedestrianSession(city, { population: 32 });

    expect(first.pedestrianIds).toHaveLength(32);
    expect(second.pedestrianIds).toHaveLength(32);
    const firstPopulation = first.pedestrianIds.map((id) => {
      const transform = first.world.getComponent(id, Transform)!;
      const civilian = first.world.getComponent(id, Civilian)!;
      return {
        position: transform.position,
        archetype: civilian.archetype,
        walkSpeed: civilian.walkSpeed,
      };
    });
    const secondPopulation = second.pedestrianIds.map((id) => {
      const transform = second.world.getComponent(id, Transform)!;
      const civilian = second.world.getComponent(id, Civilian)!;
      return {
        position: transform.position,
        archetype: civilian.archetype,
        walkSpeed: civilian.walkSpeed,
      };
    });

    expect(firstPopulation).toEqual(secondPopulation);
    expect(firstPopulation.every((civilian) =>
      Math.hypot(civilian.position.x, civilian.position.z) <= 220
    )).toBe(true);
    expect(new Set(firstPopulation.map((civilian) => civilian.archetype)).size)
      .toBeGreaterThan(1);
  });

  it("runs civilian decisions and locomotion through the fixed-step simulation", () => {
    const city = generateCity({
      seed: "pedestrian-motion-test",
      blocksPerDistrict: 2,
      terrainSegmentsPerDistrict: 2,
    });
    const session = createPedestrianSession(city, { population: 24 });
    const startingPositions = session.pedestrianIds.map((id) => {
      const position = session.world.getComponent(id, Transform)!.position;
      return { x: position.x, z: position.z };
    });

    for (let frame = 0; frame < 360; frame += 1) {
      session.simulation.advance(1 / 60);
    }

    const movedCount = session.pedestrianIds.filter((id, index) => {
      const position = session.world.getComponent(id, Transform)!.position;
      return Math.hypot(
        position.x - startingPositions[index]!.x,
        position.z - startingPositions[index]!.z,
      ) > 0.1;
    }).length;
    expect(movedCount).toBeGreaterThan(0);
  });

  it("rejects unsafe population sizes and invalid sidewalk geometry", () => {
    const city = generateCity({ seed: "pedestrian-validation-test" });
    expect(() => createPedestrianSession(city, { population: 251 })).toThrow(/between 0 and 250/);
    expect(() => createPedestrianSession(city, { spawnRadiusMeters: 0 })).toThrow(/spawn radius/);
    expect(() => createCityPedestrianNavigation(city, { sidewalkOffset: 0 })).toThrow(/Sidewalk offset/);
  });
});
