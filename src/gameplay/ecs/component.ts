/** Identifiant typé d'un composant ECS. */
export interface ComponentType<T> {
  readonly name: string;
  readonly key: symbol;
  /** Marqueur uniquement utilisé par le système de types TypeScript. */
  readonly __componentType?: T;
}

export function defineComponent<T>(name: string): ComponentType<T> {
  return Object.freeze({
    name,
    key: Symbol(name),
  });
}
