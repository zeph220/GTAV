import type { GameEventName, GameEventPayloads } from "../../shared/events";

type EventHandler<K extends GameEventName> = (
  payload: GameEventPayloads[K],
) => void;
type AnyHandler = (payload: never) => void;

/** Bus typé, synchrone et léger pour les systèmes de gameplay. */
export class GameEventBus {
  private readonly handlers = new Map<GameEventName, Set<AnyHandler>>();

  on<K extends GameEventName>(
    eventName: K,
    handler: EventHandler<K>,
  ): () => void {
    let bucket = this.handlers.get(eventName);
    if (!bucket) {
      bucket = new Set<AnyHandler>();
      this.handlers.set(eventName, bucket);
    }

    const safeHandler = handler as AnyHandler;
    bucket.add(safeHandler);

    return () => {
      bucket?.delete(safeHandler);
      if (bucket?.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  emit<K extends GameEventName>(
    eventName: K,
    payload: GameEventPayloads[K],
  ): void {
    const bucket = this.handlers.get(eventName);
    if (!bucket) return;

    for (const handler of [...bucket]) {
      (handler as (value: GameEventPayloads[K]) => void)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
