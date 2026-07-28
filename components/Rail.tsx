"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Entity, Label, Num, useEntry } from "./da";

/**
 * The track and the wall. The device for the pipeline screen.
 *
 * Seven rows in a table said "blocked" in a cell, and a cell that says blocked is a word,
 * not a shape. The refusal to publish without a named human is the spine of this product,
 * so the drawing is about the refusal:
 *
 *   the TRACK runs left to right, one column per node, and it is laid only as far as the
 *     run actually got. A node the run reached is a solid band. A node it never reached is
 *     a hairline. The eye sees where the work stops before it reads a label.
 *   each MARKET is its own lane, stacked, because the run is not one thread but three, and
 *     each of them is blocked or released on its own.
 *   the WALL is a hatched bar in --brand drawn across every lane at the blocking node. It is
 *     continuous because, until a name arrives, it holds all of them.
 *   a lane whose market carries a NAMED approval has its slice of the wall cut out: the frame
 *     stays, the track runs through, and the last node is reachable for that lane alone.
 *     `POST /approve` returns 400 on an empty name, so a lane cannot open anonymously.
 *   the SCORE column draws each draft against the minimum the gate quotes, because "below the
 *     minimum" is the reason the gate gives for holding.
 *
 * Every mark is a value the reader can check: the node states come from the run, the score is
 * the same nine-factor audit, the approver is the string the API stored.
 */

export type NodeState = "queued" | "running" | "done" | "blocked" | "failed";

export interface RailNode {
  id: string;
  label: string;
  what: string;
  state: NodeState;
  note?: string;
  error?: string;
}

/** One market's lane. `approvedBy` is the name the API accepted, never a boolean. */
export interface RailLane {
  market: string;
  term?: string;
  score?: number;
  approvedBy?: string;
}

const LANE_H = 92;
const BAND_H = 34;
const BAND_TOP = (LANE_H - BAND_H) / 2;
const CAPTION_TOP = BAND_TOP + BAND_H + 7;
const WALL_W = 46;
const LABEL_W = 158;
const GAP = 6;
const HAIRLINE = 2;

/** Vertical stripes, so stacked lane slices read as one uninterrupted bar. */
const HATCH = "repeating-linear-gradient(90deg, var(--brand) 0 5px, var(--void) 5px 11px)";

const COLOUR: Record<NodeState, string> = {
  queued: "var(--s3)",
  running: "var(--d1)",
  done: "var(--d2)",
  blocked: "var(--brand)",
  failed: "var(--brand)",
};

