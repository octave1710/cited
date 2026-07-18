export interface Heading {
  level: number;
  text: string;
}

/** A heading and the paragraphs that sit under it, in document order. */
export interface Section {
  heading: Heading | null;
  paragraphs: string[];
}

export interface ParsedPage {
  url?: string;
  title: string;
  metaDescription: string;
  robotsMeta: string;
  lang: string;
  headings: Heading[];
  sections: Section[];
  wordCount: number;
  textToHtmlRatio: number;
  jsonLd: Record<string, unknown>[];
  jsonLdErrors: string[];
  publishedDate?: string;
  modifiedDate?: string;
  author?: string;
  blockquotes: string[];
  outboundLinks: { href: string; text: string }[];
  sameAsLinks: string[];
  /** Items of each <ol> on the page (HowTo detection). */
  orderedLists: string[][];
}

export interface FactorResult {
  key: string;
  name: string;
  /** 0-100 */
  score: number;
  /** Real extracts from the page backing the score. */
  evidence: string[];
  reasoning: string;
  /** True when the full signal needs external data (Profound, SERP) — scored on on-page proxies only. */
  partial?: boolean;
}

export interface AuditOptions {
  /** Reference date for freshness scoring. Defaults to now. Injectable for tests. */
  now?: Date;
  /** Current Google rank for the target query, if known. */
  googleRank?: number;
}

export interface AuditResult {
  overall: number;
  grade: "cited" | "likely" | "at-risk" | "invisible";
  gated: boolean;
  factors: FactorResult[];
  /** Factors sorted weakest-first, weighted: the input of the fixes engine. */
  weakest: FactorResult[];
}
