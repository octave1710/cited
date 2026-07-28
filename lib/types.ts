import type { AuditResult, Fix } from "../engine/index";
import type { SuppliedFacts } from "../engine/apply";
import type { LabRun } from "../querylab/types";
import type { AccessReport } from "../engine/crawlerAccess";

export type StepId = "ingest" | "score" | "fixes" | "schema" | "querylab" | "retest" | "truth";
export type StepState = "queued" | "running" | "done" | "blocked" | "failed";

export interface Step {
  state: StepState;
  startedAt?: string;
  endedAt?: string;
  /** Human-readable one-liner shown next to the step. */
  note?: string;
  error?: string;
}

export interface IngestSummary {
  finalUrl: string;
  status: number;
  bytes: number;
  fetchedAt: string;
  source: "live" | "demo";
  /** "browser" means the site refused our self-identifying crawler and was rendered instead. */
  route?: "crawler" | "browser";
  title: string;
  words: number;
  sections: number;
  jsonLdTypes: string[];
  author?: string;
  published?: string;
  modified?: string;
}

export interface SchemaOutput {
  blocks: unknown[];
  warnings: string[];
}

export interface Run {
  id: string;
  createdAt: string;
  url: string;
  brand: string;
  market: string;
  demoId?: string;
  steps: Record<StepId, Step>;
  ingest?: IngestSummary;
  audit?: AuditResult;
  fixes?: Fix[];
  schema?: SchemaOutput;
  lab?: LabRun;
  retest?: LabRun;
  truth?: ProductionTruth;
  /** Raw HTML kept server-side so the re-test can apply the fixes to it. */
  html?: string;
  fixedHtml?: string;
  /** Facts the client supplied through the fact sheet. Never generated. */
  supplied?: SuppliedFacts;
  /** What the re-test actually changed, and what it refused to change. */
  applied?: { title: string; how: string }[];
  skipped?: { title: string; why: string }[];
  scoreAfter?: number;
  access?: AccessReport;
}

export interface BotRow {
  bot: string;
  operator: string;
  hits30d: number;
  lastSeen: string;
  thisPath: number;
}

export interface ProductionTruth {
  mode: "live" | "fixtures";
  /** Set when live was attempted and failed, so the UI can say so honestly. */
  degradedReason?: string;
  visibilityScore: number;
  shareOfVoice: { market: string; pct: number }[];
  bots: BotRow[];
}

export const STEP_ORDER: StepId[] = ["ingest", "score", "fixes", "schema", "querylab", "retest", "truth"];

export const STEP_LABEL: Record<StepId, string> = {
  ingest: "Fetch and parse the page",
  score: "Score the nine factors",
  fixes: "Write the fix plan",
  schema: "Generate structured data",
  querylab: "Test citations on a live engine",
  retest: "Apply fixes and re-test",
  truth: "Production truth from Profound",
};

export function blankSteps(): Record<StepId, Step> {
  return STEP_ORDER.reduce((acc, id) => {
    acc[id] = { state: "queued" };
    return acc;
  }, {} as Record<StepId, Step>);
}
