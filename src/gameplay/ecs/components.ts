import type { CameraPose, ItemStack, PlayerInput, Vec3 } from "../../shared/types";
import { defineComponent } from "./component";

export interface TransformComponent {
  position: Vec3;
  rotationY: number;
}

export interface VelocityComponent {
  linear: Vec3;
}

export interface PlayerInputComponent {
  current: PlayerInput;
}

export interface CharacterMotorComponent {
  walkSpeed: number;
  sprintMultiplier: number;
}

export interface CameraFollowComponent {
  yaw: number;
  pitch: number;
  distance: number;
  lookAtHeight: number;
  followSpeed: number;
}

export interface CameraRigComponent extends CameraPose {}

export interface InventoryComponent {
  capacity: number;
  slots: ItemStack[];
}

export const Transform = defineComponent<TransformComponent>("Transform");
export const Velocity = defineComponent<VelocityComponent>("Velocity");
export const PlayerInputState = defineComponent<PlayerInputComponent>("PlayerInput");
export const CharacterMotor = defineComponent<CharacterMotorComponent>("CharacterMotor");
export const CameraFollow = defineComponent<CameraFollowComponent>("CameraFollow");
export const CameraRig = defineComponent<CameraRigComponent>("CameraRig");
export const Inventory = defineComponent<InventoryComponent>("Inventory");
