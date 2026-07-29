/**
 * The half of the quality gate the case asks for by name and the pipeline did not have:
 * "quality scoring, plagiarism / AI-detection checks, and a human-in-the-loop approval".
 * Scoring and the human gate existed. These two did not.
 *
 * WHAT THIS IS AND IS NOT, stated here because the distinction is the whole point.
 *
 * There is no honest way to run a real plagiarism check without a corpus, and no
 * classifier can tell you a passage was written by a machine: the published false
 * positive rates on human text are high enough that shipping one as a verdict would be
 * worse than shipping nothing. So this does not claim either.
 *
 * What it does is measurable, local and checkable by hand:
 *   OVERLAP  every draft is compared against every other draft in the same run and
 *            against the grounding rows it was built from, on shingles of 8 words.
 *            Near-duplicate market pages are the actual risk when someone asks AI to
 *            "just write it for three markets", and this catches it exactly.
 *   TELLS    the phrases that mark unedited model output, counted with their positions
 *            so a human can go and look at each one.
 * Both are reported as evidence with the offending text quoted, never as a percentage
 * verdict, and neither blocks on its own. The human gate is what blocks.
 */

export interface OverlapFinding {
  against: string;
  /** Share of this draft's 8-word shingles also present in the other text, 0 to 1. */
  ratio: number;
  /** Ordered figure-triples shared. Language-independent, so a translation cannot hide. */
  factRatio: number;
  /** The longest run of words the two share, quoted so a person can judge it. */
  longest: string;
  words: number;
}

export interface TellFinding {
  phrase: string;
  count: number;
  /** The sentence each hit sits in, so the reviewer edits rather than hunts. */
  examples: string[];
}

export interface OriginalityReport {
  market: string;
  words: number;
  overlaps: OverlapFinding[];
  tells: TellFinding[];
  /** The single number the gate shows. Highest overlap against any sibling draft. */
  worstOverlap: number;
  /** Highest figure-sequence overlap against any sibling draft, across languages. */
  worstFactOverlap: number;
  /** True when a human must look before this can publish. Never auto-publishes either way. */
  needsReview: boolean;
  reasons: string[];
}

const SHINGLE = 8;

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function shingles(text: string, n = SHINGLE): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** Longest common run of words, so the report can quote what actually matched. */
export function longestShared(a: string, b: string): string {
  const A = words(a);
  const B = words(b);
  if (!A.length || !B.length) return "";
  // rolling row rather than a full matrix: drafts run to a few thousand words
  let prev = new Array<number>(B.length + 1).fill(0);
  let best = 0;
  let end = 0;
  for (let i = 1; i <= A.length; i++) {
    const cur = new Array<number>(B.length + 1).fill(0);
    for (let j = 1; j <= B.length; j++) {
      if (A[i - 1] === B[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) {
          best = cur[j];
          end = i;
        }
      }
    }
    prev = cur;
  }
  return best ? A.slice(end - best, end).join(" ") : "";
}

export function overlap(a: string, b: string): number {
  const A = shingles(a);
  if (!A.size) return 0;
  const B = shingles(b);
  let hits = 0;
  for (const s of A) if (B.has(s)) hits += 1;
  return hits / A.size;
}

/**
 * The same check, in a form that survives a translation.
 *
 * The word-level shingle is the right measure inside one language and is worth exactly
 * zero between two. The three drafts are English, Swedish and Danish, so the meter read
 * 0% and the card printed "written independently of the other markets" over a Swedish
 * and a Danish draft that share sixteen of their nineteen figures in the same order. The
 * demo's whole claim is that this catches one page published three times, and against
 * the case it was built for it could not fail.
 *
 * Numbers do not translate. A run of figures in the same order is the same document
 * whatever language it is wearing, and triples rather than single figures because two
 * honest drafts on one topic will quote 20% and 2024 without being the same page.
 */
export function factShingles(text: string, n = 3): Set<string> {
  const figures = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const out = new Set<string>();
  for (let i = 0; i + n <= figures.length; i++) out.add(figures.slice(i, i + n).join("|"));
  return out;
}

