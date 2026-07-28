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

export interface MapSummary {
  id: string;
  createdAt: string;
  topic: string;
  brand: string;
  brandDomain: string;
  market: string;
  questions: number;
  owned: number;
}

/**
 * Enough to rebuild the history rail without loading every question set. The counts
 * come from the stored payload, so the list and the map can never disagree.
 */
export function listMaps(limit = 40): MapSummary[] {
  const rows = conn()
    .prepare(`SELECT id, created_at, topic, brand, payload FROM maps ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as { id: string; created_at: string; topic: string; brand: string; payload: string }[];
  return rows.map((r) => {
    const m = JSON.parse(r.payload) as CitationMap;
    return {
      id: r.id,
      createdAt: r.created_at,
      topic: r.topic,
      brand: r.brand,
      brandDomain: m.brandDomain,
      market: m.market,
      questions: m.questions.length,
      owned: m.counts.owned,
    };
  });
}

/** The previous map for the same category, brand and market. The baseline for a delta. */
export function previousMapFor(map: CitationMap): CitationMap | null {
  const rows = conn()
    .prepare(`SELECT payload FROM maps WHERE topic = ? AND id != ? AND created_at <= ? ORDER BY created_at DESC LIMIT 20`)
    .all(map.topic, map.id, map.createdAt) as { payload: string }[];
  for (const r of rows) {
    const candidate = JSON.parse(r.payload) as CitationMap;
    if (candidate.brandDomain === map.brandDomain && candidate.market === map.market) return candidate;
  }
  return null;
}
