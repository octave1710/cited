import type { FactorResult, ParsedPage } from "../types.js";

/** Deliberately down-weighted: ranking well on Google predicts citations less every year. */
export function googleRank(_page: ParsedPage, rank?: number): FactorResult {
  if (rank === undefined) {
    return {
      key: "googleRank",
      name: "Classic Google rank (deliberately down-weighted)",
      score: 50,
      evidence: ["rank not provided — neutral score (SERP adapter supplies it in production mode)"],
      reasoning: "Weighted at 3%: citation/top-10 overlap collapsed from 76% to 17% in a year. Ranking is no longer the story.",
      partial: true,
    };
  }
  const score = rank <= 3 ? 100 : rank <= 10 ? 75 : rank <= 30 ? 40 : 15;
  return {
    key: "googleRank",
    name: "Classic Google rank (deliberately down-weighted)",
    score,
    evidence: [`Google rank for target query: #${rank}`],
    reasoning: "Weighted at 3%: citation/top-10 overlap collapsed from 76% to 17% in a year. Ranking is no longer the story.",
  };
}
