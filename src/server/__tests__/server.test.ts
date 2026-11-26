import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../index";

describe("NOVA CITY API", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildServer(":memory:");
  });

  afterEach(async () => {
    await app.close();
  });

  it("exposes a health endpoint", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "nova-city-api" });
  });

  it("creates, lists, reads and deletes a versioned save", async () => {
    const document = {
      schema: "nova-city.save",
      version: 1,
      slotId: "manual-1",
      savedAt: "2026-11-26T10:00:00.000Z",
      sourcePlayerId: 1,
      sections: { "player.inventory": { capacity: 10, slots: [] } },
    };

    const created = await app.inject({
      method: "POST",
      url: "/api/saves/manual-1",
      payload: document,
    });
    expect(created.statusCode).toBe(201);

    const listed = await app.inject({ method: "GET", url: "/api/saves" });
    expect(listed.json()).toEqual([{ slotId: "manual-1", savedAt: document.savedAt }]);

    const loaded = await app.inject({ method: "GET", url: "/api/saves/manual-1" });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json()).toEqual(document);

    const deleted = await app.inject({ method: "DELETE", url: "/api/saves/manual-1" });
    expect(deleted.statusCode).toBe(204);

    const missing = await app.inject({ method: "GET", url: "/api/saves/manual-1" });
    expect(missing.statusCode).toBe(404);
  });

  it("rejects unsafe slot names and mismatched save payloads", async () => {
    const badSlot = await app.inject({
      method: "POST",
      url: "/api/saves/../bad",
      payload: {},
    });
    expect([400, 404]).toContain(badSlot.statusCode);

    const badPayload = await app.inject({
      method: "POST",
      url: "/api/saves/slot-1",
      payload: { schema: "wrong", slotId: "other" },
    });
    expect(badPayload.statusCode).toBe(400);
  });
});
