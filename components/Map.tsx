"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { animate } from "motion";

gsap.registerPlugin(Flip);
import type { CitationMap, MapCost, MapQuestion, QuestionResult } from "../citationmap/types";
import { INTENTS } from "../citationmap/questions";

/* ------------------------------------------------------------------ *
 * Ownership is encoded on one ink ramp by rank, because the app owns
 * exactly one accent and it belongs to the brand. Red = you. An empty
 * cell = nobody is cited, which is a hole you can walk into.
 *
 * The ramp deliberately starts off full brightness: when one domain holds
 * three quarters of a category, a solid-cream field is what you get, and
 * the two things worth hunting for stop being visible.
 * ------------------------------------------------------------------ */
const RANK_INK = [
  "rgba(236,235,231,.66)",
  "rgba(236,235,231,.44)",
  "rgba(236,235,231,.30)",
  "rgba(236,235,231,.20)",
  "rgba(236,235,231,.13)",
];

export function shadeFor(owner: string | null, isBrand: boolean, rank: number): string {
  if (isBrand) return "var(--red)";
  if (!owner) return "transparent";
  return RANK_INK[Math.min(rank, RANK_INK.length - 1)];
}

type CellState =
  | { phase: "pending" }
  | { phase: "running" }
  | { phase: "done"; result: QuestionResult };

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function MapScreen() {
  const [topic, setTopic] = useState("vitamin c serum");
  const [brand, setBrand] = useState("Meridian Skin Lab");
  const [domain, setDomain] = useState("meridianskinlab.com");
  const [market, setMarket] = useState("UK");

  const [questions, setQuestions] = useState<MapQuestion[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [map, setMap] = useState<CitationMap | null>(null);
  const [cost, setCost] = useState<MapCost | null>(null);
  const [engine, setEngine] = useState<{ label: string; mode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<QuestionResult | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const [settled, setSettled] = useState(false);

  /** Final rank per domain, only known once the whole map is in. */
  const rankOf = useMemo(() => {
    const m = new Map<string, number>();
    map?.domains.filter((d) => !d.isBrand).forEach((d, i) => m.set(d.domain, i));
    return m;
  }, [map]);

  /**
   * During the run the cells sit in question order, so the fill reads as live sampling.
   * Once the map is complete they regroup by owner: scattered greys become one visible
   * continent, a sliver for you, and a handful of outlined holes. That regrouping is the
   * finding, so it is animated rather than swapped.
   */
  const ordered = useMemo(() => {
    if (!settled || !map) return questions;
    const rank = (id: string) => {
      const c = cells[id];
      if (c?.phase !== "done") return 99;
      const r = c.result;
      if (r.brandRank > 0) return -1;
      if (!r.owner) return 98;
      return rankOf.get(r.owner) ?? 90;
    };
    return [...questions].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  }, [settled, map, questions, cells, rankOf]);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMap(null);
    setPicked(null);
    setCells({});
    setQuestions([]);
    setCost(null);
    setSettled(false);
    flipState.current = null;
    setPhase("Decomposing the category into buyer questions");

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
            setCells(Object.fromEntries(ev.questions.map((q: MapQuestion) => [q.id, { phase: "pending" as const }])));
            setPhase(`Asking the engine all ${ev.questions.length} questions`);
          }
          if (ev.type === "result") {
            setCells((prev) => ({ ...prev, [ev.result.id]: { phase: "done", result: ev.result } }));
            setCost(ev.cost);
          }
          if (ev.type === "done") {
            // capture the scattered layout before React reorders, so Flip can animate the regroup
            if (gridRef.current) flipState.current = Flip.getState(gridRef.current.querySelectorAll("[data-cell]"));
            setMap(ev.map);
            setCost(ev.map.cost);
            setSettled(true);
            setPhase("");
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

  /* The one moment the whole grid moves. Flip animates each cell from where it sat
     during the run to its place in its owner's territory. Reduced motion gets the
     same final layout with no travel. */
  useLayoutEffect(() => {
    const state = flipState.current;
    if (!settled || !state || !gridRef.current) return;
    flipState.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // no `absolute`: the cells stay in flow at their final slots and travel by transform,
    // so the grid keeps its height and nothing below it jumps during the 0.9s
    Flip.from(state, { duration: 0.9, ease: "expo.inOut", stagger: { amount: 0.35, from: "start" } });
  }, [settled]);

  const done = Object.values(cells).filter((c) => c.phase === "done").length;
  const total = questions.length;

  return (
    <div style={{ paddingBottom: 140 }}>
      <MapBar
        topic={topic} setTopic={setTopic}
        brand={brand} setBrand={setBrand}
        domain={domain} setDomain={setDomain}
        market={market} setMarket={setMarket}
        onRun={run} busy={busy}
      />

      {error && (
        <div className="gut" style={{ background: "rgba(255,59,59,.08)", borderBottom: "1px solid var(--red)", paddingTop: 16, paddingBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <span className="m" style={{ color: "var(--red)" }}>FAILED</span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{error}</span>
          <button className="btn btn--sm btn--ghost" style={{ marginLeft: "auto" }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="gut">
        {!total && !busy && <MapEmpty />}

        {(busy || total > 0) && (
          <>
            <div className="map-layout" style={{ paddingTop: 54 }}>
              <div>
                <Verdict map={map} topic={topic} done={done} total={total} phase={phase} />
                <div style={{ marginTop: 46 }}>
                  <Territory gridRef={gridRef} questions={ordered} cells={cells} map={map} rankOf={rankOf} onPick={setPicked} picked={picked} settled={settled} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 40, minWidth: 320 }}>
                <Legend map={map} done={done} total={total} />
                {map && <Owners map={map} />}
                <Cost cost={cost} engine={engine} />
              </div>
            </div>

            {picked && <Picked result={picked} brandDomain={map?.brandDomain ?? domain} onClose={() => setPicked(null)} />}
          </>
        )}

        {map && <Queue map={map} />}
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
}) {
  return (
    <div className="rule-b gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--band)", position: "sticky", top: "var(--bar-h)", zIndex: 40 }}>
      <form onSubmit={(e) => { e.preventDefault(); if (!p.busy) p.onRun(); }} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input className="field" style={{ flex: "1 1 340px" }} value={p.topic} onChange={(e) => p.setTopic(e.target.value)} placeholder="Category, e.g. vitamin c serum" aria-label="Category" />
        <input className="field" style={{ width: 210 }} value={p.brand} onChange={(e) => p.setBrand(e.target.value)} aria-label="Brand name" />
        <input className="field" style={{ width: 230 }} value={p.domain} onChange={(e) => p.setDomain(e.target.value)} placeholder="yourdomain.com" aria-label="Your domain" />
        <select className="field" style={{ width: 110 }} value={p.market} onChange={(e) => p.setMarket(e.target.value)} aria-label="Market">
          {["UK", "SE", "DK", "US", "FR"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="btn btn--primary" type="submit" disabled={p.busy}>{p.busy ? "Mapping…" : "Map the category"}</button>
      </form>
    </div>
  );
}

/**
 * The waiting grid. Same object the run fills, so the screen is never a half-empty
 * page of prose, and the device is legible before a single call is made.
 */
function MapEmpty() {
  return (
    <div className="map-layout" style={{ paddingTop: 84, paddingBottom: 96 }}>
      <div className="map-grid ghost-grid" aria-hidden>
        {Array.from({ length: 160 }, (_, i) => (
          <span key={i} className="cell ghost" style={{ animationDelay: `${(i % 16) * 40 + Math.floor(i / 16) * 70}ms` }} />
        ))}
      </div>
      <div>
        <h1 className="h1" style={{ maxWidth: "13ch" }}>Your category, as the engine answers it.</h1>
        <p className="lede" style={{ maxWidth: "44ch", marginTop: 24, fontSize: 19 }}>
          One cell, one real question. The fill is whoever gets quoted. Check any of them by typing it
          into ChatGPT yourself.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 38 }}>
          {INTENTS.map((i) => (
            <span key={i.id} className="m" style={{ border: "1px solid var(--rule)", padding: "8px 12px", color: "var(--ink)" }}>
              {i.label}
            </span>
          ))}
        </div>
        <p className="m" style={{ color: "var(--meta)", marginTop: 18 }}>EIGHT ANGLES · TWENTY QUESTIONS EACH</p>
      </div>
    </div>
  );
}

/* ------------------------------ verdict ------------------------------ */

function Verdict({ map, topic, done, total, phase }: { map: CitationMap | null; topic: string; done: number; total: number; phase: string }) {
  if (!map) {
    return (
      <div>
        <h1 className="h1" style={{ maxWidth: "18ch" }}>Reading the category, one question at a time.</h1>
        <p className="lede" style={{ marginTop: 20, maxWidth: "50ch" }}>
          {phase || "Working"}{total ? ` · ${done} of ${total} answered` : ""}.
        </p>
      </div>
    );
  }
  const top = map.domains.find((d) => !d.isBrand);
  const yours = map.domains.find((d) => d.isBrand);
  return (
    <div>
      <h1 className="h1" style={{ maxWidth: "22ch" }}>
        {top ? (
          <>
            {top.domain} answers <Ticker value={top.wins} /> of your {map.questions.length} questions.
          </>
        ) : (
          `Nobody owns ${topic}.`
        )}
      </h1>
      <p className="lede" style={{ marginTop: 22, maxWidth: "62ch" }}>
        {yours ? `You are quoted on ${yours.appearances}.` : "You are never quoted."} On {map.counts.open} of
        them the engine names no site at all, and those are the cheapest to take.
      </p>
    </div>
  );
}

/* ---------------------------- the territory --------------------------- */

function Territory({
  gridRef, questions, cells, map, rankOf, onPick, picked, settled,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  questions: MapQuestion[];
  cells: Record<string, CellState>;
  map: CitationMap | null;
  rankOf: Map<string, number>;
  onPick: (r: QuestionResult) => void;
  picked: QuestionResult | null;
  settled: boolean;
}) {
  const [hover, setHover] = useState<{ r: QuestionResult; x: number; y: number } | null>(null);

  return (
    <div>
      <div ref={gridRef} className="map-grid" onMouseLeave={() => setHover(null)}>
        {questions.map((q) => {
          const c = cells[q.id];
          const r = c?.phase === "done" ? c.result : null;
          const isBrand = !!r && r.brandRank > 0;
          const rank = r?.owner ? (rankOf.get(r.owner) ?? 0) : 0;
          const empty = !!r && !isBrand && !r.owner;
          return (
            <button
              key={q.id}
              data-cell
              data-done={r ? "1" : "0"}
              data-sel={picked?.id === q.id ? "1" : "0"}
              className="cell"
              type="button"
              aria-label={q.text}
              disabled={!r}
              onMouseEnter={(e) => {
                const b = e.currentTarget.getBoundingClientRect();
                if (r) setHover({ r, x: b.left, y: b.bottom });
              }}
              onClick={() => r && onPick(r)}
              style={{
                background: r ? shadeFor(r.owner, isBrand, rank) : "transparent",
                // an unclaimed question keeps a visible outline: it is the hole in the category
                borderColor: empty ? "var(--ink)" : r ? "transparent" : "var(--rule-soft)",
              }}
            />
          );
        })}
      </div>

      {hover && <Tip r={hover.r} x={hover.x} y={hover.y} brandDomain={map?.brandDomain} />}

      <p className="m" style={{ color: "var(--meta)", marginTop: 20 }}>
        {settled ? "GROUPED BY WHO IS QUOTED · CLICK A CELL TO OPEN THE QUESTION" : "ONE CELL = ONE REAL QUESTION"}
      </p>
    </div>
  );
}

function Tip({ r, x, y, brandDomain }: { r: QuestionResult; x: number; y: number; brandDomain?: string }) {
  return (
    <div
      style={{
        position: "fixed", left: Math.min(x, window.innerWidth - 420), top: y + 8, width: 400, zIndex: 60,
        background: "#0a0a0a", border: "1px solid var(--rule)", padding: "16px 18px", pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{sentence(r.text)}</div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {r.domains.length === 0 && <span className="m" style={{ color: "var(--red)" }}>NO SITE CITED</span>}
        {r.domains.map((d, i) => (
          <span key={d} style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: d === brandDomain ? "var(--red)" : "var(--ink)" }}>
            {i + 1}. {d}{d === brandDomain ? "  ← you" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- legend ------------------------------- */

function Legend({ map, done, total }: { map: CitationMap | null; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      {total > done && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="m">ANSWERED</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{done} / {total}</span>
          </div>
          <div style={{ height: 2, background: "var(--rule)", marginTop: 10 }}>
            <div style={{ height: 2, width: `${pct}%`, background: "var(--red)", transition: "width 240ms cubic-bezier(0.215,0.61,0.355,1)" }} />
          </div>
        </div>
      )}

      <div>
        <div className="m" style={{ marginBottom: 14 }}>HOW TO READ THE GRID</div>
        {[
          ["var(--red)", "You are quoted", map ? map.counts.owned : null],
          [RANK_INK[0], "One site owns it", map ? map.counts.lost : null],
          [RANK_INK[2], "Split between sites", map ? map.counts.contested : null],
          ["transparent", "Nobody is quoted", map ? map.counts.open : null],
        ].map(([c, label, n]) => (
          <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", borderTop: "1px solid var(--rule-soft)" }}>
            <span style={{ width: 16, height: 16, background: c as string, border: c === "transparent" ? "1px solid var(--ink)" : "none", flex: "none" }} />
            <span style={{ fontSize: 16 }}>{label as string}</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 15 }}>
              {n === null ? "—" : <Ticker value={n as number} />}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}

function Cost({ cost, engine }: { cost: MapCost | null; engine: { label: string; mode: string } | null }) {
  return (
    <div>
      <div className="m" style={{ marginBottom: 12 }}>WHAT THIS RUN COST</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.9 }}>
        {!cost && <div>Not started</div>}
        {cost && cost.calls > 0 && (
          <>
            <div>{cost.calls} live calls to the engine</div>
            <div>{(cost.inTokens + cost.outTokens).toLocaleString("en-US")} tokens billed</div>
            <div style={{ color: "var(--red)", fontSize: 15 }}>${cost.usd.toFixed(4)}</div>
          </>
        )}
        {cost && cost.calls === 0 && cost.replayed > 0 && (
          <>
            <div>{cost.replayed} answers replayed from the recording</div>
            <div style={{ color: "var(--go)", fontSize: 15 }}>$0.0000 spent</div>
          </>
        )}
      </div>
      <p className="m-sm meta" style={{ marginTop: 10, lineHeight: 1.7, textTransform: "none", letterSpacing: 0.2 }}>
        {cost?.rate}
      </p>
      {engine && (
        <p className="m-sm meta" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0.2 }}>
          Engine {engine.label} · mode {engine.mode}
        </p>
      )}
    </div>
  );
}

/* --------------------------- picked question -------------------------- */

function Picked({ result, brandDomain, onClose }: { result: QuestionResult; brandDomain: string; onClose: () => void }) {
  const winner = result.domains.find((d) => d !== brandDomain) ?? null;
  return (
    <div style={{ borderTop: "1px solid var(--red)", background: "var(--band)", padding: "28px 30px", marginTop: 44 }}>
      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>
          <div className="m" style={{ color: "var(--red)" }}>SELECTED QUESTION · {result.intent.toUpperCase()}</div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3, marginTop: 12 }}>{sentence(result.text)}</div>
          <p className="lede" style={{ marginTop: 14, maxWidth: "58ch", fontSize: 17 }}>
            {result.domains.length === 0
              ? "The engine answered without naming a single source. There is no page to beat here, only a page to write."
              : `The engine credits ${result.domains[0]}${result.brandRank > 0 ? `, and you at position ${result.brandRank}` : ", and never you"}.`}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {winner ? (
            <a className="btn btn--primary" href={`/autopsy?domain=${encodeURIComponent(winner)}&q=${encodeURIComponent(result.text)}`}>
              Autopsy {winner}
            </a>
          ) : (
            <a className="btn btn--primary" href={`/pipeline?brief=${encodeURIComponent(result.text)}`}>Brief a page for this</a>
          )}
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- who owns the category -------------------------- */

/**
 * The ranking sits beside the grid rather than under it: the swatch is the same ink
 * the territory uses, so the block on the left and the name on the right are one read.
 * Every line carries the button that acts on it.
 */
function Owners({ map }: { map: CitationMap }) {
  const top = map.domains.slice(0, 6);
  const max = top[0]?.wins || 1;
  const ink = (d: (typeof top)[number], i: number) => (d.isBrand ? "var(--red)" : RANK_INK[Math.min(i, RANK_INK.length - 1)]);
  return (
    <div>
      <div className="m" style={{ marginBottom: 14 }}>WHO GETS QUOTED, RANKED</div>
      {top.map((d, i) => (
        <div key={d.domain} style={{ padding: "13px 0", borderTop: "1px solid var(--rule-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 14, height: 14, flex: "none", background: ink(d, i) }} />
            <span style={{ fontSize: 17, fontWeight: 600, color: d.isBrand ? "var(--red)" : "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.domain}{d.isBrand ? " (you)" : ""}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 15, flex: "none" }}>{d.wins}</span>
            {!d.isBrand && (
              <a className="btn btn--sm" href={`/autopsy?domain=${encodeURIComponent(d.domain)}`} style={{ flex: "none" }}>Autopsy</a>
            )}
          </div>
          <span style={{ display: "block", height: 5, background: "var(--rule-soft)", marginTop: 9 }}>
            <span style={{ display: "block", height: 5, width: `${(d.wins / max) * 100}%`, background: ink(d, i) }} />
          </span>
        </div>
      ))}
      <p className="m-sm meta" style={{ marginTop: 12, textTransform: "none", letterSpacing: 0.2 }}>
        Counted on questions where the domain is named first.
      </p>
      <a className="btn btn--primary" href={`/api/bundle?map=${encodeURIComponent(map.id)}`} style={{ marginTop: 20 }} download>
        Download the map as files
      </a>
    </div>
  );
}

/* ------------------------------- the queue ------------------------------- */

function Queue({ map }: { map: CitationMap }) {
  const open = map.questions.filter((q) => q.bucket === "open").slice(0, 6);
  const lost = map.questions.filter((q) => q.bucket === "lost").slice(0, 6);
  return (
    <section style={{ paddingTop: 140 }}>
      <h2 className="h1" style={{ fontSize: "clamp(34px,2.6vw,46px)", maxWidth: "22ch" }}>What to do on Monday.</h2>
      <p className="lede" style={{ marginTop: 18, maxWidth: "62ch" }}>
        Two routes, and every question lands in exactly one. Nothing here is a recommendation
        without a button attached to it.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 64, marginTop: 44 }}>
        <Route
          title="Nobody is cited"
          sub="No page to beat. Write one, and the pipeline grounds it on the local winning term."
          rows={open}
          action={(q) => ({ label: "Brief a page", href: `/pipeline?brief=${encodeURIComponent(q.text)}` })}
        />
        <Route
          title="A competitor owns it"
          sub="A page already wins this. Autopsy it against yours before writing anything."
          rows={lost}
          action={(q) => ({ label: `Autopsy ${q.owner}`, href: `/autopsy?domain=${encodeURIComponent(q.owner ?? "")}&q=${encodeURIComponent(q.text)}` })}
        />
      </div>
    </section>
  );
}

function Route({ title, sub, rows, action }: {
  title: string; sub: string; rows: QuestionResult[];
  action: (q: QuestionResult) => { label: string; href: string };
}) {
  return (
    <div>
      <div className="h2">{title}</div>
      <p style={{ fontSize: 16, lineHeight: 1.6, marginTop: 10, maxWidth: "48ch" }}>{sub}</p>
      <div style={{ marginTop: 24, borderTop: "1px solid var(--rule)" }}>
        {rows.length === 0 && <p style={{ fontSize: 16, padding: "18px 0" }}>Nothing in this route on this map.</p>}
        {rows.map((q) => {
          const a = action(q);
          return (
            <div key={q.id} style={{ display: "flex", gap: 18, alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--rule-soft)" }}>
              {/* same swatch the grid uses, so a row traces back to its cell */}
              <span
                style={{
                  width: 14, height: 14, flex: "none",
                  background: q.bucket === "open" ? "transparent" : RANK_INK[0],
                  border: q.bucket === "open" ? "1px solid var(--ink)" : "none",
                }}
              />
              <span style={{ fontSize: 16.5, lineHeight: 1.45, flex: 1, minWidth: 0 }}>{sentence(q.text)}</span>
              <a className="btn btn--sm" href={a.href} style={{ flex: "none" }}>{a.label}</a>
            </div>
          );
        })}
      </div>
    </div>
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
