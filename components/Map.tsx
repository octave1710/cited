"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "motion";
import type { CitationMap, MapCost, MapQuestion, QuestionResult } from "../citationmap/types";
import type { MapDelta } from "../citationmap/compare";
import { INTENTS } from "../citationmap/questions";
import { isInstitutional } from "../citationmap/classify";
import { deriveSignals, type EntryPoint, type MapSignals } from "../citationmap/signals";
import { MARKETS } from "../citationmap/markets";
import { DeltaPanel, History } from "./History";
import { Favicon } from "./Territory";
import {
  Awaiting,
  Counter,
  Entity,
  Figure,
  Label,
  Meter,
  Num,
  Panel,
  Section,
  useEntry,
  Verdict,
} from "./da";

/**
 * THE DEMAND MAP.
 *
 * The live-engine measurement moved to /board. What is left here is the thing that has
 * to come first: the question space of a category, written out across the eight angles a
 * buyer interrogates it from, and the place you choose what goes to the engines.
 *
 * The device is angle columns. One column per angle, one tile per real question, stacked
 * from a common baseline. Two facts are encoded as shape and neither needs a numeral:
 *
 *   COLUMN HEIGHT is how many questions that angle generated, so the demand shape of the
 *     category is ranked by eye. "Price and value" running half the height of "how to
 *     choose" is a finding about the category, not a formatting accident.
 *   TILE FILL is what came back for that question: your domain named, one site owning it,
 *     split, reference pages only, nothing at all, or written and not yet asked. The
 *     strata are ordered so what you hold is the floor and what nobody holds is the cap,
 *     which makes the free space in each angle the brightest band on the screen.
 *
 * Every tile is one question you can retype into ChatGPT yourself. Nothing is modelled.
 */

/** The screen remembers the run you were on; only the id, so nothing cached goes stale. */
const LAST = "cited.lastMap";

const TILE_H = 13;
const TILE_GAP = 4;

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ------------------------------------------------------------------ *
 * One question's state, as a fill.
 * ------------------------------------------------------------------ */

type TileState = "mine" | "held" | "split" | "reference" | "open" | "unasked";

/** Bottom of the column to the top: what you hold, what others hold, what nobody holds. */
const STACK: TileState[] = ["mine", "held", "split", "reference", "open", "unasked"];

const TILE: Record<TileState, { fill: string; border: string; opacity: number; name: string; help: string }> = {
  mine: { fill: "var(--brand)", border: "none", opacity: 1, name: "THE ENGINE NAMES YOU", help: "your domain is in the answer" },
  held: { fill: "var(--s3)", border: "none", opacity: 1, name: "ONE SITE OWNS IT", help: "the same site wins much of the map" },
  split: { fill: "var(--d3)", border: "none", opacity: 1, name: "SPLIT BETWEEN SITES", help: "cited, but nobody owns the category" },
  reference: { fill: "var(--d1)", border: "none", opacity: 0.36, name: "REFERENCE PAGES ONLY", help: "encyclopedia or government, no shop" },
  open: { fill: "transparent", border: "1px solid var(--d1)", opacity: 1, name: "NO SITE CITED AT ALL", help: "the engine named nothing" },
  unasked: { fill: "var(--s1)", border: "none", opacity: 1, name: "WRITTEN, NOT YET ASKED", help: "generated, still waiting on the engine" },
};

/**
 * `final` matters. Mid-run the stream carries a provisional bucket, because "one site owns
 * it" is a property of the whole map and cannot be known until every answer is in. So the
 * live fill is derived from the answer itself and only promotes to `held` once the map is
 * classified. Colouring a tile "owned" before that would be a claim the data cannot make.
 */
function stateOf(r: QuestionResult | undefined, final: boolean): TileState {
  if (!r) return "unasked";
  if (final) {
    if (r.bucket === "owned") return "mine";
    if (r.bucket === "lost") return "held";
    if (r.bucket === "reference") return "reference";
    if (r.bucket === "open") return "open";
    return "split";
  }
  if (r.brandRank > 0) return "mine";
  if (r.domains.length === 0) return "open";
  if (r.domains.every(isInstitutional)) return "reference";
  return "split";
}

interface AngleColumn {
  id: string;
  label: string;
  /** Already in stack order: bottom first. */
  questions: MapQuestion[];
  total: number;
  free: number;
  mine: number;
}

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

