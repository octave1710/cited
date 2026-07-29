import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../engine/parse";
import { audit } from "../engine/score";

/**
 * Part B. Seven nodes, and node six is a wall.
 *
 * The gate is not a UI convention: `publish` throws unless an approval record
 * exists, so nothing downstream can run without a human decision even if the
 * caller hits the endpoint directly.
 */

export * from "./nodes";
import type { GateDecision, MarketPlan, NodeId, NodeState, PipelineRun } from "./nodes";
import { checkOriginality, OVERLAP_REVIEW } from "./originality";
import { NODES } from "./nodes";

/** One headline shape per market, written in that market's language, never translated. */
const HEADLINES: Record<string, (t: string) => string> = {
  UK: (t) => `${t}: what it does, how long it takes, and how to choose one`,
  SE: (t) => `${t}: vad det gor, hur lang tid det tar och hur du valjer`,
  DK: (t) => `${t}: hvad det gor, hvor lang tid det tager, og hvordan du vaelger`,
};

const MIN_SCORE = 55;

function blankNodes(): PipelineRun["nodes"] {
  return NODES.reduce((acc, n) => {
    acc[n.id] = { state: "queued" };
    return acc;
  }, {} as PipelineRun["nodes"]);
}

/** One question and its answer, written for that market in that market's language. */
type GroundSection = { q: string; a: string };

type GroundRow = {
  term: string;
  monthlyVolume: number;
  note: string;
  runnerUp: string;
  /** The market's own question set. Absent means the pipeline refuses to draft for it. */
  sections?: GroundSection[];
  marketNote?: string;
};

function grounding(topic: string): Record<string, GroundRow> | null {
  try {
    const all = JSON.parse(readFileSync(join(process.cwd(), "fixtures/grounding.json"), "utf8")) as Record<
      string,
      Record<string, GroundRow>
    >;
    return all[topic.toLowerCase().trim()] ?? null;
  } catch {
    return null;
  }
}

/** Lines that must never ship on an automated pass. */
const RISKY = [
  { re: /\b(cure|treats?|heals?|prevents?)\b/i, why: "reads as a medical claim, needs expert review in this market" },
  { re: /\b(guarantee|guaranteed|100%)\b/i, why: "absolute claim, legal review required" },
  { re: /\b(clinically proven)\b/i, why: "regulated phrasing in several EU markets" },
];

