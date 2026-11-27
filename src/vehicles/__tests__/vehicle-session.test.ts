import { describe, expect, it } from "vitest";
import { Transform } from "../../gameplay/ecs/components";
import { generateCity } from "../../world/generation/city-generator";
import { VehicleDynamics } from "../vehicle-components";
import { createVehicleSession } from "../create-vehicle-session";

describe("createVehicleSession", () => {
  it("spawns a drivable car and road-following traffic on the generated city", () => {
    const city = generateCity({
      seed: "vehicle-session-test",
      terrainSegmentsPerDistrict: 4,
    });
    const session = createVehicleSession(city);

    expect(session.world.entityCount).toBe(2);
    expect(session.simulation.getSnapshot().registeredSystemIds).toEqual([
      "road-traffic",
      "vehicle-driving",
    ]);

    const player = session.world.getComponent(session.playerVehicleId, Transform)!;
    const trafficId = session.trafficVehicleIds[0]!;
    const traffic = session.world.getComponent(trafficId, Transform)!;
    const trafficStart = { x: traffic.position.x, z: traffic.position.z };
    expect(player.position.x).toBeCloseTo(40, 8);
    expect(player.position.z).toBeCloseTo(0, 8);
    expect(traffic.position.x).toBeCloseTo(-80, 8);
    expect(traffic.position.z).toBeCloseTo(80, 8);

    for (let index = 0; index < 120; index += 1) {
      session.simulation.advance(1 / 60);
    }

    const trafficAfter = session.world.getComponent(trafficId, Transform)!;
    const trafficDynamics = session.world.getComponent(trafficId, VehicleDynamics)!;
    expect(trafficDynamics.speedMps).toBeGreaterThan(0);
    expect(Math.hypot(
      trafficAfter.position.x - trafficStart.x,
      trafficAfter.position.z - trafficStart.z,
    )).toBeGreaterThan(1);
  });
});
