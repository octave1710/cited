import { describe, expect, it } from "vitest";
import { buildLlmsTxt, buildRobotsDiff } from "./llmsTxt";
import { parseSitemapXml, sitemapsFromRobots } from "./sitemap";
import type { AccessReport } from "./crawlerAccess";

describe("sitemapsFromRobots", () => {
  it("finds every declared sitemap and ignores comments", () => {
    const robots = `User-agent: *
Disallow: /admin
# Sitemap: https://example.com/commented-out.xml
Sitemap: https://example.com/sitemap_index.xml
sitemap:https://example.com/news.xml
`;
    expect(sitemapsFromRobots(robots)).toEqual([
      "https://example.com/sitemap_index.xml",
      "https://example.com/news.xml",
    ]);
  });
});

describe("parseSitemapXml", () => {
  it("reads a urlset with lastmod", () => {
    const r = parseSitemapXml(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://x.com/a</loc><lastmod>2026-01-02</lastmod></url>
  <url><loc>https://x.com/b</loc></url>
</urlset>`);
    expect(r.kind).toBe("urlset");
    expect(r.entries).toEqual([
      { loc: "https://x.com/a", lastmod: "2026-01-02" },
      { loc: "https://x.com/b", lastmod: undefined },
    ]);
  });

  it("distinguishes an index from a urlset", () => {
    const r = parseSitemapXml(`<sitemapindex><sitemap><loc>https://x.com/s1.xml</loc></sitemap></sitemapindex>`);
    expect(r.kind).toBe("index");
    expect(r.entries).toHaveLength(1);
  });

  it("refuses an HTML body that answered 200, which is what a real site does", () => {
    // paulaschoice.com/sitemap.xml answers 200 with an empty body and text/html
    expect(parseSitemapXml("").kind).toBe("none");
    expect(parseSitemapXml("<html><body>Not found</body></html>").kind).toBe("none");
  });
});

describe("buildLlmsTxt", () => {
  const pages = [
    { url: "https://x.com/a", title: "Vitamin C serum", description: "What it does and how to use it." },
    { url: "https://x.com/b", title: "Retinol guide" },
  ];

  it("lifts titles and descriptions verbatim and never writes one", () => {
    const r = buildLlmsTxt({ siteName: "X", siteUrl: "https://x.com", pages, sitemapUrl: "https://x.com/sitemap.xml" });
    expect(r.content).toContain("- [Vitamin C serum](https://x.com/a): What it does and how to use it.");
    // no description published, so the line stops at the link
    expect(r.content).toContain("- [Retinol guide](https://x.com/b)\n");
    expect(r.content).not.toMatch(/Retinol guide\]\(https:\/\/x\.com\/b\):/);
    expect(r.listed).toBe(2);
    expect(r.undescribed).toBe(1);
  });

  it("says how many pages carry no description instead of hiding it", () => {
    const r = buildLlmsTxt({ siteName: "X", siteUrl: "https://x.com", pages });
    expect(r.content).toContain("1 of these pages publish no meta description");
  });
});

describe("buildRobotsDiff", () => {
  const access = (blockedUas: string[]): AccessReport => ({
    robotsUrl: "https://x.com/robots.txt",
    status: 200,
    found: true,
    raw: "",
    verdicts: [],
    blocked: blockedUas.map((ua) => ({ ua, operator: "op", feeds: "f", allowed: false, rule: "Disallow: /", group: "*" })),
    patch: null,
  });

  it("appends rather than rewriting, so nothing the client wrote is touched", () => {
    const current = "User-agent: *\nDisallow: /admin\n";
    const r = buildRobotsDiff({ current, access: access(["GPTBot"]), sitemapDeclared: true, addLlmsTxt: false })!;
    expect(r.diff).toContain("--- a/robots.txt");
    expect(r.diff).toContain("+User-agent: GPTBot");
    expect(r.diff).toContain("+Allow: /");
    // every original line survives in the merged file
    expect(r.merged).toContain("Disallow: /admin");
    expect(r.merged.indexOf("Disallow: /admin")).toBeLessThan(r.merged.indexOf("GPTBot"));
  });

  it("declares the sitemap only when it is missing from the file", () => {
    const withDeclared = buildRobotsDiff({
      current: "User-agent: *\n",
      access: access(["GPTBot"]),
      sitemapUrl: "https://x.com/sitemap.xml",
      sitemapDeclared: true,
      addLlmsTxt: false,
    })!;
    expect(withDeclared.additions.join("\n")).not.toContain("Sitemap:");

    const missing = buildRobotsDiff({
      current: "User-agent: *\n",
      access: access([]),
      sitemapUrl: "https://x.com/sitemap.xml",
      sitemapDeclared: false,
      addLlmsTxt: false,
    })!;
    expect(missing.additions.join("\n")).toContain("Sitemap: https://x.com/sitemap.xml");
  });

  it("returns null rather than an empty patch when there is nothing to add", () => {
    expect(
      buildRobotsDiff({ current: "User-agent: *\n", access: access([]), sitemapDeclared: true, addLlmsTxt: false }),
    ).toBeNull();
  });
});

describe("buildLlmsTxt deduplication", () => {
  it("lists a page once even when a per-locale sitemap repeats it", () => {
    const same = { title: "The Ordinary", description: "Clinical formulations." };
    const r = buildLlmsTxt({
      siteName: "X",
      siteUrl: "https://x.com",
      pages: [
        { url: "https://x.com/en-us", ...same },
        { url: "https://x.com/de-de", ...same },
        { url: "https://x.com/fr-fr", ...same },
        { url: "https://x.com/serum", title: "Serum", description: "A serum." },
      ],
    });
    expect(r.listed).toBe(2);
    expect(r.content.match(/The Ordinary\]/g)).toHaveLength(1);
    expect(r.content).toContain("Serum");
  });

  it("treats same title with different descriptions as different pages", () => {
    const r = buildLlmsTxt({
      siteName: "X",
      siteUrl: "https://x.com",
      pages: [
        { url: "https://x.com/a", title: "Guide", description: "One." },
        { url: "https://x.com/b", title: "Guide", description: "Two." },
      ],
    });
    expect(r.listed).toBe(2);
  });
});
