import { describe, expect, it } from "vitest";
import { deriveSignals } from "./signals";
import type { CitationMap, QuestionResult } from "./types";

const q = (over: Partial<QuestionResult>): QuestionResult => ({
  id: "q",
  text: "t",
  intent: "evidence",
  domains: [],
  bucket: "open",
  owner: null,
  brandRank: 0,
  replayed: true,
  ms: 1,
  ...over,
});

/** 20 questions so the 15% monopoly floor lands at 3, which is easy to reason about. */
const build = (questions: QuestionResult[], domains: CitationMap["domains"]): CitationMap => ({
  id: "m",
  topic: "t",
  brand: "Us",
  brandDomain: "us.com",
  market: "UK",
  engine: "e",
  createdAt: "2026-07-28T00:00:00.000Z",
  questions,
  domains,
  counts: {
    owned: questions.filter((x) => x.bucket === "owned").length,
    lost: questions.filter((x) => x.bucket === "lost").length,
    contested: questions.filter((x) => x.bucket === "contested").length,
    reference: questions.filter((x) => x.bucket === "reference").length,
    open: questions.filter((x) => x.bucket === "open").length,
  },
  cost: { calls: 0, replayed: 0, inTokens: 0, outTokens: 0, usd: 0, rate: "t" },
});

describe("deriveSignals", () => {
  it("separates being quoted first from being quoted at all", () => {
    const s = deriveSignals(
      build(
        [
          q({ id: "a", bucket: "owned", brandRank: 1, domains: ["us.com"], owner: "us.com" }),
          q({ id: "b", bucket: "owned", brandRank: 3, domains: ["big.com", "mid.com", "us.com"], owner: "big.com" }),
          q({ id: "c", bucket: "lost", domains: ["big.com"], owner: "big.com" }),
        ],
        [
          { domain: "big.com", wins: 2, appearances: 2, isBrand: false },
          { domain: "us.com", wins: 1, appearances: 2, isBrand: true },
          { domain: "mid.com", wins: 0, appearances: 1, isBrand: false },
        ],
      ),
    );
    expect(s.citedFirst).toBe(1);
    expect(s.citedButNeverFirst).toBe(1);
  });

  it("surfaces the domain that is always in the room and never chosen", () => {
    const s = deriveSignals(
      build([q({ domains: ["big.com", "ghost.com"], owner: "big.com", bucket: "lost" })], [
        { domain: "big.com", wins: 30, appearances: 40, isBrand: false },
        { domain: "ghost.com", wins: 1, appearances: 38, isBrand: false },
      ]),
    );
    expect(s.runners[0]).toMatchObject({ domain: "ghost.com", nearMisses: 37 });
    expect(s.runners[1]).toMatchObject({ domain: "big.com", nearMisses: 10 });
  });

  it("prices a question by what is actually holding it, and quotes the count in the reason", () => {
    const questions = [
      q({ id: "open1" }),
      q({ id: "inst", domains: ["en.wikipedia.org"], owner: "en.wikipedia.org" }),
      q({ id: "soft", domains: ["a.com", "b.com", "c.com"], owner: "a.com", bucket: "contested" }),
      ...Array.from({ length: 5 }, (_, i) => q({ id: `hard${i}`, domains: ["big.com"], owner: "big.com", bucket: "lost" })),
    ];
    const s = deriveSignals(
      build(questions, [
        { domain: "big.com", wins: 5, appearances: 5, isBrand: false },
        { domain: "a.com", wins: 1, appearances: 1, isBrand: false },
      ]),
    );

    const byId = new Map(s.entryPoints.map((e) => [e.id, e]));
    expect(byId.get("open1")!.difficulty).toBe("open");
    // institutional-only counts as open: no commercial page holds it
    expect(byId.get("inst")!.difficulty).toBe("open");
    expect(byId.get("inst")!.reason).toContain("en.wikipedia.org");
    expect(byId.get("soft")!.difficulty).toBe("contested");
    expect(byId.get("hard0")!.difficulty).toBe("monopoly");
    expect(byId.get("hard0")!.reason).toBe("big.com wins 5 of the 8 questions in this category, including this one.");

    // easiest first, and questions we already own never appear
    expect(s.entryPoints[0].difficulty).toBe("open");
    expect(s.entryPoints.at(-1)!.difficulty).toBe("monopoly");
  });

  it("excludes questions the brand already holds from the entry points", () => {
    const s = deriveSignals(
      build([q({ id: "mine", bucket: "owned", brandRank: 2, domains: ["big.com", "us.com"], owner: "big.com" })], [
        { domain: "big.com", wins: 1, appearances: 1, isBrand: false },
      ]),
    );
    expect(s.entryPoints).toHaveLength(0);
  });

  it("ranks intents by how many questions are actually reachable", () => {
    const s = deriveSignals(
      build(
        [
          q({ intent: "usage", bucket: "open" }),
          q({ intent: "usage", bucket: "contested", domains: ["a.com"], owner: "a.com" }),
          q({ intent: "evidence", bucket: "lost", domains: ["big.com"], owner: "big.com" }),
        ],
        [
          { domain: "big.com", wins: 1, appearances: 1, isBrand: false },
          { domain: "a.com", wins: 1, appearances: 1, isBrand: false },
        ],
      ),
    );
    expect(s.intents[0]).toMatchObject({ intent: "usage", reachable: 2, open: 1 });
    expect(s.intents[1]).toMatchObject({ intent: "evidence", reachable: 0 });
  });

  it("counts which rivals the engine keeps naming in the same answer", () => {
    const s = deriveSignals(
      build(
        [
          q({ domains: ["a.com", "b.com"], owner: "a.com" }),
          q({ domains: ["b.com", "a.com"], owner: "b.com" }),
          q({ domains: ["a.com", "c.com"], owner: "a.com" }),
        ],
        [{ domain: "a.com", wins: 2, appearances: 3, isBrand: false }],
      ),
    );
    expect(s.coCitations[0]).toMatchObject({ a: "a.com", b: "b.com", together: 2 });
  });

  it("names the keystone as the top commercial rival, never an encyclopedia", () => {
    const s = deriveSignals(
      build([q({}), q({}), q({}), q({})], [
        { domain: "en.wikipedia.org", wins: 3, appearances: 4, isBrand: false },
        { domain: "big.com", wins: 1, appearances: 2, isBrand: false },
      ]),
    );
    expect(s.keystone).toMatchObject({ domain: "big.com", wins: 1, share: 0.25 });
  });

  it("survives an empty map instead of dividing by zero", () => {
    const s = deriveSignals(build([], []));
    expect(s).toMatchObject({ citedFirst: 0, citedButNeverFirst: 0, keystone: null });
    expect(s.entryPoints).toEqual([]);
    expect(s.intents).toEqual([]);
  });
});

