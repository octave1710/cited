import type { AuditOptions, AuditResult, FactorResult, ParsedPage } from "./types.js";
import { FACTORS } from "./weights.config.js";
import { crawlability } from "./factors/crawlability.js";
import { answerStructure } from "./factors/answerStructure.js";
import { factualSpecificity } from "./factors/factualSpecificity.js";
import { sourcedQuotes } from "./factors/sourcedQuotes.js";
import { freshness } from "./factors/freshness.js";
import { offSiteAuthority } from "./factors/offSiteAuthority.js";
import { fanoutCoverage } from "./factors/fanoutCoverage.js";
import { googleRank } from "./factors/googleRank.js";
import { schemaValidity } from "./factors/schemaValidity.js";

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
