import { describe, expect, it } from "vitest";
import { keywords, rankSitemapCandidates } from "./resolve";

const words = (q: string) => keywords(q).map((k) => k.word);

describe("keywords", () => {
  it("keeps a hyphenated term whole, because splitting it destroys the only specific word", () => {
    expect(words("How does GLP-1 work?")).toEqual(["glp-1"]);
    expect(keywords("How does GLP-1 work?")[0].specific).toBe(true);
  });

  it("drops scaffolding verbs that match half the web", () => {
    expect(words("What are the best foods to take?")).toEqual(["foods"]);
  });

  it("emits adjacent pairs before single words, and dedupes", () => {
    // pairs first: they are the discriminating terms, single words are the fallback
    expect(words("Vitamin C serum: is vitamin C serum worth it?")).toEqual([
      "vitamin-c",
      "c-serum",
      "serum-worth",
      "vitamin",
      "serum",
      "worth",
    ]);
  });
});

describe("rankSitemapCandidates", () => {
  it("refuses a match carried only by common words", () => {
    // these two really were returned for those two questions
    expect(
      rankSitemapCandidates(
        [{ loc: "https://www.nhs.uk/social-care-and-support/money-work-and-benefits/personal-budgets/" }],
        "How does GLP-1 work?",
      ),
    ).toEqual([]);
    expect(
      rankSitemapCandidates(
        [{ loc: "https://www.nhs.uk/medicines/antibiotics/side-effects/" }],
        "What are the side effects of semaglutide?",
      ),
    ).toEqual([]);
  });

  it("takes the page when the discriminating term is in the slug", () => {
    const r = rankSitemapCandidates(
      [
        { loc: "https://www.nhs.uk/medicines/antibiotics/side-effects/" },
        { loc: "https://www.nhs.uk/medicines/semaglutide/side-effects/" },
      ],
      "What are the side effects of semaglutide?",
    );
    expect(r.map((x) => x.loc)).toEqual(["https://www.nhs.uk/medicines/semaglutide/side-effects/"]);
  });

  it("matches a hyphenated term against a hyphenated slug", () => {
    const r = rankSitemapCandidates([{ loc: "https://x.com/medicines/glp-1/how-it-works" }], "How does GLP-1 work?");
    expect(r).toHaveLength(1);
  });

  it("does not let a substring hit pass for a match", () => {
    expect(
      rankSitemapCandidates([{ loc: "https://www.nhs.uk/services/pharmacy/worksop-pharmacy/FQL77" }], "How does GLP-1 work?"),
    ).toEqual([]);
  });

  it("ignores the query string and malformed entries", () => {
    expect(rankSitemapCandidates([{ loc: "https://x.com/home?utm_term=vitamin-serum" }], "vitamin serum")).toEqual([]);
    expect(rankSitemapCandidates([{ loc: "not a url" }, { loc: "https://x.com/vitamin-serum" }], "vitamin serum")).toHaveLength(1);
  });

  it("returns nothing rather than a bad guess", () => {
    expect(rankSitemapCandidates([{ loc: "https://x.com/about" }], "How do I return an order?")).toEqual([]);
    expect(rankSitemapCandidates([], "anything")).toEqual([]);
  });
});

describe("adjacent pairs keep a one-letter qualifier alive", () => {
  it("prefers vitamin-c over vitamin-b, which the single word cannot distinguish", () => {
    const r = rankSitemapCandidates(
      [
        { loc: "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-b/" },
        { loc: "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-c/" },
      ],
      "Is vitamin C good for skin?",
    );
    expect(r[0]?.loc).toBe("https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-c/");
  });

  it("refuses the wrong vitamin outright when the right one is absent", () => {
    expect(
      rankSitemapCandidates([{ loc: "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-b/" }], "vitamin C serum")
        .map((x) => x.loc),
    ).toEqual([]);
  });
});
