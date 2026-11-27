import { describe, expect, it } from "vitest";
import type { RoadNetwork } from "../../world/world-types";
import {
  findNearestRoadNode,
  findRoadRoute,
  findShortestRoadPath,
} from "../road-navigation";

const network: RoadNetwork = {
  nodes: [
    { id: "a", position: { x: 0, y: 0, z: 0 } },
    { id: "b", position: { x: 10, y: 0, z: 0 } },
    { id: "c", position: { x: 20, y: 0, z: 0 } },
    { id: "d", position: { x: 10, y: 0, z: 10 } },
    { id: "isolated", position: { x: 100, y: 0, z: 100 } },
  ],
  segments: [
    { id: "ab", fromNodeId: "a", toNodeId: "b", districtId: "downtown", kind: "local", width: 8 },
    { id: "bc", fromNodeId: "b", toNodeId: "c", districtId: "downtown", kind: "local", width: 8 },
    { id: "bd", fromNodeId: "b", toNodeId: "d", districtId: "downtown", kind: "arterial", width: 14 },
    { id: "da", fromNodeId: "d", toNodeId: "a", districtId: "downtown", kind: "local", width: 8 },
  ],
};

describe("road navigation", () => {
  it("finds the closest road node in X/Z space", () => {
    expect(findNearestRoadNode(network, { x: 9, z: 1 }).id).toBe("b");
  });

  it("uses shortest connected paths and actual edge lengths", () => {
    const path = findShortestRoadPath(network, "a", "c");

    expect(path?.nodeIds).toEqual(["a", "b", "c"]);
    expect(path?.distanceMeters).toBeCloseTo(20, 8);
    expect(findShortestRoadPath(network, "a", "isolated")).toBeNull();
    expect(findShortestRoadPath(network, "a", "a")).toEqual({
      nodeIds: ["a"],
      distanceMeters: 0,
    });
  });

  it("builds a closed loop route with no duplicated terminal node", () => {
    const route = findRoadRoute(
      network,
      [{ x: 0, z: 0 }, { x: 10, z: 10 }],
      true,
    );

    expect(route.nodeIds[0]).toBe("a");
    expect(route.nodeIds[route.nodeIds.length - 1]).toBe("d");
    expect(route.nodeIds).not.toContain("a", 1);
    expect(route.distanceMeters).toBeCloseTo(20 + Math.sqrt(200), 8);
  });

  it("rejects unknown nodes and malformed route requests", () => {
    expect(() => findShortestRoadPath(network, "missing", "a")).toThrow(/Unknown road node/);
    expect(() => findRoadRoute(network, [{ x: 0, z: 0 }])).toThrow(/at least two/);
  });
});
