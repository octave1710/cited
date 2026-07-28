"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { animate } from "motion";

gsap.registerPlugin(Flip);
import type { CitationMap, MapCost, MapQuestion, QuestionResult } from "../citationmap/types";
import { INTENTS } from "../citationmap/questions";
import { deriveSignals, type Difficulty, type EntryPoint, type MapSignals } from "../citationmap/signals";
import { DeltaPanel, History } from "./History";
import { BRAND_COLOUR, Favicon, REST_COLOUR, TerritoryMap, toTerritories } from "./Territory";
import type { MapDelta } from "../citationmap/compare";

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
  const [delta, setDelta] = useState<{ delta: MapDelta | null; noBaselineReason?: string } | null>(null);

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
    setDelta(null);
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
            // the baseline is whatever previous run covered the same category, brand
            // and market. Absent, the panel says so rather than showing a zero.
            fetch(`/api/map?id=${encodeURIComponent(ev.map.id)}&delta=1`)
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
      setCells(Object.fromEntries(m.questions.map((q) => [q.id, { phase: "done" as const, result: q }])));
      setMap(m);
      setCost(m.cost);
      setEngine({ label: m.engine, mode: "stored" });
      setSettled(true);
      setPicked(null);
      flipState.current = null;
      setDelta({ delta: d.delta ?? null, noBaselineReason: d.noBaselineReason });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  /** Pure derivation over the finished map, so it costs nothing and needs no round trip. */
  const signals = useMemo(() => (map ? deriveSignals(map) : null), [map]);

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
        currentId={map?.id} onOpen={openStored}
      />

      {error && (
        <div className="gut" style={{ background: "rgba(255,59,59,.08)", borderBottom: "1px solid var(--red)", paddingTop: 16, paddingBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <span className="m" style={{ color: "var(--red)" }}>FAILED</span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{error}</span>
          <button className="btn btn--sm btn--ghost" style={{ marginLeft: "auto" }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="gut">
        <div className="shell">
        {!total && !busy && <MapEmpty />}

        {(busy || total > 0) && (
          <>
            <div style={{ paddingTop: 48 }}>
              <Verdict map={map} topic={topic} done={done} total={total} phase={phase} />
            </div>

            {/* the run itself stays a live grid: cells fill as answers land. Once the
                map is complete it is replaced by area, which is the finding. */}
            {!map && (
              <div style={{ marginTop: 40 }}>
                <RunGrid gridRef={gridRef} questions={ordered} cells={cells} map={map} rankOf={rankOf} onPick={setPicked} picked={picked} settled={settled} />
              </div>
            )}

            {map && (
              <>
                {/* one row, both columns the same height, so there is no dead space under
                    the map. The legend and the cost sit under it as a band rather than
                    stacking the side column into something twice as tall. */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 26, alignItems: "stretch", marginTop: 24, height: 430 }}>
                  <TerritoryMap
                    map={map}
                    onPick={(d) => (window.location.href = `/autopsy?domain=${encodeURIComponent(d)}`)}
                  />
                  <Owners map={map} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 26, marginTop: 22, alignItems: "start" }}>
                  <Legend map={map} done={done} total={total} />
                  <Cost cost={cost} engine={engine} />
                </div>
              </>
            )}

            {picked && (
              <Picked
                result={picked}
                brandDomain={map?.brandDomain ?? domain}
                entry={signals?.entryPoints.find((e) => e.id === picked.id)}
                onClose={() => setPicked(null)}
              />
            )}
          </>
        )}

        {map && signals && <Queue map={map} signals={signals} />}
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
    <div className="rule-b gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--band)", position: "sticky", top: "var(--bar-h)", zIndex: 40 }}>
      <div className="shell">
      <form onSubmit={(e) => { e.preventDefault(); if (!p.busy) p.onRun(); }} className="bar">
        <input className="field" style={{ flex: "1 1 340px" }} value={p.topic} onChange={(e) => p.setTopic(e.target.value)} placeholder="Category, e.g. vitamin c serum" aria-label="Category" />
        <input className="field" style={{ width: 210 }} value={p.brand} onChange={(e) => p.setBrand(e.target.value)} aria-label="Brand name" />
        <input className="field" style={{ width: 230 }} value={p.domain} onChange={(e) => p.setDomain(e.target.value)} placeholder="yourdomain.com" aria-label="Your domain" />
        <select className="field" style={{ width: 110 }} value={p.market} onChange={(e) => p.setMarket(e.target.value)} aria-label="Market">
          {["UK", "SE", "DK", "US", "FR"].map((m) => <option key={m} value={m}>{m}</option>)}
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
        {yours ? `You are quoted on ${yours.appearances}.` : "You are never quoted."} On{" "}
        {map.counts.open + map.counts.reference} of them no commercial page is cited at all.
      </p>
    </div>
  );
}

