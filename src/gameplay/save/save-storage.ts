/** Async storage contract for browser, memory or server-backed save slots. */
export interface SaveStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export class InMemorySaveStorage implements SaveStorage {
  private readonly values = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async set(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async remove(key: string): Promise<void> { this.values.delete(key); }
  async keys(prefix: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }
}

export interface WebStorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Inject window.localStorage or another Storage-compatible object. */
export class WebStorageSaveStorage implements SaveStorage {
  constructor(private readonly storage: WebStorageLike) {}
  async get(key: string): Promise<string | null> { return this.storage.getItem(key); }
  async set(key: string, value: string): Promise<void> { this.storage.setItem(key, value); }
  async remove(key: string): Promise<void> { this.storage.removeItem(key); }
  async keys(prefix: string): Promise<string[]> {
    const result: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(prefix)) result.push(key);
    }
    return result;
  }
}
