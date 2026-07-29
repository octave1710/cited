import type { LLMClient } from "../adapters/llm";
import { audit } from "../engine/score";
import { parse } from "../engine/parse";
import { fetchPage, normaliseUrl } from "../engine/ingest";
import { FACTORS, GATE_FACTOR } from "../engine/weights.config";
import type { AuditResult, FactorResult } from "../engine/types";
import { scanSitemap } from "../engine/sitemap";
import { checkCrawlerAccess } from "../engine/crawlerAccess";
import { keywords, rankSitemapCandidates } from "./resolve";

export interface PageSide {
  url: string;
  title: string;
  words: number;
  audit: AuditResult;
}

export interface FactorDiff {
  key: string;
  name: string;
  /** Share of the score this factor carries; null for the crawlability gate. */
  weight: number | null;
  source: string;
  ours: number;
  theirs: number;
  /** theirs - ours, times weight. The order the work should be done in. */
  impact: number;
  ourEvidence: string[];
  theirEvidence: string[];
  theirReasoning: string;
  ourReasoning: string;
}

export interface Autopsy {
  question?: string;
  domain: string;
  /**
   * Absent when the brand has no page on this question yet, which is the normal case
   * for a question the map says nobody of theirs answers. The screen then reads the
   * winning page on its own and states what a page would have to carry to displace it.
   */
  ours?: PageSide;
  /** Absent when their page could not be fetched. The attempts say why. */
  theirs?: PageSide;
  diffs: FactorDiff[];
  /** Set instead of `diffs` when there is no page of ours: the bar to clear. */
  brief?: BriefLine[];
  /** Every URL tried on the way to a winning page, with what happened. */
  attempts: { url: string; outcome: string }[];
  /**
   * Set when the competitor's server refused our crawler. That is a finding in its
   * own right: a site can win citations while being unreadable to everyone but the
   * engines it has allowed.
   */
  blockedUs?: string;
}

const RESOLVE_SYSTEM =
  "You name the exact article URLs on a given website that answer a question. " +
  'Reply with JSON: {"urls": ["https://..."]}. At most three, most likely first. ' +
  "Only URLs on the domain asked for. If you do not know one, return an empty list.";

export function parseUrls(raw: string, domain: string): string[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: { urls?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.urls)) return [];
  const seen = new Set<string>();
  return parsed.urls
    .filter((u): u is string => typeof u === "string")
    .filter((u) => {
      try {
        // the model is asked for one domain and regularly offers another; refuse those
        const h = new URL(u).hostname.replace(/^www\./, "");
        return (h === domain || h.endsWith(`.${domain}`)) && !seen.has(u) && (seen.add(u), true);
      } catch {
        return false;
      }
    })
    .slice(0, 3);
}

const MIN_WORDS = 200;

/**
 * Does this page even claim to be about the question? Read off the address and the
 * title only, both of which the publisher wrote, never off the body, where a passing
 * mention of a word proves nothing.
 */
export function onTopic(question: string, url: string, title: string): boolean {
  const specific = keywords(question)
    .filter((k) => k.specific && !k.word.includes("-"))
    .map((k) => k.word);
  if (!specific.length) return true; // nothing discriminating to test against

  const hay = `${url.toLowerCase()} ${title.toLowerCase()}`;
  return specific.some((w) => hay.includes(w));
}

/**
 * Resolves the competitor's actual page, then proves it by fetching it. A URL the
 * model invented is caught here rather than carried into the comparison: every
 * attempt is reported with its outcome, and a total failure is returned as a
 * failure, never as a page picked at random.
 */
