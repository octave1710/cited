"use client";

/**
 * The one thing every screen is about: the category, the brand and the market.
 *
 * Each screen held its own copy in useState with its own hardcoded default, so typing
 * "high-performance sunscreens" on the board and then opening the map showed vitamin C
 * serum. Two screens claiming to analyse the same business while showing different
 * subjects is not a display bug, it is the tool contradicting itself on stage.
 *
 * Kept in sessionStorage rather than a context so a full page navigation carries it,
 * which is how the nav links move between screens.
 */

const KEY = "cited.subject";

export interface Subject {
  topic: string;
  /** Bare hostname, no scheme, no www, no path. Empty when no brand was given. */
  domain: string;
  market: string;
}

export const DEFAULT_SUBJECT: Subject = { topic: "vitamin C serum", domain: "", market: "UK" };

/** Normalises whatever was typed into a hostname, or "" when there is nothing usable. */
export function toHost(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t) ? t : "";
}

export function readSubject(): Subject {
  if (typeof window === "undefined") return DEFAULT_SUBJECT;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_SUBJECT;
    const p = JSON.parse(raw) as Partial<Subject>;
    return {
      topic: typeof p.topic === "string" && p.topic.trim() ? p.topic : DEFAULT_SUBJECT.topic,
      domain: typeof p.domain === "string" ? toHost(p.domain) : "",
      market: typeof p.market === "string" && p.market ? p.market : DEFAULT_SUBJECT.market,
    };
  } catch {
    return DEFAULT_SUBJECT;
  }
}

export function writeSubject(s: Subject): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...s, domain: toHost(s.domain) }));
  } catch {
    // a private window with storage disabled is not a reason to fail a run
  }
}
