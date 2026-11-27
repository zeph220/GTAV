import { defineComponent } from "../gameplay/ecs/component";

export type VehicleGear = "forward" | "reverse" | "neutral";

export interface VehicleDynamicsComponent {
  massKg: number;
  engineAccelerationMps2: number;
  brakingAccelerationMps2: number;
  handbrakeAccelerationMps2: number;
  maxForwardSpeedMps: number;
  maxReverseSpeedMps: number;
  wheelBaseMeters: number;
  maxSteeringAngleRadians: number;
  steeringResponse: number;
  rollingResistanceMps2: number;
  aerodynamicDrag: number;
  speedMps: number;
  steeringAngleRadians: number;
  gear: VehicleGear;
}

export interface VehicleControlsComponent {
  /** Signed engine request: -1 reverse, +1 forward. */
  throttle: number;
  /** Service brake, normalized to [0, 1]. */
  brake: number;
  /** Steering: -1 left, +1 right. */
  steering: number;
  handbrake: boolean;
}

export interface VehicleRouteComponent {
  /** Ordered road node IDs. Consecutive nodes must be linked by a road segment. */
  nodeIds: readonly string[];
  /** Index of the next node the vehicle should reach. */
  targetIndex: number;
  cruiseSpeedMps: number;
  arrivalRadiusMeters: number;
  loop: boolean;
}

export const VehicleDynamics = defineComponent<VehicleDynamicsComponent>("VehicleDynamics");
export const VehicleControls = defineComponent<VehicleControlsComponent>("VehicleControls");
export const VehicleRoute = defineComponent<VehicleRouteComponent>("VehicleRoute");

export interface VehicleHandling {
  massKg: number;
  engineAccelerationMps2: number;
  brakingAccelerationMps2: number;
  handbrakeAccelerationMps2: number;
  maxForwardSpeedMps: number;
  maxReverseSpeedMps: number;
  wheelBaseMeters: number;
  maxSteeringAngleRadians: number;
  steeringResponse: number;
  rollingResistanceMps2: number;
  aerodynamicDrag: number;
}

export const DEFAULT_VEHICLE_HANDLING: Readonly<VehicleHandling> = Object.freeze({
  massKg: 1450,
  engineAccelerationMps2: 7.2,
  brakingAccelerationMps2: 12.5,
  handbrakeAccelerationMps2: 19,
  maxForwardSpeedMps: 42,
  maxReverseSpeedMps: 10,
  wheelBaseMeters: 2.7,
  maxSteeringAngleRadians: 0.54,
  steeringResponse: 7.5,
  rollingResistanceMps2: 0.38,
  aerodynamicDrag: 0.00115,
});
