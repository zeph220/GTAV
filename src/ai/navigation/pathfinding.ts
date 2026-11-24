import type { Vec3 } from "../../shared/types";
import { NavGraph } from "./nav-graph";

/** Resolves arbitrary world positions to graph nodes and calculates a route. */
export function findWorldPath(graph: NavGraph, from: Vec3, to: Vec3): Vec3[] | null {
  const start = graph.nearestNode(from);
  const goal = graph.nearestNode(to);
  if (!start || !goal) return null;
  const route = graph.findPath(start.id, goal.id);
  if (!route) return null;
  // The final destination may lie between sidewalk nodes.
  if (distance3(route[route.length - 1] ?? start.position, to) > 0.75) {
    route.push({ ...to });
  }
  return route;
}

export function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
