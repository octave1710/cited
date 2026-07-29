"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ENGINES, type EngineKey } from "../engines/types";
import type { Board, DomainRow } from "../engines/board";
import { Favicon } from "./Territory";
import { Entity, Label, Num, useEntry } from "./da";

/**
 * The board. Who six real answer engines actually cite, on one surface.
 *
 * Three facts are encoded separately because they are separate problems:
 *   the SPINE on the left is engine reach, one lit segment per engine that cites you.
 *     A domain every engine quotes is unavoidable; one engine quoting you nine times
 *     is a single point of failure. Sorting on the raw total hides exactly that.
 *   each CELL is an area, scaled on the square root of the count, because area is read
 *     as quantity and a linear height makes a 9 look nine times a 1 when the eye reads
 *     the square.
 *   the NOTCH under a cell is a first mention. youtube.com carries the largest share of
 *     this panel and is named first zero times, which a count alone would hide.
 *
 * Nothing here is modelled. Every mark is a citation an engine returned.
 */

// six engines now, not five: 66px each plus a 360px domain column overflowed at 1280
const CELL = 58;
const SPINE = 12;

/**
 * A drawn mark per engine, authored here.
 *
 * The header used to set the product name in mono across a 58px column. "AI OVERVIEW"
 * is 11 characters and runs to about 74px, so with `white-space: nowrap` and centre
 * alignment every name bled into the two columns beside it and the row read as broken
 * type. A 20px mark cannot overflow a 58px column, so the identity is carried by a
 * shape and the caption underneath is cut to something that fits with room to spare.
 * The full product name lives in the column's title attribute.
 *
 * These are not logos. They are six silhouettes chosen to stay apart from each other at
 * 20px: a stack of bars, a four-point star, nested squares, a hexagon, a bowtie, a burst.
 */
const MARKS: Record<EngineKey, React.ReactElement> = {
  // a summarised answer: one solid band over the two lines it compressed
  aiOverview: (
    <g fill="currentColor">
      <rect x="1" y="2" width="18" height="6" />
      <rect x="1" y="11" width="18" height="2" />
      <rect x="1" y="16" width="12" height="2" />
    </g>
  ),
  // a four-point star, the concave diamond
  aiMode: <path d="M10 0.5 L12.1 7.9 L19.5 10 L12.1 12.1 L10 19.5 L7.9 12.1 L0.5 10 L7.9 7.9 Z" fill="currentColor" />,
  // nested squares: a search inside a search
  perplexity: (
    <g>
      <rect x="1" y="1" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="6.5" y="6.5" width="7" height="7" fill="currentColor" />
    </g>
  ),
  // a hexagon with a solid core
  chatgpt: (
    <g>
      <path d="M10 1 L18 5.5 L18 14.5 L10 19 L2 14.5 L2 5.5 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="7.5" y="7.5" width="5" height="5" fill="currentColor" />
    </g>
  ),
  // two triangles facing each other
  gemini: <path d="M1 1 L9 10 L1 19 Z M19 1 L11 10 L19 19 Z" fill="currentColor" />,
  // eight spokes from one centre
  claude: (
    <g stroke="currentColor" strokeWidth="2">
      <line x1="10" y1="1" x2="10" y2="19" />
      <line x1="1" y1="10" x2="19" y2="10" />
      <line x1="3.6" y1="3.6" x2="16.4" y2="16.4" />
      <line x1="16.4" y1="3.6" x2="3.6" y2="16.4" />
    </g>
  ),
};

/** Cut so the widest caption is 52px inside a 58px column. The full name is on hover. */
const CAPTION: Record<EngineKey, string> = {
  aiOverview: "OVERVIEW",
  aiMode: "AI MODE",
  perplexity: "PERPLEX",
  chatgpt: "CHATGPT",
  gemini: "GEMINI",
  claude: "CLAUDE",
};

