/** Client-safe half of the pipeline: node descriptions and types, zero node: imports. */

export type NodeId = "ground" | "brief" | "draft" | "optimise" | "localise" | "gate" | "publish";
export type NodeState = "queued" | "running" | "done" | "blocked" | "failed";

export const NODES: { id: NodeId; label: string; what: string }[] = [
  { id: "ground", label: "Ground each market", what: "Find the term that actually wins in that market, not the translation" },
  { id: "brief", label: "Write the brief", what: "Every angle cites the grounding row it came from" },
  { id: "draft", label: "Draft the page", what: "Answer-first structure, one question per section" },
  { id: "optimise", label: "Score the draft", what: "Runs the same nine factors as the audit, before anyone sees it" },
  { id: "localise", label: "Adapt per market", what: "Adaptation, not translation, with the risky lines flagged for a human" },
  { id: "gate", label: "Human approval", what: "Blocks. Nothing publishes without a named decision per market" },
  { id: "publish", label: "CMS output", what: "Markdown, metadata and hreflang, only after approval" },
];

export interface MarketPlan {
  market: string;
  term: string;
  monthlyVolume: number;
  groundingNote: string;
  runnerUp: string;
  headline: string;
  body: string[];
  score: number;
  flags: { line: string; why: string }[];
}

export interface GateDecision {
  market: string;
  approvedBy: string;
  at: string;
  note?: string;
}

export interface PipelineRun {
  id: string;
  createdAt: string;
  topic: string;
  markets: string[];
  brand: string;
  nodes: Record<NodeId, { state: NodeState; note?: string; error?: string }>;
  plans: MarketPlan[];
  brief?: { angle: string; source: string }[];
  decisions: GateDecision[];
  output?: { market: string; markdown: string; metadata: Record<string, string>; hreflang: string[] }[];
  trace: { step: NodeId; claim: string; source: string }[];
}
