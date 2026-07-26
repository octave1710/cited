"use client";

import { useState } from "react";
import type { FactorEvent, TraceEvent } from "../lib/stream";

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

const HEADLINE: Record<string, string> = {
  invisible: "Answer engines skip this page.",
  "at-risk": "This page is barely quotable.",
  likely: "Close, but engines still prefer others.",
  cited: "This page is quotable.",
};

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

      {/* ---------------- score + action ---------------- */}
      {summary && (
        <div
          className="sec"
          style={{ display: "flex", alignItems: "flex-end", gap: 64, flexWrap: "wrap", paddingTop: 44 }}
        >
          <div>
            <div className="kicker" style={{ marginBottom: 14, color: "var(--meta)" }}>
              CITABILITY SCORE
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span
                className="h1"
                style={{
                  fontSize: 132,
                  lineHeight: 0.8,
                  color: summary.overall < 40 ? "var(--red)" : "var(--ink)",
                }}
              >
                {summary.overall}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--meta)" }}>/100</span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: summary.overall < 40 ? "var(--red)" : "var(--ink)",
                  border: `1px solid ${summary.overall < 40 ? "var(--red)" : "var(--ink)"}`,
                  padding: "7px 11px",
                  marginLeft: 12,
                }}
              >
                {summary.grade}
              </span>
            </div>
          </div>

          <div style={{ paddingBottom: 10 }}>
            <button className="btn btn--primary" onClick={onFixes} disabled={busy !== null}>
              {busy === "fixes" ? "Writing the rewrites…" : hasFixes ? "Fix plan ready" : "Write the fix plan"}
            </button>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--meta)", marginTop: 12 }}>
              NEXT STEP · TURNS THESE FINDINGS INTO REWRITES
            </div>
          </div>
        </div>
      )}

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
