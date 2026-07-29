import { DatabaseSync } from "node:sqlite";
import { writableDbPath } from "./dbpath";
import type { Run } from "./types";

// ponytail: node:sqlite instead of better-sqlite3 — stdlib, no node-gyp toolchain on
// this machine. Ceiling: it is still flagged experimental in Node 24. Upgrade path is
// a one-line swap to better-sqlite3 once build tools exist; the interface used here is
// the same prepare/run/get/all shape.

const PATH = process.env.DATABASE_PATH ?? "./data/cited.db";

/**
 * Same fallback as the pipeline store, for the same reason: node:sqlite is experimental
 * and does not open on every runtime. An audit whose row cannot be written must still
 * return its score, and the fix routes that read the run back a moment later are served
 * from the Map when the database is not there.
 */
let db: DatabaseSync | null = null;
let tried = false;
const memory = new Map<string, Run>();

function conn(): DatabaseSync | null {
  if (db) return db;
  if (tried) return null;
  tried = true;
  try {
    const opened = new DatabaseSync(writableDbPath(PATH));
    opened.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id         TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      url        TEXT NOT NULL,
      brand      TEXT NOT NULL,
      market     TEXT NOT NULL,
      payload    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runs_created ON runs (created_at DESC);
    `);
    db = opened;
    return db;
  } catch {
    return null;
  }
}

export function saveRun(run: Run): void {
  const c = conn();
  if (!c) {
    memory.set(run.id, run);
    return;
  }
  try {
    c.prepare(
      `INSERT INTO runs (id, created_at, url, brand, market, payload)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    ).run(run.id, run.createdAt, run.url, run.brand, run.market, JSON.stringify(run));
  } catch {
    memory.set(run.id, run);
  }
}

export function getRun(id: string): Run | null {
  const fromMemory = memory.get(id);
  if (fromMemory) return fromMemory;
  const c = conn();
  if (!c) return null;
  try {
    const row = c.prepare(`SELECT payload FROM runs WHERE id = ?`).get(id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as Run) : null;
  } catch {
    return null;
  }
}

export function listRuns(limit = 12): Pick<Run, "id" | "createdAt" | "url" | "brand" | "market">[] {
  const c = conn();
  if (!c) {
    return [...memory.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((r) => ({ id: r.id, createdAt: r.createdAt, url: r.url, brand: r.brand, market: r.market }));
  }
  const rows = c
    .prepare(`SELECT id, created_at, url, brand, market FROM runs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as { id: string; created_at: string; url: string; brand: string; market: string }[];
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    url: r.url,
    brand: r.brand,
    market: r.market,
  }));
}

export function newRunId(): string {
  // short, sortable enough, no external dep
  return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
}
