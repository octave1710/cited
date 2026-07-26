import type { FactorResult, ParsedPage } from "../types";

const STOPWORDS = new Set("the a an and or of to for in on with your you what how why when is are does can should it".split(" "));
const FAQ_RE = /faq|frequently asked|questions/i;

/**
 * PARTIAL: true fan-out presence is measured against real engine sub-queries
 * (Profound query-fanouts report, production mode). Offline we score topical
 * breadth: does the page cover enough distinct sub-topics to match a fan-out?
 */
export function fanoutCoverage(page: ParsedPage): FactorResult {
  const h2s = page.headings.filter((h) => h.level === 2);
  const breadthScore = Math.min(5, h2s.length) * 10;

  const hasFaq = page.headings.some((h) => FAQ_RE.test(h.text)) || page.jsonLd.some((b) => b["@type"] === "FAQPage");

  const terms = new Set(
    page.headings
      .flatMap((h) => h.text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
  const vocabScore = Math.min(25, Math.round((terms.size / 14) * 25));

  return {
    key: "fanoutCoverage",
    name: "Fan-out / multi-subquery coverage",
    score: Math.min(100, breadthScore + (hasFaq ? 25 : 0) + vocabScore),
    evidence: [
      `${h2s.length} H2 sections (distinct sub-topics)`,
      hasFaq ? "FAQ section present" : "no FAQ section",
      `${terms.size} distinct meaningful terms across headings`,
    ],
    reasoning: "Engines decompose a query into sub-queries; 31% of citations come from pages outside Google's top-100 that match a sub-query (Ahrefs). Offline proxy; production mode tests against real fan-outs.",
    partial: true,
  };
}
