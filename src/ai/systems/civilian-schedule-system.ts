import { World } from "../../gameplay/ecs/world";
import { Transform } from "../../gameplay/ecs/components";
import { Civilian } from "../civilian/civilian-components";
import { NavGraph } from "../navigation/nav-graph";

/**
 * Simple day schedule: commuters travel home/work around configurable hours.
 * Uses game-hour input, not wall-clock time, so it remains deterministic.
 */
export class CivilianScheduleSystem {
  constructor(private readonly navigation: NavGraph, private readonly commuteStartHour = 7, private readonly returnHour = 17) {}

  update(world: World, gameHour: number): void {
    const hour = ((gameHour % 24) + 24) % 24;
    const goingToWork = hour >= this.commuteStartHour && hour < this.returnHour;
    for (const id of world.query(Transform, Civilian)) {
      const transform = world.getComponent(id, Transform)!;
      const civilian = world.getComponent(id, Civilian)!;
      if (civilian.archetype !== "commuter" && civilian.archetype !== "worker") continue;
      const targetId = goingToWork ? civilian.workNodeId : civilian.homeNodeId;
      const phase = goingToWork ? "commuting-to-work" : "commuting-home";
      if (!targetId || civilian.schedulePhase === phase) continue;
      const target = this.navigation.getNode(targetId);
      const start = this.navigation.nearestNode(transform.position);
      if (!target || !start) continue;
      const path = this.navigation.findPath(start.id, targetId);
      if (!path) continue;
      civilian.path = path;
      civilian.destination = { ...target.position };
      civilian.waypointIndex = 0;
      civilian.state = path.length ? "walking" : "waiting";
      civilian.schedulePhase = phase;
    }
  }
}