export function Rail({
  nodes,
  lanes,
  wallId,
  scoreNodeId = "optimise",
  /** Mirrors MIN_SCORE in pipeline/run.ts, which is server-only and cannot be imported here. */
  scoreFloor = 55,
}: {
  nodes: RailNode[];
  lanes?: RailLane[];
  wallId?: string;
  scoreNodeId?: string;
  scoreFloor?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  const track: RailLane[] = lanes && lanes.length ? lanes : [{ market: "ALL MARKETS" }];
  const stateKey = nodes.map((n) => n.state).join(",");
  const signKey = track.map((l) => l.approvedBy ?? "").join(",");

  // where the run actually stopped. Falling back to the declared gate keeps the wall on
  // screen before anything has run, which is the honest picture: it is there from the start.
  const stopped = nodes.findIndex((n) => n.state === "blocked" || n.state === "failed");
  const wallIndex =
    stopped >= 0 ? stopped : wallId ? nodes.findIndex((n) => n.id === wallId && n.state !== "done") : -1;
  const wallNode = wallIndex >= 0 ? nodes[wallIndex] : null;
  const signed = track.filter((l) => (l.approvedBy ?? "").trim().length > 0).length;

  useEntry([stateKey, signKey], ref);

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      // the wall drops after the track has laid itself, so the reader watches it stop
      gsap.from("[data-wall]", { scaleY: 0, transformOrigin: "top center", duration: 0.55, ease: "expo.out", delay: 0.42, stagger: 0.06 });
      gsap.from("[data-door]", { scaleX: 0, transformOrigin: "center center", duration: 0.5, ease: "back.out(1.7)", delay: 0.5, stagger: 0.06 });
    }, ref);
    return () => ctx.revert();
  }, [stateKey, signKey]);

  /**
   * A narrow viewport was opening on node one, with the wall off to the right, so the phone
   * saw a green track and never the thing that stops it. The device scrolls itself to the
   * wall instead, keeping the laid track that leads into it on screen.
   */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const cell = el.querySelector<HTMLElement>("[data-wallcell]");
    const max = el.scrollWidth - el.clientWidth;
    if (!cell || max <= 0) return;
    const left = cell.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollLeft = Math.min(max, Math.max(0, left - el.clientWidth * 0.55));
  }, [stateKey, signKey]);

  if (!nodes.length) return null;

  const cols = `${LABEL_W}px ${nodes.map((_, i) => (i === wallIndex ? `${WALL_W}px` : "minmax(0,1fr)")).join(" ")}`;
  const opened = nodes.find((n) => n.id === open) ?? null;
  const openedIndex = opened ? nodes.indexOf(opened) : -1;

  return (
    <div ref={ref}>
      {/* overflow-y would compute to auto beside an auto x, and a 2px rounding overflow
          was drawing a scrollbar down the side of the device */}
      <div style={{ overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ minWidth: 860 }}>
          {/* the nodes name themselves. The wall column carries no name: it is not a step, it is a stop */}
          <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: GAP, alignItems: "end", paddingBottom: 14 }}>
            <Label>MARKET LANE</Label>
            {nodes.map((n, i) => {
              const isWall = i === wallIndex;
              return (
                <button
                  key={n.id}
                  data-row
                  type="button"
                  onClick={() => setOpen(open === n.id ? null : n.id)}
                  aria-expanded={open === n.id}
                  title={n.what}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: open === n.id ? "2px solid var(--ink)" : "2px solid transparent",
                    padding: "0 0 8px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "var(--ink)",
                    minWidth: 0,
                  }}
                >
                  <span style={{ display: "block", marginBottom: 6 }}>
                    <Num size={11} tone="meta">{String(i + 1).padStart(2, "0")}</Num>
                  </span>
                  {isWall ? (
                    <span style={{ display: "block", width: 22, height: 12, background: HATCH }} />
                  ) : (
                    <Entity size={19} tone={n.state === "failed" ? "brand" : "ink"} style={{ display: "block" }}>
                      {n.label}
                    </Entity>
                  )}
                </button>
              );
            })}
          </div>

          {/* the lanes. rowGap is 0 on purpose: the wall slices must touch */}
          <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: GAP, rowGap: 0, borderTop: "1px solid var(--line-strong)" }}>
            {track.map((lane, li) => {
              const approver = (lane.approvedBy ?? "").trim();
              const isSigned = approver.length > 0;
              return (
                <Fragment key={lane.market}>
                  <div
                    data-row
                    style={{ height: LANE_H, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, minWidth: 0, paddingRight: 10 }}
                  >
                    <Entity size={26} tone={isSigned ? "d2" : "ink"}>{lane.market}</Entity>
                    {lane.term ? (
                      <span style={{ fontSize: 16, lineHeight: 1.2, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lane.term}
                      </span>
                    ) : (
                      <Label>NO TERM YET</Label>
                    )}
                  </div>

                  {nodes.map((n, i) => {
                    const isWall = i === wallIndex;
                    const past = wallIndex >= 0 && i > wallIndex;
                    const sealed = past && !isSigned;

                    if (isWall) {
                      return (
                        <div key={n.id} style={{ height: LANE_H, position: "relative", overflow: "hidden" }}>
                          {isSigned ? (
                            <>
                              {/* the slice is cut out: the frame stays, the track runs through */}
                              <span data-door style={{ position: "absolute", left: 0, right: 0, top: 0, height: 5, background: "var(--brand)" }} />
                              <span data-door style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: "var(--brand)" }} />
                              <span style={{ position: "absolute", left: 0, right: 0, top: BAND_TOP, height: BAND_H, background: "var(--d2)" }} />
                            </>
                          ) : (
                            <span data-wall style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: HATCH }} />
                          )}
                        </div>
                      );
                    }

                    const laid = !sealed && (n.state === "done" || n.state === "running");
                    const showScore = laid && n.id === scoreNodeId && typeof lane.score === "number";

                    return (
                      <div key={n.id} style={{ height: LANE_H, position: "relative", minWidth: 0 }}>
                        {showScore ? (
                          <span style={{ position: "absolute", left: 0, right: 0, top: BAND_TOP, height: BAND_H, background: "var(--s2)" }}>
                            <span
                              data-band
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${Math.max(0, Math.min(100, lane.score ?? 0))}%`,
                                // --d3 is a measured value, not track: the score must not read
                                // as more of the same green band running through
                                background: (lane.score ?? 0) >= scoreFloor ? "var(--d3)" : "var(--brand)",
                                transformOrigin: "left center",
                              }}
                            />
                            {/* the minimum the gate quotes, drawn where it actually falls */}
                            <span style={{ position: "absolute", left: `${scoreFloor}%`, top: -6, bottom: -6, width: 2, background: "var(--ink)" }} />
                            <span style={{ position: "absolute", right: 9, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                              <Num size={13}>{lane.score}</Num>
                            </span>
                          </span>
                        ) : laid ? (
                          <span
                            data-band
                            style={{ position: "absolute", left: 0, right: 0, top: BAND_TOP, height: BAND_H, background: COLOUR[n.state], transformOrigin: "left center" }}
                          />
                        ) : (
                          <span
                            data-band
                            style={{ position: "absolute", left: 0, right: 0, top: BAND_TOP + (BAND_H - HAIRLINE) / 2, height: HAIRLINE, background: "var(--s3)", transformOrigin: "left center" }}
                          />
                        )}

                        {/* one caption, on the first lane only: three of them read as three
                            different measurements, and a longer string wraps into the lane below */}
                        {showScore && li === 0 && (
                          <span style={{ position: "absolute", left: 0, top: CAPTION_TOP, whiteSpace: "nowrap" }}>
                            <Label>DRAFT SCORE OUT OF 100</Label>
                          </span>
                        )}

                        {past && isSigned && (
                          <span
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 8,
                              top: CAPTION_TOP - 2,
                              fontSize: 16,
                              lineHeight: 1.2,
                              color: "var(--ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Label tone="d2">SIGNED · </Label>
                            {approver}
                          </span>
                        )}

                        {sealed && (
                          <span style={{ position: "absolute", left: 0, top: CAPTION_TOP }}>
                            <Label tone="brand">NO NAME · UNREACHABLE</Label>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* the wall gets the only caption on the device, because it is the only thing that stops anything */}
      {wallNode && (
        <div style={{ borderTop: "2px solid var(--brand)", marginTop: 18, paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
            <Entity size={21} tone="brand">{wallNode.label}</Entity>
            <Label tone="brand">
              NODE {String(wallIndex + 1).padStart(2, "0")} · {signed} OF {track.length} MARKETS SIGNED
            </Label>
          </div>
          {(wallNode.error ?? wallNode.note) && (
            <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 10, maxWidth: "84ch", color: wallNode.error ? "var(--brand)" : "var(--ink)" }}>
              {wallNode.error ?? wallNode.note}
            </p>
          )}
        </div>
      )}

      {opened && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 12 }}>
          <Label>
            NODE {String(openedIndex + 1).padStart(2, "0")} · {opened.state.toUpperCase()}
          </Label>
          <p style={{ fontSize: 16.5, lineHeight: 1.55, marginTop: 8, maxWidth: "84ch" }}>{opened.what}</p>
          {(opened.error ?? opened.note) && (
            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12.5,
                lineHeight: 1.7,
                marginTop: 12,
                background: "var(--s1)",
                borderLeft: `2px solid ${opened.error ? "var(--brand)" : COLOUR[opened.state]}`,
                padding: "9px 13px",
                color: "var(--ink)",
              }}
            >
              {opened.error ?? opened.note}
            </p>
          )}
        </div>
      )}

      <Legend floor={scoreFloor} />
    </div>
  );
}

function Legend({ floor }: { floor: number }) {
  const item = (mark: React.ReactNode, text: React.ReactNode) => (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
      {mark}
      <span style={{ fontSize: 14.5, color: "var(--ink)" }}>{text}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginTop: 22 }}>
      {item(<span style={{ width: 26, height: 12, background: "var(--d2)" }} />, "track laid: the run reached this node")}
      {item(<span style={{ width: 26, height: 2, background: "var(--s3)" }} />, "not laid: nothing ran here")}
      {item(<span style={{ width: 14, height: 22, background: HATCH }} />, "the wall: publishing refuses")}
      {item(
        <span style={{ width: 14, height: 22, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, right: 0, top: 0, height: 4, background: "var(--brand)" }} />
          <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "var(--brand)" }} />
          <span style={{ position: "absolute", left: 0, right: 0, top: 8, height: 6, background: "var(--d2)" }} />
        </span>,
        "cut open by one named person",
      )}
      {item(
        <span style={{ width: 2, height: 20, background: "var(--ink)" }} />,
        <>the minimum draft score the gate quotes, <Num size={12}>{floor}</Num></>,
      )}
    </div>
  );
}
