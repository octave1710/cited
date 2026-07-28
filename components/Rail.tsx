"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * The pipeline as a rail with a wall in it.
 *
 * Seven rows in a table said "blocked" in a cell. The refusal to publish without a
 * named human is the spine of this product, so it is drawn: the track is only laid as
 * far as the run got, the gate is a solid bar across it in the accent, and everything
 * past the gate stays unlaid. You can see that the rest is unreachable before reading
 * a single label.
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

const COLOUR: Record<NodeState, string> = {
  queued: "var(--s3)",
  running: "var(--d1)",
  done: "var(--d2)",
  blocked: "var(--brand)",
  failed: "var(--brand)",
};

export function Rail({ nodes }: { nodes: RailNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const gateIndex = nodes.findIndex((n) => n.state === "blocked" || n.state === "failed");
  const reached = gateIndex >= 0 ? gateIndex : nodes.filter((n) => n.state === "done").length;

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      // the track lays itself only as far as the run actually got
      gsap.from("[data-track]", { scaleY: 0, transformOrigin: "top center", duration: 0.8, ease: "expo.out" });
      gsap.from("[data-node]", { opacity: 0, x: -14, duration: 0.4, ease: "expo.out", stagger: 0.07 });
      gsap.from("[data-wall]", { scaleX: 0, duration: 0.5, ease: "expo.out", delay: 0.5 });
    }, ref);
    return () => ctx.revert();
  }, [nodes.map((n) => n.state).join(",")]);

  return (
    <div ref={ref} style={{ position: "relative", paddingLeft: 34 }}>
      {/* the unlaid track: what the run has not reached */}
      <span style={{ position: "absolute", left: 13, top: 12, bottom: 12, width: 2, background: "var(--s2)" }} />
      {/* the laid track */}
      <span
        data-track
        style={{
          position: "absolute",
          left: 13,
          top: 12,
          height: `${Math.max(0, (reached / Math.max(1, nodes.length - 1)) * 100)}%`,
          width: 2,
          background: "var(--d2)",
        }}
      />

      {nodes.map((n, i) => {
        const past = gateIndex >= 0 && i > gateIndex;
        return (
          <div key={n.id} data-node style={{ position: "relative", paddingBottom: i === nodes.length - 1 ? 0 : 26 }}>
            <span
              style={{
                position: "absolute",
                left: -34 + 13 - 7,
                top: 3,
                width: 16,
                height: 16,
                background: past ? "var(--void)" : COLOUR[n.state],
                border: past ? "2px solid var(--s3)" : "none",
                boxShadow: "0 0 0 4px var(--void)",
              }}
            />

            <div style={{ display: "flex", gap: 16, alignItems: "baseline", opacity: past ? 0.4 : 1 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: n.state === "blocked" ? "var(--brand)" : "var(--ink)", minWidth: 210 }}>
                {n.label}
              </span>
              <span style={{ fontSize: 14.5, color: "var(--meta)", flex: 1 }}>{n.what}</span>
              <span className="m-sm" style={{ color: COLOUR[n.state] }}>{n.state}</span>
            </div>

            {(n.note || n.error) && !past && (
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  lineHeight: 1.65,
                  marginTop: 7,
                  color: n.error ? "var(--brand)" : "var(--ink)",
                  background: "var(--s1)",
                  borderLeft: `2px solid ${COLOUR[n.state]}`,
                  padding: "8px 12px",
                }}
              >
                {n.error ?? n.note}
              </p>
            )}

            {/* the wall itself, drawn across the track */}
            {i === gateIndex && (
              <div
                data-wall
                style={{
                  marginTop: 14,
                  marginLeft: -34,
                  height: 8,
                  background: "repeating-linear-gradient(135deg, var(--brand) 0 10px, var(--void) 10px 20px)",
                  transformOrigin: "left center",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
