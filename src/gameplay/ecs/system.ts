import type { World } from "./world";

/** Contrat commun des systèmes exécutés par la boucle de simulation. */
export interface GameSystem {
  update(world: World, deltaSeconds: number): void;
}
