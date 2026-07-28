"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { animate } from "motion";
import { EngineBoard } from "./EngineBoard";
import { ENGINES } from "../engines/types";
import type { PanelRun } from "../engines/types";
import type { Board } from "../engines/board";
import type { Teardown } from "../engines/why";
import { MARKETS } from "../citationmap/markets";

/**
 * The run screen. A topic goes in, five real answer engines come back with what they
 * actually cite.
 *
 * The order on screen is the order of the argument: the verdict first, in one sentence
 * anyone can repeat, then the board that proves it, then the questions behind it.
 */

interface Step {
  id: string;
  label: string;
  state: "queued" | "running" | "done" | "failed";
  note?: string;
}

const STEPS: Step[] = [
  { id: "questions", label: "Write the questions a buyer asks", state: "queued" },
  { id: "engines", label: "Put them to five answer engines", state: "queued" },
  { id: "board", label: "Count who each engine cites", state: "queued" },
];

export function PanelScreen() {
  const [topic, setTopic] = useState("vitamin C serum");
  const [market, setMarket] = useState("UK");
  const [brand, setBrand] = useState("theordinary.com");
  const [panelSize, setPanelSize] = useState(8);

  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [run, setRun] = useState<PanelRun | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [teardown, setTeardown] = useState<Teardown | null>(null);

  const go = useCallback(async () => {
    setBusy(true);
    setError(null);
    setRun(null);
    setBoard(null);
    setTeardown(null);
    setQuestions([]);
    setAsked([]);
    setSteps(STEPS.map((s) => ({ ...s, state: "queued", note: undefined })));

    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, market, brandDomain: brand, panelSize }),
      });
      if (!res.body) throw new Error("The server sent no stream.");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "step") setSteps((p) => p.map((s) => (s.id === e.id ? { ...s, state: e.state, note: e.note ?? s.note } : s)));
          if (e.type === "questions") setQuestions(e.questions);
          if (e.type === "panelQuestions") setAsked(e.questions);
          if (e.type === "engineProgress") setProgress(e.note ?? "");
          if (e.type === "done") {
            setRun(e.run);
            setBoard(e.board);
            setTeardown(e.teardown ?? null);
          }
          if (e.type === "error") throw new Error(e.error);
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setSteps((p) => p.map((s) => (s.state === "running" ? { ...s, state: "failed" } : s)));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }, [topic, market, brand, panelSize]);

  return (
    <div style={{ paddingBottom: 160 }}>
      <div className="rule-b gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--band)", position: "sticky", top: "var(--bar-h)", zIndex: 40 }}>
        <form className="bar" onSubmit={(e) => { e.preventDefault(); if (!busy) void go(); }}>
          <input className="field" style={{ flex: "1 1 300px" }} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="The category, in a buyer's words" aria-label="Topic" disabled={busy} />
          <input className="field" style={{ width: 220 }} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="yourbrand.com (optional)" aria-label="Your domain" disabled={busy} />
          <select className="field" style={{ width: 190 }} value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Market" disabled={busy}>
            {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
          <select className="field" style={{ width: 150 }} value={panelSize} onChange={(e) => setPanelSize(Number(e.target.value))} aria-label="Questions to ask the engines" disabled={busy}>
            {[4, 6, 8, 12, 16, 20].map((n) => <option key={n} value={n}>{n} to the engines</option>)}
          </select>
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Asking…" : "Run"}</button>
        </form>
        {busy && progress && (
          <div className="m-sm" style={{ color: "var(--d1)", marginTop: 10 }}>{progress.toUpperCase()}</div>
        )}
      </div>

      {error && (
        <div className="gut" style={{ background: "rgba(255,92,61,.09)", borderBottom: "1px solid var(--brand)", paddingTop: 16, paddingBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <span className="m" style={{ color: "var(--brand)" }}>FAILED</span>
          <span style={{ fontSize: 16.5, fontWeight: 500 }}>{error}</span>
        </div>
      )}

      <div className="gut shell">
        {!run && <Intro steps={steps} busy={busy} questions={questions} asked={asked} />}
        {run && board && <Result run={run} board={board} teardown={teardown} questions={questions} />}
      </div>
    </div>
  );
}

function Intro({ steps, busy, questions, asked }: { steps: Step[]; busy: boolean; questions: string[]; asked: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-engine]", { opacity: 0, y: 20, duration: 0.55, ease: "expo.out", stagger: 0.07, delay: 0.15 });
    }, ref);
    return () => ctx.revert();
  }, [busy, questions.length]);

  return (
    <div ref={ref} style={{ paddingTop: 72, display: "grid", gridTemplateColumns: "minmax(0,1fr) 480px", gap: 72, alignItems: "start" }}>
      <div>
        <h1 className="h1" style={{ maxWidth: "16ch" }}>
          Ask the engines. Not a model guessing.
        </h1>
        <p className="lede" style={{ marginTop: 24, maxWidth: "54ch" }}>
          Google AI Overview, Google AI Mode, Perplexity, ChatGPT and Gemini are each asked your
          category&apos;s questions, and every source they cite comes back with the answer.
        </p>

        <div style={{ display: "flex", gap: 44, marginTop: 52, flexWrap: "wrap" }}>
          <Stat n={ENGINES.length} label="ENGINES QUERIED LIVE" />
          <Stat n={5} label="SOURCES PER ANSWER, TYPICAL" />
          <Stat n={0} label="CITATIONS INVENTED" />
        </div>

        {/* the five engines, named, so the claim is concrete before anything runs */}
        {!busy && questions.length === 0 && (
          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 2 }}>
            {ENGINES.map((e, i) => (
              <div key={e.key} data-engine style={{ background: "var(--s1)", borderTop: "2px solid var(--d3)", padding: "18px 16px 22px" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--meta)" }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ fontFamily: "var(--display)", fontSize: 22, lineHeight: 1.15, marginTop: 8 }}>{e.short}</div>
                <div style={{ fontSize: 13.5, color: "var(--meta)", marginTop: 6, lineHeight: 1.4 }}>{e.label}</div>
              </div>
            ))}
          </div>
        )}

        {(busy || questions.length > 0) && (
          <div style={{ marginTop: 56 }}>
            {steps.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ width: 12, height: 12, marginTop: 4, background: s.state === "done" ? "var(--d2)" : s.state === "running" ? "var(--d1)" : s.state === "failed" ? "var(--brand)" : "var(--s3)" }} />
                <span style={{ fontSize: 16.5, fontWeight: 600, flex: 1 }}>{s.label}</span>
                <span className="m-sm" style={{ color: "var(--meta)" }}>{s.note ?? s.state}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: "22px 24px" }}>
        <div className="m" style={{ color: "var(--meta)" }}>WHY THIS IS DIFFERENT</div>
        <p style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
          A model asked <em>which sites would you cite</em> answers from memory, names one site, and
          nothing about it can be checked.
        </p>
        <p style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 14 }}>
          These five engines are asked the real question and return the real pages behind their real
          answer. Every row on the board opens to the page it came from.
        </p>
        {asked.length > 0 && (
          <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="m-sm" style={{ color: "var(--d1)" }}>GOING TO THE ENGINES NOW</div>
            {asked.slice(0, 8).map((q) => (
              <div key={q} style={{ fontSize: 15, lineHeight: 1.45, padding: "6px 0", color: "var(--ink)" }}>{q}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = String(n); return; }
    // animate(from, to, opts) drives the callback directly; the object form left it at 0
    const stop = animate(0, n, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v: number) => { el.textContent = String(Math.round(v)); },
    });
    return () => stop.stop();
  }, [n]);
  return (
    <span>
      <span ref={ref} className="num" style={{ display: "block", fontFamily: "var(--display)", fontSize: 58, lineHeight: 1, fontWeight: 400 }}>0</span>
      <span className="m-sm" style={{ color: "var(--meta)" }}>{label}</span>
    </span>
  );
}

