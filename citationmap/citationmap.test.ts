import { describe, expect, it } from "vitest";
import type { LLMClient } from "../adapters/llm";
import { bucketOf, classify, isInstitutional, rankDomains, toDomain } from "./classify";
import { parseQuestions } from "./questions";
import { parseSources, runCitationMap } from "./run";
import type { QuestionResult } from "./types";

const q = (over: Partial<QuestionResult>): QuestionResult => ({
  id: "q1",
  text: "t",
  intent: "i",
  domains: [],
  bucket: "contested",
  owner: null,
  brandRank: 0,
  replayed: true,
  ms: 1,
  ...over,
});

describe("toDomain", () => {
  it("normalises urls, casing and www to a bare host", () => {
    expect(toDomain("https://www.Healthline.com/nutrition/vitamin-c")).toBe("healthline.com");
    expect(toDomain("Healthline.com.")).toBe("healthline.com");
  });

  it("rejects anything that is not a host", () => {
    expect(toDomain("Healthline")).toBeNull();
    expect(toDomain("a well known magazine")).toBeNull();
    expect(toDomain("")).toBeNull();
  });

  it("rejects a brand name and a header-forging value rather than lowercasing them", () => {
    // typed into the domain field, "Meridian Skin Lab" used to become a domain that can
    // never match a cited host, so every question came back "you are never quoted"
    expect(toDomain("Meridian Skin Lab")).toBeNull();
    expect(toDomain("evil.com\r\nX-Injected: 1")).toBeNull();
    expect(toDomain("site.com/../../etc")).toBe("site.com");
    expect(toDomain(".leading.dot")).toBeNull();
  });
});

describe("isInstitutional", () => {
  it("catches reference works, government and academia but not commercial publishers", () => {
    for (const d of ["en.wikipedia.org", "nih.gov", "cancer.gov", "ox.ac.uk", "mit.edu", "who.int", "nhs.uk"]) {
      expect(isInstitutional(d), d).toBe(true);
    }
    for (const d of ["healthline.com", "govdeals.com", "theeducationhub.org"]) {
      expect(isInstitutional(d), d).toBe(false);
    }
  });
});

describe("parseSources", () => {
  it("extracts, dedupes and caps at five", () => {
    const raw = JSON.stringify({
      answer: "x",
      sources: ["https://healthline.com/a", "www.healthline.com", "byrdie.com", "Not A Domain", "a.com", "b.com", "c.com", "d.com"],
    });
    expect(parseSources(raw)).toEqual(["healthline.com", "byrdie.com", "a.com", "b.com", "c.com"]);
  });

  it("returns nothing rather than guessing when the answer is not JSON", () => {
    expect(parseSources("I would cite Healthline and Byrdie.")).toEqual([]);
  });

  it("treats an explicitly empty source list as an unclaimed question", () => {
    expect(parseSources('{"answer":"x","sources":[]}')).toEqual([]);
  });
});

describe("parseQuestions", () => {
  it("survives a fenced JSON block", () => {
    expect(parseQuestions('```json\n{"questions":["a","b"]}\n```')).toEqual(["a", "b"]);
  });

  it("throws rather than returning an empty set on garbage", () => {
    expect(() => parseQuestions("sorry, I can't")).toThrow(/unparseable/i);
  });
});

describe("bucketOf", () => {
  const consolidated = new Set(["healthline.com"]);

  it("is owned whenever the brand is cited anywhere, not only first", () => {
    expect(bucketOf(q({ domains: ["healthline.com", "us.com"], owner: "healthline.com", brandRank: 2 }), consolidated)).toBe("owned");
  });

  it("separates naming nothing from naming only reference sites", () => {
    // saying "no site was named" about an answer that named nhs.uk is a claim the
    // user disproves in one retype, so the two are counted apart
    expect(bucketOf(q({}), consolidated)).toBe("open");
    expect(bucketOf(q({ domains: ["en.wikipedia.org", "nih.gov"], owner: "en.wikipedia.org" }), consolidated)).toBe("reference");
  });

  it("separates a consolidated owner from a one-off winner", () => {
    expect(bucketOf(q({ domains: ["healthline.com"], owner: "healthline.com" }), consolidated)).toBe("lost");
    expect(bucketOf(q({ domains: ["random.com"], owner: "random.com" }), consolidated)).toBe("contested");
  });
});

describe("rankDomains", () => {
  it("counts wins on first position only and appearances anywhere", () => {
    const stats = rankDomains(
      [
        q({ domains: ["a.com", "b.com"] }),
        q({ domains: ["a.com"] }),
        q({ domains: ["b.com", "a.com"] }),
      ],
      "us.com",
    );
    expect(stats[0]).toMatchObject({ domain: "a.com", wins: 2, appearances: 3 });
    expect(stats[1]).toMatchObject({ domain: "b.com", wins: 1, appearances: 2 });
  });
});

describe("classify", () => {
  it("only calls a loss consolidated once the owner clears the threshold", () => {
    const three = Array.from({ length: 3 }, () => q({ domains: ["big.com"], owner: "big.com" }));
    const one = q({ domains: ["small.com"], owner: "small.com" });
    const { counts } = classify([...three, one], "us.com");
    expect(counts).toEqual({ owned: 0, lost: 3, contested: 1, reference: 0, open: 0 });
  });
});

describe("runCitationMap", () => {
  // one deterministic stub for both prompt shapes; asserts the whole pipeline, not a single unit
  const stub = (): LLMClient => ({
    label: "stub",
    async answer(s, u) {
      return (await this.call(s, u)).text;
    },
    async call(system, user) {
      if (system.startsWith("You generate")) {
        const angle = user.match(/Angle: ([^\n]+)/)![1].slice(0, 12);
        const want = Number(user.match(/exactly (\d+)/)![1]);
        return {
          text: JSON.stringify({ questions: Array.from({ length: want }, (_, i) => `${angle} question ${i}`) }),
          replayed: false,
          usage: { in: 100, out: 50 },
        };
      }
      const n = Number(user.match(/question (\d)/)![1]);
      const sources = n === 0 ? ["us.com", "big.com"] : n === 1 ? [] : ["big.com"];
      return { text: JSON.stringify({ answer: "a", sources }), replayed: false, usage: { in: 20, out: 10 } };
    },
  });

  it("produces a classified map with a measured cost", async () => {
    const map = await runCitationMap(stub(), {
      topic: "vitamin c serum",
      brand: "Us",
      brandDomain: "https://www.us.com/",
      market: "UK",
      perIntent: 5,
    });

    expect(map.questions).toHaveLength(40); // 8 intents x 5, all distinct
    expect(map.brandDomain).toBe("us.com");
    expect(map.counts.owned).toBe(8);
    expect(map.counts.open).toBe(8);
    expect(map.counts.reference).toBe(0);
    expect(map.counts.lost).toBe(24);
    expect(map.domains[0]).toMatchObject({ domain: "big.com", wins: 24 });

    // 8 generation calls + 40 question calls, priced off the published gpt-4o-mini rate
    expect(map.cost.calls).toBe(48);
    expect(map.cost.inTokens).toBe(8 * 100 + 40 * 20);
    expect(map.cost.usd).toBeCloseTo((1600 * 0.15 + 800 * 0.6) / 1_000_000, 10);
  });

  it("refuses to build a map from too few questions", async () => {
    await expect(
      runCitationMap(stub(), { topic: "t", brand: "Us", brandDomain: "us.com", market: "UK", perIntent: 1 }),
    ).rejects.toThrow(/at least 40/);
  });
});
