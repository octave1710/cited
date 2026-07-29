import { DatabaseSync } from "node:sqlite";
import { writableDbPath } from "./dbpath";
import type { PipelineRun } from "../pipeline/run";

/**
 * Pipeline runs, on sqlite where sqlite works and in memory where it does not.
 *
 * `node:sqlite` is still flagged experimental, and on the hosted runtime opening a
 * database threw before the route could answer, so every pipeline request returned a bare
 * 500. The audit survived only because it writes its row after the stream has already
 * been sent.
 *
 * Persistence is not what this route is for. It stores a run so the approve and publish
 * calls can find it moments later, and a Map does that. So the database is attempted
 * once, and if it will not open the Map takes over and the request goes through. On a
 * hosted build a run then lives as long as the instance, which is the right trade for a
 * demo, and `storageMode()` reports which store is live rather than hiding it.
 */

const PATH = process.env.DATABASE_PATH ?? "./data/cited.db";

let db: DatabaseSync | null = null;
let tried = false;
const memory = new Map<string, PipelineRun>();

function conn(): DatabaseSync | null {
  if (db) return db;
  if (tried) return null;
  tried = true;
  try {
    const opened = new DatabaseSync(writableDbPath(PATH));
    opened.exec(`CREATE TABLE IF NOT EXISTS pipelines (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, topic TEXT NOT NULL, payload TEXT NOT NULL);`);
    db = opened;
    return db;
  } catch {
    // no sqlite here: the Map below carries the run for the life of the instance
    return null;
  }
}

/** Which store is live. Surfaced so a demo can say so rather than pretend. */
export function storageMode(): "sqlite" | "memory" {
  return conn() ? "sqlite" : "memory";
}

export function savePipeline(run: PipelineRun): void {
  const c = conn();
  if (!c) {
    memory.set(run.id, run);
    return;
  }
  try {
    c.prepare(
      `INSERT INTO pipelines (id, created_at, topic, payload) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    ).run(run.id, run.createdAt, run.topic, JSON.stringify(run));
  } catch {
    // a write that fails must not lose the run the caller is about to approve
    memory.set(run.id, run);
  }
}

export function getPipeline(id: string): PipelineRun | null {
  const fromMemory = memory.get(id);
  if (fromMemory) return fromMemory;

  const c = conn();
  if (!c) return null;
  try {
    const row = c.prepare(`SELECT payload FROM pipelines WHERE id = ?`).get(id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as PipelineRun) : null;
  } catch {
    return null;
  }
}

export function newPipelineId(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
}