/** Label at column scale: 10px is the floor, and the tracking is cut to buy the width. */
const CAP_STYLE: React.CSSProperties = { fontSize: 10, letterSpacing: 0.5, display: "block", whiteSpace: "nowrap" };

function EngineMark({ engine, size = 20 }: { engine: EngineKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden focusable="false" style={{ display: "block" }}>
      {MARKS[engine]}
    </svg>
  );
}

export function EngineBoard({ board, limit = 14 }: { board: Board; limit?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => board.rows.slice(0, limit), [board.rows, limit]);
  const max = useMemo(
    () => Math.max(1, ...rows.flatMap((r) => ENGINES.map((e) => r.perEngine[e.key]))),
    [rows],
  );

  /**
   * What the visible column actually adds up to.
   *
   * The header used to print the engine's whole-panel total with no word attached to it,
   * directly above a column of fourteen rows that does not sum to it. Anyone who added
   * the column got a smaller number and had no way to tell whether the board was lying
   * or truncated. Both numbers are now on screen, in that order, and the difference is
   * the tail of domains below the cut.
   */
  const shown = useMemo(() => {
    const acc = Object.fromEntries(ENGINES.map((e) => [e.key, 0])) as Record<EngineKey, number>;
    for (const r of rows) for (const e of ENGINES) acc[e.key] += r.perEngine[e.key];
    return acc;
  }, [rows]);

  useEntry([rows.map((r) => r.domain).join(",")], ref);

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-seg]", { scaleX: 0, transformOrigin: "left center", duration: 0.5, ease: "expo.out", stagger: 0.012 });
      gsap.from("[data-cell]", {
        scale: 0,
        transformOrigin: "center center",
        duration: 0.55,
        ease: "back.out(1.6)",
        stagger: { each: 0.008, from: "start" },
      });
      gsap.from("[data-notch]", { scaleY: 0, transformOrigin: "bottom center", duration: 0.4, ease: "expo.out", delay: 0.3, stagger: 0.01 });
    }, ref);
    return () => ctx.revert();
  }, [board]);

  // the domain column is capped: at 1.5fr it swallowed the slack and shoved the engine
  // headers into each other, so PERPLEXITY and CHATGPT overlapped on a 1280 viewport
  const cols = `minmax(180px, 300px) ${SPINE * ENGINES.length + 8}px repeat(${ENGINES.length}, ${CELL}px) 100px`;

  return (
    <div ref={ref}>
      {/* what is on screen, against what was cited, before a single mark is read */}
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap", marginBottom: 14 }}>
        <Label>SHOWING</Label>
        <Num size={12}>{rows.length}</Num>
        <Label>OF</Label>
        <Num size={12}>{board.rows.length}</Num>
        <Label>DOMAINS CITED · ACROSS</Label>
        <Num size={12}>{board.questionCount}</Num>
        <Label>QUESTIONS AND</Label>
        <Num size={12}>{board.totalCitations}</Num>
        <Label>CITATIONS</Label>
      </div>

      {/* header: a mark per engine, then what it gave here against what it gave in total */}
      <div
        style={{ display: "grid", gridTemplateColumns: cols, gap: 10, alignItems: "end", paddingBottom: 12, justifyContent: "start" }}
      >
        <Label>DOMAIN</Label>
        <span>
          <Label style={{ display: "block" }}>ENGINES</Label>
          <Label style={{ display: "block" }}>THAT CITE</Label>
        </span>
        {ENGINES.map((e) => {
          const p = board.engineProfile.find((x) => x.engine === e.key);
          const total = p?.citations ?? 0;
          const dead = total === 0;
          return (
            <span
              key={e.key}
              title={
                dead
                  ? `${e.label} returned no citations on this panel`
                  : `${e.label} gave ${total} citations across this panel; ${shown[e.key]} of them are in the rows shown below`
              }
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0, color: dead ? "var(--d1)" : "var(--ink)" }}
            >
              <EngineMark engine={e.key} />
              <Label tone={dead ? "d1" : "ink"} style={CAP_STYLE}>{CAPTION[e.key]}</Label>
              {/* fixed, or the shorter SILENT line drops the whole column and the marks go ragged */}
              <span style={{ height: 16, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                {dead ? (
                  <Label tone="d1" style={CAP_STYLE}>SILENT</Label>
                ) : (
                  <>
                    <Num size={12} tone="ink">{shown[e.key]}</Num>
                    <Num size={12} tone="meta">{`/${total}`}</Num>
                  </>
                )}
              </span>
            </span>
          );
        })}
        <span style={{ textAlign: "right" }}>
          <Label style={{ display: "block" }}>SHARE OF ALL</Label>
          <Label style={{ display: "block" }}>NAMED 1ST</Label>
        </span>
      </div>

      {/* a full-width sentence ran across the matrix and broke the column rhythm; it sits
          under the domain column now, where there is no data to collide with */}
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 10, paddingBottom: 14 }}>
        <p style={{ fontSize: 16, lineHeight: 1.45, gridColumn: "1 / 3", margin: 0 }}>
          Read each engine as <strong>shown / total</strong>. Add its column and you get the first number.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--line-strong)" }}>
        {rows.map((r) => (
          <Row key={r.domain} row={r} max={max} cols={cols} open={open === r.domain} onToggle={() => setOpen(open === r.domain ? null : r.domain)} />
        ))}
      </div>

      <Legend board={board} rows={rows} max={max} />
    </div>
  );
}

