import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parse.js";
import { audit } from "./score.js";
import { generateFixes } from "./fixes.js";
import { generateSchemas } from "./schemaGen.js";
import { schemaValidity } from "./factors/schemaValidity.js";

const NOW = new Date("2026-07-18");
const load = (name: string) => parse(readFileSync(join(__dirname, "..", "fixtures", "pages", name), "utf8"));

describe("generateFixes", () => {
  const medium = load("medium.html");
  const fixes = generateFixes(medium, audit(medium, { now: NOW }), { now: NOW });

  it("rewrites non-question headings as questions, quoting the real heading", () => {
    const f = fixes.find((x) => x.before.includes("Benefits of vitamin C serum"));
    expect(f).toBeDefined();
    expect(f!.after).toBe('H2: "What are the benefits of vitamin C serum?"');
  });

  it("proposes a freshness fix for the stale page", () => {
    const f = fixes.find((x) => x.factorKey === "freshness");
    expect(f).toBeDefined();
    expect(f!.after).toContain("2026-07-18");
  });

  it("never invents statistics: hedge fixes carry an explicit slot instead of a number", () => {
    for (const f of fixes.filter((x) => x.factorKey === "factualSpecificity")) {
      expect(f.after).toContain("[SOURCED STAT");
    }
  });

  it("sorts by priority descending", () => {
    const p = fixes.map((f) => f.priority);
    expect(p).toEqual([...p].sort((a, b) => b - a));
  });

  it("leads with crawlability when the page is gated", () => {
    const html = `<html><head><title>t</title><meta name="robots" content="noindex"></head><body><p>${"word ".repeat(300)}</p></body></html>`;
    const page = parse(html);
    const gatedFixes = generateFixes(page, audit(page, { now: NOW }), { now: NOW });
    expect(gatedFixes[0].factorKey).toBe("crawlability");
    expect(gatedFixes[0].priority).toBe(25);
  });

  it("proposes almost nothing on the already-good page", () => {
    const good = load("good.html");
    const goodFixes = generateFixes(good, audit(good, { now: NOW }), { now: NOW });
    expect(goodFixes.length).toBeLessThanOrEqual(3);
  });
});

describe("generateSchemas", () => {
  it("extracts FAQPage from the good page's real question sections", () => {
    const { blocks } = generateSchemas(load("good.html"), { now: NOW });
    const faq = blocks.find((b) => b["@type"] === "FAQPage") as unknown as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq).toBeDefined();
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    const q = faq.mainEntity.find((m) => m.name.includes("percentage"));
    expect(q?.acceptedAnswer.text).toContain("15% L-ascorbic acid");
  });

  it("round-trips through the schemaValidity factor at 100", () => {
    const { blocks } = generateSchemas(load("good.html"), { now: NOW });
    const html = `<html><head><title>t</title>${blocks
      .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
      .join("")}</head><body><p>x</p></body></html>`;
    expect(schemaValidity(parse(html)).score).toBe(100);
  });

  it("warns instead of inventing an author", () => {
    const { blocks, warnings } = generateSchemas(load("medium.html"), { now: NOW });
    const article = blocks.find((b) => b["@type"] === "Article")!;
    expect("author" in article).toBe(false);
    expect(warnings.some((w) => w.includes("author"))).toBe(true);
  });

  it("builds HowTo from an ordered list of 3+ steps", () => {
    const html = `<html><head><title>t</title></head><body><h2>How to apply serum</h2><ol><li>Cleanse your face.</li><li>Apply 3 drops.</li><li>Wait 60 seconds, then moisturize.</li></ol></body></html>`;
    const { blocks } = generateSchemas(parse(html), { now: NOW });
    const howTo = blocks.find((b) => b["@type"] === "HowTo") as unknown as { name: string; step: unknown[] };
    expect(howTo).toBeDefined();
    expect(howTo.name).toBe("How to apply serum");
    expect(howTo.step).toHaveLength(3);
  });
});
