import { describe, expect, it } from "vitest";
import { compareMaps } from "./compare";
import type { CitationMap, QuestionResult } from "./types";

const q = (text: string, over: Partial<QuestionResult> = {}): QuestionResult => ({
  id: "x",
  text,
  intent: "evidence",
  domains: [],
  bucket: "open",
  owner: null,
  brandRank: 0,
  replayed: true,
  ms: 1,
  ...over,
});

const m = (id: string, createdAt: string, questions: QuestionResult[], over: Partial<CitationMap> = {}): CitationMap => ({
  id,
  topic: "vitamin c serum",
  brand: "Us",
  brandDomain: "us.com",
  market: "UK",
  engine: "openai:gpt-4o-mini",
  createdAt,
  questions,
  domains: [{ domain: "big.com", wins: 1, appearances: 1, isBrand: false }],
  counts: {
    owned: questions.filter((x) => x.bucket === "owned").length,
    lost: questions.filter((x) => x.bucket === "lost").length,
    contested: questions.filter((x) => x.bucket === "contested").length,
    reference: questions.filter((x) => x.bucket === "reference").length,
    open: questions.filter((x) => x.bucket === "open").length,
  },
  cost: { calls: 0, replayed: 0, inTokens: 0, outTokens: 0, usd: 0, rate: "t" },
  ...over,
});

describe("compareMaps", () => {
  it("counts a question we now own as won, and one we lost as lost", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [
      q("does it work?", { bucket: "lost", owner: "big.com", domains: ["big.com"] }),
      q("is it safe?", { bucket: "owned", owner: "us.com", domains: ["us.com"], brandRank: 1 }),
    ]);
    const after = m("b", "2026-02-01T00:00:00.000Z", [
      q("does it work?", { bucket: "owned", owner: "us.com", domains: ["us.com"], brandRank: 1 }),
      q("is it safe?", { bucket: "lost", owner: "big.com", domains: ["big.com"] }),
    ]);

    const d = compareMaps(before, after);
    expect(d.won.map((w) => w.text)).toEqual(["does it work?"]);
    expect(d.lost.map((w) => w.text)).toEqual(["is it safe?"]);
    expect(d.comparable).toBe(2);
    expect(d.daysBetween).toBe(31);
  });

  it("matches on wording, not on positional ids, because a re-run renumbers", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [
      q("Does it work?", { id: "q001", bucket: "lost", owner: "big.com" }),
      q("Is it safe?", { id: "q002", bucket: "lost", owner: "big.com" }),
    ]);
    // same two questions, opposite order, so ids now point at the other question
    const after = m("b", "2026-01-08T00:00:00.000Z", [
      q("is it safe?", { id: "q001", bucket: "lost", owner: "big.com" }),
      q("does it work?", { id: "q002", bucket: "owned", brandRank: 1, owner: "us.com" }),
    ]);

    const d = compareMaps(before, after);
    expect(d.comparable).toBe(2);
    expect(d.won.map((w) => w.text)).toEqual(["does it work?"]);
    expect(d.lost).toHaveLength(0);
  });

  it("never reports a question the newer run did not ask as a loss", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [
      q("kept", { bucket: "owned", brandRank: 1, owner: "us.com" }),
      q("gone", { bucket: "owned", brandRank: 1, owner: "us.com" }),
    ]);
    const after = m("b", "2026-01-02T00:00:00.000Z", [
      q("kept", { bucket: "owned", brandRank: 1, owner: "us.com" }),
      q("brand new", { bucket: "open" }),
    ]);

    const d = compareMaps(before, after);
    expect(d.lost).toHaveLength(0);
    expect(d.comparable).toBe(1);
    expect(d.droppedQuestions).toBe(1);
    expect(d.newQuestions).toBe(1);
  });

  it("separates a change of owner from a change of ownership by us", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [q("who wins?", { bucket: "lost", owner: "big.com", domains: ["big.com"] })]);
    const after = m("b", "2026-01-02T00:00:00.000Z", [q("who wins?", { bucket: "lost", owner: "other.com", domains: ["other.com"] })]);

    const d = compareMaps(before, after);
    expect(d.won).toHaveLength(0);
    expect(d.lost).toHaveLength(0);
    expect(d.otherMoves[0]).toMatchObject({ fromOwner: "big.com", toOwner: "other.com" });
  });

  it("ranks domain movement by size of change", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [], {
      domains: [
        { domain: "big.com", wins: 40, appearances: 50, isBrand: false },
        { domain: "us.com", wins: 1, appearances: 2, isBrand: true },
      ],
    });
    const after = m("b", "2026-01-02T00:00:00.000Z", [], {
      domains: [
        { domain: "big.com", wins: 30, appearances: 44, isBrand: false },
        { domain: "us.com", wins: 12, appearances: 20, isBrand: true },
      ],
    });

    const d = compareMaps(before, after);
    expect(d.domains[0]).toMatchObject({ domain: "us.com", delta: 11, isBrand: true });
    expect(d.domains[1]).toMatchObject({ domain: "big.com", delta: -10 });
  });
});

describe("delta counts that the panel quotes", () => {
  const owned = (t: string) => q(t, { bucket: "owned", brandRank: 1, owner: "us.com" });
  const lostQ = (t: string) => q(t, { bucket: "lost", owner: "big.com", domains: ["big.com"] });

  it("counts owned only on the questions both runs asked", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [owned("kept"), owned("dropped"), owned("also dropped")]);
    const after = m("b", "2026-01-08T00:00:00.000Z", [owned("kept"), lostQ("brand new")]);

    const d = compareMaps(before, after);
    // whole-map counts stay available, but the shared-set counts are what the panel shows
    expect(d.before.owned).toBe(3);
    expect(d.before.ownedComparable).toBe(1);
    expect(d.after.ownedComparable).toBe(1);
    expect(d.comparable).toBe(1);
  });

  it("reports gross churn even when the net is zero", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [owned("a"), owned("b"), lostQ("c"), lostQ("d")]);
    const after = m("b", "2026-01-02T00:00:00.000Z", [lostQ("a"), lostQ("b"), owned("c"), owned("d")]);

    const d = compareMaps(before, after);
    expect(d.won).toHaveLength(2);
    expect(d.lost).toHaveLength(2);
    // a headline computed from won minus lost would say nothing moved
    expect(d.won.length - d.lost.length).toBe(0);
    expect(d.won.length + d.lost.length).toBe(4);
  });

  it("lists only domains that actually moved", () => {
    const before = m("a", "2026-01-01T00:00:00.000Z", [], {
      domains: [
        { domain: "still.com", wins: 5, appearances: 5, isBrand: false },
        { domain: "mover.com", wins: 1, appearances: 1, isBrand: false },
      ],
    });
    const after = m("b", "2026-01-02T00:00:00.000Z", [], {
      domains: [
        { domain: "still.com", wins: 5, appearances: 5, isBrand: false },
        { domain: "mover.com", wins: 4, appearances: 4, isBrand: false },
      ],
    });
    expect(compareMaps(before, after).domains.map((d) => d.domain)).toEqual(["mover.com"]);
  });

  it("reports zero comparable when the two runs share no wording", () => {
    const d = compareMaps(
      m("a", "2026-01-01T00:00:00.000Z", [owned("alpha")]),
      m("b", "2026-01-02T00:00:00.000Z", [owned("beta")]),
    );
    expect(d.comparable).toBe(0);
    expect(d.won).toHaveLength(0);
    expect(d.lost).toHaveLength(0);
  });
});
