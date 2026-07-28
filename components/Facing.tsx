"use client";

import { useRef, useState } from "react";
import type { FactorDiff } from "../autopsy/run";
import { Entity, Label, Num, useEntry } from "./da";

/**
 * Facing bands. The device for the autopsy screen.
 *
 * One axis down the middle, their page growing right, yours growing left, rows ordered
 * by the weighted gap. Two dots on a shared line, which is what this was before, make
 * the reader measure a distance between two small marks; two solid bands make the
 * asymmetry the shape of the row. The widest overhang on the right is the work order,
 * and it is legible before a single numeral is read.
 *
 * Ties get one split marker rather than two bands of zero width, because a tie drawn as
 * nothing reads as missing data.
 */

const HALF = 46; // percent of the track each side may occupy

export function FacingBands({ diffs, ourLabel, theirLabel }: { diffs: FactorDiff[]; ourLabel: string; theirLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEntry([diffs.map((d) => `${d.ours}-${d.theirs}`).join(",")], ref);

  return (
    <div ref={ref}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(190px,280px) 76px minmax(0,1fr) 116px", gap: 18, alignItems: "end", paddingBottom: 10 }}>
        <Label>FACTOR, HEAVIEST GAP FIRST</Label>
        <Label>GAP</Label>
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <span style={{ width: 11, height: 11, background: "var(--brand)" }} />
            <Label>{ourLabel}</Label>
          </span>
          <Label>0 · SHARED AXIS · 100</Label>
          <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <Label>{theirLabel}</Label>
            <span style={{ width: 11, height: 11, background: "var(--d3)" }} />
          </span>
        </span>
        <span />
      </div>

      <div style={{ borderTop: "1px solid var(--line-strong)" }}>
        {diffs.map((d) => (
          <Band key={d.key} d={d} open={open === d.key} onToggle={() => setOpen(open === d.key ? null : d.key)} />
        ))}
      </div>
    </div>
  );
}

function Band({ d, open, onToggle }: { d: FactorDiff; open: boolean; onToggle: () => void }) {
  const behind = d.theirs > d.ours;
  const level = d.ours === d.theirs;
  const gapPoints = Math.abs(d.theirs - d.ours) * (d.weight ?? 0.1);

  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(190px,280px) 76px minmax(0,1fr) 116px",
          gap: 18,
          alignItems: "center",
          width: "100%",
          padding: "13px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--ink)",
        }}
      >
        <span style={{ minWidth: 0 }}>
          <Entity size={18} style={{ display: "block" }}>{d.name}</Entity>
          <span style={{ display: "block", marginTop: 4 }}>
            <Label>{d.weight === null ? "BINARY GATE" : `${Math.round(d.weight * 100)}% OF SCORE`}</Label>
          </span>
        </span>

        <span>
          {level ? (
            <Label tone="meta">LEVEL</Label>
          ) : (
            <Num size={15} tone={behind ? "var(--brand)" : "var(--d2)"}>
              {behind ? "-" : "+"}
              {gapPoints.toFixed(1)}
            </Num>
          )}
        </span>

        {/* the axis: centre line, ours grows left, theirs grows right */}
        <span style={{ position: "relative", display: "block", height: 30 }}>
          <span style={{ position: "absolute", left: 0, right: 0, top: 14, height: 1, background: "var(--s2)" }} />
          <span style={{ position: "absolute", left: "50%", top: 2, bottom: 2, width: 1, background: "var(--line-strong)" }} />

          {level ? (
            /**
             * Both at zero draws a band of zero width, which renders as nothing at all
             * and reads as missing data rather than as a tie both pages actually share.
             * A fixed stub on the axis says "measured, and both are at nothing".
             */
            d.ours === 0 ? (
              <span
                data-band
                title="Both pages: 0"
                style={{
                  position: "absolute",
                  left: "calc(50% - 9px)",
                  width: 18,
                  top: 11,
                  height: 8,
                  background: "linear-gradient(90deg, var(--brand) 0 50%, var(--d3) 50% 100%)",
                  transformOrigin: "center center",
                  opacity: 0.75,
                }}
              />
            ) : (
              <span
                data-band
                title={`Both pages: ${d.ours}`}
                style={{
                  position: "absolute",
                  left: `calc(50% - ${(d.ours / 100) * HALF}%)`,
                  width: `${(d.ours / 100) * HALF * 2}%`,
                  top: 9,
                  height: 12,
                  background: "linear-gradient(90deg, var(--brand) 0 50%, var(--d3) 50% 100%)",
                  transformOrigin: "center center",
                }}
              />
            )
          ) : (
            <>
              <span
                data-band
                title={`Your page: ${d.ours}`}
                style={{
                  position: "absolute",
                  right: "50%",
                  width: `${(d.ours / 100) * HALF}%`,
                  top: 9,
                  height: 12,
                  background: "var(--brand)",
                  transformOrigin: "right center",
                }}
              />
              <span
                data-band
                title={`Their page: ${d.theirs}`}
                style={{
                  position: "absolute",
                  left: "50%",
                  width: `${(d.theirs / 100) * HALF}%`,
                  top: 9,
                  height: 12,
                  background: "var(--d3)",
                  transformOrigin: "left center",
                }}
              />
            </>
          )}

          {/* a zero is a mark, not a blank: a hairline stub against the axis */}
          {d.ours === 0 && !level && (
            <span style={{ position: "absolute", right: "50%", width: 5, top: 12, height: 6, background: "var(--brand)" }} />
          )}
          {d.theirs === 0 && !level && (
            <span style={{ position: "absolute", left: "50%", width: 5, top: 12, height: 6, background: "var(--d3)" }} />
          )}
        </span>

        <span style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "baseline" }}>
          <Num size={15} tone="var(--brand)">{d.ours}</Num>
          <Num size={15} tone="var(--d3)">{d.theirs}</Num>
        </span>
      </button>

      {open && (
        <div style={{ padding: "2px 0 20px" }}>
          <p style={{ fontSize: 16.5, lineHeight: 1.55, maxWidth: "84ch" }}>{d.theirReasoning || d.ourReasoning}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginTop: 18 }}>
            <Evidence label="PULLED OFF YOUR PAGE" accent="var(--brand)" items={d.ourEvidence} />
            <Evidence label="PULLED OFF THEIRS" accent="var(--d3)" items={d.theirEvidence} />
          </div>
          <p style={{ marginTop: 16 }}>
            <Label>WEIGHT SOURCE · {d.source}</Label>
          </p>
        </div>
      )}
    </div>
  );
}

function Evidence({ label, accent, items }: { label: string; accent: string; items: string[] }) {
  return (
    <div>
      <Label tone={accent === "var(--brand)" ? "brand" : "d3"}>{label}</Label>
      {items.length > 0 ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
          {items.slice(0, 5).map((s, i) => (
            <p
              key={i}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12.5,
                lineHeight: 1.65,
                background: "var(--s1)",
                borderLeft: `2px solid ${accent}`,
                padding: "8px 12px",
                color: "var(--ink)",
              }}
            >
              {s}
            </p>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: 12 }}>
          <Label tone="d1">NOTHING ON THIS PAGE MATCHED THE CHECK</Label>
        </p>
      )}
    </div>
  );
}
