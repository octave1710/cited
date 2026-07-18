import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parse.js";
import { audit } from "./score.js";
import { freshness } from "./factors/freshness.js";
import { crawlability } from "./factors/crawlability.js";
import { factualSpecificity } from "./factors/factualSpecificity.js";
import { FACTORS } from "./weights.config.js";

// Frozen reference date so freshness scoring is deterministic.
const NOW = new Date("2026-07-18");

const load = (name: string) => parse(readFileSync(join(__dirname, "..", "fixtures", "pages", name), "utf8"));

describe("audit on fixture pages", () => {
  const bad = audit(load("bad.html"), { now: NOW });
  const medium = audit(load("medium.html"), { now: NOW });
  const good = audit(load("good.html"), { now: NOW });

  it("orders bad < medium < good", () => {
    expect(bad.overall).toBeLessThan(medium.overall);
    expect(medium.overall).toBeLessThan(good.overall);
  });

  it("grades the extremes correctly", () => {
    expect(good.grade).toBe("cited");
    expect(["at-risk", "invisible"]).toContain(bad.grade);
  });

  it("every factor carries evidence", () => {
    for (const f of good.factors) expect(f.evidence.length).toBeGreaterThan(0);
  });

  it("ranks weakest factors by weighted impact", () => {
    expect(bad.weakest.length).toBeGreaterThan(0);
    const impacts = bad.weakest.map((f) => (100 - f.score) * FACTORS.find((c) => c.key === f.key)!.weight);
    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
  });
});

describe("parse", () => {
  it("extracts structure from the good page", () => {
    const p = load("good.html");
    expect(p.title).toMatch(/Vitamin C Serum/);
    expect(p.author).toBe("Dr. Lena Voss");
    expect(p.publishedDate).toBe("2026-06-28");
    expect(p.modifiedDate).toBe("2026-07-10");
    expect(p.jsonLd.map((b) => b["@type"])).toContain("FAQPage");
    expect(p.headings.filter((h) => h.level === 2).length).toBeGreaterThanOrEqual(4);
    expect(p.sameAsLinks.length).toBeGreaterThan(0);
  });
});

describe("freshness", () => {
  it("scores a fresh page high and an old page low", () => {
    const fresh = freshness(load("good.html"), NOW); // modified 2026-07-10, 8 days old
    expect(fresh.score).toBe(100);
    const stale = freshness(load("medium.html"), NOW); // published 2025-09-14, ~10 months old
    expect(stale.score).toBeLessThanOrEqual(40);
  });

  it("scores 0 when no date exists", () => {
    expect(freshness(load("bad.html"), NOW).score).toBe(0);
  });
});

describe("crawlability gate", () => {
  it("fails on noindex and zeroes the overall score", () => {
    const html = `<html><head><title>t</title><meta name="robots" content="noindex"></head><body><p>${"word ".repeat(300)}</p></body></html>`;
    const page = parse(html);
    expect(crawlability(page).score).toBe(0);
    const result = audit(page, { now: NOW });
    expect(result.gated).toBe(true);
    expect(result.overall).toBe(0);
  });
});

describe("factualSpecificity", () => {
  it("scores quantified copy above fluff", () => {
    const facts = factualSpecificity(load("good.html"));
    const fluff = factualSpecificity(load("bad.html"));
    expect(facts.score).toBeGreaterThan(fluff.score);
    expect(fluff.score).toBeLessThan(20);
  });
});
