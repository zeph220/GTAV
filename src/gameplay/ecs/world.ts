import type { EntityId } from "../../shared/types";
import type { ComponentType } from "./component";

/**
 * Registre ECS minimal : entités numériques et composants indexés par type.
 * Les systèmes restent indépendants du moteur 3D et peuvent donc être testés
 * sans WebGL ni React Three Fiber.
 */
export class World {
  private nextEntityId = 1;
  private readonly entities = new Map<EntityId, Map<symbol, unknown>>();

  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.entities.set(id, new Map());
    return id;
  }

  destroyEntity(entityId: EntityId): boolean {
    return this.entities.delete(entityId);
  }

  hasEntity(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  addComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
    value: T,
  ): void {
    const components = this.entities.get(entityId);
    if (!components) {
      throw new Error(`Unknown entity: ${entityId}`);
    }
    components.set(componentType.key, value);
  }

  getComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
  ): T | undefined {
    return this.entities.get(entityId)?.get(componentType.key) as T | undefined;
  }

  hasComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
  ): boolean {
    return this.entities.get(entityId)?.has(componentType.key) ?? false;
  }

  removeComponent<T>(
    entityId: EntityId,
    componentType: ComponentType<T>,
  ): boolean {
    return this.entities.get(entityId)?.delete(componentType.key) ?? false;
  }

  /** Retourne les entités possédant tous les composants demandés. */
  query(...componentTypes: ComponentType<unknown>[]): EntityId[] {
    if (componentTypes.length === 0) {
      return [...this.entities.keys()];
    }

    const matches: EntityId[] = [];
    for (const [entityId, components] of this.entities) {
      if (componentTypes.every((type) => components.has(type.key))) {
        matches.push(entityId);
      }
    }
    return matches;
  }

  get entityCount(): number {
    return this.entities.size;
  }
}
