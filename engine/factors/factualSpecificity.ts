import type { FactorResult, ParsedPage } from "../types";

const FACT_RE = /\d+(?:[.,]\d+)?\s?(?:%|percent|mg|ml|µg|iu|spf|nm|weeks?|days?|months?|years?|hours?|minutes?|participants?|subjects?|studies|x\b)|[$€£]\s?\d+|\b\d+(?:[.,]\d+)?\b/gi;

/**
 * Is this paragraph prose a person wrote, or navigation the parser swept up?
 *
 * healthline.com scored 99 out of 100 on this factor and the evidence quoted was its
 * mega-menu: "Health ConditionsHealth ConditionsAllBreast CancerCancer Care...". A
 * product page scored 100 on its sweepstake terms. Both scores were real arithmetic on
 * text that is not the article, which makes the number worse than useless: it is
 * confidently wrong.
 *
 * Two signals separate the two, and both are cheap:
 *   prose ends sentences. A menu has no full stop in sight.
 *   a menu is words jammed together, so it carries runs like "ConditionsAll" where a
 *   lower-case letter is immediately followed by an upper-case one.
 */
export function isProse(p: string): boolean {
  // no length floor: "Use 2 drops." is twelve characters and is a real instruction with a
  // real figure in it. Length was never the signal, punctuation and jamming are.
  if (!/[.!?]/.test(p)) return false;
  const jammed = (p.match(/[a-z][A-Z]/g) ?? []).length;
  // one or two are normal (iPhone, McDonald's); a run of them is a collapsed menu
  return jammed <= 2;
}

/** Density of quantified facts (numbers, units, stats) in body copy. */
export function factualSpecificity(page: ParsedPage): FactorResult {
  const all = page.sections.flatMap((s) => s.paragraphs);
  const paras = all.filter(isProse);
  const dropped = all.length - paras.length;
  const text = paras.join(" ");
  const words = text ? text.split(/\s+/).length : 0;
  const matches = text.match(FACT_RE) ?? [];
  const per100 = words ? (matches.length / words) * 100 : 0;

  // ponytail: linear ramp, 2.5 quantified facts per 100 words = full marks
  const score = Math.round(Math.min(100, (per100 / 2.5) * 100));

  // .test() on a /g/ regex is stateful: lastIndex survives between calls, so a filter
  // silently skipped short paragraphs that did contain a figure. .match() resets it.
  const samples = paras
    .filter((p) => p.match(FACT_RE) !== null)
    .slice(0, 3)
    .map((p) => `"${p.length > 140 ? p.slice(0, 140) + "..." : p}"`);

  return {
    key: "factualSpecificity",
    name: "Quantified factual specificity",
    score,
    evidence: [
      `${matches.length} quantified facts in ${words} words of prose (${per100.toFixed(1)} per 100 words)`,
      ...(dropped > 0 ? [`${dropped} block(s) skipped as navigation or boilerplate rather than article text`] : []),
      ...samples,
    ],
    reasoning: "The GEO paper measured a causal +31% citation share from adding statistics. Vague claims get paraphrased; numbers get cited.",
  };
}
