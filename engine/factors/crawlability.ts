import type { FactorResult, ParsedPage } from "../types";
import type { AccessReport } from "../crawlerAccess";

/**
 * Binary gate: if answer-engine bots cannot read the page, no other factor matters.
 *
 * It used to read the markup only, which produced the worst contradiction in the app.
 * On healthline the gate printed OPEN in green at the top of the screen while the access
 * section eight hundred pixels below read "4 of 8 answer engines cannot read this page",
 * quoting `Disallow: /` under GPTBot, ClaudeBot, Applebot-Extended and CCBot from the
 * site's own robots.txt. The run had already fetched and parsed that file; the gate was
 * simply never shown it.
 *
 * So the verdicts come in. A page every crawler is refused is a shut gate and scores
 * zero, which is what a gate is for. A page half of them are refused is not open, and
 * saying so in the row rather than only in a section further down is the whole point.
 * The composite is untouched in that middle case: the loss is real but it is not this
 * factor's to price.
 */
export function crawlability(page: ParsedPage, access?: AccessReport | null): FactorResult {
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

  const blocked = access?.found ? access.blocked.length : 0;
  const crawlers = access?.found ? access.verdicts.length : 0;
  const names = access?.found ? access.blocked.map((b) => b.ua).join(", ") : "";

  if (crawlers > 0 && blocked === crawlers) {
    failures.push(`robots.txt refuses all ${crawlers} answer-engine crawlers${names ? `: ${names}` : ""}`);
  } else if (blocked > 0) {
    evidence.unshift(`robots.txt refuses ${blocked} of the ${crawlers} answer-engine crawlers${names ? `: ${names}` : ""}`);
  } else if (crawlers > 0) {
    evidence.unshift(`robots.txt allows all ${crawlers} answer-engine crawlers`);
  }

  const pass = failures.length === 0;
  const partial = pass && blocked > 0;

  return {
    key: "crawlability",
    name: "Technical accessibility / crawlability",
    score: pass ? 100 : 0,
    /** OPEN, PARTLY BLOCKED or SHUT, so the row cannot say OPEN on a half-blocked page. */
    state: !pass ? "shut" : partial ? "partial" : "open",
    evidence: pass ? evidence : failures,
    reasoning: !pass
      ? "GATE FAILED: the page cannot be ingested by answer engines. Fix this before anything else."
      : partial
        ? `The markup is readable, but ${blocked} of the ${crawlers} crawlers are refused in robots.txt, so those engines can never quote this page whatever the other factors say. The gate does not price that loss; the access section below lists which ones and writes the patch.`
        : "Page is readable by answer-engine bots, and robots.txt refuses none of them.",
  };
}
