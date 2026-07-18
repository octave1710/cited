import type { AuditResult, ParsedPage, Section } from "./types.js";
import { FACTORS } from "./weights.config.js";
import { QUESTION_RE } from "./factors/answerStructure.js";

export interface Fix {
  factorKey: string;
  title: string;
  /** Real extract from the page. */
  before: string;
  /** Concrete rewrite. Bracketed [SLOTS] mark data CITED refuses to invent. */
  after: string;
  impact: number; // 1-5, derived from weighted score gap
  effort: number; // 1-5, fixed per fix type
  priority: number; // impact × ease
  rationale: string;
}

const HEDGE_RE = /\b(may help|can help|could|might|many (users|people)|some people|is believed|over time|tend to)\b/i;
// Container headings (FAQ, sources...) are not passages; rewriting them as questions is noise.
const CONTAINER_RE = /faq|frequently asked|sources|references|conclusion|summary/i;
const FILLER_RE = /^(in this (article|guide|post)|welcome|when it comes to|there are many|nowadays)/i;

const sentences = (p: string) => p.split(/(?<=[.!?])\s+/);

function impactFor(key: string, score: number): number {
  const weight = FACTORS.find((c) => c.key === key)?.weight ?? 0;
  return Math.min(5, Math.max(1, Math.ceil(((100 - score) * weight) / 5)));
}

function toQuestion(heading: string): string {
  const t = heading.trim().replace(/[.!]$/, "");
  let m = /^benefits? of\s+(.+)/i.exec(t);
  if (m) return `What are the benefits of ${m[1]}?`;
  m = /^(?:the\s+)?(.+?)\s+difference$/i.exec(t);
  if (m) return `What makes ${m[1]} different?`;
  m = /^(?:a |the )?(?:complete |ultimate )?guide to\s+(.+)/i.exec(t);
  if (m) return `What should you know about ${m[1]}?`;
  m = /^(.+?)\s+(?:tips|advice)$/i.exec(t);
  if (m) return `How do you get the most from ${m[1].toLowerCase()}?`;
  return `What should you know about ${t.toLowerCase()}?`;
}

/** Best standalone answer candidate in a section: short, declarative, ideally quantified. */
function bestAnswerSentence(s: Section): string | undefined {
  const all = s.paragraphs.flatMap(sentences).filter((x) => x.split(" ").length <= 35 && !FILLER_RE.test(x));
  return all.find((x) => /\d/.test(x)) ?? all[0];
}

