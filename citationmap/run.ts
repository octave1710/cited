import type { LLMClient, LLMUsage } from "../adapters/llm";
import { classify, toDomain } from "./classify";
import { generateQuestions } from "./questions";
import { marketOf } from "./markets";
import type { CitationMap, MapCost, MapQuestion, QuestionResult } from "./types";

const askSystem = (language: string, marketLabel: string) =>
  "You are the answer engine behind a consumer AI assistant. Answer the question in at most two " +
  `sentences, in ${language}, for a user in ${marketLabel}. Then list the websites you would cite ` +
  "as sources, most authoritative first, as bare domains (example: healthline.com). Prefer the " +
  "sources a user in that market would actually be shown. At most five. If you would not cite any " +
  'specific website, return an empty list. Reply with JSON: {"answer": "...", "sources": ["domain.com"]}.';

/** Published per-million rates, so the cost counter is traceable rather than invented. */
const RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
};

export function parseSources(raw: string): string[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: { sources?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.sources)) return [];
  const seen = new Set<string>();
  return parsed.sources
    .filter((s): s is string => typeof s === "string")
    .map(toDomain)
    .filter((d): d is string => d !== null && !seen.has(d) && (seen.add(d), true))
    .slice(0, 5);
}

/** Runs `jobs` with at most `limit` in flight, preserving input order in the result. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface MapEvents {
  onQuestions?: (questions: MapQuestion[]) => void;
  onResult?: (result: QuestionResult, cost: MapCost) => void;
}

export interface MapOptions {
  topic: string;
  brand: string;
  brandDomain: string;
  market: string;
  perIntent?: number;
  concurrency?: number;
}

export async function runCitationMap(llm: LLMClient, opts: MapOptions, events: MapEvents = {}): Promise<CitationMap> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const rate = RATES[model];
  const cost: MapCost = {
    calls: 0,
    replayed: 0,
    inTokens: 0,
    outTokens: 0,
    usd: rate ? 0 : null,
    rate: rate
      ? `${model} at $${rate.in}/1M in, $${rate.out}/1M out`
      : `${model}: no published rate on file, so the spend is not computed here`,
  };
  /** Set when a billed call came back without usage, so the total is a floor, not a total. */
  let missingUsage = false;
  const charge = (usage: LLMUsage | undefined, replayed: boolean) => {
    if (replayed) {
      cost.replayed++;
      return;
    }
    cost.calls++;
    if (!usage) {
      missingUsage = true;
      cost.usd = null;
      return;
    }
    cost.inTokens += usage.in;
    cost.outTokens += usage.out;
    if (rate && !missingUsage) cost.usd = (cost.inTokens * rate.in + cost.outTokens * rate.out) / 1_000_000;
  };

  const market = marketOf(opts.market);
  const ask = askSystem(market.language, market.label);
  const brandDomain = toDomain(opts.brandDomain) ?? opts.brandDomain.toLowerCase();
  const questions = await generateQuestions(llm, opts.topic, opts.market, opts.perIntent ?? 20, charge);
  events.onQuestions?.(questions);

  const raw = await pool(questions, opts.concurrency ?? 6, async (q) => {
    const t0 = Date.now();
    const res = await llm.call(ask, `Question: ${q.text}\nMarket: ${market.label}`);
    charge(res.usage, res.replayed);
    const domains = parseSources(res.text);
    const result: QuestionResult = {
      ...q,
      domains,
      owner: domains[0] ?? null,
      brandRank: domains.indexOf(brandDomain) + 1,
      bucket: "contested", // provisional: the real bucket needs the whole map, see classify()
      replayed: res.replayed,
      ms: Date.now() - t0,
    };
    events.onResult?.(result, cost);
    return result;
  });

  const { questions: classified, domains, counts } = classify(raw, brandDomain);

  return {
    id: `map-${Date.now().toString(36)}`,
    topic: opts.topic,
    brand: opts.brand,
    brandDomain,
    market: opts.market,
    engine: llm.label,
    createdAt: new Date().toISOString(),
    questions: classified,
    domains,
    counts,
    cost,
  };
}
