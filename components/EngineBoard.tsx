"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ENGINES, type EngineKey } from "../engines/types";
import type { Board, DomainRow } from "../engines/board";
import { Favicon } from "./Territory";

/**
 * The board. Who five real answer engines actually cite, on one surface.
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

export function EngineBoard({ board, limit = 14 }: { board: Board; limit?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => board.rows.slice(0, limit), [board.rows, limit]);
  const max = useMemo(
    () => Math.max(1, ...rows.flatMap((r) => ENGINES.map((e) => r.perEngine[e.key]))),
    [rows],
  );

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
      {/* header: the engines name themselves, with what each one gave */}
      <div
        style={{ display: "grid", gridTemplateColumns: cols, gap: 10, alignItems: "end", paddingBottom: 12, justifyContent: "start" }}
      >
        <span className="m" style={{ color: "var(--meta)" }}>DOMAIN</span>
        <span className="m" style={{ color: "var(--meta)" }}>REACH</span>
        {ENGINES.map((e) => {
          const p = board.engineProfile.find((x) => x.engine === e.key);
          const dead = !p || p.citations === 0;
          return (
            <span key={e.key} style={{ textAlign: "center", lineHeight: 1.2 }}>
              <span
                style={{ display: "block", color: dead ? "var(--brand)" : "var(--ink)", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase", whiteSpace: "nowrap" }}
              >
                {e.short.toUpperCase()}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--meta)" }}>
                {dead ? "silent" : p!.citations}
              </span>
            </span>
          );
        })}
        <span className="m" style={{ color: "var(--meta)", textAlign: "right" }}>SHARE</span>
      </div>

      <div style={{ borderTop: "1px solid var(--line-strong)" }}>
        {rows.map((r) => (
          <Row key={r.domain} row={r} max={max} cols={cols} open={open === r.domain} onToggle={() => setOpen(open === r.domain ? null : r.domain)} />
        ))}
      </div>

      <Legend />
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
          <span
            style={{
              fontFamily: "var(--display)",
              fontWeight: 400,
              fontSize: 21,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: row.isBrand ? "var(--brand)" : "var(--ink)",
            }}
          >
            {row.domain}
          </span>
        </span>

        {/* the spine: one segment per engine that cites this domain at all */}
        <span style={{ display: "flex", gap: 2 }}>
          {ENGINES.map((e) => (
            <span
              key={e.key}
              data-seg
              title={`${e.label}: ${row.perEngine[e.key]} citation(s)`}
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
                    title={`${n} citation(s) from ${e.label}`}
                    style={{
                      width: side,
                      height: side,
                      background: row.isBrand ? "var(--brand)" : "var(--d3)",
                      display: "block",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      color: side > 22 ? "var(--void)" : "var(--ink)",
                      fontWeight: 600,
                      pointerEvents: "none",
                    }}
                  >
                    {n}
                  </span>
                </>
              ) : (
                <span style={{ width: 4, height: 1, background: "var(--line-strong)" }} />
              )}
            </span>
          );
        })}

        <span style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
            {(row.share * 100).toFixed(1)}%
          </span>
          {/* first mentions get their own shape: being quoted and being quoted FIRST differ */}
          <span style={{ display: "flex", gap: 2, height: 8, alignItems: "flex-end" }}>
            {row.firstMentions > 0 ? (
              Array.from({ length: Math.min(row.firstMentions, 8) }).map((_, i) => (
                <span key={i} data-notch title={`named first ${row.firstMentions} time(s)`} style={{ width: 3, height: 8, background: "var(--d1)" }} />
              ))
            ) : (
              <span className="m-sm" style={{ color: "var(--meta)", fontSize: 11, letterSpacing: 0.4 }}>NEVER 1ST</span>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "4px 0 18px" }}>
          <div className="m-sm" style={{ color: "var(--meta)", marginBottom: 10 }}>
            THE EXACT PAGES THE ENGINES QUOTED
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
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--d1)", minWidth: 22 }}>{p.count}x</span>
              <span style={{ fontSize: 16, flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                {p.title || p.url.replace(/^https?:\/\//, "").slice(0, 90)}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--meta)" }}>open</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend() {
  const item = (mark: React.ReactNode, text: string) => (
    <span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}>
      {mark}
      <span style={{ fontSize: 14.5, color: "var(--ink)" }}>{text}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginTop: 18 }}>
      {item(
        <span style={{ display: "flex", gap: 2 }}>
          <span style={{ width: 8, height: 14, background: "var(--d2)" }} />
          <span style={{ width: 8, height: 14, background: "var(--d2)" }} />
          <span style={{ width: 8, height: 14, background: "var(--s2)", opacity: 0.55 }} />
        </span>,
        "one segment per engine that cites the domain",
      )}
      {item(<span style={{ width: 16, height: 16, background: "var(--d3)" }} />, "area is the number of citations")}
      {item(<span style={{ width: 3, height: 12, background: "var(--d1)" }} />, "one mark per time it is named first")}
      {item(<span style={{ width: 16, height: 16, background: "var(--brand)" }} />, "your domain")}
    </div>
  );
}
