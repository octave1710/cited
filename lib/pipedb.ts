import { DatabaseSync } from "node:sqlite";
import { writableDbPath } from "./dbpath";
import type { PipelineRun } from "../pipeline/run";

const PATH = process.env.DATABASE_PATH ?? "./data/cited.db";
let db: DatabaseSync | null = null;

function conn(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(writableDbPath(PATH));
  db.exec(`CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, topic TEXT NOT NULL, payload TEXT NOT NULL);`);
  return db;
}

export function savePipeline(run: PipelineRun): void {
  conn()
    .prepare(
      `INSERT INTO pipelines (id, created_at, topic, payload) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    )
    .run(run.id, run.createdAt, run.topic, JSON.stringify(run));
}

export function getPipeline(id: string): PipelineRun | null {
  const row = conn().prepare(`SELECT payload FROM pipelines WHERE id = ?`).get(id) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as PipelineRun) : null;
}

export function newPipelineId(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
}
