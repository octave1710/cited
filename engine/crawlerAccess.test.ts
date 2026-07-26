import { describe, expect, it } from "vitest";
import { parseRobots } from "./crawlerAccess";

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