export function runToGate(input: { id: string; topic: string; markets: string[]; brand: string }): PipelineRun {
  const run: PipelineRun = {
    id: input.id,
    createdAt: new Date().toISOString(),
    topic: input.topic,
    markets: input.markets,
    brand: input.brand,
    nodes: blankNodes(),
    plans: [],
    decisions: [],
    trace: [],
  };

  // ---- 1. ground
  const rows = grounding(input.topic);
  if (!rows) {
    run.nodes.ground = {
      state: "failed",
      error: `No grounding data for "${input.topic}". A brief without grounding is a hard stop, so the pipeline refuses to continue.`,
    };
    return run;
  }
  const missing = input.markets.filter((m) => !rows[m]);
  if (missing.length) {
    run.nodes.ground = {
      state: "failed",
      error: `No grounding for ${missing.join(", ")}. Hard stop rather than guessing the local term.`,
    };
    return run;
  }
  run.nodes.ground = {
    state: "done",
    note: input.markets.map((m) => `${m}: ${rows[m].term} (${rows[m].monthlyVolume.toLocaleString("en-US")}/mo)`).join(" · "),
  };
  for (const m of input.markets) {
    run.trace.push({ step: "ground", claim: `${m} targets "${rows[m].term}"`, source: `grounding.json → ${input.topic} → ${m}` });
  }

  // ---- 2. brief, each angle citing its grounding row
  run.brief = input.markets.map((m) => ({
    angle: `${m}: lead on "${rows[m].term}", answer-first, and beat "${rows[m].runnerUp}" on specificity`,
    source: `${rows[m].monthlyVolume.toLocaleString("en-US")} monthly searches · ${rows[m].note}`,
  }));
  run.nodes.brief = { state: "done", note: `${run.brief.length} market angles, each citing its grounding row` };

  // ---- 3 to 5. draft, score, adapt
  for (const m of input.markets) {
    const g = rows[m];
    /**
     * The draft is assembled from THAT MARKET's own question set, in that market's own
     * language, not from one English body with the term swapped in.
     *
     * The version before this reused four identical English paragraphs across UK, SE and
     * DK and changed only the search term. The originality check caught it immediately at
     * 95% overlap, which is the right verdict: that is not localisation, it is the same
     * page published three times, and it is exactly the failure the brief warns about
     * when a client says "just use AI to generate it".
     */
    const sections: GroundSection[] = (g.sections ?? []).map((sec) => ({
      q: sec.q.replaceAll("{term}", g.term),
      a: sec.a.replaceAll("{term}", g.term),
    }));
    if (!sections.length) {
      run.nodes.draft = {
        state: "failed",
        error: `No question set grounded for ${m}. A draft assembled from another market's copy is not a localisation, so the pipeline refuses to write one.`,
      };
      return run;
    }

    const headline = HEADLINES[m] ? HEADLINES[m](g.term) : `${g.term}: what it does, how long it takes, and how to choose one`;
    const body = sections.map((sec: GroundSection) => sec.a);

    const html = `<!DOCTYPE html><html lang="${m.toLowerCase()}"><head><title>${headline}</title>
<meta name="description" content="${body[0].slice(0, 150)}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(headline)},"inLanguage":"${m.toLowerCase()}","datePublished":"${new Date().toISOString().slice(0, 10)}","dateModified":"${new Date().toISOString().slice(0, 10)}","author":{"@type":"Person","name":"[SUPPLIED BY CLIENT]"}}</script>
</head><body><article><h1>${headline}</h1>
${sections.map((sec: GroundSection) => `<h2>${sec.q}</h2><p>${sec.a}</p>`).join("")}
</article></body></html>`;

    const scored = audit(parse(html));
    const flags = body
      .flatMap((line: string) => RISKY.filter((r) => r.re.test(line)).map((r) => ({ line, why: r.why })))
      .concat(
        m !== "UK"
          ? [{ line: headline, why: `adapted from the UK angle, a native ${m} speaker must read it before it ships` }]
          : [],
      );

    run.plans.push({
      market: m,
      term: g.term,
      monthlyVolume: g.monthlyVolume,
      groundingNote: g.note,
      runnerUp: g.runnerUp,
      headline,
      body,
      score: scored.overall,
      flags,
    });
    run.trace.push({ step: "optimise", claim: `${m} draft scores ${scored.overall}/100`, source: "engine/score.ts, same nine factors as the audit" });
  }

  run.nodes.draft = { state: "done", note: `${run.plans.length} drafts, answer-first, one question per section` };
  run.nodes.optimise = {
    state: "done",
    note: run.plans.map((p) => `${p.market} ${p.score}/100`).join(" · "),
  };
  run.nodes.localise = {
    state: "done",
    note: `${run.plans.reduce((s, p) => s + p.flags.length, 0)} lines flagged for human eyes`,
  };

  /**
   * ---- 6a. plagiarism and AI-detection, the half of the gate the case names
   *
   * Every draft is compared against every sibling draft and against its own grounding
   * row. Near-duplicate market pages are the real damage when someone asks AI to write
   * the same article three times, and this measures exactly that on 8-word shingles.
   * It reports evidence, never a verdict, and it never blocks on its own.
   */
  const reports = checkOriginality(
    run.plans.map((p) => ({ market: p.market, text: [p.headline, ...p.body].join(" ") })),
    run.plans.map((p) => ({ market: p.market, text: p.groundingNote })),
  );
  for (const p of run.plans) p.originality = reports.find((r) => r.market === p.market);

  const flaggedOriginality = reports.filter((r) => r.needsReview);
  for (const r of flaggedOriginality) {
    run.trace.push({
      step: "gate",
      claim: `${r.market}: ${r.reasons.join(" ")}`,
      source: "pipeline/originality.ts, 8-word shingle overlap and unedited-output phrases",
    });
  }

  // ---- 6b. the wall
  const below = run.plans.filter((p) => p.score < MIN_SCORE);
  const worst = reports.length ? Math.max(...reports.map((r) => r.worstOverlap)) : 0;
  run.nodes.gate = {
    state: "blocked",
    note:
      (below.length > 0
        ? `${below.map((p) => p.market).join(", ")} below the ${MIN_SCORE} minimum. `
        : `All markets clear the ${MIN_SCORE} minimum. `) +
      (flaggedOriginality.length
        ? `${flaggedOriginality.length} flagged for overlap or unedited phrasing, worst overlap ${Math.round(worst * 100)}%. `
        : `Highest overlap between markets ${Math.round(worst * 100)}%, under the ${Math.round(OVERLAP_REVIEW * 100)}% review line. `) +
      "Approval still required per market.",
  };
  run.nodes.publish = { state: "queued", note: "unreachable until every market is approved" };

  return run;
}

export class GateError extends Error {}

/** Throws unless every market carries a named approval. The refusal lives here, not in the UI. */
export function publish(run: PipelineRun): PipelineRun {
  const approved = new Set(run.decisions.map((d) => d.market));
  const pending = run.markets.filter((m) => !approved.has(m));
  if (pending.length) {
    throw new GateError(
      `Blocked: ${pending.join(", ")} not approved. CITED cannot publish a market without a named human decision.`,
    );
  }

  run.nodes.gate = {
    state: "done",
    note: run.decisions.map((d) => `${d.market} approved by ${d.approvedBy}`).join(" · "),
  };

  run.output = run.plans.map((p) => ({
    market: p.market,
    markdown: [`# ${p.headline}`, "", ...p.body.flatMap((b, i) => [`## ${["What does it do?", "How long does it take?", "How do you choose one?", "How should you apply it?"][i]}`, "", b, ""])].join("\n"),
    metadata: {
      title: p.headline,
      description: p.body[0].slice(0, 155),
      market: p.market,
      primaryTerm: p.term,
      status: "ready for CMS, not published",
      approvedBy: run.decisions.find((d) => d.market === p.market)?.approvedBy ?? "",
    },
    hreflang: run.markets.map((m) => `<link rel="alternate" hreflang="${m.toLowerCase()}" href="/${m.toLowerCase()}/${slug(run.plans.find((x) => x.market === m)!.term)}" />`),
  }));

  run.nodes.publish = { state: "done", note: `${run.output.length} CMS payloads written. hreflang proposed, never pushed.` };
  run.trace.push({ step: "publish", claim: "hreflang proposed but not deployed", source: "refusal list: localisation is never auto-deployed" });
  return run;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
