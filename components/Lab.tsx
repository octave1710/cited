"use client";

import type { Run } from "../lib/types";

const STATUS: Record<string, { label: string; color: string }> = {
  cited: { label: "cited", color: "var(--go)" },
  paraphrased: { label: "used, not credited", color: "var(--amber)" },
  absent: { label: "absent", color: "var(--red)" },
};

export function LabPanel({
  run,
  busy,
  onRunLab,
  onRetest,
}: {
  run: Run;
  busy: string | null;
  onRunLab: () => void;
  onRetest: () => void;
}) {
  const lab = run.lab;
  const retest = run.retest;

  return (
    <div style={{ paddingBottom: 120 }}>
      <div className="sec" style={{ paddingTop: 52 }}>
        <div className="kicker" style={{ color: "var(--meta)" }}>
          STEP 5 · THE ONLY MEASUREMENT THAT SETTLES IT
        </div>
        <h1 className="h1" style={{ maxWidth: "19ch", marginTop: 24 }}>
          {retest ? "The same page, re-tested." : "Does an engine actually quote this page?"}
        </h1>
        <p className="lede" style={{ maxWidth: "62ch", marginTop: 22 }}>
          The score is a model. This is the measurement: we hand the page to a live answer engine alongside two
          competing sources and read which one it credits. Then we apply the fixes and ask again.
        </p>

        <div style={{ display: "flex", gap: 14, marginTop: 30, flexWrap: "wrap" }}>
          <button className="btn btn--primary" onClick={onRunLab} disabled={busy !== null}>
            {busy === "querylab" ? "Asking the engine…" : lab ? "Run the test again" : "Test citations now"}
          </button>
          <button className="btn" onClick={onRetest} disabled={busy !== null || !lab}>
            {busy === "retest" ? "Applying and re-testing…" : "Apply the fixes and re-test"}
          </button>
        </div>
      </div>

      {lab && (
        <div className="sec">
          {retest && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 30,
                marginBottom: 40,
                flexWrap: "wrap",
              }}
            >
              <span className="h1" style={{ fontSize: 116, color: "var(--meta)" }}>
                {lab.citedCount}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 26 }}>→</span>
              <span className="h1" style={{ fontSize: 116, color: "var(--go)" }}>
                {retest.citedCount}
                <span style={{ fontSize: 42, color: "var(--meta)" }}>/{retest.total}</span>
              </span>
              <span className="lede" style={{ maxWidth: "26ch", paddingBottom: 14 }}>
                queries citing the page, before and after the fixes. Same engine, same competitors.
              </span>
            </div>
          )}

          <div className="trace">
            <div className="tr" style={{ gridTemplateColumns: "26px minmax(0,1fr) 190px 190px", paddingTop: 0 }}>
              <span className="tr__i" />
              <span className="tr__i">STRATEGIC QUERY</span>
              <span className="tr__i">BEFORE</span>
              <span className="tr__i">AFTER FIXES</span>
            </div>
            {lab.verdicts.map((v, i) => {
              const a = retest?.verdicts[i];
              return (
                <div key={v.query.id} className="tr" style={{ gridTemplateColumns: "26px minmax(0,1fr) 190px 190px" }}>
                  <span className="tr__i">{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>{v.query.text}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: STATUS[v.status].color }}>
                    {STATUS[v.status].label}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: a ? STATUS[a.status].color : "var(--meta)" }}>
                    {a ? STATUS[a.status].label : "not run yet"}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="lede" style={{ marginTop: 22, maxWidth: "70ch" }}>
            Engine: {lab.llm}. Competing sources: {lab.competitors.join(", ")}.
          </p>
        </div>
      )}

      {(run.applied?.length || run.skipped?.length) && (
        <div className="sec">
          <h2 className="h2">What the re-test actually changed</h2>
          <p className="lede" style={{ maxWidth: "64ch", marginTop: 14, marginBottom: 24 }}>
            Structural fixes are applied automatically. Anything that needs a fact stays untouched unless the client
            supplied that fact, which is why the skipped list matters as much as the applied one.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 44 }}>
            <div>
              <div className="kicker" style={{ color: "var(--go)", marginBottom: 14 }}>
                APPLIED · {run.applied?.length ?? 0}
              </div>
              {(run.applied ?? []).map((a, i) => (
                <div key={i} style={{ borderTop: "1px solid var(--rule-soft)", padding: "13px 0" }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7, marginTop: 5 }}>{a.how}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="kicker" style={{ color: "var(--red)", marginBottom: 14 }}>
                REFUSED OR SKIPPED · {run.skipped?.length ?? 0}
              </div>
              {(run.skipped ?? []).map((s, i) => (
                <div key={i} style={{ borderTop: "1px solid var(--rule-soft)", padding: "13px 0" }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7, marginTop: 5 }}>{s.why}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
