"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { FactorEvent, TraceEvent } from "../lib/stream";

/** One colour per weighted factor, in the fixed data order. Identity, never rank. */
const SEGMENT = ["var(--d1)", "var(--d2)", "var(--d3)", "var(--d4)", "var(--d5)", "var(--d6)", "var(--d-rest)", "var(--brand)"];

const MEASURES: Record<string, string> = {
  crawlability: "Can answer-engine bots read the page at all. Nothing else counts until this passes.",
  answerStructure: "Question headings whose first sentence is the answer. Engines lift passages, not pages.",
  sourcedQuotes: "Claims attributed to a named expert or institution.",
  factualSpecificity: "Exact figures an engine can quote back with a source.",
  freshness: "How recently the page was verified.",
  offSiteAuthority: "Whether the brand is cited anywhere else on the web.",
  fanoutCoverage: "How many sub-questions of the topic the page actually answers.",
  googleRank: "Classic ranking. Down-weighted on purpose, it no longer predicts citation.",
  schemaValidity: "Valid JSON-LD. Generated for hygiene, weighted at 1%, measured causal effect is zero.",
};

/** What the one-word grade actually asserts, so it is never a bare label. */
const GRADE_MEANS: Record<string, string> = {
  invisible: "Invisible: under 35, so an engine has no reason to quote this page over the ones already winning.",
  "at-risk": "At risk: 35 to 54, quotable in principle but beaten by any page that carries figures and a named source.",
  likely: "Likely: 55 to 74, in the running. The remaining gap is usually one or two heavy factors.",
  cited: "Cited: 75 and over, carrying what engines lift.",
};

const HEADLINE: Record<string, string> = {
  invisible: "Answer engines skip this page.",
  "at-risk": "This page is barely quotable.",
  likely: "Close, but engines still prefer others.",
  cited: "This page is quotable.",
};

/**
 * The score as a budget, not as a number.
 *
 * A big numeral says "43" and stops there. Every factor owns a share of the 100 points,
 * so the bar is nine segments whose WIDTH is the weight and whose FILL is what was
 * earned of it. The empty part of each segment is exactly the points that were lost,
 * and where they went is visible without reading a table.
 */
