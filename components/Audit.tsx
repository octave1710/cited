"use client";

import { useRef, useState } from "react";
import type { FactorEvent, TraceEvent } from "../lib/stream";
import { Ladder, type LadderRow } from "./Ladder";
import { Awaiting, Entity, Figure, Label, Num, Section, Verdict, useEntry } from "./da";

/** What the one-word grade actually asserts, so it is never a bare label. */
const GRADE_MEANS: Record<string, string> = {
  cited: "an engine has enough here to quote the page",
  likely: "quotable, but a rival on the same topic beats it on structure",
  "at-risk": "readable, and thin on the things an engine lifts",
  invisible: "nothing here is in the shape an engine quotes",
};

/** What each factor is actually measuring, in a sentence, next to its own row. */
const MEASURES: Record<string, string> = {
  crawlability: "Can answer-engine bots read the page at all. Nothing else counts until this passes.",
  answerStructure: "Question headings whose first sentence is the answer. Engines lift passages, not pages.",
  sourcedQuotes: "Claims attributed to a named expert or institution.",
  factualSpecificity: "Exact figures an engine can quote back with a source.",
  freshness: "How recently the page was verified.",
  offSiteAuthority: "The authority markers the page carries itself: a named author, linked profiles, links out to primary sources. Not a check of where else the brand is cited.",
  fanoutCoverage: "How many sub-questions of the topic the page actually answers.",
  googleRank: "Classic ranking. Down-weighted on purpose, it no longer predicts citation.",
  schemaValidity: "Valid JSON-LD. Generated for hygiene, weighted at 1%, measured causal effect is zero.",
};

const toRows = (factors: FactorEvent[]): LadderRow[] =>
  factors.map((f) => ({
    key: f.key,
    name: f.name.replace(/\s*\(.*\)$/, ""),
    weight: f.gate ? null : f.weight,
    score: f.score,
    source: f.source,
    evidence: f.evidence,
    reasoning: MEASURES[f.key] ? `${MEASURES[f.key]} ${f.reasoning}` : f.reasoning,
    partial: f.partial,
  }));

export function AuditPanel({
  url,
  mode,
  trace,
  factors,
  summary,
  busy,
  onFixes,
  hasFixes,
}: {
  url: string;
  mode: "live" | "demo";
  trace: TraceEvent[];
  factors: FactorEvent[];
  summary: { overall: number; grade: string; zeros: number; lostWeight: number; totalMs: number; checks: number } | null;
  busy: string | null;
  onFixes: () => void;
  hasFixes: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEntry([summary?.overall, factors.length], ref);

  if (!summary) {
    return (
      <div className="gut shell">
        <Awaiting
          title="Score one page the way an answer engine reads it."
          what="A crawlability gate plus eight weighted factors, each carrying its published source, run against the page's real text. The score is what the page earned against what each factor is worth."
          steps={busy ? [{ label: busy, state: "running" }] : undefined}
        />
      </div>
    );
  }

  const rows = toRows(factors);
  const weighted = rows.filter((r) => r.weight !== null);
  const worst = [...weighted].sort((a, b) => (b.weight ?? 0) * (100 - b.score) - (a.weight ?? 0) * (100 - a.score))[0];
  const gateShut = rows.some((r) => r.weight === null && r.score < 100);
  // weight is a fraction of 1, so this is already points out of 100
  const worstCost = worst ? (worst.weight ?? 0) * (100 - worst.score) : 0;

  const headline = gateShut
    ? "Bots are blocked, so none of the rest counts yet."
    : worstCost >= 1
      ? `${worst.name} is costing ${worstCost.toFixed(1)} of the ${100 - summary.overall} points missing.`
      : "The page earns nearly everything the nine factors offer.";

  return (
    <div ref={ref} className="gut shell" style={{ paddingBottom: 140 }}>
      <div style={{ paddingTop: 60 }}>
        <Verdict
          meta={
            <>
              {mode === "live" ? "LIVE FETCH" : "PAGE HELD IN THIS REPO"} · {summary.checks} CHECKS ·{" "}
              {summary.totalMs.toFixed(0)}MS · {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 58)}
            </>
          }
          headline={headline}
          lede={
            <>
              {summary.overall} out of 100, which reads as {GRADE_MEANS[summary.grade] ?? summary.grade}.
              {summary.zeros > 0 && ` ${summary.zeros} factor${summary.zeros === 1 ? "" : "s"} scored nothing at all.`}
            </>
          }
          warning={
            gateShut
              ? "The crawlability gate is shut. An engine that cannot fetch the page cannot quote it, whatever the other eight factors say."
              : undefined
          }
        />

        <div style={{ display: "flex", gap: 56, marginTop: 46, flexWrap: "wrap" }}>
          <Figure n={summary.overall} label="OUT OF 100" tone={summary.overall >= 70 ? "d2" : summary.overall >= 40 ? "d1" : "brand"} />
          <Figure n={100 - summary.overall} label="POINTS ON THE TABLE" tone="brand" />
          <Figure n={summary.zeros} label="FACTORS AT ZERO" />
        </div>
      </div>

      <Section>
        <div style={{ marginBottom: 20 }}>
          <Label>THE SCORE, SPLIT BY WHAT EACH FACTOR IS WORTH</Label>
        </div>
        <Ladder rows={rows} overall={summary.overall} />
      </Section>

      <NextStep onFixes={onFixes} busy={busy} hasFixes={hasFixes} missing={100 - summary.overall} />

      {trace.length > 0 && <Trace trace={trace} />}
    </div>
  );
}

/** The action sits against the number. A diagnosis with nothing beside it is reporting. */
function NextStep({ onFixes, busy, hasFixes, missing }: { onFixes: () => void; busy: string | null; hasFixes: boolean; missing: number }) {
  return (
    <Section>
      <div
        style={{
          background: "var(--s1)",
          borderTop: "2px solid var(--brand)",
          padding: "28px 32px",
          display: "flex",
          gap: 32,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 440px" }}>
          <Entity size={30} style={{ display: "block" }}>Write the rewrites that close it.</Entity>
          <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 10, maxWidth: "64ch" }}>
            Each one names the sentence it replaces and the points it unblocks. The ones needing a figure or a
            named expert are not invented, they come back as a sheet for the client to fill in.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <Num size={30} tone="var(--brand)">{missing}</Num>
          <div style={{ marginTop: 4, marginBottom: 12 }}>
            <Label>POINTS IN PLAY</Label>
          </div>
          <button className="btn btn--primary" onClick={onFixes} disabled={Boolean(busy)}>
            {busy === "fixes" ? "Writing…" : hasFixes ? "Rewrite again" : "Write the fix plan"}
          </button>
        </div>
      </div>
    </Section>
  );
}

/** Every check that ran, with what it read. Collapsed by default, because it is a receipt. */
function Trace({ trace }: { trace: TraceEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Section style={{ paddingTop: 72 }}>
      <button className="btn btn--ghost btn--sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide the run" : `Show all ${trace.length} checks and what each one read`}
      </button>
      {open && (
        <div style={{ marginTop: 20 }}>
          {trace.map((t, i) => {
            const e = t as { name?: string; what?: string; ms?: number };
            return (
              <div
                key={i}
                data-row
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px,260px) minmax(0,1fr) 74px",
                  gap: 20,
                  padding: "9px 0",
                  borderTop: "1px solid var(--line)",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600 }}>{e.name ?? "check"}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink)" }}>{e.what ?? ""}</span>
                <span style={{ textAlign: "right" }}>
                  <Num size={12} tone="meta">{(e.ms ?? 0).toFixed(1)}ms</Num>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
