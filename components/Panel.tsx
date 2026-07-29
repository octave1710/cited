"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { animate } from "motion";
import { EngineBoard } from "./EngineBoard";
import { ENGINES } from "../engines/types";
import type { PanelRun } from "../engines/types";
import type { Board } from "../engines/board";
import type { FactorFinding, Teardown } from "../engines/why";
import { MARKETS } from "../citationmap/markets";
import { Awaiting, Entity, Label, Num, Panel as Surface, Section, useEntry } from "./da";
import { readSubject, writeSubject, toHost, DEFAULT_SUBJECT } from "../lib/subject";
import { useKept } from "../lib/keep";

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
  { id: "engines", label: `Put them to ${ENGINES.length} answer engines`, state: "queued" },
  { id: "board", label: "Count who each engine cites", state: "queued" },
];

export function PanelScreen() {
  /* one subject across every screen: typing a category here must reach the map */
  const [topic, setTopic] = useState(DEFAULT_SUBJECT.topic);
  const [market, setMarket] = useState(DEFAULT_SUBJECT.market);
  const [brand, setBrand] = useState(DEFAULT_SUBJECT.domain);
  useEffect(() => {
    const s = readSubject();
    setTopic(s.topic);
    setMarket(s.market);
    setBrand(s.domain);
  }, []);
  const [panelSize, setPanelSize] = useState(8);

  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [questions, setQuestions] = useKept<string[]>("cited.panel.questions", []);
  const [asked, setAsked] = useState<string[]>([]);
  /* a four-minute paid run must survive a click on another tab and back */
  const [run, setRun] = useKept<PanelRun | null>("cited.panel.run", null);
  const [board, setBoard] = useKept<Board | null>("cited.panel.board", null);
  const [teardown, setTeardown] = useKept<Teardown | null>("cited.panel.teardown", null);

  const go = useCallback(async () => {
    writeSubject({ topic, market, domain: toHost(brand) });
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
        {run && !board && (
          <Awaiting
            title="The run finished without a board."
            what="The engines answered but nothing could be counted from it. Run it again, and if it repeats the panel came back empty rather than the screen failing."
          />
        )}
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
          Google AI Overview, Google AI Mode, Perplexity, ChatGPT, Gemini and Claude are each asked your
          category&apos;s questions, and every source they cite comes back with the answer.
        </p>

        <div style={{ display: "flex", gap: 44, marginTop: 52, flexWrap: "wrap" }}>
          <Stat n={ENGINES.length} label="ENGINES QUERIED LIVE" />
          <Stat n={MARKETS.length} label="MARKETS, EACH IN ITS OWN LANGUAGE" />
          <Stat n={8} label="BUYING ANGLES PER CATEGORY" />
        </div>

        {/* the engines, named, so the claim is concrete before anything runs */}
        {!busy && questions.length === 0 && (
          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: `repeat(${ENGINES.length},1fr)`, gap: 2 }}>
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
          These engines are asked the real question and return the real pages behind their real
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
  /**
   * The same domain the section below takes apart. This read the reach-sorted top row
   * while <Why> renders primaryTarget, which sorts on lead slots, so the headline could
   * name one site while the teardown under it dismantled another.
   */
  const target = (teardown ? board.rows.find((r) => r.domain === teardown.domain) : undefined) ?? board.rows.find((r) => !r.isBrand);
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
            ? `${board.consensus[0]} is the only domain every engine that answered cites.`
            : `${board.consensus.slice(0, 3).join(", ")} ${board.consensus.length > 3 ? `and ${board.consensus.length - 3} more ` : ""}are cited by every engine that answered. That set is the consensus, and it is the hardest to displace.`}
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

/* ==================================================================== the WHY section
 *
 * Why that domain wins, read in one pass from the back of a room.
 *
 * The version before this printed each finding as a percentage bar, a paragraph and
 * three monospace blocks, then two columns of four-line sentences. Every number was
 * there and none of it was readable while somebody was talking over it.
 *
 * What is on screen now is the QUESTION each factor answers, the answer cut to one
 * line, and the strength as a SHAPE with its denominator named beside it. Everything
 * countable sits behind one control per finding. The two lists at the bottom carry the
 * commercial argument, so they are the largest type in the section and each line opens
 * with the action rather than with the domain, which would make five lines start with
 * the same word.
 *
 * Nothing here recomputes anything. Every string comes from engines/why.ts; the only
 * work done in this file is choosing which clause of it is the headline.
 */

const wordsIn = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Sentence split without lookbehind, so it runs in every browser. URLs carry no space. */
function sentencesOf(s: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === "." && /\s/.test(s[i + 1])) {
      out.push(s.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** Clauses that begin the justification. The claim is what goes on screen; the rest opens. */
const CLAUSE = [", so ", ", and ", ", which ", " because "];
const PRONOUN = /^(its|it|that|this|they|their|these|those)\b/i;

/** Keeps whole comma-separated clauses, never mid-clause, so a truncated line is still true. */
function cap(t: string, maxWords: number): string {
  if (wordsIn(t) <= maxWords) return t;
  const parts = t.split(", ");
  let acc = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const next = `${acc}, ${parts[i]}`;
    if (wordsIn(next) > maxWords) break;
    acc = next;
  }
  return `${acc.replace(/[\s.,;:]+$/, "")}.`;
}

/** A verdict reduced to its claim: first sentence, first clause, capped. Full text stays behind the control. */
function oneLine(text: string, maxWords = 15): string {
  let t = sentencesOf(text)[0] ?? text;
  for (const c of CLAUSE) {
    const i = t.indexOf(c);
    if (i > 24) {
      t = t.slice(0, i);
      break;
    }
  }
  if (wordsIn(t) > maxWords) {
    const colon = t.indexOf(": ");
    if (colon > 24) t = t.slice(0, colon);
  }
  return cap(`${t.replace(/[\s.,;:]+$/, "")}.`, maxWords);
}

/**
 * The instruction inside a replicable/not-replicable string.
 *
 * why.ts writes these as "<claim sentence>. <the counts behind it>", and half of them
 * open on the domain, which is exactly the word that must not lead a scannable line.
 * So the headline is the first sentence that names neither the domain nor a pronoun
 * standing in for it; everything else is the proof and opens on demand, verbatim.
 */
function actionOf(text: string, domain: string): string {
  const parts = sentencesOf(text);
  if (!parts.length) return text;
  const lead = domain.toLowerCase();
  const named = (p: string) => p.toLowerCase().startsWith(lead);
  let idx = parts.findIndex((p) => !named(p) && !PRONOUN.test(p));
  if (idx < 0) idx = parts.findIndex((p) => !named(p));
  if (idx < 0) idx = 0;
  let action = parts[idx];
  const colon = action.indexOf(": ");
  if (colon > 24) action = `${action.slice(0, colon)}.`;
  return cap(action, 18);
}

/**
 * A sentence from the engine, rendered so the primitives still hold: numerals go
 * through Num in mono tabular, domains through Entity in the display serif, URLs stay
 * openable. Nothing is reworded, only marked up.
 */
const RICH =
  /(https?:\/\/[^\s,;)"]+|\b(?:[a-z0-9-]+\.)+(?:co\.uk|ac\.uk|nhs\.uk|org\.uk|com|org|net|edu|gov|io|int|info|eu|uk|us|fr|de|se|dk|nl|es|it)\b)|(\d+(?:[.,]\d+)*%?)/gi;

function Rich({ text, size = 16.5, weight = 400 }: { text: string; size?: number; weight?: number }) {
  const out: React.ReactNode[] = [];
  const re = new RegExp(RICH.source, "gi");
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        m[1].startsWith("http") ? (
          <a
            key={key++}
            href={m[1]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--d3)", wordBreak: "break-all" }}
          >
            {m[1]}
          </a>
        ) : (
          <Entity key={key++} size={size}>{m[1]}</Entity>
        ),
      );
    } else {
      out.push(<Num key={key++} size={Math.min(15, size - 1)}>{m[2]}</Num>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <span style={{ fontSize: size, fontWeight: weight, lineHeight: 1.5, color: "var(--ink)" }}>{out}</span>;
}

/* ------------------------------------------------------------- one device per finding */

/**
 * Three findings, three shapes, no repeats and no percentage bars.
 *
 * Each one names what its 100 is a share OF, because a bare score is the thing this
 * tool exists to argue against. The wedge is scaled on the square root so the AREA is
 * the share, not the width; the same rule the board uses for its cells.
 */
interface DeviceSpec {
  accent: string;
  scale: string;
  zero: string;
  mark: (v: number) => React.ReactNode;
}

const WEDGE = (v: number) => (
  <span
    style={{
      display: "block",
      position: "relative",
      height: 44,
      width: "100%",
      maxWidth: 200,
      // s3, not s2: an unlit mark sits on a raised card here, and s2 on s1 is a step nobody sees
      background: "var(--s3)",
      clipPath: "polygon(0 100%, 100% 0, 100% 100%)",
    }}
  >
    <span
      data-band
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${Math.sqrt(Math.max(v, 0) / 100) * 100}%`,
        background: "var(--d2)",
        transformOrigin: "left center",
      }}
    />
  </span>
);

const STAIRS = (v: number) => {
  const lit = v <= 0 ? 0 : Math.max(1, Math.ceil((v / 100) * 5));
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 44 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} data-tile style={{ width: 18, height: 12 + i * 8, background: i < lit ? "var(--d1)" : "var(--s3)" }} />
      ))}
    </span>
  );
};

const COMB = (v: number) => {
  const n = 22;
  const lit = v <= 0 ? 0 : Math.max(1, Math.round((v / 100) * n));
  return (
    <span style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 44 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} data-tile style={{ width: 3, height: i < lit ? 44 : 9, background: i < lit ? "var(--d3)" : "var(--s3)" }} />
      ))}
    </span>
  );
};

const DEVICES: Record<string, DeviceSpec> = {
  engineReach: {
    accent: "var(--d2)",
    scale: "OF THE ENGINES THAT ANSWERED THIS PANEL",
    zero: "NO ENGINE REACHES IT",
    mark: WEDGE,
  },
  leadSlotByIntent: {
    accent: "var(--d1)",
    scale: "OF WHAT THE BIGGEST LEAD-SLOT HOLDER TAKES",
    zero: "NEVER THE FIRST SOURCE",
    mark: STAIRS,
  },
  proseNamingGap: {
    accent: "var(--d3)",
    scale: "OF THE ANSWERS THAT CARRY TEXT",
    zero: "NAMED IN NO ANSWER HERE",
    mark: COMB,
  },
};

const FALLBACK: DeviceSpec = { accent: "var(--d3)", scale: "OF THIS PANEL", zero: "NOTHING MEASURED HERE", mark: COMB };

const deviceFor = (key: string) => DEVICES[key] ?? FALLBACK;

function Why({ teardown }: { teardown: Teardown }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEntry([teardown.domain, teardown.findings.map((f) => f.strength).join(",")], ref);

  const opened = teardown.findings.find((f) => f.key === open);

  /** The honesty line lives at the foot of the section, never inside a list. */
  const notRun = teardown.notReplicable.find((s) => /designed factors/i.test(s));
  const noBuy = teardown.notReplicable.filter((s) => s !== notRun);

  // the domain is already the headline above; repeating it inside the fact line wastes the line
  const facts = teardown.headline.startsWith(`${teardown.domain}:`)
    ? teardown.headline.slice(teardown.domain.length + 1).trim().replace(/^./, (c) => c.toUpperCase())
    : teardown.headline;

  return (
    <Section>
      <div ref={ref}>
        <div style={{ marginBottom: 12 }}>
          <Label>WHY THIS DOMAIN AND NOT ANOTHER · PICKED ON LEAD SLOTS, THEN ENGINE REACH, THEN VOLUME</Label>
        </div>
        <h2>
          <Entity size={44} style={{ display: "block", fontSize: "clamp(30px,2.6vw,46px)", letterSpacing: "-0.015em", lineHeight: 1.08 }}>
            {teardown.domain}
          </Entity>
        </h2>
        {/* the criterion, stated: he asked why this one was chosen and nothing on screen said */}
        <p style={{ fontSize: 16.5, lineHeight: 1.5, marginTop: 12, maxWidth: "72ch" }}>
          Of every site on this board, this one is named <strong>first</strong> most often. Being quoted and
          being the source an engine leans on are different outcomes, and the second is the one worth copying.
        </p>
        <p style={{ marginTop: 14, maxWidth: "70ch" }}>
          <Rich text={facts} size={17.5} />
        </p>

        {/* three questions, three shapes. One control each, all shut on arrival. */}
        <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 2 }}>
          {teardown.findings.map((f, i) => (
            <FindingCard key={f.key} f={f} i={i} open={open === f.key} onToggle={() => setOpen(open === f.key ? null : f.key)} />
          ))}
        </div>

        <div id="why-counts">{opened && <Counts f={opened} />}</div>

        <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "36px 56px" }}>
          <ActionList head="WHAT A CLIENT CAN COPY" tone="d2" accent="var(--d2)" items={teardown.replicable} domain={teardown.domain} />
          <ActionList head="WHAT NO PAGE WILL BUY" tone="brand" accent="var(--brand)" items={noBuy} domain={teardown.domain} />
        </div>

        {notRun && <NotRun text={notRun} />}
      </div>
    </Section>
  );
}

function FindingCard({ f, i, open, onToggle }: { f: FactorFinding; i: number; open: boolean; onToggle: () => void }) {
  const d = deviceFor(f.key);
  const zero = f.strength <= 0;
  return (
    <button
      type="button"
      data-row
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="why-counts"
      style={{
        // a column, so the three devices land on one line whatever the question wraps to
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: open ? "var(--s2)" : "var(--s1)",
        border: "none",
        borderTop: `2px solid ${d.accent}`,
        padding: "16px 20px 14px",
        color: "var(--ink)",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Num size={12} tone="meta">{String(i + 1).padStart(2, "0")}</Num>
        <Label>{f.source === "citation-data" ? "FROM THE CITATIONS" : "NEEDS A PAGE FETCH"}</Label>
      </span>

      <span style={{ display: "block", marginTop: 12 }}>
        <Entity size={20} style={{ display: "block", lineHeight: 1.25 }}>{f.question}</Entity>
      </span>

      <span style={{ display: "block", marginTop: 12 }}>
        <Rich text={oneLine(f.verdict)} size={16.5} weight={600} />
      </span>

      <span style={{ display: "block", marginTop: "auto", paddingTop: 20 }}>{d.mark(f.strength)}</span>

      <span style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 9, flexWrap: "wrap" }}>
        <Num size={15} tone={zero ? "var(--d1)" : "ink"}>{`${f.strength}/100`}</Num>
        <Label tone={zero ? "d1" : "meta"} style={{ flex: "1 1 150px" }}>{zero ? d.zero : d.scale}</Label>
      </span>

      <span style={{ display: "block", marginTop: 14, paddingTop: 11, borderTop: "1px solid var(--line)" }}>
        <Label tone={open ? "brand" : "d3"}>{open ? "HIDE THE COUNTS" : "SHOW THE COUNTS"}</Label>
      </span>
    </button>
  );
}

/** The receipts for one finding, full width so a long count is one line and not five. */
function Counts({ f }: { f: FactorFinding }) {
  const d = deviceFor(f.key);
  return (
    <Surface accent={d.accent} style={{ marginTop: 2, padding: "22px 24px 26px" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
        <Rich text={f.name} size={18} weight={600} />
        <Label>{f.source === "citation-data" ? "EVERY LINE IS ARITHMETIC ON THIS PANEL" : "NEEDS A PAGE FETCH"}</Label>
      </div>

      <p style={{ marginTop: 12, maxWidth: "88ch" }}>
        <Rich text={f.verdict} size={16.5} />
      </p>

      {f.evidence.length > 0 ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {f.evidence.map((e, i) => (
            <p key={i} style={{ background: "var(--s2)", borderLeft: `2px solid ${d.accent}`, padding: "10px 14px", maxWidth: "104ch" }}>
              <Rich text={e} size={16} />
            </p>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: 14 }}>
          <Label tone="d1">NOTHING ON THIS PANEL MATCHED THIS CHECK</Label>
        </p>
      )}
    </Surface>
  );
}

function ActionList({
  head,
  tone,
  accent,
  items,
  domain,
}: {
  head: string;
  tone: "d2" | "brand";
  accent: string;
  items: string[];
  domain: string;
}) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Label tone={tone}>{head}</Label>
      </div>
      {items.length === 0 ? (
        <div style={{ borderTop: `2px solid ${accent}`, paddingTop: 12 }}>
          <Label tone="d1">NOTHING OF THIS KIND ON THIS PANEL</Label>
        </div>
      ) : (
        items.map((s, i) => <ActionRow key={i} text={s} domain={domain} accent={accent} />)
      )}
    </div>
  );
}

function ActionRow({ text, domain, accent }: { text: string; domain: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const action = actionOf(text, domain);
  const more = action.trim() !== text.trim();

  const line = (
    <>
      <span style={{ width: 10, height: 10, background: accent, flex: "0 0 auto", marginTop: 9 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <Rich text={action} size={18.5} weight={600} />
      </span>
      {more && (
        <Label tone={open ? "brand" : "d3"} style={{ whiteSpace: "nowrap", marginTop: 8 }}>
          {open ? "HIDE" : "THE COUNT"}
        </Label>
      )}
    </>
  );

  return (
    <div data-row style={{ borderTop: "1px solid var(--line)" }}>
      {more ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            width: "100%",
            padding: "14px 0 12px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            color: "var(--ink)",
          }}
        >
          {line}
        </button>
      ) : (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0 12px" }}>{line}</div>
      )}
      {open && more && (
        <p style={{ padding: "0 0 14px 24px", maxWidth: "78ch" }}>
          <Rich text={text} size={16} />
        </p>
      )}
    </div>
  );
}

/**
 * What was not run. One line, at the foot, always visible.
 *
 * It is the sentence that stops the section being read as a complete factor set, so it
 * is never behind a control. The key list after the colon is identifiers, so it is set
 * in mono and separated rather than run on as prose.
 */
function NotRun({ text }: { text: string }) {
  const cut = text.indexOf(": ");
  const claim = cut > 0 ? text.slice(0, cut) : text;
  const keys = cut > 0 ? text.slice(cut + 2).replace(/\.$/, "").split(", ") : [];
  return (
    <div style={{ marginTop: 44, borderTop: "1px solid var(--line-strong)", paddingTop: 16, display: "flex", gap: 20, alignItems: "baseline", flexWrap: "wrap" }}>
      <Label tone="d1">NOT RUN HERE</Label>
      <span style={{ flex: "1 1 420px", minWidth: 0 }}>
        <Rich text={`${claim}.`} size={16} />
        {keys.length > 0 && (
          <span style={{ display: "block", marginTop: 6, fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>
            {keys.join("  ·  ")}
          </span>
        )}
      </span>
    </div>
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
