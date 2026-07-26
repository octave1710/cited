"use client";

import { useState } from "react";
import { FACTORS } from "../engine/weights.config";
import type { Run } from "../lib/types";

/** One plain-language line per factor. A number with no meaning is reporting. */
const MEASURES: Record<string, string> = {
  crawlability: "Whether answer-engine bots can read the page at all. Nothing else counts until this passes.",
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

const SHORT: Record<string, string> = {
  crawlability: "Crawl",
  answerStructure: "Answer-first",
  sourcedQuotes: "Quotes",
  factualSpecificity: "Figures",
  freshness: "Freshness",
  offSiteAuthority: "Authority",
  fanoutCoverage: "Fan-out",
  googleRank: "Rank",
  schemaValidity: "Schema",
};

export function AuditPanel({
  run,
  busy,
  onFixes,
}: {
  run: Run;
  busy: string | null;
  onFixes: () => void;
}) {
  const audit = run.audit;
  const [selected, setSelected] = useState<string>("sourcedQuotes");
  if (!audit) return null;

  const byKey = new Map(audit.factors.map((f) => [f.key, f]));
  const gate = byKey.get("crawlability");
  const detail = byKey.get(selected) ?? gate;
  const cfg = FACTORS.find((c) => c.key === selected);

  return (
    <div style={{ padding: "40px 0 72px" }} className="gut">
      {/* ---- verdict: the number, and the action it unlocks ---- */}
      <h1 className="d" style={{ fontSize: "clamp(40px,4vw,64px)", maxWidth: "16ch" }}>
        {HEADLINE[audit.grade] ?? "Audit complete."}
      </h1>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 40, marginTop: 26, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            className="d"
            style={{ fontSize: 128, lineHeight: 0.78, color: audit.overall < 40 ? "var(--red)" : "var(--ink)" }}
          >
            {audit.overall}
          </span>
          <span className="m meta" style={{ fontSize: 15 }}>
            /100
          </span>
        </div>

        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 500, maxWidth: "34ch", lineHeight: 1.4 }}>
            Weighted across nine factors. {audit.factors.filter((f) => f.score === 0).length} of them return zero, and
            they carry{" "}
            {Math.round(
              audit.factors
                .filter((f) => f.score === 0)
                .reduce((s, f) => s + (FACTORS.find((c) => c.key === f.key)?.weight ?? 0), 0) * 100,
            )}
            % of the total weight.
          </div>
          <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={onFixes} disabled={busy !== null}>
            {busy === "fixes" ? "Writing…" : run.fixes ? "Fix plan ready ↓" : "Generate the fix plan"}
          </button>
        </div>

        {gate && (
          <div style={{ paddingBottom: 8, marginLeft: "auto" }}>
            <div className="m-sm meta">CRAWLABILITY GATE</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--mono)",
                fontSize: 13,
                color: gate.score === 100 ? "var(--go)" : "var(--red)",
                border: `1px solid ${gate.score === 100 ? "var(--go)" : "var(--red)"}`,
                padding: "8px 12px",
                display: "inline-block",
              }}
            >
              {gate.score === 100 ? "PASSED · bots can read it" : "FAILED · bots cannot read it"}
            </div>
          </div>
        )}
      </div>

      {/* ---- the weight bar: width = weight, fill = score. not a list of rows ---- */}
      <div style={{ marginTop: 54 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 14 }}>
          <h2 className="d" style={{ fontSize: 26 }}>
            Where the score comes from
          </h2>
          <span style={{ fontSize: 15, fontWeight: 500 }}>
            Each block is as wide as the weight it carries. Click one to read its evidence.
          </span>
        </div>

        {/* scores sit above the bar in full ink: never text laid over its own fill */}
        <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
          {FACTORS.map((c) => {
            const score = byKey.get(c.key)?.score ?? 0;
            return (
              <span
                key={c.key}
                style={{ flex: `${c.weight} 1 0`, minWidth: 0, overflow: "hidden" }}
                className="d"
              >
                <span style={{ fontSize: 22, color: score === 0 ? "var(--red)" : "var(--ink)" }}>{score}</span>
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 3, height: 150, alignItems: "flex-end" }}>
          {FACTORS.map((c) => {
            const score = byKey.get(c.key)?.score ?? 0;
            const isSel = selected === c.key;
            const zero = score === 0;
            return (
              <button
                key={c.key}
                onClick={() => setSelected(c.key)}
                title={`${c.name} · weight ${(c.weight * 100).toFixed(0)}% · score ${score}`}
                style={{
                  flex: `${c.weight} 1 0`,
                  height: "100%",
                  position: "relative",
                  border: 0,
                  outline: isSel ? "2px solid var(--ink)" : "none",
                  outlineOffset: 2,
                  cursor: "pointer",
                  padding: 0,
                  minWidth: 0,
                  background: "var(--rule-soft)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${Math.max(score, 2)}%`,
                    background: zero ? "var(--red)" : "var(--ink)",
                    transition: "height .5s cubic-bezier(.16,1,.3,1)",
                  }}
                />
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 3, marginTop: 9 }}>
          {FACTORS.map((c) => (
            <span key={c.key} style={{ flex: `${c.weight} 1 0`, minWidth: 0, overflow: "hidden" }} className="m-sm">
              <span style={{ color: "var(--ink)" }}>{(c.weight * 100).toFixed(0)}%</span>
              {/* narrow blocks would clip their name; the tooltip and the panel below carry it */}
              {c.weight >= 0.08 && (
                <span
                  style={{
                    display: "block",
                    color: selected === c.key ? "var(--ink)" : "var(--meta)",
                    whiteSpace: "nowrap",
                    fontSize: 10,
                    paddingTop: 3,
                  }}
                >
                  {SHORT[c.key]}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ---- the selected factor, with its receipt ---- */}
      {detail && (
        <div className="rule-t" style={{ marginTop: 40, paddingTop: 30 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,360px) minmax(0,1fr)", gap: 52 }}>
            <div>
              <h3 className="d" style={{ fontSize: 38, color: detail.score === 0 ? "var(--red)" : "var(--ink)" }}>
                {detail.name.replace(/\s*\(.*\)$/, "")}
              </h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 14 }}>
                <span className="d" style={{ fontSize: 46, color: detail.score === 0 ? "var(--red)" : "var(--ink)" }}>
                  {detail.score}
                </span>
                <span className="m-sm meta">
                  {cfg ? `WEIGHT ${(cfg.weight * 100).toFixed(0)}%` : "BINARY GATE"}
                </span>
              </div>
              <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.5, marginTop: 16 }}>
                {MEASURES[detail.key] ?? detail.reasoning}
              </p>
              {detail.partial && (
                <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginTop: 12, color: "var(--amber)" }}>
                  Scored on on-page proxies only. The full signal needs production data.
                </p>
              )}
            </div>

            <div>
              <div className="m-sm meta" style={{ marginBottom: 14 }}>
                EVIDENCE TAKEN FROM THE PAGE
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {detail.evidence.map((e, i) => (
                  <li
                    key={i}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      lineHeight: 1.75,
                      color: "var(--ink)",
                      borderLeft: `2px solid ${detail.score === 0 ? "var(--red)" : "var(--rule)"}`,
                      paddingLeft: 14,
                      maxWidth: "84ch",
                    }}
                  >
                    {e}
                  </li>
                ))}
              </ul>
              <div className="m-sm meta" style={{ marginTop: 20, maxWidth: "80ch", lineHeight: 1.7 }}>
                SOURCE · {cfg?.source ?? "Shepard/Zyppy meta-analysis, 54 studies, May 2026"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
