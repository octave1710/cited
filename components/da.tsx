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
        // labels carry live counts in half the screens; without this they reflow at 9 to 10
        fontVariantNumeric: "tabular-nums",
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
    const scope = ref.current;
    if (!scope) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return revealIn(scope, (reveal) =>
      reveal("[data-verdict]", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.65, ease: "expo.out" }),
    );
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
/**
 * The only safe way to reveal something.
 *
 * `gsap.from` writes the hidden state on frame one and animates out of it, so anything
 * that interrupts it leaves the element exactly where it started. That is how the whole
 * pipeline rail shipped invisible: seven node labels, three market names and their scores
 * all sitting at opacity 0, with the text present in the DOM the entire time.
 *
 * `fromTo` with `clearProps` leaves no inline style behind once it lands, and the returned
 * cleanup force-clears after the revert. The animation is allowed to fail; the content is
 * not. Returns the effect cleanup, so a call site is `return revealIn(scope, ...)`.
 */
export function revealIn(
  scope: HTMLElement,
  build: (reveal: (sel: string, from: gsap.TweenVars, to: gsap.TweenVars) => void) => void,
  props = "opacity,transform",
): () => void {
  const seen: string[] = [];
  const ctx = gsap.context((self) => {
    build((sel, from, to) => {
      seen.push(sel);
      // gsap warns on an empty target, and several of these are legitimately absent
      const els = self.selector?.(sel) ?? [];
      if (!els.length) return;
      gsap.fromTo(els, from, { ...to, clearProps: props, overwrite: "auto" });
    });
  }, scope);
  return () => {
    ctx.revert();
    if (seen.length) gsap.set(scope.querySelectorAll(seen.join(",")), { clearProps: props });
  };
}

/** Everything this hook reveals. Listed once so the cleanup can un-hide all of it. */
const REVEALED = "[data-meter],[data-band],[data-tile],[data-row]";

/**
 * The entrance reveal, written so that failing leaves the content visible.
 *
 * It used to be four `gsap.from` calls. A `from` sets the hidden state on frame one and
 * animates out of it, so anything that interrupts it, a revert, a re-render, a second
 * context on the same scope, leaves the element exactly where it started: invisible. That
 * is what happened on the pipeline. The seven node labels, the market names, the terms and
 * the scores were all sitting at `opacity: 0` with `translateX(-12px)` on a screen whose
 * whole point is to show where the run stops, and the text was in the DOM the entire time,
 * so every check that read `innerText` said the screen was fine.
 *
 * Two changes make that unreachable. `fromTo` clears its own inline styles on completion,
 * so a settled element carries no opacity at all. And the cleanup force-clears after the
 * revert, so no interruption can leave anything hidden. The animation is now allowed to
 * fail; the content is not.
 */
export function useEntry(deps: unknown[], ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = ref.current;
    if (!scope) return;
    const clear = () => gsap.set(scope.querySelectorAll(REVEALED), { clearProps: "opacity,transform" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clear();
      return;
    }

    const ctx = gsap.context((self) => {
      const reveal = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars) => {
        // gsap warns on an empty target, and several of these are legitimately absent
        const els = self.selector?.(sel) ?? [];
        if (!els.length) return;
        gsap.fromTo(els, from, { ...to, clearProps: "opacity,transform", overwrite: "auto" });
      };
      reveal("[data-meter]", { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 0.7, ease: "expo.out", stagger: 0.04 });
      reveal("[data-band]", { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: "expo.out", stagger: 0.035 });
      reveal("[data-tile]", { scale: 0 }, { scale: 1, transformOrigin: "center center", duration: 0.45, ease: "back.out(1.5)", stagger: 0.006 });
      reveal("[data-row]", { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.4, ease: "expo.out", stagger: 0.03 });
    }, scope);

    return () => {
      ctx.revert();
      clear();
    };
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
