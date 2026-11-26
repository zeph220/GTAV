import { describe, expect, it, vi } from "vitest";
import { Transform } from "../../../gameplay/ecs/components";
import { World } from "../../../gameplay/ecs/world";
import { ReputationSystem } from "../../../gameplay/progression/reputation-system";
import { NOVA_CITY_GANGS } from "../gang-catalog";
import { GangMember } from "../gang-components";
import { GangSystem } from "../gang-system";

describe("NOVA CITY gang system", () => {
  it("registers the original factions and symmetric relationships", () => {
    const system = new GangSystem();
    for (const gang of NOVA_CITY_GANGS) system.registerGang(gang);
    system.setRelationship("northbank-circle", "harbor-line", "hostile");

    expect(system.listGangs()).toHaveLength(3);
    expect(system.getRelationship("northbank-circle", "harbor-line")).toBe("hostile");
    expect(system.getRelationship("harbor-line", "northbank-circle")).toBe("hostile");
    expect(system.getRelationship("northbank-circle", "northbank-circle")).toBe("allied");
  });

  it("rejects unknown factions and invalid or duplicate territories", () => {
    const system = new GangSystem();
    system.registerGang(NOVA_CITY_GANGS[0]!);

    expect(() => system.registerTerritory({
      id: "unknown", gangId: "missing", districtId: "Downtown",
      center: { x: 0, y: 0, z: 0 }, radius: 10,
    })).toThrow("Invalid gang territory");

    const territory = {
      id: "northbank", gangId: "northbank-circle", districtId: "Downtown",
      center: { x: 0, y: 0, z: 0 }, radius: 20,
    };
    system.registerTerritory(territory);
    expect(() => system.registerTerritory(territory)).toThrow("Territory already registered");
  });

  it("returns the most specific territory when registered zones overlap", () => {
    const system = new GangSystem();
    for (const gang of NOVA_CITY_GANGS) system.registerGang(gang);
    system.registerTerritory({
      id: "downtown", gangId: "northbank-circle", districtId: "Downtown",
      center: { x: 0, y: 0, z: 0 }, radius: 30,
    });
    system.registerTerritory({
      id: "market-square", gangId: "harbor-line", districtId: "Downtown",
      center: { x: 0, y: 0, z: 0 }, radius: 8,
    });

    expect(system.territoryAt({ x: 2, y: 0, z: 1 })?.id).toBe("market-square");
    expect(system.territoryAt({ x: 15, y: 0, z: 0 })?.id).toBe("downtown");
    expect(system.territoryAt({ x: 40, y: 0, z: 0 })).toBeNull();
  });

  it("alerts nearby members once when a player with hostile standing enters turf", () => {
    const reputation = new ReputationSystem();
    const onEntered = vi.fn();
    const onReaction = vi.fn();
    const system = new GangSystem({
      reputationSystem: reputation,
      onTerritoryEntered: onEntered,
      onMemberReaction: onReaction,
    });
    system.registerGang(NOVA_CITY_GANGS[0]!);
    system.registerTerritory({
      id: "northbank-square", gangId: "northbank-circle", districtId: "Downtown",
      center: { x: 0, y: 0, z: 0 }, radius: 40,
    });

    const world = new World();
    const playerId = world.createEntity();
    world.addComponent(playerId, Transform, {
      position: { x: 4, y: 0, z: 2 }, rotationY: 0,
    });
    reputation.initialize(world, playerId);
    reputation.adjust(world, playerId, "northbank-circle", -65, "previous dispute");

    const memberId = system.spawnMember(
      world,
      "northbank-circle",
      "lookout",
      { x: 5, y: 0, z: 2 },
      { aggression: 0.8 },
    );
    system.trackPlayer(playerId);

    system.update(world, 1 / 60);
    system.update(world, 1 / 60);

    expect(onEntered).toHaveBeenCalledTimes(1);
    expect(onEntered).toHaveBeenCalledWith(expect.objectContaining({
      playerId,
      standing: "hostile",
      territory: expect.objectContaining({ id: "northbank-square" }),
    }));
    expect(world.getComponent(memberId, GangMember)).toMatchObject({
      state: "confronting",
      targetPlayerId: playerId,
    });
    expect(onReaction).toHaveBeenCalledTimes(1);

    world.getComponent(playerId, Transform)!.position.x = 60;
    system.update(world, 1 / 60);
    expect(world.getComponent(memberId, GangMember)).toMatchObject({
      state: "idle",
      targetPlayerId: null,
    });
    expect(onReaction).toHaveBeenCalledTimes(2);
  });

  it("does not provoke members when the player's standing is neutral or friendly", () => {
    const reputation = new ReputationSystem();
    const system = new GangSystem({ reputationSystem: reputation });
    system.registerGang(NOVA_CITY_GANGS[0]!);
    system.registerTerritory({
      id: "northbank", gangId: "northbank-circle", districtId: "Downtown",
      center: { x: 0, y: 0, z: 0 }, radius: 20,
    });
    const world = new World();
    const playerId = world.createEntity();
    world.addComponent(playerId, Transform, { position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    reputation.initialize(world, playerId);
    const memberId = system.spawnMember(world, "northbank-circle", "patrol", { x: 1, y: 0, z: 0 });
    system.trackPlayer(playerId);

    system.update(world, 0.016);
    expect(world.getComponent(memberId, GangMember)?.state).toBe("idle");
  });
});
