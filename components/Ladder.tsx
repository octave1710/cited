"use client";

import { useRef, useState } from "react";
import { FACTORS, GATE_FACTOR } from "../engine/weights.config";
import type { AuditResult, FactorResult } from "../engine/types";
import { Entity, Label, Num, useEntry } from "./da";

/**
 * The weight ladder. The device for the audit screen.
 *
 * A score out of 100 printed next to nine rows of numbers tells you nothing about where
 * the missing points are or which one is worth chasing. Here every factor is a band
 * whose WIDTH is the share of the score it carries and whose FILL is the share it
 * earned. The band widths sum to the whole ladder, so the unfilled area IS the missing
 * score, at scale, sorted with the biggest loss at the top.
 *
 * The consequence is that the eye lands on the widest dark band, which is by
 * construction the most valuable thing to fix, before a single numeral is read.
 */

export interface LadderRow {
  key: string;
  name: string;
  /** Share of the total score, 0 to 1. Null for the crawlability gate, which is binary. */
  weight: number | null;
  score: number;
  source: string;
  evidence: string[];
  reasoning: string;
  partial?: boolean;
  /** Gate rows only: OPEN was printed on pages half the crawlers are refused on. */
  state?: "open" | "partial" | "shut";
}

export function rowsFromAudit(audit: AuditResult): LadderRow[] {
  const cfg = new Map(FACTORS.map((f) => [f.key, f]));
  return audit.factors
    .map((f: FactorResult): LadderRow => {
      const c = cfg.get(f.key);
      return {
        key: f.key,
        name: f.name.replace(/\s*\(.*\)$/, ""),
        weight: c ? c.weight : null,
        score: f.score,
        source: c?.source ?? GATE_FACTOR.source,
        evidence: f.evidence,
        reasoning: f.reasoning,
        partial: f.partial,
        state: f.state,
      };
    })
    // biggest weighted loss first: the order the work should actually be done in
    .sort((a, b) => (b.weight ?? 0) * (100 - b.score) - (a.weight ?? 0) * (100 - a.score));
}

/**
 * Points a factor is currently costing, out of 100.
 *
 * weight is already a fraction of 1, so weight * (100 - score) is points. Dividing by
 * 100 on top made every row read "nothing left here" on a page missing 54 points.
 */
const lost = (r: LadderRow) => (r.weight ?? 0) * (100 - r.score);

export function Ladder({ rows, overall }: { rows: LadderRow[]; overall: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEntry([rows.map((r) => r.score).join(",")], ref);

  const weighted = rows.filter((r) => r.weight !== null);
  const gate = rows.find((r) => r.weight === null);

  return (
    <div ref={ref}>
      {/* the ladder itself: one continuous 100-point bar, split by weight */}
      <div style={{ display: "flex", gap: 2, height: 74, alignItems: "stretch", marginBottom: 6 }}>
        {weighted.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setOpen(open === r.key ? null : r.key)}
            title={`${r.name}: ${Math.round((r.weight ?? 0) * 100)}% of the score, ${r.score}/100 earned`}
            style={{
              flex: `${(r.weight ?? 0) * 100} 0 0`,
              position: "relative",
              background: "var(--s2)",
              border: "none",
              borderBottom: open === r.key ? "2px solid var(--ink)" : "2px solid transparent",
              padding: 0,
              cursor: "pointer",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {/* fill rises from the floor: the dark space above is the score not earned */}
            <span
              data-band
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: `${r.score}%`,
                background: r.partial ? "repeating-linear-gradient(135deg, var(--d3) 0 6px, var(--s2) 6px 12px)" : "var(--d3)",
                transformOrigin: "left bottom",
              }}
            />
            <span style={{ position: "absolute", top: 6, left: 6 }}>
              <Num size={11} tone="ink">{Math.round((r.weight ?? 0) * 100)}%</Num>
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 34 }}>
        <Label>WIDTH IS WHAT THE FACTOR IS WORTH · FILL IS WHAT THE PAGE EARNED · DARK IS THE {100 - overall} POINTS MISSING</Label>
        <Num size={13}>{overall}/100</Num>
      </div>

      {gate && <GateRow row={gate} open={open === gate.key} onToggle={() => setOpen(open === gate.key ? null : gate.key)} />}

      {weighted.map((r) => (
        <Row key={r.key} row={r} open={open === r.key} onToggle={() => setOpen(open === r.key ? null : r.key)} />
      ))}
    </div>
  );
}

