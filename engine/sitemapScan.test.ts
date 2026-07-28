import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Both defects here were found on healthline.com, the site that wins the whole
 * demo category, and both made its winning page unresolvable.
 */

const BODIES = new Map<string, string>();

vi.mock("./ingest", async () => {
  const actual = await vi.importActual<typeof import("./ingest")>("./ingest");
  return {
    ...actual,
    safeFetch: async (url: string) => {
      const body = BODIES.get(url);
      if (body === undefined) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, status: 200, text: async () => body };
    },
  };
});

const { scanSitemap } = await import("./sitemap");

const index = (...locs: string[]) =>
  `<sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join("")}</sitemapindex>`;
const urlset = (...locs: string[]) =>
  `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join("")}</urlset>`;

const ROBOTS = `User-agent: *
Sitemap: https://ex.com/first.xml
Sitemap: https://ex.com/articles.xml
`;

beforeEach(() => {
  BODIES.clear();
  // healthline's shape: a thin index of indexes, and the real articles in a SECOND
  // sitemap that robots.txt declares on its own line
  BODIES.set("https://ex.com/first.xml", index("https://ex.com/nested.xml"));
  BODIES.set("https://ex.com/nested.xml", index("https://ex.com/leaf.xml"));
  BODIES.set("https://ex.com/leaf.xml", urlset("https://ex.com/pages/about"));
  BODIES.set("https://ex.com/articles.xml", urlset("https://ex.com/nutrition/vitamin-c-benefits"));
});

describe("scanSitemap", () => {
  it("reads every sitemap robots.txt declares, not only the first that parses", async () => {
    const seen: string[] = [];
    const r = await scanSitemap("https://ex.com/", ROBOTS, (entries) => seen.push(...entries.map((e) => e.loc)));

    expect(seen).toContain("https://ex.com/nutrition/vitamin-c-benefits");
    expect(r.urlsScanned).toBe(2);
  });

  it("follows a nested index instead of scoring its .xml children as pages", async () => {
    const seen: string[] = [];
    await scanSitemap("https://ex.com/", ROBOTS, (entries) => seen.push(...entries.map((e) => e.loc)));

    // the page behind two levels of index is reached
    expect(seen).toContain("https://ex.com/pages/about");
    // and no sitemap file was ever offered as a candidate page
    expect(seen.filter((l) => l.endsWith(".xml"))).toEqual([]);
  });

  it("reports a domain with no sitemap as empty rather than throwing", async () => {
    BODIES.clear();
    const r = await scanSitemap("https://ex.com/", "", () => {});
    expect(r.urlsScanned).toBe(0);
    expect(r.source).toBe("");
    expect(r.attempts.length).toBeGreaterThan(0);
  });
});
