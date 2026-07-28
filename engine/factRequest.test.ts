import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildFactRequests, factSheetRows, parseCsv, readFilledSheet, toSuppliedFacts } from "./factRequest";
import { generateFixes } from "./fixes";
import { parse } from "./parse";
import { audit } from "./score";
import { applyFixes } from "./apply";
import type { Fix } from "./fixes";

const fix = (over: Partial<Fix>): Fix => ({
  factorKey: "factualSpecificity",
  title: "t",
  before: "Vitamin C may help brighten skin over time.",
  after: "Vitamin C brightens skin by [SOURCED STAT: metric, %, timeframe, study + year].",
  impact: 3,
  effort: 2,
  priority: 6,
  rationale: "r",
  ...over,
});

describe("parseCsv", () => {
  it("survives quotes, embedded commas and newlines from a spreadsheet round trip", () => {
    const rows = parseCsv('a,b\n"one, two","say ""hi""\nnext line"\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["one, two", 'say "hi"\nnext line'],
    ]);
  });

  it("drops entirely blank rows rather than producing empty requests", () => {
    expect(parseCsv("a,b\n,\nx,y\n")).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
  });
});

describe("buildFactRequests", () => {
  it("asks only for what is actually blocked", () => {
    const reqs = buildFactRequests([
      fix({}),
      fix({ factorKey: "answerStructure", after: "Move the question into the H2 verbatim." }),
      fix({ factorKey: "sourcedQuotes" }),
      fix({ factorKey: "offSiteAuthority" }),
    ]);
    expect(reqs.map((r) => r.kind)).toEqual(["figure", "quote", "person"]);
    expect(reqs[0].replaces).toContain("may help brighten");
    expect(reqs[0].weightPct).toBe(18);
  });

  it("leaves the answer column empty in the sheet it hands over", () => {
    const rows = factSheetRows(buildFactRequests([fix({})]));
    expect(rows[0].at(-4)).toBe("");
  });
});

describe("readFilledSheet and toSuppliedFacts", () => {
  const requests = buildFactRequests([fix({}), fix({ factorKey: "sourcedQuotes" }), fix({ factorKey: "offSiteAuthority" })]);

  it("reads the sheet back by header name, not by column position", () => {
    const csv =
      "your_answer,id,source_url,person_name,person_credential\n" +
      '"Vitamin C raised brightness 32% over 12 weeks.",fact-01,https://study.example/x,,\n';
    expect(readFilledSheet(csv)).toEqual([
      {
        id: "fact-01",
        answer: "Vitamin C raised brightness 32% over 12 weeks.",
        sourceUrl: "https://study.example/x",
        personName: "",
        personCredential: "",
      },
    ]);
  });

  it("carries the client's own source into the replacement sentence", () => {
    const facts = toSuppliedFacts(requests, [
      { id: "fact-01", answer: "Brightness rose 32% in 12 weeks.", sourceUrl: "https://study.example/x" },
    ]);
    expect(facts.claims).toEqual([
      { find: "Vitamin C may help brighten skin over time.", replace: "Brightness rose 32% in 12 weeks. (https://study.example/x)" },
    ]);
  });

  it("refuses a quote or a byline with no real name behind it", () => {
    const facts = toSuppliedFacts(requests, [
      { id: "fact-02", answer: "Vitamin C is well evidenced.", personName: "  " },
      { id: "fact-03", answer: "anything" },
    ]);
    expect(facts.quote).toBeUndefined();
    expect(facts.author).toBeUndefined();
  });

  it("drops a blank answer instead of writing an empty sentence onto the page", () => {
    expect(toSuppliedFacts(requests, [{ id: "fact-01", answer: "   " }])).toEqual({});
  });

  it("ignores a row whose id is not one we asked about", () => {
    expect(toSuppliedFacts(requests, [{ id: "fact-99", answer: "smuggled" }])).toEqual({});
  });

  it("round-trips into applyFixes and actually changes the page", () => {
    const html = readFileSync("fixtures/pages/medium.html", "utf8");
    const page = parse(html, "https://example.com/x");
    const fixes = generateFixes(page, audit(page));
    const requests = buildFactRequests(fixes);
    expect(requests.length).toBeGreaterThan(0);

    const figure = requests.find((r) => r.kind === "figure")!;
    const before = applyFixes(html, page, fixes, {});
    const after = applyFixes(html, page, fixes, {
      ...toSuppliedFacts(requests, [
        { id: figure.id, answer: "Brightness rose 32% over 12 weeks.", sourceUrl: "https://study.example/x" },
      ]),
    });

    // one supplied fact moves exactly one refusal into the applied column
    expect(after.applied.length).toBe(before.applied.length + 1);
    expect(after.skipped.length).toBe(before.skipped.length - 1);
    expect(after.html).toContain("Brightness rose 32% over 12 weeks.");
    expect(after.html).not.toBe(before.html);
  });
});
