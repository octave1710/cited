import type { FactorResult, ParsedPage } from "../types.js";

const FACT_RE = /\d+(?:[.,]\d+)?\s?(?:%|percent|mg|ml|µg|iu|spf|nm|weeks?|days?|months?|years?|hours?|minutes?|participants?|subjects?|studies|x\b)|[$€£]\s?\d+|\b\d+(?:[.,]\d+)?\b/gi;

/** Density of quantified facts (numbers, units, stats) in body copy. */
export function factualSpecificity(page: ParsedPage): FactorResult {
  const paras = page.sections.flatMap((s) => s.paragraphs);
  const text = paras.join(" ");
  const words = text ? text.split(/\s+/).length : 0;
  const matches = text.match(FACT_RE) ?? [];
  const per100 = words ? (matches.length / words) * 100 : 0;

  // ponytail: linear ramp, 2.5 quantified facts per 100 words = full marks
  const score = Math.round(Math.min(100, (per100 / 2.5) * 100));

  const samples = paras
    .filter((p) => FACT_RE.test(p))
    .slice(0, 3)
    .map((p) => `"${p.length > 140 ? p.slice(0, 140) + "..." : p}"`);

  return {
    key: "factualSpecificity",
    name: "Quantified factual specificity",
    score,
    evidence: [`${matches.length} quantified facts in ${words} words (${per100.toFixed(1)} per 100 words)`, ...samples],
    reasoning: "The GEO paper measured a causal +31% citation share from adding statistics. Vague claims get paraphrased; numbers get cited.",
  };
}
