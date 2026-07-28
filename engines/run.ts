import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractAll } from "./extract";
import { ENGINES, type EngineKey, type PanelRun, type QuestionResult } from "./types";

/**
 * Asks the five engines the panel's questions, for real.
 *
 * One Apify actor exposes all five as add-ons, which is why it is used rather than five
 * separate integrations: apify/google-search-scraper carries aiOverview, aiModeSearch,
 * geminiSearch, perplexitySearch and chatGptSearch. Measured on 2026-07-28: six
 * questions across all five engines took 273 seconds and cost $0.1635, about 2.7 cents
 * per question, and it parallelises, so a twenty-question panel is roughly half a dollar.
 *
 * Without a token the run replays a recorded panel, and says so on screen. It never
 * silently substitutes recorded data for a live request.
 */

const ACTOR = "apify~google-search-scraper";
const RECORDED = "fixtures/engines/vitamin-c-serum-uk.json";

/** Apify wants an ISO country code; the market list carries the rest. */
const COUNTRY: Record<string, { cc: string; lang: string }> = {
  UK: { cc: "gb", lang: "en" },
  US: { cc: "us", lang: "en" },
  SE: { cc: "se", lang: "sv" },
  DK: { cc: "dk", lang: "da" },
  FR: { cc: "fr", lang: "fr" },
  DE: { cc: "de", lang: "de" },
  ES: { cc: "es", lang: "es" },
  IT: { cc: "it", lang: "it" },
  NL: { cc: "nl", lang: "nl" },
};

export interface RunProgress {
  (event: { phase: "starting" | "running" | "reading" | "done"; note: string; runId?: string; seconds?: number }): void;
}

export function hasApifyToken(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

function recordedPanel(topic: string, market: string, brandDomain: string | undefined, why: string): PanelRun {
  const path = join(process.cwd(), RECORDED);
  if (!existsSync(path)) throw new Error(`No APIFY_TOKEN and no recorded panel at ${RECORDED}. ${why}`);
  const questions = extractAll(JSON.parse(readFileSync(path, "utf8")));
  return {
    topic,
    market,
    brandDomain,
    questions,
    source: "recorded",
    costUsd: null,
    ranAt: new Date().toISOString(),
    silentEngines: silent(questions),
  };
}

function silent(questions: QuestionResult[]): EngineKey[] {
  return ENGINES.map((e) => e.key).filter((k) =>
    questions.every((q) => !q.answers.find((a) => a.engine === k)?.citations.length),
  );
}

const POLL_MS = 6_000;

export async function runPanel(
  input: { topic: string; market: string; questions: string[]; brandDomain?: string },
  onProgress: RunProgress = () => {},
): Promise<PanelRun> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    onProgress({ phase: "done", note: "No APIFY_TOKEN in .env, replaying the recorded panel instead" });
    return recordedPanel(input.topic, input.market, input.brandDomain, "Add APIFY_TOKEN to run the engines live.");
  }

  const geo = COUNTRY[input.market] ?? COUNTRY.UK;
  const body = {
    queries: input.questions.join("\n"),
    countryCode: geo.cc,
    languageCode: geo.lang,
    maxPagesPerQuery: 1,
    resultsPerPage: 10,
    // every add-on is an object, not a boolean: passing `true` is rejected with a 400
    aiOverview: { scrapeFullAiOverview: true },
    aiModeSearch: { enableAiMode: true },
    geminiSearch: { enableGemini: true },
    perplexitySearch: { enablePerplexity: true },
    chatGptSearch: { enableChatGpt: true },
  };

  onProgress({ phase: "starting", note: `Asking ${ENGINES.length} engines ${input.questions.length} questions` });

  const started = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!started.ok) {
    throw new Error(`Apify refused the run (HTTP ${started.status}): ${(await started.text()).slice(0, 200)}`);
  }
  let run = (await started.json()).data as { id: string; status: string; defaultDatasetId: string; usageTotalUsd?: number };
  const t0 = Date.now();

  while (run.status === "READY" || run.status === "RUNNING") {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const seconds = Math.round((Date.now() - t0) / 1000);
    onProgress({ phase: "running", note: `${run.status.toLowerCase()} for ${seconds}s`, runId: run.id, seconds });
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${token}`);
    if (!poll.ok) throw new Error(`Lost the Apify run (HTTP ${poll.status}).`);
    run = (await poll.json()).data;
  }

  if (run.status !== "SUCCEEDED") throw new Error(`The engine run ended as ${run.status}.`);

  onProgress({ phase: "reading", note: "Reading the answers", runId: run.id });
  const dataRes = await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${token}`);
  if (!dataRes.ok) throw new Error(`Could not read the results (HTTP ${dataRes.status}).`);
  const questions = extractAll(await dataRes.json());

  onProgress({ phase: "done", note: `${questions.length} questions answered`, runId: run.id });

  return {
    topic: input.topic,
    market: input.market,
    brandDomain: input.brandDomain,
    questions,
    source: "live",
    costUsd: typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : null,
    ranAt: new Date().toISOString(),
    silentEngines: silent(questions),
  };
}
