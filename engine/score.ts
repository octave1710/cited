import type { AuditOptions, AuditResult, FactorResult, ParsedPage } from "./types";
import { FACTORS } from "./weights.config";
import { crawlability } from "./factors/crawlability";
import { answerStructure } from "./factors/answerStructure";
import { factualSpecificity } from "./factors/factualSpecificity";
import { sourcedQuotes } from "./factors/sourcedQuotes";
import { freshness } from "./factors/freshness";
import { offSiteAuthority } from "./factors/offSiteAuthority";
import { fanoutCoverage } from "./factors/fanoutCoverage";
import { googleRank } from "./factors/googleRank";
import { schemaValidity } from "./factors/schemaValidity";

export function audit(page: ParsedPage, opts: AuditOptions = {}): AuditResult {
  const gate = crawlability(page);
  const scored: FactorResult[] = [
    answerStructure(page),
    sourcedQuotes(page),
    factualSpecificity(page),
    freshness(page, opts.now ?? new Date()),
    offSiteAuthority(page),
    fanoutCoverage(page),
    googleRank(page, opts.googleRank),
    schemaValidity(page),
  ];

  const byKey = new Map(scored.map((f) => [f.key, f]));
  const weighted = FACTORS.reduce((sum, cfg) => sum + cfg.weight * (byKey.get(cfg.key)?.score ?? 0), 0);

  const gated = gate.score === 0;
  const overall = gated ? 0 : Math.round(weighted);
  const grade = overall >= 75 ? "cited" : overall >= 55 ? "likely" : overall >= 35 ? "at-risk" : "invisible";

  const weakest = FACTORS
    .map((cfg) => ({ f: byKey.get(cfg.key)!, impact: (100 - byKey.get(cfg.key)!.score) * cfg.weight }))
    .filter((x) => x.f.score < 70)
    .sort((a, b) => b.impact - a.impact)
    .map((x) => x.f);

  return { overall, grade, gated, factors: [gate, ...scored], weakest };
}
