import Database from "better-sqlite3";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface SaveDocument {
  schema: "nova-city.save";
  version: number;
  slotId: string;
  savedAt: string;
  sourcePlayerId: number;
  sections: Record<string, unknown>;
}

interface SaveRow {
  slot_id: string;
  saved_at: string;
  payload: string;
}

export function buildServer(databasePath = process.env.SQLITE_PATH ?? "data/nova-city.sqlite"): FastifyInstance {
  const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (resolvedPath !== ":memory:") mkdirSync(dirname(resolvedPath), { recursive: true });

  const database = new Database(resolvedPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS save_slots (
      slot_id TEXT PRIMARY KEY,
      saved_at TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `);

  const app = Fastify({ logger: true });
  app.addHook("onClose", async () => database.close());

  app.get("/health", async () => ({ status: "ok", service: "nova-city-api" }));

  app.get("/api/saves", async () => {
    const rows = database.prepare(
      "SELECT slot_id, saved_at FROM save_slots ORDER BY saved_at DESC",
    ).all() as Array<Pick<SaveRow, "slot_id" | "saved_at">>;
    return rows.map((row) => ({ slotId: row.slot_id, savedAt: row.saved_at }));
  });

  app.post<{ Params: { slotId: string }; Body: unknown }>(
    "/api/saves/:slotId",
    async (request, reply) => {
      const { slotId } = request.params;
      if (!isValidSlotId(slotId)) return reply.code(400).send({ error: "invalid-slot-id" });
      if (!isSaveDocument(request.body, slotId)) {
        return reply.code(400).send({ error: "invalid-save-document" });
      }

      const payload = JSON.stringify(request.body);
      if (payload.length > 2_000_000) return reply.code(413).send({ error: "save-too-large" });
      database.prepare(`
        INSERT INTO save_slots (slot_id, saved_at, payload)
        VALUES (?, ?, ?)
        ON CONFLICT(slot_id) DO UPDATE SET saved_at = excluded.saved_at, payload = excluded.payload
      `).run(slotId, request.body.savedAt, payload);

      return reply.code(201).send({ slotId, savedAt: request.body.savedAt });
    },
  );

  app.get<{ Params: { slotId: string } }>("/api/saves/:slotId", async (request, reply) => {
    if (!isValidSlotId(request.params.slotId)) return reply.code(400).send({ error: "invalid-slot-id" });
    const row = database.prepare(
      "SELECT payload FROM save_slots WHERE slot_id = ?",
    ).get(request.params.slotId) as { payload: string } | undefined;
    if (!row) return reply.code(404).send({ error: "save-not-found" });
    return JSON.parse(row.payload) as SaveDocument;
  });

  app.delete<{ Params: { slotId: string } }>("/api/saves/:slotId", async (request, reply) => {
    if (!isValidSlotId(request.params.slotId)) return reply.code(400).send({ error: "invalid-slot-id" });
    const result = database.prepare("DELETE FROM save_slots WHERE slot_id = ?").run(request.params.slotId);
    if (result.changes === 0) return reply.code(404).send({ error: "save-not-found" });
    return reply.code(204).send();
  });

  return app;
}

export async function startServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "127.0.0.1";
  const app = buildServer();
  await app.listen({ port, host });
}

function isValidSlotId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,32}$/.test(value);
}

function isSaveDocument(value: unknown, slotId: string): value is SaveDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  return document.schema === "nova-city.save" &&
    Number.isInteger(document.version) && (document.version as number) >= 1 &&
    document.slotId === slotId &&
    typeof document.savedAt === "string" && Number.isFinite(Date.parse(document.savedAt)) &&
    Number.isInteger(document.sourcePlayerId) &&
    typeof document.sections === "object" && document.sections !== null &&
    !Array.isArray(document.sections);
}

const isDirectExecution = process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
