import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProductionTruth } from "../lib/types";

/**
 * Profound gives the one thing the on-page score cannot: what the answer-engine
 * crawlers actually did. Every call is attempted for real when a key is present.
 * If it fails for any reason the panel falls back to the recorded fixture AND
 * reports why, because a demo that silently swaps live data for canned data is
 * lying about its own provenance.
 */

const BASE = "https://api.tryprofound.com";
const TIMEOUT_MS = 10_000;

function fixtures(reason?: string): ProductionTruth {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "fixtures/profound.json"), "utf8")) as ProductionTruth;
  return { ...raw, mode: "fixtures", degradedReason: reason };
}

async function call(path: string, key: string, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "X-API-Key": key, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 403) {
      throw new Error("your Profound account is not entitled to this domain (HTTP 403)");
    }
    if (res.status === 401) throw new Error("Profound rejected the API key (HTTP 401)");
    if (res.status === 429) throw new Error("Profound rate limit reached (HTTP 429, 600 req/h)");
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Profound ${path} answered HTTP ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function productionTruth(opts: { domain: string; path: string; markets: string[] }): Promise<ProductionTruth> {
  const key = process.env.PROFOUND_API_KEY;
  const mode = process.env.PROFOUND_MODE ?? "mock";

  if (mode !== "real") return fixtures("PROFOUND_MODE is set to mock in .env");
  if (!key) return fixtures("no PROFOUND_API_KEY in .env");

  // shape confirmed against the live API: metrics + an explicit date range are required
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86_400_000);
  const range = { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };

  try {
    const [botsRaw, visRaw] = await Promise.all([
      call("/v2/reports/bots", key, { domain: opts.domain, metrics: ["count"], ...range }),
      call("/v1/reports/visibility", key, {
        domain: opts.domain,
        metrics: ["visibility_score", "share_of_voice"],
        dimensions: ["region"],
        ...range,
      }),
    ]);

    const bots = normaliseBots(botsRaw, opts.path);
    const share = normaliseShare(visRaw, opts.markets);
    if (!bots.length) return fixtures("Profound returned no bot rows for this domain");

    return {
      mode: "live",
      visibilityScore: readNumber(visRaw, ["visibility_score", "score"]) ?? 0,
      shareOfVoice: share,
      bots,
    };
  } catch (e) {
    return fixtures((e as Error).message);
  }
}

/** Defensive shape reading: the report schema is not ours, so nothing is assumed. */
function normaliseBots(raw: unknown, path: string): ProductionTruth["bots"] {
  const rows = pickArray(raw, ["data", "rows", "bots", "results"]);
  return rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const bot = String(o.bot ?? o.user_agent ?? o.name ?? "").trim();
      if (!bot) return null;
      return {
        bot,
        operator: String(o.operator ?? o.company ?? o.vendor ?? "unknown"),
        hits30d: Number(o.hits ?? o.requests ?? o.count ?? 0),
        lastSeen: String(o.last_seen ?? o.lastSeen ?? "unknown"),
        thisPath: Number(
          (o.paths as Record<string, number> | undefined)?.[path] ?? o.path_hits ?? 0,
        ),
      };
    })
    .filter((x): x is ProductionTruth["bots"][number] => x !== null);
}

function normaliseShare(raw: unknown, markets: string[]): ProductionTruth["shareOfVoice"] {
  const rows = pickArray(raw, ["data", "rows", "results"]);
  const found = rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const market = String(o.region ?? o.market ?? o.country ?? "").toUpperCase();
      const pct = Number(o.share_of_voice ?? o.shareOfVoice ?? o.share ?? 0);
      return market ? { market, pct } : null;
    })
    .filter((x): x is { market: string; pct: number } => x !== null);
  return found.length ? found : markets.map((m) => ({ market: m, pct: 0 }));
}

function pickArray(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function readNumber(raw: unknown, keys: string[]): number | undefined {
  if (raw && typeof raw === "object") {
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "number") return v;
    }
  }
  return undefined;
}
