import type { Vec3 } from "./types";

/**
 * Valeurs par défaut communes. Les modules consommateurs peuvent les
 * surcharger localement ; ne pas changer leur sens sans migration documentée.
 */
export const WORLD_UP: Readonly<Vec3> = Object.freeze({ x: 0, y: 1, z: 0 });

export const PLAYER_WALK_SPEED = 4.5;
export const PLAYER_SPRINT_MULTIPLIER = 1.65;
export const MAX_SIMULATION_DELTA_SECONDS = 0.1;

export const PLAYER_CAMERA_DISTANCE = 5.5;
export const PLAYER_CAMERA_PITCH = 0.28;
export const PLAYER_CAMERA_LOOK_AT_HEIGHT = 1.45;
export const PLAYER_CAMERA_FOLLOW_SPEED = 10;

export const DEFAULT_INVENTORY_CAPACITY = 20;
export const DEFAULT_ITEM_MAX_STACK = 99;
