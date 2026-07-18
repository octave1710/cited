/**
 * Citability factor weights, ordered by strength of evidence (2025-2026 research).
 * This file is rendered as-is in the UI and README: every weight carries its source.
 *
 * Crawlability is not weighted: it is a binary gate. If answer-engine bots cannot
 * fetch the page, nothing else matters (Shepard/Zyppy meta-analysis of 54 studies,
 * May 2026: 9.5/9.5, best-correlated factor across all studies).
 */
export interface FactorConfig {
  key: string;
  name: string;
  weight: number;
  source: string;
}

export const GATE_FACTOR = {
  key: "crawlability",
  name: "Technical accessibility / crawlability",
  source: "Shepard/Zyppy meta-analysis, 54 studies, May 2026: 9.5/9.5, binary prerequisite",
};

export const FACTORS: FactorConfig[] = [
  {
    key: "answerStructure",
    name: "Answer-first structure & self-contained passages",
    weight: 0.24,
    source: "seoClarity 2026: r=0.87 on semantic completeness of extractable passages",
  },
  {
    key: "sourcedQuotes",
    name: "Sourced quotes (named expert, institution)",
    weight: 0.2,
    source: "GEO paper (Aggarwal et al., SIGKDD 2024, arXiv 2311.09735): +41% PAWC, strongest single lever",
  },
  {
    key: "factualSpecificity",
    name: "Quantified factual specificity",
    weight: 0.18,
    source: "GEO paper (Aggarwal et al., SIGKDD 2024): +31% Position-Adjusted Word Count, causal evidence",
  },
  {
    key: "freshness",
    name: "Freshness",
    weight: 0.14,
    source: "Kevin Indig / seoClarity 2026: 2-3x citations when <3 months old; Perplexity <30 days = 3.2x",
  },
  {
    key: "offSiteAuthority",
    name: "Off-site brand authority (proxied on-page)",
    weight: 0.12,
    source: "Ahrefs 2026 factor #1; YouTube presence = most correlated signal in their study. Full signal via Profound (production mode)",
  },
  {
    key: "fanoutCoverage",
    name: "Fan-out / multi-subquery coverage",
    weight: 0.08,
    source: "Ahrefs 2026: explains 31% of citations outside Google top-100",
  },
  {
    key: "googleRank",
    name: "Classic Google rank (deliberately down-weighted)",
    weight: 0.03,
    source: "Citation/top-10 overlap collapsed 76%→38%→17% in one year, r=0.347",
  },
  {
    key: "schemaValidity",
    name: "Structured data validity (near-zero by design)",
    weight: 0.01,
    source: "Ahrefs May 2026, 1,885 pages: NULL causal effect on citations. Generated for hygiene, not weighted for score",
  },
];
