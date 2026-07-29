import type { SitemapEntry } from "../engine/sitemap";

/**
 * Finding the competitor's page for a question, without asking a model to remember URLs.
 *
 * The LLM route produced `bmj.com/content/377/bmj.n2460` and two siblings for a GLP-1
 * question. None of them is a page anyone can open. A model recalls the SHAPE of a
 * publisher's URLs, not which ones exist, so the honest source is the site's own
 * sitemap: every URL in it is one the site published.
 *
 * The bar for returning anything is deliberately high. A wrong page is worse than no
 * page, because the brief that follows would describe the wrong thing with total
 * confidence: matching only the common words offered "money-work-and-benefits" for
 * "How does GLP-1 work?" and "antibiotics/side-effects" for a semaglutide question.
 */

const STOP = new Set([
  "what","which","when","where","who","why","how","does","do","did","is","are","was","were","can","could",
  "should","would","will","the","a","an","and","or","of","for","to","in","on","at","with","from","by",
  "about","into","over","after","before","any","all","some","my","your","it","its","that","this","there",
  "have","has","had","been","being","get","got","make","made","use","used","using","help","helps","work",
  "works","take","takes","best","good","better","need","needs","much","many","long","time","really",
]);

/**
 * Content words that appear in thousands of URLs on any publisher and therefore cannot
 * identify a page on their own. Length is not the test: "effects" is seven letters and
 * matched /antibiotics/side-effects/ for a semaglutide question.
 */
const GENERIC = new Set([
  "effects","effect","benefits","benefit","guide","guides","review","reviews","price","prices","cost",
  "costs","symptoms","symptom","causes","cause","treatment","treatments","medicine","medicines","health",
  "advice","tips","facts","information","overview","introduction","basics","options","types","difference",
  "differences","comparison","results","dosage","dose","safety","risks","side","uses","usage","products",
  "product","brands","brand","conditions","condition","support","service","services","about","contact",
]);

export interface Keyword {
  word: string;
  /** A term specific enough to identify a topic on its own. */
  specific: boolean;
}

/**
 * `glp-1` stays one token: splitting it produces "glp" and a digit, and the digit is
 * dropped, so the only term that identifies the topic disappears.
 */
export function keywords(question: string): Keyword[] {
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter(Boolean);

  const kept = tokens.filter((w) => w.length > 2 && !STOP.has(w));

  /**
   * Adjacent pairs, so a one-letter qualifier survives. "vitamin c" loses its C to the
   * length filter and then matches /vitamins-and-minerals/vitamin-b/, which is a
   * different vitamin and a confidently wrong page.
   */
  const pairs: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (STOP.has(a) || STOP.has(b)) continue;
    if (a.length < 2 && b.length < 2) continue;
    // "side-effects" is two generic words glued together and identifies nothing
    if (GENERIC.has(a) && GENERIC.has(b)) continue;
    pairs.push(`${a}-${b}`);
  }

  const raw = [...pairs, ...kept];
  const seen = new Set<string>();
  return raw
    .filter((w) => !seen.has(w) && (seen.add(w), true))
    .map((word) => ({
      // what names the subject: a number, a hyphenated term, or a long word that is not
      // one of the content words every publisher uses on every page
      specific: !GENERIC.has(word) && (/\d/.test(word) || word.includes("-") || word.length >= 6),
      word,
    }));
}

export interface Candidate {
  loc: string;
  score: number;
  matched: string[];
}

/**
 * A trailing plural is not a different subject.
 *
 * "What is the best vitamin C serum?" scored /nutrition/vitamin-c-foods above
 * /health/beauty-skin-care/vitamin-c-serums, because "serum" and "serums" were two
 * different tokens, so the serum page matched on "vitamin-c" alone and lost the tie to a
 * page about food. Both forms go in the set. Four letters is the floor so "is" and "as"
 * are left alone.
 */
const depluralise = (w: string) => (w.length >= 5 && /[^s]s$/.test(w) ? w.slice(0, -1) : w);

const segmentsOf = (path: string): Set<string> => {
  const parts = path.split(/[/\-_.]+/).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    out.add(depluralise(p));
  }
  // keep hyphenated pairs so "glp-1" can match a "glp-1" slug segment
  for (let i = 0; i < parts.length - 1; i++) {
    out.add(`${parts[i]}-${parts[i + 1]}`);
    out.add(`${depluralise(parts[i])}-${depluralise(parts[i + 1])}`);
  }
  return out;
};

/**
 * Ranks sitemap URLs by the question's words appearing as whole slug segments. Only the
 * path is read, never the query string, where a match is a coincidence.
 *
 * A candidate is returned ONLY if it matches a specific term. Common words alone are
 * never enough.
 */
export function rankSitemapCandidates(entries: SitemapEntry[], question: string, limit = 3): Candidate[] {
  const words = keywords(question);
  if (!words.length || !entries.length) return [];
  const specific = words.filter((w) => w.specific).map((w) => w.word);

  const scored: Candidate[] = [];
  for (const e of entries) {
    let path: string;
    try {
      path = new URL(e.loc).pathname.toLowerCase();
    } catch {
      continue;
    }
    const segments = segmentsOf(path);
    const matched = words.filter((w) => segments.has(w.word) || segments.has(depluralise(w.word))).map((w) => w.word);
    if (!matched.length) continue;

    // the discriminating term has to be there. Without it, this is a coincidence.
    if (specific.length > 0) {
      if (!matched.some((m) => specific.includes(m))) continue;
    } else if (matched.length < 2) {
      // no discriminating term in the question at all: one common word is not evidence
      continue;
    }

    const score = matched.reduce((s, w) => s + w.length, 0) / Math.max(1, Math.log2(path.length));
    scored.push({ loc: e.loc, score, matched });
  }

  /**
   * If any candidate matched a compound term, only those survive. "vitamin" alone hits
   * vitamin-b as happily as vitamin-c; once one URL carries "vitamin-c", the ones that
   * only carry "vitamin" are the wrong page and must not be offered.
   */
  const compounds = new Set(words.filter((w) => w.word.includes("-") && w.specific).map((w) => w.word));
  const onCompound = scored.filter((c) => c.matched.some((m) => compounds.has(m)));
  const pool = onCompound.length ? onCompound : compounds.size ? [] : scored;

  return pool.sort((a, b) => b.matched.length - a.matched.length || b.score - a.score).slice(0, limit);
}