export function MapScreen() {
  const [topic, setTopic] = useState("vitamin c serum");
  const [brand, setBrand] = useState("The Ordinary");
  const [domain, setDomain] = useState("theordinary.com");
  const [market, setMarket] = useState("UK");

  const [questions, setQuestions] = useState<MapQuestion[]>([]);
  const [results, setResults] = useState<Record<string, QuestionResult>>({});
  const [map, setMap] = useState<CitationMap | null>(null);
  const [cost, setCost] = useState<MapCost | null>(null);
  const [engine, setEngine] = useState<{ label: string; mode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState<{ delta: MapDelta | null; noBaselineReason?: string } | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<string | null>(null);
  const [angleId, setAngleId] = useState<string | null>(null);

  const final = map !== null;

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMap(null);
    setResults({});
    setQuestions([]);
    setCost(null);
    setDelta(null);
    setSelected(new Set());
    setOpened(null);
    setAngleId(null);
    setPhase("Writing the questions a buyer types");

    try {
      const res = await fetch("/api/map/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, brand, brandDomain: domain, market }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status}).`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "engine") setEngine({ label: ev.label, mode: ev.mode });
          if (ev.type === "questions") {
            setQuestions(ev.questions);
            setPhase(`Asking the engine all ${ev.questions.length} questions`);
          }
          if (ev.type === "result") {
            setResults((prev) => ({ ...prev, [ev.result.id]: ev.result }));
            setCost(ev.cost);
          }
          if (ev.type === "done") {
            const m: CitationMap = ev.map;
            setMap(m);
            setResults(Object.fromEntries(m.questions.map((q) => [q.id, q])));
            setCost(m.cost);
            setPhase("");
            try {
              sessionStorage.setItem(LAST, m.id);
            } catch {
              // private mode or a full quota: the map still renders, it just will not survive a reload
            }
            // the baseline is whatever previous run covered the same category, brand and
            // market. Absent, the panel says so rather than showing a zero.
            fetch(`/api/map?id=${encodeURIComponent(m.id)}&delta=1`)
              .then((r) => r.json())
              .then((d) => setDelta({ delta: d.delta ?? null, noBaselineReason: d.noBaselineReason }))
              .catch(() => setDelta(null));
          }
          if (ev.type === "error") throw new Error(ev.error);
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("");
    } finally {
      setBusy(false);
    }
  }, [topic, brand, domain, market]);

  const openStored = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/map?id=${encodeURIComponent(id)}&delta=1`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status}).`);
      const m: CitationMap = d.map;
      setTopic(m.topic);
      setBrand(m.brand);
      setDomain(m.brandDomain);
      setMarket(m.market);
      setQuestions(m.questions);
      setResults(Object.fromEntries(m.questions.map((q) => [q.id, q])));
      setMap(m);
      setCost(m.cost);
      setEngine({ label: m.engine, mode: "stored" });
      setSelected(new Set());
      setOpened(null);
      setAngleId(null);
      setDelta({ delta: d.delta ?? null, noBaselineReason: d.noBaselineReason });
      sessionStorage.setItem(LAST, id);
    } catch (e) {
      setError((e as Error).message);
      sessionStorage.removeItem(LAST);
    } finally {
      setBusy(false);
    }
  }, []);

  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    const id = typeof window !== "undefined" ? sessionStorage.getItem(LAST) : null;
    if (!id) {
      setRestoring(false);
      return;
    }
    void openStored(id).finally(() => setRestoring(false));
  }, [openStored]);

  /** Pure derivation over the finished map, so it costs nothing and needs no round trip. */
  const signals: MapSignals | null = useMemo(() => (map ? deriveSignals(map) : null), [map]);

  /** The columns. Stack order is the finding, so it is computed once with the states. */
  const columns: AngleColumn[] = useMemo(() => {
    const known = new Map<string, MapQuestion[]>(INTENTS.map((i) => [i.label, []]));
    const extra = new Map<string, MapQuestion[]>();
    for (const q of questions) {
      const bucket = known.get(q.intent) ?? extra.get(q.intent);
      if (bucket) bucket.push(q);
      else extra.set(q.intent, [q]);
    }
    const build = (id: string, label: string, list: MapQuestion[]): AngleColumn => {
      const ordered = [...list].sort(
        (a, b) =>
          STACK.indexOf(stateOf(results[a.id], final)) - STACK.indexOf(stateOf(results[b.id], final)) ||
          a.id.localeCompare(b.id),
      );
      const count = (fn: (s: TileState) => boolean) =>
        list.filter((q) => fn(stateOf(results[q.id], final))).length;
      return {
        id,
        label,
        questions: ordered,
        total: list.length,
        free: count((s) => s === "open" || s === "reference"),
        mine: count((s) => s === "mine"),
      };
    };
    return [
      ...INTENTS.map((i) => build(i.id, i.label, known.get(i.label) ?? [])),
      ...[...extra.entries()].map(([label, list]) => build(label, label, list)),
    ].filter((c) => c.total > 0 || questions.length === 0);
  }, [questions, results, final]);

  const stateCounts = useMemo(() => {
    const c: Record<TileState, number> = { mine: 0, held: 0, split: 0, reference: 0, open: 0, unasked: 0 };
    for (const q of questions) c[stateOf(results[q.id], final)]++;
    return c;
  }, [questions, results, final]);

  /** Default focus is the angle with the most free space, which is where the work is. */
  const focus = useMemo(() => {
    if (!columns.length) return null;
    const picked = angleId ? columns.find((c) => c.id === angleId) : null;
    if (picked) return picked;
    return [...columns].sort((a, b) => b.free - a.free || b.total - a.total)[0] ?? null;
  }, [columns, angleId]);

  const total = questions.length;
  const answered = Object.keys(results).length;
  const free = stateCounts.open + stateCounts.reference;

  const toggle = useCallback((q: MapQuestion) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
    setOpened(q.id);
    const col = INTENTS.find((i) => i.label === q.intent);
    setAngleId(col ? col.id : q.intent);
  }, []);

  const openedQuestion = opened ? questions.find((q) => q.id === opened) ?? null : null;

  const meta = (
    <>
      {engine ? `${engine.mode.toUpperCase()} · ${engine.label.toUpperCase()}` : "ENGINE NOT STARTED"} · {market} ·{" "}
      <Num size={10.5} tone="meta" weight={500}>{INTENTS.length}</Num> ANGLES ·{" "}
      <Num size={10.5} tone="meta" weight={500}>{total}</Num> QUESTIONS
      {cost && cost.calls > 0 && (
        <>
          {" "}· <Num size={10.5} tone="meta" weight={500}>{cost.calls}</Num> LIVE CALLS
        </>
      )}
      {cost && cost.calls === 0 && cost.replayed > 0 && (
        <>
          {" "}· <Num size={10.5} tone="meta" weight={500}>{cost.replayed}</Num> REPLAYED, $0.0000 SPENT
        </>
      )}
      {cost && cost.usd !== null && cost.calls > 0 && (
        <>
          {" "}· <Num size={10.5} tone="meta" weight={500}>${cost.usd.toFixed(4)}</Num>
        </>
      )}
    </>
  );

  const headline = !final
    ? "The category, written out as the questions buyers actually type."
    : stateCounts.mine > 0
      ? `Buyers ask ${total} questions here, and the engine names you on ${stateCounts.mine}.`
      : `Buyers ask ${total} questions here, and the engine never names you on one of them.`;

  return (
    <div style={{ paddingBottom: 120 }}>
      <MapBar
        topic={topic} setTopic={setTopic}
        brand={brand} setBrand={setBrand}
        domain={domain} setDomain={setDomain}
        market={market} setMarket={setMarket}
        onRun={run} busy={busy}
        currentId={map?.id} onOpen={openStored}
      />

      {error && (
        <div className="gut" style={{ paddingTop: 18, paddingBottom: 18 }}>
          <div className="shell">
            <Panel accent="var(--brand)" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <Label tone="brand">RUN FAILED</Label>
              <span style={{ fontSize: 16.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{error}</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setError(null)}>Dismiss</button>
            </Panel>
          </div>
        </div>
      )}

      <div className="gut">
        <div className="shell">
          {/* while a stored run is being re-read, the empty state would flash "nothing mapped
              yet" at someone who has one, so it waits */}
          {!total && !busy && !restoring && <MapEmpty />}

          {(busy || total > 0) && (
            <>
              <div style={{ paddingTop: 52 }}>
                <Verdict
                  meta={meta}
                  headline={headline}
                  lede={
                    final ? (
                      <>
                        {free === 0
                          ? "Every one of them already has a commercial page cited."
                          : free === 1
                            ? "One of them comes back with no commercial page cited at all."
                            : `${free} of them come back with no commercial page cited at all.`}{" "}
                        Click any tile to shortlist it.
                      </>
                    ) : (
                      <>{phase || "Working"}.</>
                    )
                  }
                />
              </div>

              {!final && total > 0 && (
                <div style={{ marginTop: 26, maxWidth: 420 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <Label>ANSWERED BY THE ENGINE</Label>
                    <Num size={13}>{answered} / {total}</Num>
                  </div>
                  <Meter value={answered} max={total} accent="var(--d1)" height={5} />
                </div>
              )}

              <div style={{ marginTop: 44 }}>
                <AngleColumns
                  columns={columns}
                  results={results}
                  final={final}
                  brandDomain={map?.brandDomain ?? domain}
                  selected={selected}
                  focusId={focus?.id ?? null}
                  onToggle={toggle}
                  onFocus={(id) => setAngleId(id)}
                />
              </div>

              <TileLegend counts={stateCounts} />

              {cost?.rate && (
                <p style={{ marginTop: 14 }}>
                  <Label>
                    RATE · {cost.rate.toUpperCase()} ·{" "}
                    <Num size={10.5} tone="meta" weight={500}>
                      {(cost.inTokens + cost.outTokens).toLocaleString("en-US")}
                    </Num>{" "}
                    TOKENS BILLED
                  </Label>
                </p>
              )}

              <Shortlist
                questions={questions}
                results={results}
                selected={selected}
                onClear={() => setSelected(new Set())}
                mapId={map?.id}
              />

              {openedQuestion && (
                <OpenQuestion
                  question={openedQuestion}
                  result={results[openedQuestion.id]}
                  brandDomain={map?.brandDomain ?? domain}
                  entry={signals?.entryPoints.find((e) => e.id === openedQuestion.id)}
                  selected={selected.has(openedQuestion.id)}
                  onToggle={() => toggle(openedQuestion)}
                  onClose={() => setOpened(null)}
                  final={final}
                />
              )}

              {focus && focus.total > 0 && (
                <Ledger
                  angle={focus}
                  index={columns.findIndex((c) => c.id === focus.id) + 1}
                  count={columns.length}
                  results={results}
                  final={final}
                  brandDomain={map?.brandDomain ?? domain}
                  signals={signals}
                  selected={selected}
                  onToggle={toggle}
                  mapId={map?.id}
                />
              )}
            </>
          )}

          {map && delta && <DeltaPanel delta={delta.delta} noBaselineReason={delta.noBaselineReason} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- input ------------------------------- */

function MapBar(p: {
  topic: string; setTopic: (v: string) => void;
  brand: string; setBrand: (v: string) => void;
  domain: string; setDomain: (v: string) => void;
  market: string; setMarket: (v: string) => void;
  onRun: () => void; busy: boolean;
  currentId?: string; onOpen: (id: string) => void;
}) {
  return (
    <div className="rule-b gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--s1)", position: "sticky", top: "var(--bar-h)", zIndex: 40 }}>
      <div className="shell">
        <form onSubmit={(e) => { e.preventDefault(); if (!p.busy) p.onRun(); }} className="bar">
          <input className="field" style={{ flex: "1 1 340px" }} value={p.topic} onChange={(e) => p.setTopic(e.target.value)} placeholder="Category, e.g. vitamin c serum" aria-label="Category" />
          <input className="field" style={{ width: 210 }} value={p.brand} onChange={(e) => p.setBrand(e.target.value)} aria-label="Brand name" />
          <input className="field" style={{ width: 230 }} value={p.domain} onChange={(e) => p.setDomain(e.target.value)} placeholder="yourdomain.com" aria-label="Your domain" />
          <select className="field" style={{ width: 120 }} value={p.market} onChange={(e) => p.setMarket(e.target.value)} aria-label="Market">
            {MARKETS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} · {m.language}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" type="submit" disabled={p.busy}>{p.busy ? "Mapping…" : "Map the category"}</button>
        </form>
        <div style={{ marginTop: 14 }}>
          <History currentId={p.currentId} onOpen={p.onOpen} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- nothing yet ---------------------------- */

/**
 * The device is legible before a call is made: the eight angles stand as empty tracks,
 * so what a run does to the screen is obvious from the shape it will fill.
 */
function MapEmpty() {
  const ref = useRef<HTMLDivElement>(null);
  useEntry([INTENTS.length], ref);
  return (
    <div>
      <Awaiting
        title="No category mapped yet."
        what="A run writes the questions buyers actually type, eight angles at twenty each, then puts every one of them to the engine."
        steps={[
          { label: "Write the questions", state: "queued", note: "8 ANGLES" },
          { label: "Ask the engine each one", state: "queued", note: "1 CALL EACH" },
          { label: "Shortlist what goes to the engines", state: "queued", note: "YOU CHOOSE" },
        ]}
      />
      <div ref={ref} style={{ marginTop: 64, overflowX: "auto" }}>
        <div style={{ minWidth: 760, display: "grid", gridTemplateColumns: `repeat(${INTENTS.length}, minmax(0,1fr))`, gap: 12, alignItems: "end" }}>
          {INTENTS.map((i) => (
            <div key={i.id} style={{ display: "flex", flexDirection: "column-reverse", gap: TILE_GAP }}>
              {Array.from({ length: 20 }, (_, n) => (
                <span key={n} data-tile style={{ display: "block", height: TILE_H, background: "var(--s1)" }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ minWidth: 760, borderTop: "2px solid var(--line-strong)", marginTop: 10, paddingTop: 12, display: "grid", gridTemplateColumns: `repeat(${INTENTS.length}, minmax(0,1fr))`, gap: 12 }}>
          {INTENTS.map((i) => (
            <span key={i.id}>
              {/* the angle name is content, never metadata, so it is never in --meta */}
              <Entity size={17} style={{ display: "block" }}>{i.label}</Entity>
              <span style={{ display: "block", marginTop: 6 }}>
                <Label>NOT ASKED YET</Label>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ the device ------------------------------ */

function AngleColumns({
  columns, results, final, brandDomain, selected, focusId, onToggle, onFocus,
}: {
  columns: AngleColumn[];
  results: Record<string, QuestionResult>;
  final: boolean;
  brandDomain: string;
  selected: Set<string>;
  focusId: string | null;
  onToggle: (q: MapQuestion) => void;
  onFocus: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ q: MapQuestion; x: number; y: number } | null>(null);
  const count = columns.reduce((s, c) => s + c.total, 0);
  useEntry([count, final ? 1 : 0], ref);

  const cols = `repeat(${columns.length}, minmax(0,1fr))`;

  return (
    <div ref={ref}>
      <div style={{ overflowX: "auto", paddingBottom: 4 }} onMouseLeave={() => setHover(null)}>
        {/* the columns, bottom-aligned on one baseline so height is directly comparable */}
        <div style={{ minWidth: 760, display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "end" }}>
          {columns.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column-reverse", gap: TILE_GAP }}>
              {c.questions.map((q) => {
                const st = stateOf(results[q.id], final);
                const t = TILE[st];
                const isSel = selected.has(q.id);
                return (
                  <button
                    key={q.id}
                    data-tile
                    type="button"
                    aria-label={q.text}
                    aria-pressed={isSel}
                    onMouseEnter={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      setHover({ q, x: b.right + 10, y: b.top });
                    }}
                    onFocus={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      setHover({ q, x: b.right + 10, y: b.top });
                    }}
                    onClick={() => onToggle(q)}
                    style={{
                      display: "block",
                      height: TILE_H,
                      width: "100%",
                      padding: 0,
                      background: t.fill,
                      border: t.border,
                      opacity: t.opacity,
                      outline: isSel ? "2px solid var(--ink)" : "none",
                      outlineOffset: 1,
                      cursor: "pointer",
                      transition: "background 260ms cubic-bezier(0.16,1,0.3,1), opacity 260ms ease",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* the baseline, then the angle each column belongs to */}
        <div
          style={{
            minWidth: 760,
            display: "grid",
            gridTemplateColumns: cols,
            gap: 12,
            borderTop: "2px solid var(--line-strong)",
            marginTop: 10,
            paddingTop: 12,
          }}
        >
          {columns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onFocus(c.id)}
              aria-pressed={focusId === c.id}
              style={{
                background: "transparent",
                border: "none",
                borderTop: focusId === c.id ? "2px solid var(--ink)" : "2px solid transparent",
                marginTop: -14,
                paddingTop: 12,
                textAlign: "left",
                cursor: "pointer",
                color: "var(--ink)",
                minWidth: 0,
              }}
            >
              <Entity size={17} style={{ display: "block" }}>{c.label}</Entity>
              <span style={{ display: "block", marginTop: 6 }}>
                <Num size={12}>{c.total}</Num> <Label>ASKED</Label>
              </span>
              <span style={{ display: "block", marginTop: 3 }}>
                {c.free > 0 ? (
                  <>
                    <Num size={12} tone="d1">{c.free}</Num> <Label tone="d1">FREE</Label>
                  </>
                ) : (
                  <Label>NONE FREE</Label>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {hover && <Tip q={hover.q} r={results[hover.q.id]} final={final} x={hover.x} y={hover.y} brandDomain={brandDomain} />}
    </div>
  );
}

function Tip({
  q, r, final, x, y, brandDomain,
}: {
  q: MapQuestion;
  r: QuestionResult | undefined;
  final: boolean;
  x: number;
  y: number;
  brandDomain: string;
}) {
  const st = stateOf(r, final);
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - 400) : x;
  const top = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 260) : y;
  return (
    <Panel
      accent={st === "mine" ? "var(--brand)" : st === "open" || st === "reference" ? "var(--d1)" : "var(--d3)"}
      style={{ position: "fixed", left, top, width: 380, zIndex: 60, pointerEvents: "none" }}
    >
      <Label>{q.intent.toUpperCase()} · {TILE[st].name}</Label>
      <p style={{ fontSize: 17, lineHeight: 1.4, fontWeight: 600, marginTop: 10 }}>{sentence(q.text)}</p>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
        {!r && <Label tone="meta">THE ENGINE HAS NOT ANSWERED THIS ONE YET</Label>}
        {r && r.domains.length === 0 && <Label tone="d1">NO SITE CITED AT ALL</Label>}
        {r?.domains.map((d, i) => (
          <span key={d} style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <Num size={12} tone="meta">{i + 1}</Num>
            <Favicon domain={d} size={16} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: d === brandDomain ? "var(--brand)" : "var(--ink)" }}>
              {d}{d === brandDomain ? "  ← you" : ""}
            </span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

function TileLegend({ counts }: { counts: Record<TileState, number> }) {
  const shown = STACK.filter((s) => counts[s] > 0);
  return (
    <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginTop: 22, alignItems: "flex-start" }}>
      {shown.map((s) => {
        const t = TILE[s];
        return (
          <span key={s} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 22, height: TILE_H, marginTop: 3, flex: "none", background: t.fill, border: t.border, opacity: t.opacity }} />
            <span style={{ display: "block" }}>
              <span style={{ display: "block" }}>
                <Num size={13}>{counts[s]}</Num>{" "}
                <span style={{ fontSize: 14.5, color: "var(--ink)" }}>{t.help}</span>
              </span>
              <span style={{ display: "block", marginTop: 2 }}>
                <Label>{t.name}</Label>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------- what goes to the engines ------------------------- */

/**
 * The shortlist. What the screen exists to produce.
 *
 * It hands over an artefact and nothing else: the exact questions, as plain text, on the
 * clipboard. Paste them into ChatGPT, Perplexity or the board and the answer either
 * matches what this map recorded or it does not, which is the only kind of proof worth
 * shipping. No promise is made about what another screen will do with them.
 */
function Shortlist({
  questions, results, selected, onClear, mapId,
}: {
  questions: MapQuestion[];
  results: Record<string, QuestionResult>;
  selected: Set<string>;
  onClear: () => void;
  mapId?: string;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const list = useMemo(() => questions.filter((q) => selected.has(q.id)), [questions, selected]);

  useEffect(() => {
    setCopied("idle");
  }, [selected]);

  if (list.length === 0) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(list.map((q) => q.text).join("\n"));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  const firstFree = list.find((q) => {
    const r = results[q.id];
    return r && r.domains.filter((d) => !isInstitutional(d)).length === 0;
  });

  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 30, marginTop: 40 }}>
      <Panel accent="var(--brand)" style={{ display: "flex", gap: 34, alignItems: "center", flexWrap: "wrap" }}>
        <Figure n={list.length} label="ON THE SHORTLIST" tone="var(--brand)" />

        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <Label>WHAT LEAVES WITH YOU</Label>
          <p style={{ fontSize: 16.5, lineHeight: 1.5, marginTop: 8, maxWidth: "54ch" }}>
            The exact questions, one per line, on your clipboard. Paste any of them into an engine and check the row yourself.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn--primary" onClick={copy}>
            {copied === "done" ? `Copied ${list.length}` : copied === "failed" ? "Clipboard blocked" : `Copy the ${list.length} questions`}
          </button>
          {firstFree && (
            <a className="btn" href={`/pipeline?brief=${encodeURIComponent(firstFree.text)}`}>Brief a page</a>
          )}
          <a className="btn" href="/board">Open the engine board</a>
          {mapId && (
            <a className="btn btn--ghost" href={`/api/bundle?map=${encodeURIComponent(mapId)}`} download>
              Export the map · 3 CSVs
            </a>
          )}
          <button className="btn btn--ghost" onClick={onClear}>Clear</button>
        </div>
      </Panel>
    </div>
  );
}

/* --------------------------- the opened question --------------------------- */

function OpenQuestion({
  question, result, brandDomain, entry, selected, onToggle, onClose, final,
}: {
  question: MapQuestion;
  result: QuestionResult | undefined;
  brandDomain: string;
  entry?: EntryPoint;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
  final: boolean;
}) {
  const st = stateOf(result, final);
  const winner = entry?.weakest?.domain ?? result?.domains.find((d) => d !== brandDomain) ?? null;

  return (
    <div style={{ marginTop: 40 }}>
      <Panel accent={st === "mine" ? "var(--brand)" : "var(--d1)"}>
        <div style={{ display: "flex", gap: 34, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 460px", minWidth: 0 }}>
            <Label>{question.intent.toUpperCase()} · {TILE[st].name}</Label>
            <p style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: 27, lineHeight: 1.2, marginTop: 12, maxWidth: "30ch" }}>
              {sentence(question.text)}
            </p>
            <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 14, maxWidth: "62ch" }}>
              {entry?.reason ??
                (!result
                  ? "The engine has not answered this one yet."
                  : result.domains.length === 0
                    ? "The engine answered and named no source. There is no page to beat here, only a page to write."
                    : `The engine credits ${result.domains[0]}${result.brandRank > 0 ? `, and you at position ${result.brandRank}` : ", and never you"}.`)}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 210 }}>
            <button className={selected ? "btn" : "btn btn--primary"} onClick={onToggle}>
              {selected ? "Remove from the shortlist" : "Add to the shortlist"}
            </button>
            {winner ? (
              <a
                className="btn"
                style={{ maxWidth: "100%", overflow: "hidden" }}
                title={`Fetch ${winner}'s page for this question and yours, and score both on the same nine factors`}
                href={`/autopsy?domain=${encodeURIComponent(winner)}&q=${encodeURIComponent(question.text)}`}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Take {winner}&apos;s seat</span>
              </a>
            ) : (
              <a className="btn" href={`/pipeline?brief=${encodeURIComponent(question.text)}`}>Brief a page for this</a>
            )}
            <button className="btn btn--ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------ the ledger ------------------------------ */

/**
 * The evidence under the device: the exact questions of one angle, with the sites the
 * engine actually named, in its own order. The area marks above them are the same counts
 * the column is built from, scaled on the square root so the eye reads the square honestly.
 */
function Ledger({
  angle, index, count, results, final, brandDomain, signals, selected, onToggle, mapId,
}: {
  angle: AngleColumn;
  index: number;
  count: number;
  results: Record<string, QuestionResult>;
  final: boolean;
  brandDomain: string;
  signals: MapSignals | null;
  selected: Set<string>;
  onToggle: (q: MapQuestion) => void;
  mapId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEntry([angle.id, angle.total, final ? 1 : 0], ref);

  const holders = useMemo(() => {
    const wins = new Map<string, number>();
    for (const q of angle.questions) {
      const first = results[q.id]?.domains[0];
      if (first) wins.set(first, (wins.get(first) ?? 0) + 1);
    }
    return [...wins.entries()]
      .map(([domain, n]) => ({ domain, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [angle, results]);

  const maxHold = Math.max(1, ...holders.map((h) => h.n));
  const ordered = useMemo(() => [...angle.questions].reverse(), [angle.questions]);

  return (
    <Section>
      <div ref={ref}>
        <Verdict
          size="section"
          meta={
            <>
              ANGLE <Num size={10.5} tone="meta" weight={500}>{index}</Num> OF{" "}
              <Num size={10.5} tone="meta" weight={500}>{count}</Num> · {angle.label.toUpperCase()} · CLICK ANOTHER COLUMN TO SWITCH
            </>
          }
          headline={
            angle.free === 0
              ? `All ${angle.total} questions on ${angle.label} already have a commercial page cited.`
              : angle.free === 1
                ? `One of the ${angle.total} questions on ${angle.label} names no commercial page.`
                : `${angle.free} of the ${angle.total} questions on ${angle.label} name no commercial page.`
          }
        />

        <div style={{ display: "flex", gap: 42, alignItems: "flex-start", flexWrap: "wrap", marginTop: 34 }}>
          <span style={{ display: "block" }}>
            <Counter n={angle.total} size={54} />
            <span style={{ display: "block", marginTop: 8 }}>
              <Label>QUESTIONS ON THIS ANGLE</Label>
            </span>
          </span>
          <Figure n={angle.mine} label="OF THEM NAME YOU" tone="var(--brand)" />

          {/* who answers this angle, as area. Side scales on the square root of the count. */}
          <span style={{ display: "block", flex: "1 1 320px", minWidth: 0 }}>
            <Label>WHO THE ENGINE PUTS FIRST HERE · AREA IS THE COUNT</Label>
            <span style={{ display: "flex", gap: 20, alignItems: "flex-end", marginTop: 14, minHeight: 74, flexWrap: "wrap" }}>
              {holders.length === 0 && <Label tone="d1">NO SITE PUT FIRST ON A SINGLE ONE</Label>}
              {holders.map((h) => {
                const side = Math.max(12, Math.round(52 * Math.sqrt(h.n / maxHold)));
                return (
                  <span key={h.domain} style={{ display: "block" }}>
                    <span
                      data-tile
                      title={`${h.domain} is cited first on ${h.n} of the ${angle.total}`}
                      style={{
                        display: "block",
                        width: side,
                        height: side,
                        background: h.domain === brandDomain ? "var(--brand)" : "var(--d3)",
                      }}
                    />
                    <span style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8 }}>
                      <Favicon domain={h.domain} size={15} />
                      <Num size={12}>{h.n}</Num>
                    </span>
                  </span>
                );
              })}
            </span>
          </span>
        </div>

        <p style={{ marginTop: 40, marginBottom: 12 }}>
          <Label>EVERY ROW ROUTES AT THE WEAKEST SITE IN THAT ANSWER, RINGED IN ORANGE</Label>
        </p>

        <div style={{ borderTop: "1px solid var(--line-strong)" }}>
          {ordered.map((q) => {
            const r = results[q.id];
            const st = stateOf(r, final);
            const t = TILE[st];
            const isSel = selected.has(q.id);
            const entry = signals?.entryPoints.find((e) => e.id === q.id);
            const weakest = entry?.weakest?.domain ?? null;
            return (
              <div
                key={q.id}
                data-row
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px minmax(0,1fr) 132px 236px",
                  gap: 20,
                  alignItems: "center",
                  padding: "13px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <button
                  type="button"
                  aria-label={isSel ? `Remove: ${q.text}` : `Shortlist: ${q.text}`}
                  aria-pressed={isSel}
                  onClick={() => onToggle(q)}
                  style={{
                    width: 26,
                    height: TILE_H + 4,
                    padding: 0,
                    background: t.fill,
                    border: t.border,
                    opacity: t.opacity,
                    outline: isSel ? "2px solid var(--ink)" : "none",
                    outlineOffset: 1,
                    cursor: "pointer",
                  }}
                />

                <span style={{ fontSize: 16.5, lineHeight: 1.45, minWidth: 0 }}>{sentence(q.text)}</span>

                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {!r && <Label>NOT ASKED YET</Label>}
                  {r && r.domains.length === 0 && <Label tone="d1">NOBODY CITED</Label>}
                  {r?.domains.slice(0, 5).map((d) => (
                    <span
                      key={d}
                      title={`${d}${d === weakest ? " · the weakest seat in this answer" : ""}`}
                      style={{
                        display: "block",
                        opacity: d === weakest || d === brandDomain ? 1 : 0.36,
                        outline: d === weakest ? "2px solid var(--brand)" : "none",
                        outlineOffset: 1,
                      }}
                    >
                      <Favicon domain={d} size={19} />
                    </span>
                  ))}
                </span>

                {/* the label carries the domain, so the column is capped and the anchor clips
                    rather than running past its own border, which is what 196px did */}
                <span style={{ minWidth: 0, overflow: "hidden" }}>
                  {weakest ? (
                    <a
                      className="btn btn--sm"
                      style={{ maxWidth: "100%", overflow: "hidden" }}
                      href={`/autopsy?domain=${encodeURIComponent(weakest)}&q=${encodeURIComponent(q.text)}`}
                      title={`Fetch ${weakest}'s page for this question and yours, and score both on the same nine factors`}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Take {weakest}</span>
                    </a>
                  ) : (
                    <a
                      className="btn btn--sm"
                      style={{ maxWidth: "100%" }}
                      href={`/pipeline?brief=${encodeURIComponent(q.text)}`}
                      title="Send this question to the pipeline, which drafts a page for it and blocks on a named human approval"
                    >
                      Write the page
                    </a>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {mapId && (
          <div style={{ marginTop: 24 }}>
            <a className="btn btn--ghost" href={`/api/bundle?map=${encodeURIComponent(mapId)}`} download>
              Export every question · 3 CSVs
            </a>
          </div>
        )}
      </div>
    </Section>
  );
}

/** Count-up for a measured number. Motion, not a timer, so it lands on the real value. */
export function Ticker({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = String(Math.round(v)); },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref} className={className} style={style}>{value}</span>;
}
