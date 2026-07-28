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
