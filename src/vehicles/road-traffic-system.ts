import type { RoadNetwork, RoadNode } from "../world/world-types";
import { Transform } from "../gameplay/ecs/components";
import type { GameSystem } from "../gameplay/ecs/system";
import type { World } from "../gameplay/ecs/world";
import {
  VehicleControls,
  VehicleDynamics,
  VehicleRoute,
  type VehicleRouteComponent,
} from "./vehicle-components";

export interface VehicleRouteOptions {
  nodeIds: readonly string[];
  targetIndex?: number;
  cruiseSpeedMps?: number;
  arrivalRadiusMeters?: number;
  loop?: boolean;
}

export function setVehicleRoute(
  world: World,
  entityId: number,
  options: VehicleRouteOptions,
): void {
  if (!world.hasComponent(entityId, VehicleDynamics) ||
      !world.hasComponent(entityId, VehicleControls) ||
      !world.hasComponent(entityId, Transform)) {
    throw new Error(`Entity ${entityId} is not a drivable vehicle`);
  }
  if (options.nodeIds.length < 2 || options.nodeIds.some((id) => !id.trim())) {
    throw new Error("A vehicle route requires at least two road node IDs");
  }
  const targetIndex = options.targetIndex ?? 1;
  const cruiseSpeedMps = options.cruiseSpeedMps ?? 12;
  const arrivalRadiusMeters = options.arrivalRadiusMeters ?? 7;
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= options.nodeIds.length) {
    throw new Error("Vehicle route targetIndex is outside the route");
  }
  if (!Number.isFinite(cruiseSpeedMps) || cruiseSpeedMps <= 0) {
    throw new Error("Vehicle cruise speed must be positive and finite");
  }
  if (!Number.isFinite(arrivalRadiusMeters) || arrivalRadiusMeters <= 0) {
    throw new Error("Vehicle route arrival radius must be positive and finite");
  }

  const route: VehicleRouteComponent = {
    nodeIds: [...options.nodeIds],
    targetIndex,
    cruiseSpeedMps,
    arrivalRadiusMeters,
    loop: options.loop ?? false,
  };
  world.addComponent(entityId, VehicleRoute, route);
}

export class RoadTrafficSystem implements GameSystem {
  private readonly nodeById: Map<string, RoadNode>;

  constructor(network: RoadNetwork) {
    this.nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    for (const segment of network.segments) {
      if (!this.nodeById.has(segment.fromNodeId) || !this.nodeById.has(segment.toNodeId)) {
        throw new Error(`Road segment ${segment.id} references an unknown node`);
      }
    }
  }

  update(world: World): void {
    for (const entityId of world.query(Transform, VehicleDynamics, VehicleControls, VehicleRoute)) {
      const transform = world.getComponent(entityId, Transform);
      const dynamics = world.getComponent(entityId, VehicleDynamics);
      const controls = world.getComponent(entityId, VehicleControls);
      const route = world.getComponent(entityId, VehicleRoute);
      if (!transform || !dynamics || !controls || !route) continue;

      const target = this.getTarget(route);
      if (!target) {
        controls.throttle = 0;
        controls.brake = 1;
        controls.steering = 0;
        continue;
      }

      let dx = target.position.x - transform.position.x;
      let dz = target.position.z - transform.position.z;
      let distance = Math.hypot(dx, dz);
      if (distance <= route.arrivalRadiusMeters) {
        if (route.targetIndex < route.nodeIds.length - 1) {
          route.targetIndex += 1;
        } else if (route.loop) {
          route.targetIndex = 0;
        } else {
          controls.throttle = 0;
          controls.brake = 1;
          controls.steering = 0;
          continue;
        }

        const nextTarget = this.getTarget(route);
        if (!nextTarget) continue;
        dx = nextTarget.position.x - transform.position.x;
        dz = nextTarget.position.z - transform.position.z;
        distance = Math.hypot(dx, dz);
      }

      if (distance < 0.001) {
        controls.throttle = 0;
        controls.brake = 0.5;
        controls.steering = 0;
        continue;
      }

      const desiredHeading = Math.atan2(dx, -dz);
      const headingError = normalizeAngle(desiredHeading - transform.rotationY);
      const turnDemand = Math.max(0, Math.abs(headingError) - 0.18);
      const targetSpeed = route.cruiseSpeedMps / (1 + turnDemand * 1.8);
      const speedError = targetSpeed - Math.max(0, dynamics.speedMps);

      controls.steering = clampAxis(
        headingError / Math.max(0.2, dynamics.maxSteeringAngleRadians * 1.4),
      );
      controls.throttle = speedError > 0.2
        ? Math.max(0.12, Math.min(1, speedError / 5))
        : 0;
      controls.brake = speedError < -0.8
        ? Math.max(0, Math.min(1, -speedError / 6))
        : 0;
      controls.handbrake = false;
    }
  }

  private getTarget(route: VehicleRouteComponent): RoadNode | undefined {
    const nodeId = route.nodeIds[route.targetIndex];
    return nodeId ? this.nodeById.get(nodeId) : undefined;
  }
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function normalizeAngle(angle: number): number {
  const tau = Math.PI * 2;
  return ((angle + Math.PI) % tau + tau) % tau - Math.PI;
}
