import type { EntityId, Vec3 } from "../../shared/types";
import { Transform } from "../../gameplay/ecs/components";
import type { World } from "../../gameplay/ecs/world";
import { PoliceOfficer } from "./police-components";

export function createPoliceOfficer(
  world: World,
  position: Vec3,
  targetEntityId: EntityId,
  moveSpeed = 6.5,
): EntityId {
  if (!Number.isFinite(moveSpeed) || moveSpeed <= 0) {
    throw new Error("Police officer speed must be greater than zero");
  }
  const entityId = world.createEntity();
  world.addComponent(entityId, Transform, {
    position: { ...position },
    rotationY: 0,
  });
  world.addComponent(entityId, PoliceOfficer, {
    targetEntityId,
    state: "responding",
    moveSpeed,
    path: [],
    waypointIndex: 0,
    repathRemaining: 0,
    detainProgress: 0,
  });
  return entityId;
}
