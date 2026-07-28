"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { animate } from "motion";

/**
 * The pieces every screen shares, so the art direction is one implementation rather
 * than five near-copies that drift. The rules these encode are written down in
 * design/DA_V4.md.
 */

/** Mono, uppercase, tracked. Metadata only, never a sentence of content. */
export function Label({ children, tone = "meta", style }: { children: React.ReactNode; tone?: "meta" | "ink" | "brand" | "d1" | "d2" | "d3"; style?: React.CSSProperties }) {
  const colour = tone === "meta" ? "var(--meta)" : `var(--${tone === "ink" ? "ink" : tone})`;
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        color: colour,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Every numeral on every screen goes through here: mono, tabular, never reflowing. */
export function Num({ children, size = 14, tone = "ink", weight = 600 }: { children: React.ReactNode; size?: number; tone?: string; weight?: number }) {
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: size, fontVariantNumeric: "tabular-nums", color: tone.startsWith("var(") ? tone : `var(--${tone})`, fontWeight: weight }}>
      {children}
    </span>
  );
}

/** The display serif, for the name of a thing: a domain, a page, a factor, a market. */
export function Entity({ children, size = 21, tone = "ink", style }: { children: React.ReactNode; size?: number; tone?: string; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--display)",
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.15,
        color: tone.startsWith("var(") ? tone : `var(--${tone})`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * The header every screen opens with: what was measured, then the one sentence.
 * The order is fixed on purpose. A verdict with no provenance above it is a claim.
 */
export function Verdict({
  meta,
  headline,
  lede,
  warning,
  size = "screen",
}: {
  meta: React.ReactNode;
  headline: string;
  lede?: React.ReactNode;
  warning?: React.ReactNode;
  size?: "screen" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-verdict]", { opacity: 0, y: 16, duration: 0.65, ease: "expo.out" });
    }, ref);
    return () => ctx.revert();
  }, [headline]);

  return (
    <div ref={ref}>
      <div style={{ marginBottom: 12 }}>
        <Label>{meta}</Label>
      </div>
      <h2
        data-verdict
        className={size === "screen" ? "h1" : undefined}
        style={
          size === "screen"
            ? { maxWidth: "34ch" }
            : { fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(30px,2.6vw,46px)", lineHeight: 1.1, maxWidth: "28ch" }
        }
      >
        {headline}
      </h2>
      {lede && <p className="lede" style={{ marginTop: 18, maxWidth: "68ch" }}>{lede}</p>}
      {warning && (
        <p className="lede" style={{ marginTop: 12, maxWidth: "68ch", color: "var(--d1)" }}>{warning}</p>
      )}
    </div>
  );
}

/** A raised panel. Top rule in the accent, square, no shadow, no border on the other sides. */
export function Panel({ accent = "var(--d3)", children, style }: { accent?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--s1)", borderTop: `2px solid ${accent}`, padding: "20px 22px", ...style }}>
      {children}
    </div>
  );
}

/** A section, with the standing top rhythm. */
export function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ paddingTop: 92, ...style }}>{children}</section>;
}

/**
 * A track with a fill. The fill enters by scaling on its own x axis so nothing reflows
 * and the numeral beside it never moves.
 */
export function Meter({ value, max = 100, accent = "var(--d3)", height = 6, track = "var(--s2)" }: { value: number; max?: number; accent?: string; height?: number; track?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span style={{ display: "block", height, background: track }}>
      <span data-meter style={{ display: "block", height, width: `${pct}%`, background: accent, transformOrigin: "left center" }} />
    </span>
  );
}

/** Runs the standing entry choreography for whatever marks a screen rendered. */
export function useEntry(deps: unknown[], ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-meter]", { scaleX: 0, transformOrigin: "left center", duration: 0.7, ease: "expo.out", stagger: 0.04 });
      gsap.from("[data-band]", { scaleX: 0, duration: 0.65, ease: "expo.out", stagger: 0.035 });
      gsap.from("[data-tile]", { scale: 0, transformOrigin: "center center", duration: 0.45, ease: "back.out(1.5)", stagger: 0.006 });
      gsap.from("[data-row]", { opacity: 0, x: -12, duration: 0.4, ease: "expo.out", stagger: 0.03 });
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** A number that counts up on arrival. A static figure reads as a label, not a measurement. */
export function Counter({ n, size = 54, tone = "ink" }: { n: number; size?: number; tone?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(n);
      return;
    }
    const stop = animate(0, n, {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v: number) => { el.textContent = String(Math.round(v)); },
    });
    return () => stop.stop();
  }, [n]);
  return (
    <span
      ref={ref}
      style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: size, lineHeight: 1, display: "block", color: tone.startsWith("var(") ? tone : `var(--${tone})` }}
    >
      0
    </span>
  );
}

/** Counter plus its unit. The unit is never left to be guessed from context. */
export function Figure({ n, label, tone = "ink" }: { n: number; label: string; tone?: string }) {
  return (
    <span style={{ display: "block" }}>
      <Counter n={n} tone={tone} />
      <span style={{ display: "block", marginTop: 8 }}>
        <Label>{label}</Label>
      </span>
    </span>
  );
}

/**
 * The state a screen is in before it has anything to show. A blank column is read as
 * a bug, so the empty state says what will appear and what has to happen first.
 */
export function Awaiting({ title, what, steps }: { title: string; what: string; steps?: { label: string; state: string; note?: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEntry([steps?.map((s) => s.state).join(",")], ref);
  return (
    <div ref={ref} style={{ paddingTop: 76, maxWidth: "62ch" }}>
      <h2 style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: "clamp(30px,2.6vw,46px)", lineHeight: 1.1 }}>{title}</h2>
      <p className="lede" style={{ marginTop: 18 }}>{what}</p>
      {steps && steps.length > 0 && (
        <div style={{ marginTop: 40 }}>
          {steps.map((s) => (
            <div key={s.label} data-row style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "12px 0", borderTop: "1px solid var(--line)" }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  marginTop: 4,
                  background:
                    s.state === "done" ? "var(--d2)" : s.state === "running" ? "var(--d1)" : s.state === "failed" ? "var(--brand)" : "var(--s3)",
                }}
              />
              <span style={{ fontSize: 16.5, fontWeight: 600, flex: 1 }}>{s.label}</span>
              <Label>{s.note ?? s.state}</Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
