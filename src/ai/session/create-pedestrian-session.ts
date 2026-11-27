import { World } from "../../gameplay/ecs/world";
import { GameSimulation } from "../../gameplay/simulation/game-simulation";
import type { GeneratedCity } from "../../world/world-types";
import { createSeededRandom } from "../../world/generation/seeded-random";
import {
  createCityPedestrianNavigation,
  type CityPedestrianNavigation,
} from "../navigation/city-pedestrian-navigation";
import { CivilianSpawner } from "../spawning/civilian-spawner";
import { PedestrianSystem } from "../systems/pedestrian-system";

const ARCHETYPES = ["commuter", "resident", "visitor", "worker"] as const;

export interface PedestrianSessionOptions {
  population?: number;
  sidewalkOffset?: number;
}

export interface PedestrianSession {
  world: World;
  simulation: GameSimulation;
  navigation: CityPedestrianNavigation;
  pedestrianIds: readonly number[];
}

/** Creates a repeatable pedestrian population and its fixed-step simulation. */
export function createPedestrianSession(
  city: GeneratedCity,
  options: PedestrianSessionOptions = {},
): PedestrianSession {
  const population = options.population ?? 42;
  if (!Number.isInteger(population) || population < 0 || population > 250) {
    throw new Error("Pedestrian population must be an integer between 0 and 250");
  }

  const navigation = createCityPedestrianNavigation(city, {
    sidewalkOffset: options.sidewalkOffset,
  });
  if (population > 0 && navigation.spawnPoints.length === 0) {
    throw new Error("Cannot spawn pedestrians because the city has no sidewalk navigation nodes");
  }

  const random = createSeededRandom(`${city.seed}:pedestrians`);
  const spawnPoints = navigation.spawnPoints.map((position, index) => ({
    position,
    weight: 1,
    archetype: ARCHETYPES[index % ARCHETYPES.length],
  }));
  const world = new World();
  const spawner = new CivilianSpawner(random);
  const pedestrianIds = spawner.spawn(world, spawnPoints, population);
  const simulation = new GameSimulation(world);
  simulation.registerSystem({
    id: "pedestrian-ai",
    priority: 10,
    system: new PedestrianSystem(navigation.graph, { random }),
  });

  return { world, simulation, navigation, pedestrianIds };
}
