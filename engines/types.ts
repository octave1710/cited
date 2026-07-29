/**
 * The five answer engines this tool reads, and the one shape their answers are
 * normalised into.
 *
 * The version before this asked gpt-4o-mini which sites it WOULD cite. That is a model
 * describing its own imagined behaviour, it named exactly one site per question, and it
 * was not checkable against anything. Real answers cite several sources and the sources
 * differ per engine, which is the entire finding.
 */

export const ENGINES = [
  { key: "aiOverview", label: "Google AI Overview", short: "AI Overview" },
  { key: "aiMode", label: "Google AI Mode", short: "AI Mode" },
  { key: "perplexity", label: "Perplexity", short: "Perplexity" },
  { key: "chatgpt", label: "ChatGPT search", short: "ChatGPT" },
  { key: "gemini", label: "Gemini", short: "Gemini" },
  /**
   * Called at the source rather than through the Apify actor, which has no Claude
   * add-on: the Anthropic Messages API with the web_search tool returns the pages the
   * answer was built from, so this is a first-party read rather than a scrape.
   */
  { key: "claude", label: "Claude", short: "Claude" },
] as const;

export type EngineKey = (typeof ENGINES)[number]["key"];

export interface Citation {
  url: string;
  domain: string;
  title: string;
  /** 1-based position in that engine's own source list. 1 means cited first. */
  rank: number;
}

export interface EngineAnswer {
  engine: EngineKey;
  /** The prose the engine produced. Empty when the engine returned no answer. */
  text: string;
  citations: Citation[];
  /** Set when this engine produced nothing for this question, with the reason. */
  empty?: string;
}

export interface QuestionResult {
  question: string;
  answers: EngineAnswer[];
  /** Sub-queries ChatGPT actually ran, when it exposes them. */
  fanOut: string[];
  /** Ordinary Google results for the same question, for the classic-rank comparison. */
  organic: { url: string; domain: string; title: string; rank: number }[];
}

export interface PanelRun {
  topic: string;
  market: string;
  brandDomain?: string;
  questions: QuestionResult[];
  source: "live" | "recorded";
  costUsd: number | null;
  ranAt: string;
  /** Engines that returned nothing across the whole panel, so the UI can say so. */
  silentEngines: EngineKey[];
}