export function generateFixes(page: ParsedPage, result: AuditResult, opts: { now?: Date } = {}): Fix[] {
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const score = (key: string) => result.factors.find((f) => f.key === key)?.score ?? 0;
  const fixes: Fix[] = [];
  const add = (f: Omit<Fix, "priority" | "impact"> & { impact?: number }) => {
    const impact = f.impact ?? impactFor(f.factorKey, score(f.factorKey));
    fixes.push({ ...f, impact, priority: impact * (6 - f.effort) });
  };

  // Gate first: nothing else matters if bots cannot read the page.
  if (result.gated) {
    for (const failure of result.factors[0].evidence) {
      add({
        factorKey: "crawlability",
        title: "Unblock answer-engine bots",
        before: failure,
        after: failure.includes("noindex")
          ? '<meta name="robots" content="index, follow">'
          : "Server-render the main content so it exists in the raw HTML response (most answer-engine bots do not execute JavaScript).",
        impact: 5,
        effort: 1,
        rationale: "Binary gate (Shepard/Zyppy meta-analysis, May 2026). Until bots can read the page, no other fix pays anything.",
      });
    }
  }

  // Answer-first structure
  if (score("answerStructure") < 90) {
    const subs = page.sections.filter((s) => s.heading && (s.heading.level === 2 || s.heading.level === 3));
    for (const s of subs.filter((x) => !QUESTION_RE.test(x.heading!.text) && !CONTAINER_RE.test(x.heading!.text)).slice(0, 3)) {
      add({
        factorKey: "answerStructure",
        title: "Rephrase heading as the question users actually ask",
        before: `H${s.heading!.level}: "${s.heading!.text}"`,
        after: `H${s.heading!.level}: "${toQuestion(s.heading!.text)}"`,
        effort: 1,
        rationale: "Answer engines match passages to question-shaped sub-queries (seoClarity 2026, r=0.87). The heading is the passage's address.",
      });
    }
    for (const s of subs.filter((x) => QUESTION_RE.test(x.heading!.text) && x.paragraphs.length)) {
      const first = sentences(s.paragraphs[0])[0];
      if (first.split(" ").length > 40 || FILLER_RE.test(first)) {
        const candidate = bestAnswerSentence(s);
        add({
          factorKey: "answerStructure",
          title: `Answer "${s.heading!.text}" in the first sentence`,
          before: `Current opener: "${first.slice(0, 140)}"`,
          after: candidate
            ? `Move this sentence first: "${candidate}"`
            : "Open with a one-sentence direct answer (under 35 words), then elaborate.",
          effort: 2,
          rationale: "The first sentence under a question heading is what gets lifted verbatim. Filler openers forfeit the citation.",
        });
      }
    }
  }

  // Quantified specificity: flag hedges, never invent the numbers.
  if (score("factualSpecificity") < 70) {
    const vague = page.sections.flatMap((s) => s.paragraphs).flatMap(sentences).filter((x) => HEDGE_RE.test(x));
    for (const v of vague.slice(0, 3)) {
      add({
        factorKey: "factualSpecificity",
        title: "Replace hedge with a sourced figure",
        before: `"${v}"`,
        after: `Rewrite with an exact number and source, e.g. "${v.replace(/[.!?]$/, "")} [SOURCED STAT: metric, %, timeframe, study + year]." CITED does not invent statistics; supply one or let the pipeline's grounding step propose sourced candidates.`,
        effort: 3,
        rationale: "Causal +31% citation share from adding statistics (GEO paper, SIGKDD 2024). Hedged claims get paraphrased without attribution.",
      });
    }
  }

  // Sourced quotes: strongest lever, same refusal to fabricate.
  if (score("sourcedQuotes") < 70) {
    const target = page.sections.find((s) => s.heading && s.paragraphs.length);
    add({
      factorKey: "sourcedQuotes",
      title: "Add an attributed expert quote",
      before: target ? `Section "${target.heading!.text}" makes claims with no attributed voice.` : "No attributed quotes anywhere on the page.",
      after: `Insert: '"[One-sentence version of your strongest claim]," says [NAME], [credential], [institution].' CITED does not fabricate experts; quote a real one (founder, in-house specialist, or published researcher).`,
      effort: 4,
      rationale: "Strongest single lever measured: +41% citation share (GEO paper). Engines need a name to attribute a claim to.",
    });
  }

  // Freshness
  if (score("freshness") < 85) {
    add({
      factorKey: "freshness",
      title: "Add machine-readable dates and a visible verification line",
      before: page.modifiedDate ?? page.publishedDate ?? "No machine-readable date anywhere (JSON-LD, meta, <time>).",
      after: `JSON-LD: "dateModified": "${today}" + visible line "Last verified ${today}" near the top. Then actually re-verify the content on a schedule.`,
      effort: 1,
      rationale: "Content under 3 months old earns 2-3x more citations; under 30 days is Perplexity's sweet spot (seoClarity 2026).",
    });
  }

  // Off-site authority proxies
  if (score("offSiteAuthority") < 70 && !page.author) {
    add({
      factorKey: "offSiteAuthority",
      title: "Add a named author with credentials",
      before: "No named author on the page.",
      after: `Byline + JSON-LD author: { "@type": "Person", "name": "[REAL NAME]", "sameAs": ["[LinkedIn]", "[YouTube]"] }. Link profiles that actually exist.`,
      effort: 2,
      rationale: "On-page proxy of Ahrefs' #1 factor (third-party brand authority). The full lever is off-site: mentions, YouTube, communities.",
    });
  }

  // Schema: generated, honest near-zero priority.
  if (score("schemaValidity") < 100) {
    add({
      factorKey: "schemaValidity",
      title: "Add generated JSON-LD (hygiene, not a citation lever)",
      before: page.jsonLd.length ? "JSON-LD present but incomplete." : "No JSON-LD structured data.",
      after: "Paste the output of `cited schema <page>` (auto-built from this page's own content).",
      impact: 1,
      effort: 1,
      rationale: "Ahrefs (May 2026, 1,885 pages): null causal effect on citations. Do it because it is cheap and correct, not because it moves the score.",
    });
  }

  return fixes.sort((a, b) => b.priority - a.priority);
}