/* ---------------------------- the territory --------------------------- */

function RunGrid({
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
  const rows: [string, string, string, number | null][] = [
    ["var(--brand)", "You are quoted", "your domain appears in the engine's source list", map ? map.counts.owned : null],
    ["var(--d1)", "One site owns it", "the first-cited site also wins a large share of the whole map", map ? map.counts.lost : null],
    ["var(--d3)", "Split between sites", "several sites are cited and none of them owns the category", map ? map.counts.contested : null],
    ["var(--d-rest)", "Only reference sites", "the engine named encyclopedias or government pages, no commercial page", map ? map.counts.reference : null],
    ["transparent", "No site named at all", "the engine answered without citing anything", map ? map.counts.open : null],
  ];

  return (
    <div>
      {total > done && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="m" style={{ color: "var(--meta)" }}>ANSWERED</span>
            <span className="num" style={{ fontSize: 13 }}>{done} / {total}</span>
          </div>
          <div style={{ height: 3, background: "var(--s2)", marginTop: 8 }}>
            <div style={{ height: 3, width: `${pct}%`, background: "var(--brand)", transition: "width 240ms cubic-bezier(0.215,0.61,0.355,1)" }} />
          </div>
        </div>
      )}

      <div className="m" style={{ color: "var(--meta)", marginBottom: 10 }}>WHAT EACH QUESTION CAME BACK AS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 2 }}>
        {rows.map(([c, label, help, n]) => (
          <div key={label} className="card" style={{ padding: "12px 14px", background: "var(--s1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 12, height: 12, flex: "none", background: c, border: c === "transparent" ? "1px solid var(--ink)" : "none" }} />
              <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{label}</span>
              <span className="num" style={{ fontSize: 16, fontWeight: 700 }}>{n === null ? "—" : n}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--meta)", marginTop: 7 }}>{help}</p>
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
            {cost.usd === null ? (
              <div style={{ color: "var(--amber)", fontSize: 15 }}>spend not computed</div>
            ) : (
              <div style={{ color: "var(--red)", fontSize: 15 }}>${cost.usd.toFixed(4)}</div>
            )}
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

function Picked({ result, brandDomain, entry, onClose }: {
  result: QuestionResult;
  brandDomain: string;
  entry?: EntryPoint;
  onClose: () => void;
}) {
  // route at the softest chair when the map knows one, never at the category owner
  const winner = entry?.weakest?.domain ?? result.domains.find((d) => d !== brandDomain) ?? null;
  return (
    <div style={{ borderTop: "1px solid var(--red)", background: "var(--band)", padding: "28px 30px", marginTop: 44 }}>
      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>
          <div className="m" style={{ color: "var(--red)" }}>SELECTED QUESTION · {result.intent.toUpperCase()}</div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3, marginTop: 12 }}>{sentence(result.text)}</div>
          <p className="lede" style={{ marginTop: 14, maxWidth: "58ch", fontSize: 17 }}>
            {entry?.reason ??
              (result.domains.length === 0
                ? "The engine answered without naming a single source. There is no page to beat here, only a page to write."
                : `The engine credits ${result.domains[0]}${result.brandRank > 0 ? `, and you at position ${result.brandRank}` : ", and never you"}.`)}
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
/**
 * The order book. Same colours as the treemap, so a block on the left and a line on
 * the right are read as one object. Two bars per row: how often the engine puts a
 * domain first, and how often it names it at all. The gap between them is the whole
 * "always in the room, never chosen" finding, visible without a sentence.
 */
function Owners({ map }: { map: CitationMap }) {
  const territories = toTerritories(map);
  const colourOf = new Map(territories.map((t) => [t.domain, t.colour]));
  const top = map.domains.slice(0, 5);
  const max = Math.max(...top.map((d) => d.appearances), 1);

  return (
    <div className="card" style={{ padding: "16px 18px", minHeight: 0, overflow: "hidden" }}>
      <div className="m" style={{ marginBottom: 16, color: "var(--meta)" }}>WHO THE ENGINE QUOTES</div>

      {top.map((d) => {
        const colour = d.isBrand ? BRAND_COLOUR : (colourOf.get(d.domain) ?? REST_COLOUR);
        return (
          <div key={d.domain} style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Favicon domain={d.domain} size={20} />
              <span
                style={{
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: d.isBrand ? "var(--brand)" : "var(--ink)",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {d.domain}
                {d.isBrand && <span style={{ color: "var(--meta)", fontWeight: 400 }}> · you</span>}
              </span>
              <span className="num" style={{ fontSize: 15, fontWeight: 700, color: colour }}>{d.wins}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
              <span style={{ display: "block", height: 7, background: "var(--s2)" }}>
                <span style={{ display: "block", height: 7, width: `${(d.wins / max) * 100}%`, background: colour }} />
              </span>
              <span style={{ display: "block", height: 3, background: "var(--s2)" }}>
                <span
                  style={{ display: "block", height: 3, width: `${(d.appearances / max) * 100}%`, background: colour, opacity: 0.4 }}
                />
              </span>
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--meta)", marginTop: 10 }}>
        Thick bar: named first. Thin: named at all. The gap is a site the engine keeps in
        the room and never chooses.
      </p>
    </div>
  );
}

/* ------------------------------- the queue ------------------------------- */

/**
 * The work order, sorted easiest first, routed at the weakest occupant rather than at
 * the site that owns the category. Displacing the domain that wins 118 of 158 is a
 * year; displacing the one that wins nothing anywhere is a page.
 */
function Queue({ map, signals }: { map: CitationMap; signals: MapSignals }) {
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const all = signals.entryPoints.filter((e) => difficulty === "all" || e.difficulty === difficulty);
  // showing twelve of a hundred and fifty and calling the filter "All" is a lie about
  // what is on screen. The full list is one click away and the CSV is next to it.
  const rows = showAll ? all : all.slice(0, 12);
  const counts = signals.entryPoints.reduce<Record<string, number>>((a, e) => ({ ...a, [e.difficulty]: (a[e.difficulty] ?? 0) + 1 }), {});

  return (
    <section style={{ paddingTop: 140 }}>
      <h2 className="h1" style={{ fontSize: "clamp(34px,2.6vw,46px)", maxWidth: "24ch" }}>
        {signals.softChairQuestions} of these answers have a seat you can take.
      </h2>
      <p className="lede" style={{ marginTop: 18, maxWidth: "64ch" }}>
        An answer names up to five sites. Beating the one that owns the category is a year of work.
        Taking the seat held by a site that wins nothing anywhere is a page.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 30, flexWrap: "wrap", alignItems: "center" }}>
        {([
          ["all", `All ${signals.entryPoints.length}`, "Every question you do not currently hold."],
          ["open", `Nobody cited · ${counts.open ?? 0}`, "The engine named no commercial page. Nothing to beat, a page to write."],
          ["contested", `Split · ${counts.contested ?? 0}`, "Several sites are cited and none of them owns the category."],
          ["monopoly", `One site owns it · ${counts.monopoly ?? 0}`, "The first-cited site also wins a large share of the whole map."],
        ] as const).map(([key, label, help]) => (
          <button
            key={key}
            title={help}
            className={`btn btn--sm ${difficulty === key ? "btn--primary" : "btn--ghost"}`}
            onClick={() => {
              setDifficulty(key as Difficulty | "all");
              setShowAll(false);
            }}
          >
            {label}
          </button>
        ))}
        <a
          className="btn btn--sm"
          href={`/api/bundle?map=${encodeURIComponent(map.id)}`}
          download
          style={{ marginLeft: "auto" }}
        >
          Export all {signals.entryPoints.length} to CSV
        </a>
      </div>

      <p style={{ fontSize: 15.5, lineHeight: 1.6, marginTop: 14, maxWidth: "88ch" }}>
        {difficulty === "all"
          ? "Sorted easiest first. The logos are the sites the engine actually named in that answer, in its order. The one ringed in orange is the seat worth taking."
          : difficulty === "open"
            ? "The engine named no commercial page on these. There is nothing to outrank, only a page to write."
            : difficulty === "contested"
              ? "Several sites are cited here and none of them owns the category, so the incumbent is beatable."
              : "The site cited first also wins a large share of the whole map. The way in is the weaker site sitting beside it, ringed on each row."}
      </p>

      {/* what each button does, because a row of verbs with no mechanism behind them is
          the exact thing that makes a tool feel like a mock-up */}
      <div
        className="card"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20, padding: "16px 18px", marginTop: 18 }}
      >
        <div>
          <div className="m" style={{ color: "var(--brand)", marginBottom: 6 }}>TAKE A SEAT</div>
          <p style={{ fontSize: 14.5, lineHeight: 1.55 }}>
            Fetches that site&apos;s page for this question and your page, runs the same nine factors on both, and
            shows the gap with the exact text pulled off each one. You leave with the rewrites and a corrected HTML file.
          </p>
        </div>
        <div>
          <div className="m" style={{ color: "var(--brand)", marginBottom: 6 }}>WRITE THE PAGE</div>
          <p style={{ fontSize: 14.5, lineHeight: 1.55 }}>
            Sends the question to the multi-market pipeline, which grounds it on the term that wins in that market,
            drafts answer-first, scores itself, and stops dead until a named human approves.
          </p>
        </div>
        <div>
          <div className="m" style={{ color: "var(--brand)", marginBottom: 6 }}>EXPORT TO CSV</div>
          <p style={{ fontSize: 14.5, lineHeight: 1.55 }}>
            All {signals.entryPoints.length} rows as a file: the question, every site named, which one holds the
            weakest seat, and its record across the map. Retype any question into ChatGPT to check the row yourself.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 30, borderTop: "1px solid var(--rule)" }}>
        {rows.length === 0 && <p style={{ fontSize: 16, padding: "18px 0" }}>Nothing in this route on this map.</p>}
        {rows.map((e) => (
          <div key={e.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {/* who is actually in this answer, in the engine's own order. A grey square
                  told the user nothing; five logos say who to beat before a word is read. */}
              <span style={{ display: "flex", gap: 3, flex: "none", width: 118, alignItems: "center" }}>
                {e.occupants.length === 0 && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--brand)", letterSpacing: 0.6 }}>
                    NOBODY
                  </span>
                )}
                {e.occupants.slice(0, 5).map((o) => (
                  <span
                    key={o.domain}
                    title={`${o.domain} · slot ${o.slot} here · wins ${o.winsAcross} across the map`}
                    style={{
                      // the seat we are telling them to take is the only one at full strength
                      opacity: o.domain === e.weakest?.domain ? 1 : 0.34,
                      outline: o.domain === e.weakest?.domain ? "2px solid var(--brand)" : "none",
                      outlineOffset: 1,
                      display: "block",
                    }}
                  >
                    <Favicon domain={o.domain} size={20} />
                  </span>
                ))}
              </span>

              <span style={{ fontSize: 15.5, lineHeight: 1.45, flex: 1, minWidth: 0 }}>{sentence(e.text)}</span>

              {e.weakest ? (
                <a
                  className="btn btn--sm"
                  href={`/autopsy?domain=${encodeURIComponent(e.weakest.domain)}&q=${encodeURIComponent(e.text)}`}
                  style={{ flex: "none" }}
                  title={`Fetch ${e.weakest.domain}'s page for this question, fetch yours, and score both on the same nine factors`}
                >
                  Take {e.weakest.domain}&apos;s seat
                </a>
              ) : (
                <a
                  className="btn btn--sm"
                  href={`/pipeline?brief=${encodeURIComponent(e.text)}`}
                  style={{ flex: "none" }}
                  title="Send this question to the content pipeline, which drafts a page for it and blocks on a named human approval"
                >
                  Write the page
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {all.length > rows.length && (
        <button className="btn" style={{ marginTop: 22 }} onClick={() => setShowAll(true)}>
          Show the other {all.length - rows.length}
        </button>
      )}
    </section>
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
