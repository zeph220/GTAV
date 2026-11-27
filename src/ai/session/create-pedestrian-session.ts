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

export const DEFAULT_CITY_PEDESTRIAN_POPULATION = 24;

const ARCHETYPES = ["commuter", "resident", "visitor", "worker"] as const;

export interface PedestrianSessionOptions {
  population?: number;
  sidewalkOffset?: number;
  /** Radius around the city centre used for the initial loaded pedestrian district. */
  spawnRadiusMeters?: number;
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
  const population = options.population ?? DEFAULT_CITY_PEDESTRIAN_POPULATION;
  if (!Number.isInteger(population) || population < 0 || population > 250) {
    throw new Error("Pedestrian population must be an integer between 0 and 250");
  }

  const spawnRadiusMeters = options.spawnRadiusMeters ?? 220;
  if (!Number.isFinite(spawnRadiusMeters) || spawnRadiusMeters <= 0) {
    throw new Error("Pedestrian spawn radius must be positive and finite");
  }

  const navigation = createCityPedestrianNavigation(city, {
    sidewalkOffset: options.sidewalkOffset,
  });
  const cityCenterX = (city.bounds.minX + city.bounds.maxX) / 2;
  const cityCenterZ = (city.bounds.minZ + city.bounds.maxZ) / 2;
  const localSpawnPoints = navigation.spawnPoints.filter((position) =>
    Math.hypot(position.x - cityCenterX, position.z - cityCenterZ) <= spawnRadiusMeters
  );
  if (population > 0 && localSpawnPoints.length === 0) {
    throw new Error("Cannot spawn pedestrians because the city has no sidewalk navigation nodes");
  }

  const random = createSeededRandom(`${city.seed}:pedestrians`);
  const spawnPoints = localSpawnPoints.map((position, index) => ({
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