describe("weakest occupant routing", () => {
  it("points at the site that wins nothing, not at the one that owns the category", () => {
    const s = deriveSignals(
      build(
        [q({ id: "t", domains: ["big.com", "mid.com", "ghost.com"], owner: "big.com", bucket: "lost" })],
        [
          { domain: "big.com", wins: 40, appearances: 45, isBrand: false },
          { domain: "mid.com", wins: 4, appearances: 20, isBrand: false },
          { domain: "ghost.com", wins: 0, appearances: 30, isBrand: false },
        ],
      ),
    );
    const e = s.entryPoints[0];
    expect(e.occupants.map((o) => o.domain)).toEqual(["big.com", "mid.com", "ghost.com"]);
    expect(e.occupants[2]).toMatchObject({ slot: 3, winsAcross: 0, appearancesAcross: 30 });
    expect(e.weakest!.domain).toBe("ghost.com");
    expect(e.incumbent).toBe("big.com");
    expect(e.reason).toContain("ghost.com holds slot 3");
    expect(s.softChairQuestions).toBe(1);
  });

  it("never routes at a reference site, only at commercial occupants", () => {
    const s = deriveSignals(
      build([q({ domains: ["en.wikipedia.org", "shop.com"], owner: "en.wikipedia.org" })], [
        { domain: "shop.com", wins: 1, appearances: 1, isBrand: false },
      ]),
    );
    expect(s.entryPoints[0].occupants.map((o) => o.domain)).toEqual(["shop.com"]);
    expect(s.entryPoints[0].weakest!.domain).toBe("shop.com");
    // slot is the position in the engine's own list, so the encyclopedia still counts as slot 1
    expect(s.entryPoints[0].occupants[0].slot).toBe(2);
  });

  it("leaves weakest null when the engine named nothing commercial", () => {
    const s = deriveSignals(build([q({ id: "none" })], []));
    expect(s.entryPoints[0].weakest).toBeNull();
    expect(s.softChairQuestions).toBe(0);
  });
});

describe("reason strings never name something that does not exist", () => {
  it("handles a reference site cited first with commercial sites behind it", () => {
    const s = deriveSignals(
      build(
        [q({ id: "mix", domains: ["nhs.uk", "shop.com", "other.com"], owner: "nhs.uk", bucket: "contested" })],
        [
          { domain: "shop.com", wins: 0, appearances: 3, isBrand: false },
          { domain: "other.com", wins: 0, appearances: 2, isBrand: false },
        ],
      ),
    );
    const r = s.entryPoints[0].reason;
    expect(r).not.toContain("null");
    expect(r).not.toContain("undefined");
    expect(r).toContain("reference source first");
  });

  it("never prints null or undefined on any question of a mixed map", () => {
    const s = deriveSignals(
      build(
        [
          q({ id: "a" }),
          q({ id: "b", domains: ["en.wikipedia.org"], owner: "en.wikipedia.org" }),
          q({ id: "c", domains: ["nhs.uk", "x.com"], owner: "nhs.uk" }),
          q({ id: "d", domains: ["big.com", "x.com"], owner: "big.com", bucket: "lost" }),
          q({ id: "e", domains: ["small.com"], owner: "small.com", bucket: "contested" }),
        ],
        [
          { domain: "big.com", wins: 30, appearances: 30, isBrand: false },
          { domain: "x.com", wins: 0, appearances: 2, isBrand: false },
          { domain: "small.com", wins: 1, appearances: 1, isBrand: false },
        ],
      ),
    );
    for (const e of s.entryPoints) {
      expect(e.reason, e.id).not.toMatch(/\bnull\b|\bundefined\b|\bNaN\b/);
      expect(e.reason.length, e.id).toBeGreaterThan(20);
    }
  });
});
