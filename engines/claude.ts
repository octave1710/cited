import type { Citation, EngineAnswer } from "./types";
import { cleanUrl, toDomain } from "./extract";

/**
 * Claude, asked directly, with its own web search turned on.
 *
 * The other five engines arrive through one Apify actor because that actor exposes
 * them as add-ons. Claude is not one of its add-ons, so it is called at the source:
 * the Anthropic Messages API with the web_search tool, which returns the pages the
 * answer was actually built from. That is a first-party read rather than a scrape,
 * so it is the most direct of the six.
 *
 * Verified live on 2026-07-28: "What is the best vitamin C serum for sensitive skin
 * in the UK?" returned five sources including forbes.com and truskin.com.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 90_000;

export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

interface Block {
  type?: string;
  text?: string;
  content?: unknown;
}

/**
 * Pulls the sources out of the response.
 *
 * They arrive in web_search_tool_result blocks as {type:"web_search_result", url, title},
 * and again inside citations attached to text blocks. Both are read and deduplicated on
 * the cleaned URL, so a page quoted three times counts once, which is how the other five
 * engines are counted too.
 */
export function citationsFromClaude(payload: unknown): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    if (typeof o.url === "string") {
      const url = cleanUrl(o.url);
      const domain = toDomain(url);
      if (domain && !seen.has(url)) {
        seen.add(url);
        out.push({ url, domain, title: typeof o.title === "string" ? o.title : "", rank: out.length + 1 });
      }
    }
    for (const v of Object.values(o)) walk(v);
  };

  walk(payload);
  return out;
}

export function textFromClaude(payload: unknown): string {
  const blocks = (payload as { content?: Block[] })?.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

async function askOne(question: string, market: string, key: string): Promise<EngineAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        // the market is stated so the search is localised the way the other five are
        system: `Answer for a buyer in ${market}. Search the web and cite the pages you used.`,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 160);
      return { engine: "claude", text: "", citations: [], empty: `Anthropic answered HTTP ${res.status}: ${body}` };
    }

    const json = await res.json();
    const citations = citationsFromClaude(json);
    const text = textFromClaude(json);
    if (!citations.length) {
      return {
        engine: "claude",
        text,
        citations: [],
        empty: text ? "answered without citing any source" : "this engine returned no answer for this question",
      };
    }
    return { engine: "claude", text, citations };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return {
      engine: "claude",
      text: "",
      citations: [],
      empty: aborted ? `Claude did not answer within ${TIMEOUT_MS / 1000}s` : `Claude could not be reached: ${(e as Error).message.slice(0, 90)}`,
    };
  }
}

/** Small pool: the panel is a handful of questions and the API is rate limited per minute. */
const CONCURRENCY = 3;

export async function askClaude(
  questions: string[],
  market: string,
  onEach: (done: number, total: number) => void = () => {},
): Promise<Map<string, EngineAnswer>> {
  const key = process.env.ANTHROPIC_API_KEY;
  const answers = new Map<string, EngineAnswer>();
  if (!key) {
    for (const q of questions) {
      answers.set(q, { engine: "claude", text: "", citations: [], empty: "no ANTHROPIC_API_KEY, so Claude was not asked" });
    }
    return answers;
  }

  let done = 0;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, questions.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= questions.length) return;
      const q = questions[i];
      answers.set(q, await askOne(q, market, key));
      onEach(++done, questions.length);
    }
  });
  await Promise.all(workers);
  return answers;
}
