import type { FactorResult, ParsedPage } from "../types.js";

/**
 * Binary gate: if answer-engine bots cannot read the page, no other factor matters.
 * Offline checks only. URL mode adds robots.txt + HTTP status; production mode adds
 * real bot logs (GPTBot, PerplexityBot...) via the Profound bots report.
 */
export function crawlability(page: ParsedPage): FactorResult {
  const failures: string[] = [];
  const evidence: string[] = [];

  if (/noindex|none/.test(page.robotsMeta)) {
    failures.push(`meta robots blocks indexing: "${page.robotsMeta}"`);
  } else {
    evidence.push(page.robotsMeta ? `meta robots allows indexing ("${page.robotsMeta}")` : "no blocking robots meta");
  }

  if (page.wordCount < 120) {
    failures.push(`only ${page.wordCount} words of server-rendered text — content likely behind JavaScript, invisible to most answer-engine bots`);
  } else {
    evidence.push(`${page.wordCount} words of server-rendered text`);
  }

  if (!page.title) failures.push("no <title>");
  else evidence.push(`title present: "${page.title}"`);

  const pass = failures.length === 0;
  return {
    key: "crawlability",
    name: "Technical accessibility / crawlability",
    score: pass ? 100 : 0,
    evidence: pass ? evidence : failures,
    reasoning: pass
      ? "Page is readable by answer-engine bots (offline checks). Production mode verifies with real crawl logs per bot."
      : "GATE FAILED: the page cannot be ingested by answer engines. Fix this before anything else.",
  };
}