/** Share of this draft's ordered figure-triples that also appear in the other. */
export function factOverlap(a: string, b: string): number {
  const A = factShingles(a);
  if (!A.size) return 0;
  const B = factShingles(b);
  let hits = 0;
  for (const s of A) if (B.has(s)) hits += 1;
  return hits / A.size;
}

/**
 * Phrases that survive from an unedited model draft. Each one is a real string a human
 * can search for and rewrite; none of them is evidence of anything on its own, which is
 * why the count and the sentence are reported rather than a score.
 */
export const TELLS = [
  "in today's world",
  "in the ever-evolving",
  "it's important to note",
  "it is important to note",
  "delve into",
  "when it comes to",
  "in conclusion",
  "unlock the",
  "elevate your",
  "game-changer",
  "look no further",
  "the world of",
  "navigate the",
  "harness the power",
  "a testament to",
  "plays a crucial role",
  "plays a vital role",
  "it's worth noting",
  "in summary",
  "rest assured",
] as const;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function findTells(text: string): TellFinding[] {
  const sents = sentences(text);
  const out: TellFinding[] = [];
  for (const phrase of TELLS) {
    const hits = sents.filter((s) => s.toLowerCase().includes(phrase));
    if (hits.length) out.push({ phrase, count: hits.length, examples: hits.slice(0, 2) });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Overlap at or above this against a sibling draft means the pages are the same page. */
export const OVERLAP_REVIEW = 0.25;
/**
 * Figure-sequence overlap at or above this means one draft is the other translated.
 * Set at a third: two honest drafts on one topic quote the same handful of published
 * figures, but they do not put a third of their figure-triples in the same order.
 */
export const FACT_REVIEW = 0.34;
/** Enough tells that the draft reads as unedited. */
export const TELLS_REVIEW = 3;

export function checkOriginality(
  drafts: { market: string; text: string }[],
  grounding: { market: string; text: string }[] = [],
): OriginalityReport[] {
  return drafts.map((d) => {
    const others = drafts.filter((o) => o.market !== d.market);
    const overlaps: OverlapFinding[] = [
      ...others.map((o) => ({
        against: `${o.market} draft`,
        ratio: overlap(d.text, o.text),
        factRatio: factOverlap(d.text, o.text),
        longest: longestShared(d.text, o.text),
        words: words(o.text).length,
      })),
      ...grounding
        .filter((g) => g.market === d.market && g.text.trim())
        .map((g) => ({
          against: `${g.market} grounding`,
          ratio: overlap(d.text, g.text),
          factRatio: factOverlap(d.text, g.text),
          longest: longestShared(d.text, g.text),
          words: words(g.text).length,
        })),
    ].sort((a, b) => b.ratio - a.ratio);

    const tells = findTells(d.text);
    const worst = overlaps.length ? overlaps[0].ratio : 0;
    const siblings = overlaps.filter((o) => o.against.endsWith("draft"));
    const worstFacts = siblings.length ? Math.max(...siblings.map((o) => o.factRatio)) : 0;
    const factPeer = siblings.find((o) => o.factRatio === worstFacts);

    const reasons: string[] = [];
    if (worst >= OVERLAP_REVIEW) {
      reasons.push(
        `${Math.round(worst * 100)}% of this draft's 8-word sequences also appear in ${overlaps[0].against}. Two markets sharing this much are one page published twice.`,
      );
    }
    if (worstFacts >= FACT_REVIEW) {
      reasons.push(
        `${Math.round(worstFacts * 100)}% of this draft's figures appear in the same order in ${factPeer?.against ?? "another draft"}. Numbers survive translation, so this is the same page in another language.`,
      );
    }
    if (tells.length >= TELLS_REVIEW) {
      reasons.push(
        `${tells.length} phrases that mark unedited model output, ${tells.reduce((n, t) => n + t.count, 0)} occurrences in total.`,
      );
    }

    return {
      market: d.market,
      words: words(d.text).length,
      overlaps,
      tells,
      worstOverlap: worst,
      worstFactOverlap: worstFacts,
      needsReview: reasons.length > 0,
      reasons,
    };
  });
}
