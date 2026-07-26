import type { FactorResult, ParsedPage } from "../types";

/** Age of the page from dateModified (preferred) or datePublished. */
export function freshness(page: ParsedPage, now: Date): FactorResult {
  const raw = page.modifiedDate ?? page.publishedDate;
  if (!raw || isNaN(Date.parse(raw))) {
    return {
      key: "freshness",
      name: "Freshness",
      score: 0,
      evidence: [raw ? `unparseable date: "${raw}"` : "no machine-readable date anywhere (JSON-LD, meta, <time>)"],
      reasoning: "Undated content is stale by default for answer engines. Perplexity in particular over-weights content under 30 days old (3.2x).",
    };
  }

  const ageDays = Math.floor((now.getTime() - Date.parse(raw)) / 86_400_000);
  const score = ageDays <= 30 ? 100 : ageDays <= 90 ? 85 : ageDays <= 180 ? 60 : ageDays <= 365 ? 40 : ageDays <= 730 ? 20 : 10;
  const which = page.modifiedDate ? "dateModified" : "datePublished";

  return {
    key: "freshness",
    name: "Freshness",
    score,
    evidence: [`${which}: ${raw} → ${ageDays} days old`],
    reasoning: "Content under 3 months old earns 2-3x more citations (seoClarity 2026); under 30 days is the Perplexity sweet spot.",
  };
}
