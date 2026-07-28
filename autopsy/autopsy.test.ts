import { describe, expect, it } from "vitest";
import { diff, parseUrls } from "./run";
import type { AuditResult, FactorResult } from "../engine/types";

const f = (key: string, score: number, evidence: string[] = []): FactorResult => ({
  key,
  name: `${key} (weighted)`,
  score,
  evidence,
  reasoning: `${key} at ${score}`,
});

const result = (factors: FactorResult[]): AuditResult => ({
  overall: 0,
  grade: "at-risk",
  gated: false,
  factors,
  weakest: [],
});

describe("parseUrls", () => {
  it("keeps only URLs on the domain asked for", () => {
    const raw = JSON.stringify({
      urls: [
        "https://www.healthline.com/nutrition/vitamin-c",
        "https://byrdie.com/vitamin-c",
        "https://healthline.com/a",
        "not a url",
      ],
    });
    expect(parseUrls(raw, "healthline.com")).toEqual([
      "https://www.healthline.com/nutrition/vitamin-c",
      "https://healthline.com/a",
    ]);
  });

  it("returns nothing rather than guessing on unparseable output", () => {
    expect(parseUrls("I would look at healthline", "healthline.com")).toEqual([]);
    expect(parseUrls('{"urls":[]}', "healthline.com")).toEqual([]);
  });
});

describe("diff", () => {
  it("orders factors by the weighted gap, not the raw gap", () => {
    // raw gaps are 60 and 70, so the lighter factor would win on raw difference.
    // weighted (0.18 and 0.14) it is 10.8 against 9.8, and the order flips.
    const ours = result([f("factualSpecificity", 20), f("freshness", 10)]);
    const theirs = result([f("factualSpecificity", 80), f("freshness", 80)]);
    const d = diff(ours, theirs);
    expect(d.map((x) => x.key)).toEqual(["factualSpecificity", "freshness"]);
    expect(d[0].impact).toBeCloseTo(10.8, 6);
    expect(d[1].impact).toBeCloseTo(9.8, 6);
  });

  it("carries the evidence from both pages so the gap is quotable", () => {
    const d = diff(
      result([f("sourcedQuotes", 0, [])]),
      result([f("sourcedQuotes", 100, ["Dr. Anna Lee, dermatologist"])]),
    );
    expect(d[0].theirEvidence).toEqual(["Dr. Anna Lee, dermatologist"]);
    expect(d[0].ourEvidence).toEqual([]);
    expect(d[0].theirReasoning).toBe("sourcedQuotes at 100");
  });

  it("keeps a factor present on only one side instead of dropping it", () => {
    const d = diff(result([]), result([f("freshness", 90)]));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ key: "freshness", ours: 0, theirs: 90 });
  });
});