function Result({ run, board, teardown, questions }: { run: PanelRun; board: Board; teardown: Teardown | null; questions: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const target = board.rows.find((r) => !r.isBrand);
  const brandCited = board.brandRow;

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-headline]", { opacity: 0, y: 18, duration: 0.7, ease: "expo.out" });
    }, ref);
    return () => ctx.revert();
  }, [board]);

  const verdict = !run.brandDomain
    ? `${target?.domain ?? "nobody"} is the site these engines reach for.`
    : brandCited
      ? `You are cited on ${brandCited.questions} of ${board.questionCount} questions. ${target?.domain} is on ${target?.questions}.`
      : `You are cited on none of the ${board.questionCount} questions. ${target?.domain ?? "another site"} takes them.`;

  return (
    <div ref={ref} style={{ paddingTop: 64 }}>
      <div className="m" style={{ color: "var(--meta)", marginBottom: 12 }}>
        {run.source === "live" ? "MEASURED LIVE" : "RECORDED PANEL"} · {run.market} · {board.questionCount} QUESTIONS · {board.totalCitations} CITATIONS
        {run.costUsd !== null && ` · $${run.costUsd.toFixed(3)}`}
      </div>
      <h1 data-headline className="h1" style={{ maxWidth: "34ch" }}>{verdict}</h1>

      {board.consensus.length > 0 && (
        <p className="lede" style={{ marginTop: 22, maxWidth: "62ch" }}>
          {board.consensus.length === 1
            ? `${board.consensus[0]} is the only domain all five engines cite.`
            : `${board.consensus.slice(0, 3).join(", ")} ${board.consensus.length > 3 ? `and ${board.consensus.length - 3} more ` : ""}are cited by all five engines. That set is the consensus, and it is the hardest to displace.`}
        </p>
      )}

      {run.silentEngines.length > 0 && (
        <p className="lede" style={{ marginTop: 14, maxWidth: "62ch", color: "var(--d1)" }}>
          {run.silentEngines.map((k) => ENGINES.find((e) => e.key === k)?.short).join(", ")} cited nothing on this
          panel. That is reported, not hidden.
        </p>
      )}

      <div style={{ marginTop: 56 }}>
        <EngineBoard board={board} />
      </div>

      {teardown && <Why teardown={teardown} />}

      <Download run={run} target={teardown?.domain} />

      <QuestionLedger run={run} questions={questions} />
    </div>
  );
}

