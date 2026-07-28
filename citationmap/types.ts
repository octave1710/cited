/** Where a question sits in the category, once the engine has answered it. */
export type Bucket = "owned" | "lost" | "contested" | "open";

export interface MapQuestion {
  id: string;
  text: string;
  /** The decomposition bucket that produced it, e.g. "how to choose". */
  intent: string;
}

export interface QuestionResult extends MapQuestion {
  /** Bare hostnames the engine named as sources, most authoritative first. */
  domains: string[];
  bucket: Bucket;
  /** domains[0], or null when the engine named no site at all. */
  owner: string | null;
  /** 1-based position of the brand domain in `domains`; 0 when absent. */
  brandRank: number;
  replayed: boolean;
  ms: number;
}

export interface DomainStat {
  domain: string;
  /** Questions where this domain is cited first. */
  wins: number;
  /** Questions where it appears anywhere in the source list. */
  appearances: number;
  isBrand: boolean;
}

export interface MapCost {
  calls: number;
  replayed: number;
  inTokens: number;
  outTokens: number;
  usd: number;
  /** The published rate the usd figure was computed from, so the number is traceable. */
  rate: string;
}

export interface CitationMap {
  id: string;
  topic: string;
  brand: string;
  brandDomain: string;
  market: string;
  engine: string;
  createdAt: string;
  questions: QuestionResult[];
  domains: DomainStat[];
  counts: Record<Bucket, number>;
  cost: MapCost;
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  owned: "You are cited",
  lost: "Owned by one competitor",
  contested: "Split between sites",
  open: "Nobody is cited",
};
