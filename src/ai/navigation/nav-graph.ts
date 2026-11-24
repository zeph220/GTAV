import type { Vec3 } from "../../shared/types";

export interface NavNode {
  id: string;
  position: Vec3;
  /** Walkability weight; values above 1 represent slower or less desirable paths. */
  traversalCost?: number;
}
export interface NavEdge {
  from: string;
  to: string;
  cost?: number;
}

/**
 * Lightweight navigation graph. World builders can populate it from sidewalks,
 * crossings, plazas and pedestrian passages without coupling AI to rendering.
 */
export class NavGraph {
  private readonly nodes = new Map<string, NavNode>();
  private readonly adjacency = new Map<string, Array<{ id: string; cost: number }>>();

  addNode(node: NavNode): void {
    if (!node.id || !isFiniteVec3(node.position)) throw new Error("Invalid navigation node");
    this.nodes.set(node.id, { ...node, position: { ...node.position } });
    if (!this.adjacency.has(node.id)) this.adjacency.set(node.id, []);
  }

  addEdge(edge: NavEdge, bidirectional = true): void {
    const from = this.nodes.get(edge.from);
    const to = this.nodes.get(edge.to);
    if (!from || !to) throw new Error("Navigation edge references an unknown node");
    const distance = distance3(from.position, to.position);
    const cost = Math.max(0.001, edge.cost ?? distance);
    this.connect(edge.from, edge.to, cost);
    if (bidirectional) this.connect(edge.to, edge.from, cost);
  }

  getNode(id: string): NavNode | undefined {
    const node = this.nodes.get(id);
    return node ? { ...node, position: { ...node.position } } : undefined;
  }

  get size(): number { return this.nodes.size; }

  nearestNode(position: Vec3, maxDistance = Number.POSITIVE_INFINITY): NavNode | undefined {
    let nearest: NavNode | undefined;
    let best = maxDistance;
    for (const node of this.nodes.values()) {
      const distance = distance3(position, node.position);
      if (distance < best) { nearest = node; best = distance; }
    }
    return nearest ? { ...nearest, position: { ...nearest.position } } : undefined;
  }

  /** A* shortest path. Returns node positions, excluding the start node. */
  findPath(startId: string, goalId: string): Vec3[] | null {
    if (!this.nodes.has(startId) || !this.nodes.has(goalId)) return null;
    if (startId === goalId) return [];
    const open = new MinHeap<{ id: string; priority: number }>((a, b) => a.priority - b.priority);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startId, 0]]);
    const closed = new Set<string>();
    const goal = this.nodes.get(goalId)!;
    open.push({ id: startId, priority: distance3(this.nodes.get(startId)!.position, goal.position) });

    while (open.size) {
      const current = open.pop()!.id;
      if (current === goalId) {
        const ids: string[] = [];
        let cursor = goalId;
        while (cursor !== startId) {
          ids.push(cursor);
          const previous = cameFrom.get(cursor);
          if (!previous) return null;
          cursor = previous;
        }
        ids.reverse();
        return ids.map((id) => ({ ...this.nodes.get(id)!.position }));
      }
      if (closed.has(current)) continue;
      closed.add(current);
      for (const edge of this.adjacency.get(current) ?? []) {
        if (closed.has(edge.id)) continue;
        const node = this.nodes.get(edge.id)!;
        const tentative = (gScore.get(current) ?? Infinity) + edge.cost * Math.max(0.1, node.traversalCost ?? 1);
        if (tentative >= (gScore.get(edge.id) ?? Infinity)) continue;
        cameFrom.set(edge.id, current);
        gScore.set(edge.id, tentative);
        open.push({ id: edge.id, priority: tentative + distance3(node.position, goal.position) });
      }
    }
    return null;
  }

  private connect(from: string, to: string, cost: number): void {
    const edges = this.adjacency.get(from)!;
    const existing = edges.find((edge) => edge.id === to);
    if (existing) existing.cost = Math.min(existing.cost, cost);
    else edges.push({ id: to, cost });
  }
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

class MinHeap<T> {
  private values: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}
  get size(): number { return this.values.length; }
  push(value: T): void {
    this.values.push(value);
    let i = this.values.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.values[p]!, value) <= 0) break;
      this.values[i] = this.values[p]!;
      i = p;
    }
    this.values[i] = value;
  }
  pop(): T | undefined {
    if (!this.values.length) return undefined;
    const root = this.values[0]!;
    const last = this.values.pop()!;
    if (this.values.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        let child = left;
        if (right < this.values.length && this.compare(this.values[right]!, this.values[left]!) < 0) child = right;
        if (this.compare(last, this.values[child]!) <= 0) break;
        this.values[i] = this.values[child]!;
        i = child;
      }
      this.values[i] = last;
    }
    return root;
  }
}
