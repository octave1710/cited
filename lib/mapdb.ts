import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CitationMap } from "../citationmap/types";

// same node:sqlite ceiling as lib/db.ts; kept in its own table so a map survives a
// restart and the autopsy can be re-opened from its id without re-running the engine
const PATH = process.env.DATABASE_PATH ?? "./data/cited.db";

let db: DatabaseSync | null = null;

function conn(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(PATH), { recursive: true });
  db = new DatabaseSync(PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id         TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      topic      TEXT NOT NULL,
      brand      TEXT NOT NULL,
      payload    TEXT NOT NULL
    );
  `);
  return db;
}

export function saveMap(map: CitationMap): void {
  conn()
    .prepare(
      `INSERT INTO maps (id, created_at, topic, brand, payload) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    )
    .run(map.id, map.createdAt, map.topic, map.brand, JSON.stringify(map));
}

export function getMap(id: string): CitationMap | null {
  const row = conn().prepare(`SELECT payload FROM maps WHERE id = ?`).get(id) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as CitationMap) : null;
}