function Row({
  row,
  max,
  cols,
  open,
  onToggle,
}: {
  row: DomainRow;
  max: number;
  cols: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        data-row
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 10,
          alignItems: "center",
          width: "100%",
          justifyContent: "start",
          padding: "10px 0",
          background: row.isBrand ? "rgba(255,92,61,.07)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--ink)",
        }}
      >
        <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Favicon domain={row.domain} size={20} />
          <Entity
            size={21}
            tone={row.isBrand ? "var(--brand)" : "ink"}
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
          >
            {row.domain}
          </Entity>
        </span>

        {/* the spine: one segment per engine that cites this domain at all */}
        <span style={{ display: "flex", gap: 2 }}>
          {ENGINES.map((e) => (
            <span
              key={e.key}
              data-seg
              title={
                row.perEngine[e.key] > 0
                  ? `${e.label} cites ${row.domain} ${row.perEngine[e.key]} time(s)`
                  : `${e.label} never cites ${row.domain}`
              }
              style={{
                width: SPINE - 2,
                height: 18,
                background: row.perEngine[e.key] > 0 ? "var(--d2)" : "var(--s2)",
                opacity: row.perEngine[e.key] > 0 ? 1 : 0.55,
              }}
            />
          ))}
        </span>

        {ENGINES.map((e) => {
          const n = row.perEngine[e.key];
          // area, not height: the square root keeps the eye's reading honest
          const side = n ? Math.max(9, Math.round(CELL * 0.78 * Math.sqrt(n / max))) : 0;
          return (
            <span key={e.key} style={{ display: "grid", placeItems: "center", height: CELL, position: "relative" }}>
              {n > 0 ? (
                <>
                  <span
                    data-cell
                    title={`${e.label} quoted ${row.domain} ${n} time(s)`}
                    style={{
                      width: side,
                      height: side,
                      background: row.isBrand ? "var(--brand)" : "var(--d3)",
                      display: "block",
                    }}
                  />
                  <span style={{ position: "absolute", pointerEvents: "none" }}>
                    <Num size={12} tone={side > 22 ? "var(--void)" : "var(--ink)"}>{n}</Num>
                  </span>
                </>
              ) : (
                <span title={`${e.label} quoted ${row.domain} 0 times`} style={{ width: 4, height: 1, background: "var(--line-strong)" }} />
              )}
            </span>
          );
        })}

        <span style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <Num size={14} weight={500}>{`${(row.share * 100).toFixed(1)}%`}</Num>
          {/* first mentions get their own shape: being quoted and being quoted FIRST differ */}
          <span style={{ display: "flex", gap: 2, height: 8, alignItems: "flex-end" }}>
            {row.firstMentions > 0 ? (
              Array.from({ length: Math.min(row.firstMentions, 8) }).map((_, i) => (
                <span key={i} data-notch title={`${row.domain} is the first source named ${row.firstMentions} time(s)`} style={{ width: 3, height: 8, background: "var(--d1)" }} />
              ))
            ) : (
              <Label style={{ whiteSpace: "nowrap" }}>NEVER 1ST</Label>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "4px 0 18px" }}>
          <div style={{ marginBottom: 10 }}>
            <Label>THE EXACT PAGES THE ENGINES QUOTED</Label>
          </div>
          {row.pages.slice(0, 8).map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                gap: 14,
                alignItems: "baseline",
                padding: "8px 0",
                borderTop: "1px solid var(--line)",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <span style={{ minWidth: 30 }}>
                <Num size={12} tone="d1">{`${p.count}x`}</Num>
              </span>
              <span style={{ fontSize: 16, flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                {p.title || p.url.replace(/^https?:\/\//, "").slice(0, 90)}
              </span>
              <Label>OPEN</Label>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The legend, in words a marketer can repeat, on the panel's own numbers.
 *
 * The previous wording ("one segment per engine that cites the domain", "one mark per
 * time it is named first") described the drawing rule rather than the finding, and sat
 * next to a generic swatch that belonged to no row on screen. Every entry below is cut
 * from the board that is actually rendered: the spine is a real domain's spine, the
 * square is the largest square drawn above it, the ticks are a real count. A reader can
 * point at the sentence, then point at the row it came from.
 */
function Legend({ board, rows, max }: { board: Board; rows: DomainRow[]; max: number }) {
  const reachRow = [...rows].sort((a, b) => b.engineReach - a.engineReach || b.totalCitations - a.totalCitations)[0];

  let big: { row: DomainRow; engine: EngineKey; n: number } | null = null;
  for (const r of rows) {
    for (const e of ENGINES) {
      const n = r.perEngine[e.key];
      if (n > 0 && (!big || n > big.n)) big = { row: r, engine: e.key, n };
    }
  }

  const firstRow = [...rows].sort((a, b) => b.firstMentions - a.firstMentions)[0];
  const neverFirst = [...rows].filter((r) => r.firstMentions === 0).sort((a, b) => b.totalCitations - a.totalCitations)[0];
  /**
   * Three states, not two. A brand cited but sitting under the cut would otherwise read
   * "orange is you" beside a board with nothing orange on it, which looks like a bug.
   */
  const brandShown = rows.find((r) => r.isBrand);
  const brandRow = brandShown ?? board.brandRow;

  if (!reachRow || !big) return null;

  const bigEngine = ENGINES.find((e) => e.key === big!.engine);
  const bigSide = Math.max(9, Math.round(CELL * 0.78 * Math.sqrt(big.n / max)));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: 32,
        marginTop: 30,
        paddingTop: 24,
        borderTop: "1px solid var(--line)",
      }}
    >
      <Item
        tone="d2"
        title="GREEN BLOCKS · WHO REACHES EVERYWHERE"
        mark={
          <span style={{ display: "flex", gap: 2 }}>
            {ENGINES.map((e) => (
              <span
                key={e.key}
                style={{
                  width: SPINE - 2,
                  height: 18,
                  background: reachRow.perEngine[e.key] > 0 ? "var(--d2)" : "var(--s2)",
                  opacity: reachRow.perEngine[e.key] > 0 ? 1 : 0.55,
                }}
              />
            ))}
          </span>
        }
      >
        One lit block is one engine that quotes the site.{" "}
        <Entity size={17}>{reachRow.domain}</Entity> is quoted by <Num size={14}>{reachRow.engineReach}</Num> of the{" "}
        <Num size={14}>{ENGINES.length}</Num>.
      </Item>

      <Item
        tone="d3"
        title="BLUE SQUARES · HOW OFTEN, PER ENGINE"
        mark={
          <span style={{ display: "grid", placeItems: "center", position: "relative" }}>
            <span style={{ width: bigSide, height: bigSide, background: "var(--d3)", display: "block" }} />
            <span style={{ position: "absolute" }}>
              <Num size={12} tone={bigSide > 22 ? "var(--void)" : "var(--ink)"}>{big.n}</Num>
            </span>
          </span>
        }
      >
        Bigger square, more quotes from that one engine. <Entity size={17}>{big.row.domain}</Entity> was quoted{" "}
        <Num size={14}>{big.n}</Num> times by <Entity size={17}>{bigEngine?.label ?? big.engine}</Entity>, the biggest
        square here.
      </Item>

      <Item
        tone="d1"
        title="AMBER TICKS · WHO GETS NAMED FIRST"
        mark={
          firstRow && firstRow.firstMentions > 0 ? (
            <span style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
              {Array.from({ length: Math.min(firstRow.firstMentions, 8) }).map((_, i) => (
                <span key={i} style={{ width: 3, height: 14, background: "var(--d1)" }} />
              ))}
            </span>
          ) : (
            <Label tone="d1">NOBODY NAMED FIRST HERE</Label>
          )
        }
      >
        {firstRow && firstRow.firstMentions > 0 ? (
          <>
            One tick is one answer that opened with that site.{" "}
            <Entity size={17}>{firstRow.domain}</Entity> opens <Num size={14}>{firstRow.firstMentions}</Num> of them.
            {neverFirst && (
              <>
                {" "}
                <Entity size={17}>{neverFirst.domain}</Entity> is quoted{" "}
                <Num size={14}>{neverFirst.totalCitations}</Num> times and opens none.
              </>
            )}
          </>
        ) : (
          <>No site in these rows is ever the first source an engine names, however often it is quoted.</>
        )}
      </Item>

      <Item
        tone="brand"
        title="ORANGE · YOUR OWN DOMAIN"
        mark={
          <span
            style={{
              width: 22,
              height: 22,
              display: "block",
              background: brandShown
                ? "var(--brand)"
                : "repeating-linear-gradient(135deg, var(--brand) 0 4px, var(--void) 4px 8px)",
            }}
          />
        }
      >
        {brandShown ? (
          <>
            Orange is you. <Entity size={17}>{brandShown.domain}</Entity> is quoted{" "}
            <Num size={14}>{brandShown.totalCitations}</Num> times, by <Num size={14}>{brandShown.engineReach}</Num> of
            the <Num size={14}>{ENGINES.length}</Num>.
          </>
        ) : brandRow ? (
          <>
            Orange is you. <Entity size={17}>{brandRow.domain}</Entity> is quoted{" "}
            <Num size={14}>{brandRow.totalCitations}</Num> times in all, too few to reach the rows above.
          </>
        ) : (
          <>Orange is you. Nothing here is orange, because no page you own was quoted on this panel.</>
        )}
      </Item>
    </div>
  );
}

function Item({
  mark,
  title,
  tone,
  children,
}: {
  mark: React.ReactNode;
  title: string;
  tone: "brand" | "d1" | "d2" | "d3";
  children: React.ReactNode;
}) {
  return (
    <div>
      <span style={{ height: 46, display: "flex", alignItems: "flex-end" }}>{mark}</span>
      <span style={{ display: "block", marginTop: 12 }}>
        <Label tone={tone}>{title}</Label>
      </span>
      <p style={{ fontSize: 16, lineHeight: 1.55, marginTop: 7, maxWidth: "36ch" }}>{children}</p>
    </div>
  );
}