function Row({ row, open, onToggle }: { row: LadderRow; open: boolean; onToggle: () => void }) {
  const costing = lost(row);
  return (
    <div style={{ borderTop: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "grid",
          // 118px wrapped "POINTS LOST HERE" onto three lines
          gridTemplateColumns: "minmax(200px,1fr) 96px minmax(140px,220px) 152px",
          gap: 20,
          alignItems: "center",
          width: "100%",
          padding: "14px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--ink)",
        }}
      >
        <span style={{ minWidth: 0 }}>
          <Entity size={19} style={{ display: "block" }}>{row.name}</Entity>
          {row.partial && (
            <span style={{ display: "block", marginTop: 4 }}>
              <Label tone="d1">ON-PAGE PROXY, NOT THE FULL SIGNAL</Label>
            </span>
          )}
        </span>

        <span>
          <Num size={13} tone="meta">{Math.round((row.weight ?? 0) * 100)}% of 100</Num>
        </span>

        {/* the earned fraction of this factor's own weight, on its own axis */}
        <span style={{ display: "block" }}>
          <span style={{ display: "block", height: 8, background: "var(--s2)" }}>
            <span data-meter style={{ display: "block", height: 8, width: `${row.score}%`, background: row.score >= 70 ? "var(--d2)" : row.score >= 35 ? "var(--d1)" : "var(--brand)", transformOrigin: "left center" }} />
          </span>
          <span style={{ display: "block", marginTop: 5 }}>
            <Num size={12} tone="meta">{row.score}/100 earned</Num>
          </span>
        </span>

        <span style={{ textAlign: "right" }}>
          {costing >= 0.5 ? (
            <>
              <Num size={17} tone="var(--brand)">-{costing.toFixed(1)}</Num>
              <span style={{ display: "block", marginTop: 3, whiteSpace: "nowrap" }}>
                <Label>POINTS LOST HERE</Label>
              </span>
            </>
          ) : (
            <Label tone="d2" style={{ whiteSpace: "nowrap" }}>NOTHING LEFT HERE</Label>
          )}
        </span>
      </button>

      {open && <Evidence row={row} />}
    </div>
  );
}

/** The gate is not a percentage of anything. It is a door, so it is drawn as one. */
function GateRow({ row, open, onToggle }: { row: LadderRow; open: boolean; onToggle: () => void }) {
  const state = row.state ?? (row.score < 100 ? "shut" : "open");
  const shut = state === "shut";
  const partial = state === "partial";
  /* three states, because a page whose robots.txt refuses four of eight crawlers is not
     shut and is certainly not open, and the access section below says so out loud */
  const tone = shut ? "var(--brand)" : partial ? "var(--amber)" : "var(--d2)";
  return (
    <div style={{ borderTop: `2px solid ${tone}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ display: "flex", gap: 20, alignItems: "center", width: "100%", padding: "14px 0", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
      >
        <span
          data-band
          style={{
            width: 54,
            height: 26,
            background: shut || partial ? `repeating-linear-gradient(135deg, ${tone} 0 7px, var(--void) 7px 14px)` : "var(--d2)",
            transformOrigin: "left center",
            flex: "0 0 auto",
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <Entity size={19} style={{ display: "block" }}>{row.name}</Entity>
        </span>
        <Label style={{ color: tone }}>{shut ? "SHUT: NOTHING BELOW COUNTS" : partial ? "PARTLY BLOCKED: SEE THE CRAWLERS BELOW" : "OPEN"}</Label>
      </button>
      {open && <Evidence row={row} />}
    </div>
  );
}

function Evidence({ row }: { row: LadderRow }) {
  return (
    <div style={{ padding: "2px 0 20px" }}>
      <p style={{ fontSize: 16.5, lineHeight: 1.55, maxWidth: "84ch" }}>{row.reasoning}</p>
      {row.evidence.length > 0 ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          {row.evidence.slice(0, 6).map((e, i) => (
            <p
              key={i}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12.5,
                lineHeight: 1.65,
                background: "var(--s1)",
                borderLeft: "2px solid var(--d3)",
                padding: "8px 12px",
                color: "var(--ink)",
              }}
            >
              {e}
            </p>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: 12 }}>
          <Label tone="d1">NOTHING ON THE PAGE MATCHED THIS CHECK</Label>
        </p>
      )}
      <p style={{ marginTop: 14 }}>
        <Label>WEIGHT SOURCE · {row.source}</Label>
      </p>
    </div>
  );
}