function QuestionLedger({ run, questions }: { run: PanelRun; questions: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 84 }}>
      <div className="m" style={{ color: "var(--meta)", marginBottom: 14 }}>
        THE QUESTIONS, AND WHO EACH ENGINE NAMED FIRST
      </div>
      {run.questions.map((q) => (
        <div key={q.question} style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 17.5, lineHeight: 1.4, marginBottom: 10 }}>{q.question}</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {q.answers.map((a) => {
              const e = ENGINES.find((x) => x.key === a.engine);
              const first = a.citations[0];
              return (
                <span key={a.engine} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span className="m-sm" style={{ color: "var(--meta)", minWidth: 78 }}>{e?.short.toUpperCase()}</span>
                  <span style={{ fontSize: 15, color: first ? "var(--ink)" : "var(--d1)" }}>
                    {first ? first.domain : "no source"}
                  </span>
                  {a.citations.length > 1 && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--meta)" }}>+{a.citations.length - 1}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}

      {questions.length > run.questions.length && (
        <div style={{ marginTop: 22 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : `Show the other ${questions.length - run.questions.length} questions written but not asked`}
          </button>
          {open && (
            <div style={{ marginTop: 16, columns: 2, columnGap: 48 }}>
              {questions.filter((q) => !run.questions.some((r) => r.question === q)).map((q) => (
                <div key={q} style={{ fontSize: 15, lineHeight: 1.5, padding: "5px 0", breakInside: "avoid" }}>{q}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Why the widest-reaching rival wins, from the same citations.
 *
 * The two lists at the bottom are the point. Separating what a client can copy from
 * what they structurally cannot is what stops this becoming a plan to become Reddit.
 */
function Why({ teardown }: { teardown: Teardown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-strength]", { scaleX: 0, transformOrigin: "left center", duration: 0.8, ease: "expo.out", stagger: 0.08 });
    }, ref);
    return () => ctx.revert();
  }, [teardown]);

  return (
    <section ref={ref} style={{ paddingTop: 96 }}>
      <div className="m" style={{ color: "var(--meta)", marginBottom: 12 }}>WHY THAT DOMAIN, MEASURED ON THE SAME CITATIONS</div>
      <h2 className="h1" style={{ fontSize: "clamp(30px,2.6vw,46px)", maxWidth: "26ch" }}>{teardown.domain}</h2>
      <p className="lede" style={{ marginTop: 16, maxWidth: "70ch" }}>{teardown.headline}</p>

      <div style={{ marginTop: 40 }}>
        {teardown.findings.map((f) => (
          <div key={f.key} style={{ padding: "18px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
              <span style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>{f.name}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--meta)" }}>{f.strength}/100</span>
            </div>
            <div style={{ height: 5, background: "var(--s2)", marginTop: 10 }}>
              <div data-strength style={{ height: 5, width: `${f.strength}%`, background: f.strength >= 60 ? "var(--d2)" : "var(--d1)" }} />
            </div>
            <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 12, maxWidth: "80ch" }}>{f.verdict}</p>
            {f.evidence.slice(0, 3).map((e, i) => (
              <p key={i} style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7, marginTop: 8, color: "var(--ink)", background: "var(--s1)", borderLeft: "2px solid var(--d3)", padding: "8px 12px" }}>{e}</p>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, marginTop: 48 }}>
        <div>
          <div className="m" style={{ color: "var(--d2)", marginBottom: 12 }}>WHAT A CLIENT CAN COPY</div>
          {teardown.replicable.map((r, i) => (
            <p key={i} style={{ fontSize: 16.5, lineHeight: 1.55, padding: "12px 0", borderTop: "1px solid var(--line)" }}>{r}</p>
          ))}
        </div>
        <div>
          <div className="m" style={{ color: "var(--brand)", marginBottom: 12 }}>WHAT NO PAGE WILL BUY</div>
          {teardown.notReplicable.map((r, i) => (
            <p key={i} style={{ fontSize: 16.5, lineHeight: 1.55, padding: "12px 0", borderTop: "1px solid var(--line)" }}>{r}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Download({ run, target }: { run: PanelRun; target?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grab = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/panel/bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run, target }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "cited-panel.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 84, background: "var(--s1)", padding: "28px 32px", borderTop: "2px solid var(--brand)" }}>
      <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <h3 style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 400, lineHeight: 1.15 }}>Take the run with you.</h3>
          <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 10, maxWidth: "62ch" }}>
            Every citation as a spreadsheet, the board, the questions you are absent from, and the brief
            written from these numbers. Nothing in it is templated.
          </p>
        </div>
        <button className="btn btn--primary" onClick={grab} disabled={busy}>{busy ? "Building…" : "Download the files"}</button>
      </div>
      {err && <p style={{ color: "var(--brand)", fontSize: 15.5, marginTop: 12 }}>{err}</p>}
    </section>
  );
}
