import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Run } from "./types";

// ponytail: node:sqlite instead of better-sqlite3 — stdlib, no node-gyp toolchain on
// this machine. Ceiling: it is still flagged experimental in Node 24. Upgrade path is
// a one-line swap to better-sqlite3 once build tools exist; the interface used here is
// the same prepare/run/get/all shape.

const PATH = process.env.DATABASE_PATH ?? "./data/cited.db";

let db: DatabaseSync | null = null;

function conn(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(PATH), { recursive: true });
  db = new DatabaseSync(PATH);
  db.exec(`
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
  return db;
}

export function saveRun(run: Run): void {
  conn()
    .prepare(
      `INSERT INTO runs (id, created_at, url, brand, market, payload)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    )
    .run(run.id, run.createdAt, run.url, run.brand, run.market, JSON.stringify(run));
}

export function getRun(id: string): Run | null {
  const row = conn().prepare(`SELECT payload FROM runs WHERE id = ?`).get(id) as
    | { payload: string }
    | undefined;
  return row ? (JSON.parse(row.payload) as Run) : null;
}

export function listRuns(limit = 12): Pick<Run, "id" | "createdAt" | "url" | "brand" | "market">[] {
  const rows = conn()
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
