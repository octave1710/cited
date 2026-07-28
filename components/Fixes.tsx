"use client";

import { useState } from "react";
import { needsSuppliedFact } from "../engine/fixes";
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
  const needSlots = fixes.filter((f) => needsSuppliedFact(f.after)).length;

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

      <FactSheet run={run} />
      <BundleBox run={run} />
    </div>
  );
}

/**
 * The refusals are the ceiling on every run, and until now nobody was ever asked to
 * lift it. This hands over one sheet with an empty answer column and takes it back
 * filled. A row left blank stays a visible empty slot on the page.
 */
function FactSheet({ run }: { run: Run }) {
  const [sheet, setSheet] = useState("");
  const [result, setResult] = useState<{ asked: number; answered: number; stillEmpty: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blocked = (run.fixes ?? []).filter((f) => needsSuppliedFact(f.after) || f.factorKey === "sourcedQuotes" || f.factorKey === "offSiteAuthority");
  if (!blocked.length) return null;

  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/facts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: sheet }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status}).`);
      setResult({ asked: j.asked, answered: j.answered, stillEmpty: j.stillEmpty });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rule-t" style={{ marginTop: 40, paddingTop: 28 }}>
      <h2 className="h2">{blocked.length} rewrites are waiting on you, not on us.</h2>
      <p className="lede" style={{ marginTop: 14, maxWidth: "64ch", fontSize: 17 }}>
        Sourced quotes carry 20% of the score and quantified specificity 18%, the two heaviest factors in the engine,
        and both need a fact this tool refuses to invent. The sheet quotes the sentence on your own page that each
        answer would replace.
      </p>

      <div style={{ display: "flex", gap: 14, marginTop: 22, alignItems: "center", flexWrap: "wrap" }}>
        <a className="btn btn--primary" href={`/api/bundle?run=${encodeURIComponent(run.id)}`} download>
          Get facts-needed.csv
        </a>
        <span className="m-sm meta">IN THE BUNDLE, ONE ROW PER REFUSAL</span>
      </div>

      <textarea
        className="field"
        value={sheet}
        onChange={(e) => setSheet(e.target.value)}
        placeholder="Paste the filled sheet back here, header row included"
        aria-label="Filled fact sheet"
        style={{ width: "100%", height: 120, marginTop: 20, padding: 14, lineHeight: 1.6, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 14, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={upload} disabled={busy || !sheet.trim()}>
          {busy ? "Reading…" : "Load the answers"}
        </button>
        {result && (
          <span style={{ fontSize: 16 }}>
            {result.answered} of {result.asked} answered.{" "}
            {result.stillEmpty > 0 ? (
              <span style={{ color: "var(--red)" }}>{result.stillEmpty} stay empty on the page.</span>
            ) : (
              <span style={{ color: "var(--go)" }}>Nothing is left blank.</span>
            )}{" "}
            Re-run the apply and re-test to use them.
          </span>
        )}
        {error && <span style={{ fontSize: 16, color: "var(--red)" }}>{error}</span>}
      </div>
    </div>
  );
}

/**
 * The audit produced deployable files and had no way to hand them over: the only
 * download link in the whole product pointed at the map. The list is rendered from
 * what this run actually holds, so a thin bundle is visibly thin instead of a surprise.
 */
export function BundleBox({ run }: { run: Run }) {
  const files: [boolean, string, string][] = [
    [Boolean(run.fixedHtml), "corrected.html", "your page with the structural fixes applied"],
    [Boolean(run.schema?.blocks?.length), "schema.jsonld", "paste into a script tag in the head"],
    [Boolean(run.access?.patch), "robots-patch.txt", "append to robots.txt to unblock the engines"],
    [Boolean(run.fixes?.length), "fix-plan.csv", "every rewrite, ranked, with the refusals marked"],
  ];
  const ready = files.filter(([has]) => has);
  if (!ready.length) return null;

  return (
    <div className="rule-t" style={{ marginTop: 40, paddingTop: 28 }}>
      <h2 className="h2">Take the files, not the report.</h2>
      <div style={{ display: "flex", gap: 40, marginTop: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>
          {files.map(([has, name, what]) => (
            <div
              key={name}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "baseline",
                padding: "10px 0",
                borderBottom: "1px solid var(--rule-soft)",
              }}
            >
              <span style={{ width: 9, height: 9, flex: "none", background: has ? "var(--go)" : "transparent", border: has ? "none" : "1px solid var(--rule)" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: has ? "var(--ink)" : "var(--meta)" }}>{name}</span>
              <span style={{ fontSize: 15, color: has ? "var(--ink)" : "var(--meta)" }}>
                {has ? what : "not produced by this run"}
              </span>
            </div>
          ))}
        </div>
        <a className="btn btn--primary" href={`/api/bundle?run=${encodeURIComponent(run.id)}`} download>
          Download {ready.length} file{ready.length > 1 ? "s" : ""}
        </a>
      </div>
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
