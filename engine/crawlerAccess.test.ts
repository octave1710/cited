import { describe, expect, it } from "vitest";
import { decide, matches, parseRobots } from "./crawlerAccess";

const ROBOTS = `
# comment line
User-agent: *
Disallow: /admin
Allow: /admin/public

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow:
`;

describe("parseRobots", () => {
  const groups = parseRobots(ROBOTS);

  it("groups consecutive user-agent lines together", () => {
    const g = groups.find((x) => x.agents.includes("gptbot"))!;
    expect(g.agents).toEqual(["gptbot", "ccbot"]);
    expect(g.rules).toEqual([{ allow: false, path: "/" }]);
  });

  it("keeps the wildcard group separate with its allow and disallow rules", () => {
    const g = groups.find((x) => x.agents.includes("*"))!;
    expect(g.rules).toEqual([
      { allow: false, path: "/admin" },
      { allow: true, path: "/admin/public" },
    ]);
  });

  it("reads an empty Disallow as its own rule rather than dropping the group", () => {
    const g = groups.find((x) => x.agents.includes("perplexitybot"))!;
    expect(g.rules).toEqual([{ allow: false, path: "" }]);
  });

  it("ignores comments and blank lines", () => {
    expect(groups).toHaveLength(3);
  });
});

describe("parseRobots group boundaries", () => {
  it("does not merge two agents across a Crawl-delay line", () => {
    const groups = parseRobots(`User-agent: GPTBot
Crawl-delay: 10

User-agent: AhrefsBot
Disallow: /
`);
    const gpt = groups.find((g) => g.agents.includes("gptbot"))!;
    const ahrefs = groups.find((g) => g.agents.includes("ahrefsbot"))!;
    expect(gpt).not.toBe(ahrefs);
    expect(gpt.agents).toEqual(["gptbot"]);
    expect(gpt.rules).toEqual([]);
    expect(ahrefs.rules).toEqual([{ allow: false, path: "/" }]);
  });

  it("does not merge two agents across a Sitemap line", () => {
    const groups = parseRobots(`User-agent: GPTBot
Sitemap: https://example.com/sitemap.xml
User-agent: BadBot
Disallow: /
`);
    expect(groups.find((g) => g.agents.includes("gptbot"))!.agents).toEqual(["gptbot"]);
    expect(groups.find((g) => g.agents.includes("badbot"))!.rules).toEqual([{ allow: false, path: "/" }]);
  });

  it("still groups genuinely consecutive user-agent lines", () => {
    const groups = parseRobots(`User-agent: A
User-agent: B
Disallow: /x
`);
    expect(groups).toHaveLength(1);
    expect(groups[0].agents).toEqual(["a", "b"]);
  });
});

describe("matches", () => {
  it("handles prefixes, wildcards and the end anchor", () => {
    expect(matches("/admin", "/admin/users")).toBe(true);
    expect(matches("/admin", "/public")).toBe(false);
    expect(matches("/*.pdf$", "/docs/report.pdf")).toBe(true);
    expect(matches("/*.pdf$", "/docs/report.pdf.html")).toBe(false);
    expect(matches("/a/*/c", "/a/b/c")).toBe(true);
    expect(matches("/a/*/c", "/a/b/d")).toBe(false);
    expect(matches("/", "/anything")).toBe(true);
    expect(matches("/x$", "/x")).toBe(true);
    expect(matches("/x$", "/xy")).toBe(false);
  });

  it("does not let overlapping segments satisfy an anchored tail", () => {
    // "/aa" then "$aa" cannot both be served by the same two characters
    expect(matches("/aa*aa$", "/aa")).toBe(false);
    expect(matches("/aa*aa$", "/aabaa")).toBe(true);
  });

  it("answers a pathological pattern in milliseconds instead of minutes", () => {
    const evil = "/" + "a*".repeat(20);
    const path = "/" + "a".repeat(60);
    const t0 = Date.now();
    expect(matches(evil, path)).toBe(true);
    expect(matches(evil + "$", path + "b")).toBe(false);
    expect(Date.now() - t0).toBeLessThan(50);
  });
});

describe("decide merges every group naming the same crawler", () => {
  it("lets a later Allow override an earlier Disallow, which is what our own patch emits", () => {
    const before = `User-agent: GPTBot
Disallow: /
`;
    expect(decide(parseRobots(before), "GPTBot", "/guide").allowed).toBe(false);

    // exactly what buildRobotsDiff appends
    const after = before + `\nUser-agent: GPTBot\nAllow: /\n`;
    const verdict = decide(parseRobots(after), "GPTBot", "/guide");
    expect(verdict.allowed).toBe(true);
    expect(verdict.rule).toBe("Allow: /");
  });

  it("still prefers a specific group over the wildcard", () => {
    const robots = `User-agent: *
Allow: /
User-agent: GPTBot
Disallow: /private
`;
    expect(decide(parseRobots(robots), "GPTBot", "/private/x").allowed).toBe(false);
    expect(decide(parseRobots(robots), "SomeOtherBot", "/private/x").allowed).toBe(true);
  });

  it("keeps longest-match precedence across merged groups", () => {
    const robots = `User-agent: GPTBot
Disallow: /
User-agent: GPTBot
Allow: /public
`;
    expect(decide(parseRobots(robots), "GPTBot", "/public/a").allowed).toBe(true);
    expect(decide(parseRobots(robots), "GPTBot", "/private").allowed).toBe(false);
  });
});