function ScoreBudget({
  summary,
  factors,
  busy,
  onFixes,
  hasFixes,
}: {
  summary: { overall: number; grade: string; zeros: number; lostWeight: number; totalMs: number; checks: number };
  factors: FactorEvent[];
  busy: string | null;
  onFixes: () => void;
  hasFixes: boolean;
}) {
  const weighted = factors.filter((f) => f.weight !== null && f.weight > 0);
  const gate = factors.find((f) => f.gate);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!weighted.length || !barRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-earned]", { scaleX: 0, transformOrigin: "left center", duration: 0.7, ease: "expo.out", stagger: 0.05 });
    }, barRef);
    return () => ctx.revert();
  }, [weighted.length]);

  return (
    <div className="sec" style={{ paddingTop: 34 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 40, alignItems: "end" }}>
        <div>
          <div className="m" style={{ color: "var(--meta)", marginBottom: 10 }}>
            WHERE THE 100 POINTS WENT
          </div>

          <div ref={barRef} style={{ display: "flex", gap: 2, height: 60 }}>
            {weighted.map((f, i) => {
              const colour = SEGMENT[i % SEGMENT.length];
              const earned = Math.max(0, Math.min(100, f.score)) / 100;
              return (
                <div
                  key={f.key}
                  title={`${f.name}: earned ${f.score} of 100 on a weight of ${Math.round((f.weight ?? 0) * 100)}%`}
                  style={{ flex: `${(f.weight ?? 0) * 100} 0 0`, position: "relative", background: "var(--s2)", minWidth: 4 }}
                >
                  <div
                    data-earned
                    style={{ position: "absolute", inset: 0, transform: `scaleX(${earned})`, transformOrigin: "left center", background: colour }}
                  />
                </div>
              );
            })}
          </div>

          {/* the bar was unreadable without this: a coloured block with a bare percentage
              under it names nothing, so every segment gets its factor and its two numbers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(178px,1fr))", gap: 2, marginTop: 10 }}>
            {weighted.map((f, i) => (
              <div key={f.key} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 0" }}>
                <span style={{ width: 10, height: 10, flex: "none", background: SEGMENT[i % SEGMENT.length], marginTop: 4 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>
                    {f.name.replace(/\s*[&/(].*$/, "")}
                  </span>
                  <span className="num" style={{ fontSize: 11.5, color: f.score === 0 ? "var(--brand)" : "var(--meta)" }}>
                    {f.score === 0
                      ? `0 of ${Math.round((f.weight ?? 0) * 100)} points`
                      : `${Math.round(((f.weight ?? 0) * 100 * f.score) / 100)} of ${Math.round((f.weight ?? 0) * 100)} points`}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--meta)", marginTop: 12, maxWidth: "80ch" }}>
            Segment width is what the factor is worth. Filled is what this page earned of it. The unfilled part is the
            points on the table.
            {gate && gate.score === 0 && (
              <strong style={{ color: "var(--brand)" }}> Crawlability failed, which zeroes the whole score whatever the rest says.</strong>
            )}
          </p>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div className="m" style={{ color: "var(--meta)" }}>CITABILITY SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span
              className="num"
              style={{ fontSize: 58, fontWeight: 700, lineHeight: 1, color: summary.overall < 40 ? "var(--brand)" : "var(--ink)" }}
            >
              {summary.overall}
            </span>
            <span className="num" style={{ fontSize: 13, color: "var(--meta)" }}>/100</span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8, color: summary.overall < 40 ? "var(--brand)" : "var(--ink)" }}>
            {GRADE_MEANS[summary.grade] ?? summary.grade}
          </p>
          <button className="btn btn--primary" style={{ marginTop: 16, width: "100%" }} onClick={onFixes} disabled={busy !== null}>
            {busy === "fixes" ? "Writing the rewrites…" : hasFixes ? "Fix plan ready" : "Write the fix plan"}
          </button>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--meta)", marginTop: 10 }}>
            Turns every unfilled segment above into a before and after rewrite you can paste.
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* ---------------- header ---------------- */}
      <div className="sec" style={{ paddingTop: 52 }}>
        <div className="kicker" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span>{mode === "live" ? "LIVE FETCH" : "BUNDLED DEMO PAGE"}</span>
          <span style={{ color: "var(--meta)" }}>{url}</span>
        </div>

        <h1 className="h1" style={{ maxWidth: "20ch", marginTop: 26 }}>
          {summary ? HEADLINE[summary.grade] : "Reading the page the way an engine does."}
        </h1>

        {summary && (
          <p className="lede" style={{ maxWidth: "58ch", marginTop: 22 }}>
            {summary.checks} checks ran against the real text in {summary.totalMs} ms.{" "}
            {summary.zeros > 0 && (
              <>
                {summary.zeros} factors returned zero and they carry {summary.lostWeight}% of the weight.
              </>
            )}
          </p>
        )}
      </div>

      {summary && <ScoreBudget summary={summary} factors={factors} busy={busy} onFixes={onFixes} hasFixes={hasFixes} />}

      {/* ---------------- the trace: proof of work ---------------- */}
      <div className="sec">
        <h2 className="h2">Every check that ran</h2>
        <p className="lede" style={{ maxWidth: "64ch", marginTop: 14, marginBottom: 26 }}>
          What each check looked at, how long it took, and what it scored. Click a row to read the exact text it
          pulled off the page.
        </p>

        <div className="trace">
          <div
            className="tr"
            style={{ borderBottom: "1px solid var(--rule)", paddingTop: 0, paddingBottom: 12 }}
          >
            <span className="tr__i" />
            <span className="tr__i">CHECK</span>
            <span className="tr__i">WHAT IT INSPECTED</span>
            <span className="tr__i" style={{ textAlign: "right" }}>
              TIME
            </span>
            <span className="tr__i" style={{ textAlign: "right" }}>
              SCORE
            </span>
          </div>

          {trace.map((t, i) =>
            t.type === "check" ? (
              <div className="tr" key={`c${i}`}>
                <span className="tr__i">{String(i + 1).padStart(2, "0")}</span>
                <span className="tr__name">{t.name}</span>
                <span className="tr__what">{t.what}</span>
                <span className="tr__ms">{t.ms} ms</span>
                <span className="tr__sc" style={{ color: "var(--go)", fontSize: 18 }}>
                  ok
                </span>
              </div>
            ) : null,
          )}

          {factors.map((f, i) => {
            const isOpen = open === f.key;
            return (
              <div key={f.key}>
                <button
                  className={`tr${f.score === 0 ? " tr--zero" : ""}`}
                  onClick={() => setOpen(isOpen ? null : f.key)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isOpen ? "rgba(236,235,231,.045)" : "transparent",
                    border: 0,
                    borderBottom: "1px solid var(--rule-soft)",
                    cursor: "pointer",
                  }}
                >
                  <span className="tr__i">{String(trace.filter((t) => t.type === "check").length + i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="tr__name" style={{ display: "block" }}>
                      {f.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        letterSpacing: 1.1,
                        textTransform: "uppercase",
                        color: "var(--meta)",
                        display: "block",
                        paddingTop: 5,
                      }}
                    >
                      {f.gate ? "BINARY GATE" : `WEIGHT ${Math.round((f.weight ?? 0) * 100)}%`}
                      {f.partial ? " · PARTIAL" : ""}
                    </span>
                  </span>
                  <span className="tr__what">{f.inspected}</span>
                  <span className="tr__ms">{f.ms} ms</span>
                  <span className="tr__sc">{f.score}</span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      borderBottom: "1px solid var(--rule-soft)",
                      padding: "22px 0 30px",
                      display: "grid",
                      gridTemplateColumns: "26px minmax(0,250px) minmax(0,1fr)",
                      gap: 28,
                    }}
                  >
                    <span />
                    <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5, color: "var(--ink)" }}>
                      {MEASURES[f.key] ?? f.reasoning}
                    </p>
                    <div>
                      <div className="kicker" style={{ color: "var(--meta)", marginBottom: 12 }}>
                        TEXT PULLED OFF THE PAGE
                      </div>
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 11 }}>
                        {f.evidence.map((e, j) => (
                          <li
                            key={j}
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 13,
                              lineHeight: 1.75,
                              color: "var(--ink)",
                              borderLeft: `2px solid ${f.score === 0 ? "var(--red)" : "var(--rule)"}`,
                              paddingLeft: 14,
                            }}
                          >
                            {e}
                          </li>
                        ))}
                      </ul>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11.5,
                          lineHeight: 1.7,
                          color: "var(--meta)",
                          marginTop: 18,
                        }}
                      >
                        WEIGHTED FROM · {f.source}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
