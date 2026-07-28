"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { squarify } from "../lib/treemap";
import type { CitationMap, DomainStat } from "../citationmap/types";

/**
 * Who holds the category, as area.
 *
 * v2 drew 158 identical grey squares, which encoded competitor identity and question
 * category on the same ramp and told the user nothing. Here area carries the count,
 * a fixed colour carries identity, and the site's own logo carries recognition. The
 * dominant domain is 75% of the picture before a word is read.
 */

/** Assigned once, in order, never cycled. A ninth domain folds into "everyone else". */
export const DATA_COLOURS = ["var(--d1)", "var(--d2)", "var(--d3)", "var(--d4)", "var(--d5)", "var(--d6)"];
export const REST_COLOUR = "var(--d-rest)";
export const BRAND_COLOUR = "var(--brand)";

export interface Territory {
  id: string;
  domain: string;
  value: number;
  colour: string;
  isBrand: boolean;
  isRest: boolean;
  appearances: number;
}

/** Top six rivals keep their own colour; the tail is one honest "everyone else" block. */
export function toTerritories(map: CitationMap): Territory[] {
  const withWins = map.domains.filter((d) => d.wins > 0);
  const brand = withWins.find((d) => d.isBrand);
  const rivals = withWins.filter((d) => !d.isBrand);
  const head = rivals.slice(0, 6);
  const tail = rivals.slice(6);

  const out: Territory[] = head.map((d: DomainStat, i) => ({
    id: d.domain,
    domain: d.domain,
    value: d.wins,
    colour: DATA_COLOURS[i],
    isBrand: false,
    isRest: false,
    appearances: d.appearances,
  }));

  if (brand) {
    out.unshift({
      id: brand.domain,
      domain: brand.domain,
      value: brand.wins,
      colour: BRAND_COLOUR,
      isBrand: true,
      isRest: false,
      appearances: brand.appearances,
    });
  }
  if (tail.length) {
    out.push({
      id: "__rest",
      domain: `${tail.length} other sites`,
      value: tail.reduce((s, d) => s + d.wins, 0),
      colour: REST_COLOUR,
      isBrand: false,
      isRest: true,
      appearances: tail.reduce((s, d) => s + d.appearances, 0),
    });
  }
  return out;
}

export function TerritoryMap({
  map,
  minHeight = 260,
  onPick,
}: {
  map: CitationMap;
  minHeight?: number;
  onPick?: (domain: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: minHeight });
  const [hover, setHover] = useState<string | null>(null);

  /**
   * Both dimensions come from the parent, so the map fills the row instead of sitting
   * at a fixed height with dead space under it. A hard 520px left a 137px hole below
   * the treemap on every screen where the side column ran longer.
   */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: Math.max(minHeight, r.height) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    measure();
    return () => ro.disconnect();
  }, [minHeight]);

  const width = box.w;
  const height = box.h;

  const territories = toTerritories(map);
  const tiles = width > 0 ? squarify(territories, width, height) : [];
  const total = territories.reduce((s, t) => s + t.value, 0);

  /* Each tile grows from its own top-left, biggest first, so the eye lands on the
     dominant holder before the small ones arrive. */
  useLayoutEffect(() => {
    if (!tiles.length || !wrapRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-tile]", {
        scaleX: 0.6,
        scaleY: 0.6,
        opacity: 0,
        transformOrigin: "top left",
        duration: 0.62,
        ease: "expo.out",
        stagger: 0.05,
      });
    }, wrapRef);
    return () => ctx.revert();
  }, [tiles.length, width]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div ref={wrapRef} style={{ position: "relative", flex: "1 1 auto", minHeight, width: "100%" }} onMouseLeave={() => setHover(null)}>
        {tiles.map(({ item, x, y, w, h }) => {
          const dim = hover !== null && hover !== item.id;
          const big = w > 116 && h > 84;
          const pct = Math.round((item.value / total) * 100);
          return (
            <button
              key={item.id}
              data-tile
              type="button"
              onMouseEnter={() => setHover(item.id)}
              onClick={() => !item.isRest && onPick?.(item.domain)}
              aria-label={`${item.domain}, ${item.value} questions`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: h,
                // 2px of ground between fills, which reads as separation without a border
                padding: big ? 14 : 6,
                border: "none",
                outline: `2px solid var(--void)`,
                outlineOffset: -1,
                background: item.colour,
                opacity: dim ? 0.32 : 1,
                filter: dim ? "saturate(0.5)" : "none",
                transition: "opacity 180ms ease, filter 180ms ease",
                cursor: item.isRest ? "default" : "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "space-between",
                textAlign: "left",
                overflow: "hidden",
              }}
            >
              {big && !item.isRest && <Favicon domain={item.domain} size={26} />}
              <span style={{ display: "block", width: "100%" }}>
                {big && (
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--body)",
                      fontWeight: 600,
                      fontSize: w > 220 ? 17 : 14,
                      lineHeight: 1.2,
                      color: "#0A0E1A",
                      wordBreak: "break-word",
                    }}
                  >
                    {item.domain}
                  </span>
                )}
                <span
                  className="num"
                  style={{
                    display: "block",
                    fontSize: big ? (w > 220 ? 34 : 22) : 13,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: "#0A0E1A",
                    marginTop: big ? 4 : 0,
                  }}
                >
                  {item.value}
                  {big && <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.72 }}> · {pct}%</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, alignItems: "center", flex: "0 0 auto" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: 0.8, color: "var(--meta)" }}>
          AREA = QUESTIONS ANSWERED FIRST. CLICK A BLOCK TO AUTOPSY IT.
        </span>
      </div>
    </div>
  );
}

/**
 * The site's own favicon. A logo is recognised before a label is read, which is the
 * whole reason the grey squares failed.
 */
export function Favicon({ domain, size = 18 }: { domain: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const clean = domain.replace(/^www\./, "");
  if (failed || !clean.includes(".")) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10,14,26,.14)",
          fontFamily: "var(--mono)",
          fontSize: size * 0.5,
          fontWeight: 700,
          color: "#0A0E1A",
          textTransform: "uppercase",
        }}
      >
        {clean[0] ?? "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=64`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ flex: "none", display: "block", background: "rgba(255,255,255,.9)" }}
    />
  );
}
