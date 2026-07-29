"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "../../components/Chrome";
import { NODES, type MarketPlan, type PipelineRun } from "../../pipeline/nodes";
import { Rail, type RailLane } from "../../components/Rail";
import { Entity, Label, Num, Panel, Section, Verdict, useEntry } from "../../components/da";

/** The markets this run asks for. Sent to the API and drawn as lanes before it answers. */
const MARKETS = ["UK", "SE", "DK"];
/** Mirrors MIN_SCORE in pipeline/run.ts, which is server-only and cannot be imported here. */
const SCORE_FLOOR = 55;

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
        body: JSON.stringify({ topic, markets: MARKETS }),
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

  const approvers = new Map((run?.decisions ?? []).map((d) => [d.market, d.approvedBy]));
  const markets = run?.markets ?? MARKETS;
  const pending = markets.filter((m) => !approvers.has(m));

  // one lane per market, carrying the name the API stored rather than a boolean
  const lanes: RailLane[] = markets.map((m) => {
    const plan = run?.plans.find((p) => p.market === m);
    return { market: m, term: plan?.term, score: plan?.score, approvedBy: approvers.get(m) };
  });

  const railNodes = NODES.map((n) => ({
    id: n.id,
    label: n.label,
    what: n.what,
    state: run ? run.nodes[n.id].state : ("queued" as const),
    note: run?.nodes[n.id].note,
    error: run?.nodes[n.id].error,
  }));

  const failed = run ? NODES.find((n) => run.nodes[n.id].state === "failed") : undefined;
  const headline = !run
    ? "Seven nodes, and node six is a wall."
    : failed
      ? "The run refused to guess, so it stopped where the data ran out."
      : run.output
        ? "Every market carries a name. The pages are written, and still not published."
        : pending.length === markets.length
          ? "Nothing here can publish. No market carries a name yet."
          : pending.length === 1
            ? `${pending[0]} still carries no name, so nothing in it can publish.`
            : `${pending.join(" and ")} carry no names, so those lanes stay shut.`;

  /* the gate cards, the CMS panels and the trace rows had no arrival motion at all */
  const pageRef = useRef<HTMLDivElement>(null);
  useEntry([run?.id, run?.plans.length, run?.output?.length, busy], pageRef);

  return (
    <div ref={pageRef} style={{ minHeight: "100vh" }}>
      <TopBar runId={run?.id} />

      <div className="gut rule-b" style={{ paddingTop: 22, paddingBottom: 20, background: "var(--s1)" }}>
        <div className="bar shell">
          <input className="field" style={{ flex: "1 1 420px" }} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic" />
          <Label>{MARKETS.join(" · ")}</Label>
          <button className="btn btn--primary" onClick={start} disabled={busy !== null}>
            {busy === "run" ? "Running…" : "Run the pipeline"}
          </button>
          <a className="btn btn--ghost" href="/">Back to the audit</a>
        </div>
      </div>

      {brief && (
        <div className="gut" style={{ borderBottom: "1px solid var(--line)", paddingTop: 14, paddingBottom: 14, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
          <Label tone="brand">BRIEFED FROM THE MAP</Label>
          <span style={{ fontSize: 16.5 }}>{brief}</span>
        </div>
      )}

      {/* the refusal is the product, so the API's own words stay on screen while you scroll */}
      {error && (
        <div
          className="gut"
          style={{
            background: "rgba(255,92,61,.09)",
            borderBottom: "1px solid var(--brand)",
            paddingTop: 16,
            paddingBottom: 16,
            display: "flex",
            gap: 16,
            alignItems: "baseline",
            flexWrap: "wrap",
            position: "sticky",
            top: "var(--bar-h)",
            zIndex: 45,
          }}
        >
          <Label tone="brand">REFUSED BY THE API</Label>
          <span style={{ fontSize: 16.5, fontWeight: 500 }}>{error}</span>
        </div>
      )}

      <div className="gut shell" style={{ paddingBottom: 140 }}>
        <div style={{ paddingTop: 48 }}>
          <Verdict
            meta={`PART B · MULTI-MARKET CONTENT ENGINE · ${NODES.length} NODES · ${markets.length} MARKETS${run ? ` · RUN ${run.id.toUpperCase()}` : " · NOTHING RUN YET"}`}
            headline={headline}
            lede={
              <>
                Grounding, brief, draft, score, adaptation. Then <code style={{ fontFamily: "var(--mono)", fontSize: 16.5 }}>publish()</code> throws
                unless every market carries a named human decision, and the route answers <Num size={15}>409</Num>. That refusal lives in the
                domain logic, not on this screen.
              </>
            }
          />
        </div>

        {/* the device */}
        <Section>
          <Rail nodes={railNodes} lanes={lanes} wallId="gate" scoreFloor={SCORE_FLOOR} />
        </Section>

        {run && run.plans.length > 0 && !run.output && (
          <Section>
            <div style={{ marginBottom: 20 }}>
              <Label>THE GATE · ONE NAMED DECISION PER MARKET</Label>
            </div>
            <div data-row style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 2 }}>
              {run.plans.map((p) => (
                <MarketGate
                  key={p.market}
                  plan={p}
                  approver={approvers.get(p.market)}
                  name={names[p.market] ?? ""}
                  busy={busy !== null}
                  onName={(v) => setNames({ ...names, [p.market]: v })}
                  onSign={(approvedBy) => act("approve", { market: p.market, approvedBy })}
                />
              ))}
            </div>
          </Section>
        )}

        {run && !run.output && run.plans.length > 0 && (
          <Section>
            <Panel accent="var(--brand)" style={{ padding: "26px 28px" }}>
              <div style={{ display: "flex", gap: 30, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 440px" }}>
                  <Entity size={30} style={{ display: "block" }}>Try to publish with the names missing.</Entity>
                  <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 12, maxWidth: "62ch" }}>
                    This hits the same endpoint a CMS would. It fails while any market is unsigned, and it fails in the
                    domain logic rather than behind a disabled button.
                  </p>
                </div>
                <button className="btn" onClick={() => act("publish")} disabled={busy !== null}>
                  {busy === "publish" ? "Calling…" : "Attempt the publish"}
                </button>
              </div>
            </Panel>
          </Section>
        )}

        {run?.output && (
          <Section>
            <div style={{ marginBottom: 20 }}>
              <Label tone="d2">CMS OUTPUT · WRITTEN, HANDED OVER, NEVER PUSHED</Label>
            </div>
            {run.output.map((o) => (
              <Panel key={o.market} accent="var(--d2)" style={{ marginBottom: 2, padding: "22px 24px" }}>
                <div style={{ display: "flex", gap: 20, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Entity size={30}>{o.market}</Entity>
                  <span style={{ fontSize: 16.5 }}>{o.metadata.approvedBy}</span>
                  <Label tone="d2">SIGNED OFF</Label>
                  <Label tone="d1">{o.metadata.status.toUpperCase()}</Label>
                </div>
                <pre
                  style={{
                    background: "var(--void)",
                    borderLeft: "2px solid var(--d2)",
                    padding: "12px 16px",
                    marginTop: 16,
                    fontFamily: "var(--mono)",
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    overflow: "auto",
                    maxHeight: 220,
                  }}
                >
                  {o.markdown}
                </pre>
                <div style={{ marginTop: 14 }}>
                  <Label>HREFLANG PROPOSED, NEVER DEPLOYED</Label>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.9, marginTop: 6, color: "var(--ink)", overflowX: "auto" }}>
                    {o.hreflang.map((h, j) => (
                      <div key={j} style={{ whiteSpace: "nowrap" }}>{h}</div>
                    ))}
                  </div>
                </div>
              </Panel>
            ))}
          </Section>
        )}

        {run && run.trace.length > 0 && (
          <Section>
            <div style={{ marginBottom: 6 }}>
              <Label>DECISION TRACE · EVERY CLAIM AND THE ROW IT CAME FROM</Label>
            </div>
            <div style={{ marginTop: 18, borderTop: "1px solid var(--line-strong)" }}>
              {run.trace.map((t, i) => (
                <div
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--line)",
                    padding: "14px 0",
                    display: "grid",
                    gridTemplateColumns: "132px minmax(0,1fr) minmax(0,1fr)",
                    gap: 24,
                    alignItems: "baseline",
                  }}
                >
                  <Label>{t.step.toUpperCase()}</Label>
                  <span style={{ fontSize: 16.5, lineHeight: 1.45, fontVariantNumeric: "tabular-nums" }}>{t.claim}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 16, lineHeight: 1.6, color: "var(--ink)" }}>{t.source}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/**
 * One market's gate. The evidence the decision rests on, then the only control that
 * opens the lane. The unsigned button is kept on purpose: it demonstrates that an
 * anonymous approval is refused by the API rather than by this form.
 */
function MarketGate({
  plan,
  approver,
  name,
  busy,
  onName,
  onSign,
}: {
  plan: MarketPlan;
  approver?: string;
  name: string;
  busy: boolean;
  onName: (v: string) => void;
  onSign: (approvedBy: string) => void;
}) {
  const signed = (approver ?? "").trim().length > 0;
  return (
    <Panel accent={signed ? "var(--d2)" : "var(--brand)"} style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
        <Entity size={32}>{plan.market}</Entity>
        <Label tone={signed ? "d2" : "brand"}>{signed ? "LANE OPEN" : "LANE HELD SHUT"}</Label>
      </div>

      <p style={{ fontSize: 16.5, lineHeight: 1.35, marginTop: 10 }}>{plan.term}</p>

      <div style={{ display: "flex", gap: 28, marginTop: 18, flexWrap: "wrap" }}>
        <span>
          <span style={{ display: "block" }}>
            <Num size={15}>{plan.monthlyVolume.toLocaleString("en-US")}</Num>
          </span>
          <span style={{ display: "block", marginTop: 5 }}>
            <Label>SEARCHES A MONTH</Label>
          </span>
        </span>
        <span>
          <span style={{ display: "block" }}>
            <Num size={15} tone={plan.score >= SCORE_FLOOR ? "d2" : "brand"}>{plan.score}/100</Num>
          </span>
          <span style={{ display: "block", marginTop: 5 }}>
            <Label>DRAFT SCORE · {SCORE_FLOOR} IS THE FLOOR</Label>
          </span>
        </span>
      </div>

      <p style={{ fontSize: 16.5, lineHeight: 1.5, marginTop: 18, fontVariantNumeric: "tabular-nums" }}>{plan.groundingNote}</p>

      {/* the plagiarism and AI-detection half of the gate: measured, quoted, never a verdict */}
      {plan.originality && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "baseline", justifyContent: "space-between" }}>
            <Label tone={plan.originality.needsReview ? "d1" : "d2"}>
              OVERLAP WITH THE OTHER MARKETS
            </Label>
            <Num size={15} tone={plan.originality.needsReview ? "var(--d1)" : "var(--d2)"}>
              {Math.round(plan.originality.worstOverlap * 100)}%
            </Num>
          </div>
          <div style={{ marginTop: 8, height: 8, background: "var(--s2)", position: "relative" }}>
            <span
              data-meter
              style={{
                display: "block",
                height: 8,
                width: `${Math.min(100, Math.round(plan.originality.worstOverlap * 100))}%`,
                background: plan.originality.needsReview ? "var(--d1)" : "var(--d2)",
                transformOrigin: "left center",
              }}
            />
            {/* the review line, drawn, so the number has something to be measured against */}
            <span style={{ position: "absolute", left: "25%", top: -3, width: 2, height: 14, background: "var(--ink)" }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <Label>25% IS THE REVIEW LINE · 8-WORD SEQUENCES SHARED</Label>
          </div>
          {plan.originality.needsReview ? (
            plan.originality.reasons.map((r, j) => (
              <p key={j} style={{ fontSize: 16, lineHeight: 1.45, marginTop: 10, color: "var(--ink)" }}>{r}</p>
            ))
          ) : (
            <p style={{ marginTop: 10 }}>
              <Label tone="d2">
                WRITTEN INDEPENDENTLY OF THE OTHER MARKETS · {plan.originality.tells.length} UNEDITED PHRASES
              </Label>
            </p>
          )}
        </div>
      )}

      {plan.flags.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          {plan.flags.slice(0, 3).map((f, j) => (
            <div key={j} style={{ borderLeft: "2px solid var(--d1)", paddingLeft: 13, marginTop: 10 }}>
              <span style={{ display: "block" }}>
                <Label tone="d1">NEEDS HUMAN EYES</Label>
              </span>
              <span style={{ display: "block", fontSize: 16, lineHeight: 1.45, marginTop: 4 }}>{f.why}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <Label tone="d2">NO LINE IN THIS MARKET WAS FLAGGED</Label>
        </div>
      )}

      {signed ? (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <Label tone="d2">SIGNED BY</Label>
          <Entity size={21} style={{ display: "block", marginTop: 5 }}>{approver}</Entity>
        </div>
      ) : (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input
            className="field"
            style={{ width: "100%" }}
            placeholder="Who approves this market?"
            value={name}
            onChange={(e) => onName(e.target.value)}
            aria-label={`Approver for ${plan.market}`}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn btn--primary" disabled={busy || !name.trim()} onClick={() => onSign(name)}>
              Sign {plan.market}
            </button>
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => onSign("")}>
              Send it unsigned
            </button>
          </div>
          <p style={{ marginTop: 12 }}>
            <Label tone="brand">AN UNSIGNED APPROVAL IS REJECTED · HTTP 400</Label>
          </p>
        </div>
      )}
    </Panel>
  );
}