export async function resolveCompetitorPage(
  llm: LLMClient,
  domain: string,
  question: string,
): Promise<{ page?: PageSide; html?: string; attempts: { url: string; outcome: string }[] }> {
  const attempts: { url: string; outcome: string }[] = [];

  /**
   * The site's own sitemap first. Every URL in it is one the site published, whereas a
   * model recalls the SHAPE of a publisher's URLs and invents the rest: asked for BMJ
   * pages on GLP-1 it produced three /content/377/bmj.n246x paths, none of which exists.
   */
  let candidates: string[] = [];
  let matched = 0;
  try {
    const access = await checkCrawlerAccess(`https://${domain}/`);
    let best: ReturnType<typeof rankSitemapCandidates> = [];
    /**
     * Keep a wider shortlist than the three that get fetched, so the line below can say
     * how many pages actually matched. It used to print `candidates.length`, and
     * rankSitemapCandidates defaults to a limit of 3, so "3 match the question" was the
     * app's own cap wearing the costume of a measurement: the same scan with the cap
     * lifted returns sixteen.
     */
    const SHORTLIST = 50;
    const scan = await scanSitemap(`https://${domain}/`, access.raw, (entries) => {
      best = rankSitemapCandidates([...best.map((b) => ({ loc: b.loc })), ...entries], question, SHORTLIST);
    });
    matched = best.length;
    candidates = best.slice(0, 3).map((b) => b.loc);
    attempts.push(...scan.attempts.slice(0, 3));
    attempts.push({
      url: scan.source || `https://${domain}/sitemap.xml`,
      outcome: scan.urlsScanned
        ? `${scan.urlsScanned.toLocaleString("en-US")} sitemap URLs scanned, ${matched} match the question${matched > candidates.length ? `, the top ${candidates.length} were fetched and scored` : ""}`
        : "no sitemap could be read on this domain",
    });
  } catch (e) {
    attempts.push({ url: `https://${domain}/sitemap.xml`, outcome: (e as Error).message });
  }

  /** Only a URL the sitemap actually published is trusted without a topic check. */
  let fromSitemap = candidates.length > 0;

  if (!candidates.length) {
    const res = await llm.call(RESOLVE_SYSTEM, `Website: ${domain}\nQuestion: ${question}`);
    candidates = parseUrls(res.text, domain);
    fromSitemap = false;
    attempts.push({
      url: `(engine suggestion for ${domain})`,
      outcome: candidates.length
        ? `${candidates.length} URL(s) suggested; each is fetched and checked against the question`
        : "the engine named no URL it could stand behind",
    });
  }

  if (!candidates.length) return { attempts };

  for (const url of candidates) {
    try {
      const fetched = await fetchPage(normaliseUrl(url).toString());
      const parsed = parse(fetched.html, fetched.finalUrl);
      if (parsed.wordCount < MIN_WORDS) {
        attempts.push({ url, outcome: `fetched, but only ${parsed.wordCount} words, too thin to compare` });
        continue;
      }
      /**
       * A URL the model invented can still resolve to a real page on the wrong subject.
       * Asked for mayoclinic.org on "Is vitamin C good for skin?" it produced a type 1
       * diabetes expert-answers page, which loaded fine and would have been presented as
       * "the page beating you" with total confidence. A page whose own title and address
       * carry none of the question's specific words is not that page.
       */
      if (!fromSitemap && !onTopic(question, fetched.finalUrl, parsed.title)) {
        attempts.push({
          url,
          outcome: `fetched, but "${(parsed.title || "untitled").slice(0, 54)}" is not about this question, so it was refused`,
        });
        continue;
      }
      attempts.push({ url, outcome: `HTTP ${fetched.status}, ${parsed.wordCount.toLocaleString("en-US")} words` });
      return {
        page: { url: fetched.finalUrl, title: parsed.title, words: parsed.wordCount, audit: audit(parsed) },
        html: fetched.html,
        attempts,
      };
    } catch (e) {
      attempts.push({ url, outcome: (e as Error).message });
    }
  }
  return { attempts };
}

/** Same nine factors on both pages, ordered by the weighted gap, biggest work first. */
export function diff(ours: AuditResult, theirs: AuditResult): FactorDiff[] {
  const byKey = (r: AuditResult) => new Map(r.factors.map((f) => [f.key, f]));
  const o = byKey(ours);
  const t = byKey(theirs);
  const cfg = new Map(FACTORS.map((f) => [f.key, f]));

  const keys = [...new Set([...o.keys(), ...t.keys()])];
  return keys
    .map((key): FactorDiff => {
      const of = o.get(key) as FactorResult | undefined;
      const tf = t.get(key) as FactorResult | undefined;
      const c = cfg.get(key);
      return {
        key,
        name: (tf ?? of)!.name.replace(/\s*\(.*\)$/, ""),
        weight: c ? c.weight : null,
        source: c?.source ?? GATE_FACTOR.source,
        ours: of?.score ?? 0,
        theirs: tf?.score ?? 0,
        impact: ((tf?.score ?? 0) - (of?.score ?? 0)) * (c?.weight ?? 0.1),
        ourEvidence: of?.evidence ?? [],
        theirEvidence: tf?.evidence ?? [],
        theirReasoning: tf?.reasoning ?? "",
        ourReasoning: of?.reasoning ?? "",
      };
    })
    .sort((a, b) => b.impact - a.impact);
}

