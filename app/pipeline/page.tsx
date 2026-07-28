"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "../../components/Chrome";
import { NODES, type PipelineRun } from "../../pipeline/nodes";

/**
 * useSearchParams opts a client component out of static prerendering unless it sits
 * under a Suspense boundary, and the build fails outright without one.
 */
export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <PipelineScreen />
    </Suspense>
  );
}

function PipelineScreen() {
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [topic, setTopic] = useState("vitamin c serum");
  /**
   * The map's "Brief a page" button has always sent ?brief=<the question>. This page
   * never read it, so the user landed on the demo category and the question they
   * clicked was lost. It seeds the topic and stays on screen as the reason for the run.
   */
  const params = useSearchParams();
  const brief = params.get("brief")?.trim() ?? "";
  useEffect(() => {
    if (brief) setTopic(brief);
  }, [brief]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  async function start() {
    setBusy("run");
    setError(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, markets: ["UK", "SE", "DK"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRun(data.run);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function act(path: string, body?: unknown) {
    if (!run) return;
    setBusy(path);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${run.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRun(data.run);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const approved = new Set(run?.decisions.map((d) => d.market) ?? []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar engineMode="mock" profoundMode="mock" />

      {brief && (
        <div
          className="gut"
          style={{ borderBottom: "1px solid var(--rule)", paddingTop: 14, paddingBottom: 14, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}
        >
          <span className="m" style={{ color: "var(--red)" }}>BRIEFED FROM THE MAP</span>
          <span style={{ fontSize: 16.5 }}>{brief}</span>
        </div>
      )}

      <div className="gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--band)", borderBottom: "1px solid var(--rule)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="field" style={{ flex: "1 1 420px" }} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic" />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>UK · SE · DK</span>
          <button className="btn btn--primary" onClick={start} disabled={busy !== null}>
            {busy === "run" ? "Running…" : "Run the pipeline"}
          </button>
          <a className="btn btn--ghost" href="/">Back to the audit</a>
        </div>
      </div>

      {error && (
        <div className="gut" style={{ background: "rgba(255,59,59,.08)", borderBottom: "1px solid var(--red)", paddingTop: 16, paddingBottom: 16, display: "flex", gap: 16 }}>
          <span className="m" style={{ color: "var(--red)" }}>BLOCKED</span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{error}</span>
        </div>
      )}

      <div className="gut" style={{ maxWidth: 1500, paddingBottom: 120 }}>
        <div className="sec" style={{ paddingTop: 52 }}>
          <div className="kicker" style={{ color: "var(--meta)" }}>PART B · MULTI-MARKET CONTENT ENGINE</div>
          <h1 className="h1" style={{ maxWidth: "22ch", marginTop: 24 }}>
            Seven nodes, and one of them is a wall.
          </h1>
          <p className="lede" style={{ maxWidth: "64ch", marginTop: 22 }}>
            The pipeline grounds every market on the term that actually wins there, drafts, scores itself with the
            same nine factors as the audit, then stops. Publishing is impossible without a named human decision per
            market, and that refusal lives in the domain logic, not in this screen.
          </p>
        </div>

        {run && (
          <>
            <div className="sec trace">
              {NODES.map((n, i) => {
                const st = run.nodes[n.id];
                return (
                  <div key={n.id} className="tr" style={{ gridTemplateColumns: "26px minmax(0,240px) minmax(0,1fr) 130px" }}>
                    <span className="tr__i">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="tr__name" style={{ display: "block", color: st.state === "blocked" ? "var(--red)" : "var(--ink)" }}>
                        {n.label}
                      </span>
                      <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: "var(--meta)", paddingTop: 5 }}>
                        {st.state}
                      </span>
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: 15.5, fontWeight: 500 }}>{n.what}</span>
                      {(st.note || st.error) && (
                        <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7, paddingTop: 6, color: st.error ? "var(--red)" : "var(--ink)" }}>
                          {st.error ?? st.note}
                        </span>
                      )}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <i className={`dot dot--${st.state === "queued" ? "queued" : st.state}`} />
                    </span>
                  </div>
                );
              })}
            </div>

            {run.nodes.gate.state !== "done" && run.plans.length > 0 && (
              <div className="sec">
                <h2 className="h2" style={{ color: "var(--red)" }}>Human approval required</h2>
                <p className="lede" style={{ maxWidth: "60ch", marginTop: 14, marginBottom: 26 }}>
                  One decision per market, each carrying a name. Try the publish endpoint without them and it returns
                  409.
                </p>

                {run.plans.map((p) => (
                  <div key={p.market} style={{ borderTop: "1px solid var(--rule)", padding: "24px 0" }}>
                    <div style={{ display: "flex", gap: 22, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span className="h2" style={{ fontSize: 34 }}>{p.market}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{p.term}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--meta)" }}>
                        {p.monthlyVolume.toLocaleString("en-US")}/mo · draft scores {p.score}/100
                      </span>
                      {approved.has(p.market) && (
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--go)", border: "1px solid var(--go)", padding: "5px 9px" }}>
                          approved
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 16, fontWeight: 500, marginTop: 12, maxWidth: "80ch" }}>{p.groundingNote}</p>

                    {p.flags.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        {p.flags.map((f, j) => (
                          <div key={j} style={{ borderLeft: "2px solid var(--amber)", paddingLeft: 14, marginTop: 9, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7 }}>
                            <span style={{ color: "var(--amber)" }}>needs human eyes</span> · {f.why}
                          </div>
                        ))}
                      </div>
                    )}

                    {!approved.has(p.market) && (
                      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                        <input
                          className="field"
                          style={{ width: 280 }}
                          placeholder="Who approves this market?"
                          value={names[p.market] ?? ""}
                          onChange={(e) => setNames({ ...names, [p.market]: e.target.value })}
                          aria-label={`Approver for ${p.market}`}
                        />
                        <button
                          className="btn btn--primary"
                          disabled={busy !== null || !(names[p.market] ?? "").trim()}
                          onClick={() => act("approve", { market: p.market, approvedBy: names[p.market] })}
                        >
                          Approve {p.market}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ display: "flex", gap: 12, marginTop: 28, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => act("publish")} disabled={busy !== null}>
                    Try to publish without approving
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>
                    This is the demo of the refusal. It should fail while any market is pending.
                  </span>
                </div>
              </div>
            )}

            {run.output && (
              <div className="sec">
                <h2 className="h2" style={{ color: "var(--go)" }}>CMS output, ready but not published</h2>
                {run.output.map((o) => (
                  <div key={o.market} style={{ borderTop: "1px solid var(--rule)", padding: "22px 0" }}>
                    <div style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span className="h2" style={{ fontSize: 28 }}>{o.market}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>approved by {o.metadata.approvedBy}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)" }}>{o.metadata.status}</span>
                    </div>
                    <pre style={{ background: "#030303", border: "1px solid var(--rule)", padding: 16, marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7, overflow: "auto", maxHeight: 210 }}>
                      {o.markdown}
                    </pre>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8, marginTop: 10 }}>
                      {o.hreflang.map((h, j) => (
                        <div key={j}>{h}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="sec">
              <h2 className="h2">Decision trace</h2>
              <p className="lede" style={{ maxWidth: "62ch", marginTop: 14, marginBottom: 20 }}>
                Every recommendation the pipeline made, and the row it came from.
              </p>
              {run.trace.map((t, i) => (
                <div key={i} style={{ borderTop: "1px solid var(--rule-soft)", padding: "13px 0", display: "grid", gridTemplateColumns: "110px minmax(0,1fr) minmax(0,1fr)", gap: 24 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: "var(--meta)" }}>{t.step}</span>
                  <span style={{ fontSize: 15.5, fontWeight: 500 }}>{t.claim}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7 }}>{t.source}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
