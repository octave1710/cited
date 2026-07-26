"use client";

import { useState } from "react";
import type { Run } from "../lib/types";

/** Bracketed slots are the facts CITED refuses to invent. Render them as visible holes. */
function withSlots(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((p, i) =>
    /^\[[^\]]+\]$/.test(p) ? (
      <span
        key={i}
        style={{
          color: "var(--red)",
          border: "1px dashed var(--red)",
          padding: "1px 6px",
          margin: "0 3px",
          whiteSpace: "nowrap",
        }}
      >
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function FixesPanel({ run, busy, onSchema }: { run: Run; busy: string | null; onSchema: () => void }) {
  const fixes = run.fixes ?? [];
  const needSlots = fixes.filter((f) => /\[[A-Z]/.test(f.after)).length;

  return (
    <div style={{ padding: "40px 0 72px" }} className="gut">
      <h1 className="d" style={{ fontSize: "clamp(40px,4vw,64px)", maxWidth: "18ch" }}>
        {fixes.length} rewrites, ranked by what they buy you.
      </h1>
      <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.5, maxWidth: "62ch", marginTop: 18 }}>
        Priority is impact times ease, impact coming from the weight of the factor it repairs.{" "}
        {needSlots > 0 && (
          <>
            {needSlots} of them stop at a bracket: CITED writes the sentence, it will not invent the figure, the source
            or the name that belongs inside it.
          </>
        )}
      </p>

      <div style={{ marginTop: 38, display: "flex", flexDirection: "column", gap: 2 }}>
        {fixes.map((f, i) => (
          <FixCard key={i} fix={f} rank={i + 1} big={i === 0} />
        ))}
      </div>

      <div className="rule-t" style={{ marginTop: 34, paddingTop: 26, display: "flex", gap: 14, alignItems: "center" }}>
        <button className="btn" onClick={onSchema} disabled={busy !== null}>
          {busy === "schema" ? "Generating…" : run.schema ? "Structured data ready" : "Generate the structured data"}
        </button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>
          Valid JSON-LD built from this page&apos;s own content. Weighted at 1% on purpose.
        </span>
      </div>

      {run.schema && <SchemaBlock run={run} />}
    </div>
  );
}

function FixCard({ fix, rank, big }: { fix: Run["fixes"] extends (infer F)[] | undefined ? F : never; rank: number; big: boolean }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--rule)",
        padding: big ? "28px 0" : "20px 0",
        display: "grid",
        gridTemplateColumns: "minmax(0,300px) minmax(0,1fr)",
        gap: 44,
        alignItems: "start",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span className="d" style={{ fontSize: big ? 40 : 26, color: "var(--red)" }}>
            {fix.priority}
          </span>
          <span className="m-sm meta">PRIORITY</span>
        </div>
        <h3
          className="d"
          style={{ fontSize: big ? 30 : 22, marginTop: 8, color: "var(--ink)", textTransform: "none", fontStyle: "normal" }}
        >
          {fix.title}
        </h3>
        <div className="m-sm meta" style={{ marginTop: 10 }}>
          IMPACT {fix.impact}/5 · EFFORT {fix.effort}/5 · {fix.factorKey.toUpperCase()}
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 13,
            lineHeight: 1.8,
            display: "grid",
            gridTemplateColumns: "18px 1fr",
            gap: "0 10px",
          }}
        >
          <span style={{ color: "var(--red)" }}>−</span>
          <span style={{ color: "var(--ink)", textDecoration: "line-through", textDecorationColor: "rgba(255,59,59,.6)" }}>
            {fix.before}
          </span>
          <span style={{ color: "var(--go)", paddingTop: 6 }}>+</span>
          <span style={{ color: "var(--ink)", paddingTop: 6 }}>{withSlots(fix.after)}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 12, maxWidth: "76ch", opacity: 0.86 }}>
          {fix.rationale}
        </div>
      </div>
    </div>
  );
}

function SchemaBlock({ run }: { run: Run }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(run.schema?.blocks ?? [], null, 2);

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span className="m-sm meta">GENERATED JSON-LD</span>
        <button
          className="btn btn--sm btn--ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(json);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          background: "#030303",
          border: "1px solid var(--rule)",
          padding: 18,
          fontFamily: "var(--mono)",
          fontSize: 12,
          lineHeight: 1.7,
          color: "var(--ink)",
          maxHeight: 320,
          overflow: "auto",
        }}
      >
        {json}
      </pre>
      {(run.schema?.warnings ?? []).map((w, i) => (
        <div key={i} style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)", marginTop: 8 }}>
          ↳ {w}
        </div>
      ))}
    </div>
  );
}