export interface BriefLine {
  key: string;
  name: string;
  weight: number | null;
  /** What the winning page scores on this factor. */
  theirs: number;
  /** The strings pulled off their page, which is the standard to match. */
  evidence: string[];
  requirement: string;
}

/**
 * The winning page read as a specification. Every line is what THEY actually carry,
 * measured, so it is a bar to clear rather than a checklist somebody wrote.
 */
export function briefFrom(theirs: PageSide): BriefLine[] {
  const cfg = new Map(FACTORS.map((f) => [f.key, f]));
  return theirs.audit.factors
    .map((f) => {
      const c = cfg.get(f.key);
      return {
        key: f.key,
        name: f.name.replace(/\s*\(.*\)$/, ""),
        weight: c ? c.weight : null,
        theirs: f.score,
        evidence: f.evidence,
        requirement: f.reasoning,
      };
    })
    .sort((a, b) => b.theirs * (b.weight ?? 0.1) - a.theirs * (a.weight ?? 0.1));
}

export async function runAutopsy(
  llm: LLMClient,
  input: { domain: string; question?: string; ourUrl?: string; theirUrl?: string; theirHtml?: string; ourHtml?: string },
): Promise<Autopsy> {
  // no page of ours is a legitimate state, not an error: you cannot diff against a page
  // that does not exist, but you can still read the one that is winning
  let ours: PageSide | undefined;
  if (input.ourHtml?.trim()) {
    // pasted source: the only route no server can refuse
    const p = parse(input.ourHtml, input.ourUrl?.trim() || "pasted");
    ours = { url: input.ourUrl?.trim() || "pasted HTML", title: p.title, words: p.wordCount, audit: audit(p) };
  } else if (input.ourUrl?.trim()) {
    const ourFetched = await fetchPage(normaliseUrl(input.ourUrl).toString());
    const ourParsed = parse(ourFetched.html, ourFetched.finalUrl);
    ours = {
      url: ourFetched.finalUrl,
      title: ourParsed.title,
      words: ourParsed.wordCount,
      audit: audit(ourParsed),
    };
  }

  let theirs: PageSide | undefined;
  let attempts: { url: string; outcome: string }[] = [];

  if (input.theirHtml?.trim()) {
    /**
     * Pasted source. mayoclinic.org and bmj.com refuse every automated read, including
     * their own robots.txt, from behind a WAF. There is no honest way around that, and
     * pretending to be a browser would contradict the crawler-honesty this tool is built
     * on. So the user opens the page they can already see, copies the source, and the
     * same nine factors run on it. This route cannot be blocked.
     */
    const p = parse(input.theirHtml, input.theirUrl?.trim() || `https://${input.domain}/`);
    theirs = {
      url: input.theirUrl?.trim() || `pasted from ${input.domain}`,
      title: p.title,
      words: p.wordCount,
      audit: audit(p),
    };
    attempts = [
      { url: input.theirUrl?.trim() || `(pasted source, ${input.domain})`, outcome: `pasted by hand, ${p.wordCount.toLocaleString("en-US")} words parsed` },
    ];
  } else if (input.theirUrl) {
    const f = await fetchPage(normaliseUrl(input.theirUrl).toString());
    const p = parse(f.html, f.finalUrl);
    theirs = { url: f.finalUrl, title: p.title, words: p.wordCount, audit: audit(p) };
    attempts = [{ url: f.finalUrl, outcome: `supplied by hand, HTTP ${f.status}, ${p.wordCount.toLocaleString("en-US")} words` }];
  } else {
    if (!input.question) throw new Error("Give a question to resolve the competitor page from, or paste their URL.");
    const r = await resolveCompetitorPage(llm, input.domain, input.question);
    theirs = r.page;
    attempts = r.attempts;
  }

  // a server that refuses us is reported as what it is, not folded into "not found"
  const blocked = attempts.find((a) => /HTTP (4\d\d|5\d\d)/.test(a.outcome));

  return {
    question: input.question,
    domain: input.domain,
    ours,
    theirs,
    diffs: theirs && ours ? diff(ours.audit, theirs.audit) : [],
    // with no page of ours, the winner's own factor scores become the bar to clear
    brief: theirs && !ours ? briefFrom(theirs) : undefined,
    attempts,
    blockedUs: !theirs && blocked ? blocked.outcome : undefined,
  };
}
