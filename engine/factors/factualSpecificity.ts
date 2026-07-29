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
  if (jammed > 2) return false;
  return !isBoilerplate(p);
}

/**
 * Promotional and legal small print, which the menu test cannot see.
 *
 * The comment above says a product page scored 100 on its sweepstake terms. Only half of
 * that was fixed: a menu has no full stop and jams its words, so it was caught, while
 * legal copy is well-punctuated ordinary English and sailed through. So theordinary.com
 * took a perfect 100 on "quantified factual specificity" with these as its evidence:
 *
 *   "Customers who purchase one (1) unit of The Ordinary Glycolic Acid 7% (100ml)..."
 *   "Limit of one (1) Gift per order and two (2) Gifts per customer..."
 *
 * while the Cleveland Clinic page scored 29 quoting "73% of participants saw an
 * improvement" and "a 14-person study". The page the engines actually lean on lost to
 * the page they ignore, on the strength of its own promo terms, and the composite score
 * flipped with it. A factor that confidently rewards the wrong text is worse than one
 * that is missing.
 *
 * The signals are structural rather than a vocabulary list, because a list is whack-a-mole:
 * the first pass caught "limit of one (1) Gift per order" and the same page simply scored
 * its next clause instead. Contract drafting has three habits article prose does not have.
 */

/** "one (1) unit": a number written out and then repeated in brackets. */
const LEGAL_NUMERAL = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*\(\s*\d+\s*\)/i;

/** '(the "Consultation Promotion")': a term defined mid-sentence so it can be referenced. */
const DEFINED_TERM = /\((?:the\s+)?["“”][^"“”]{3,60}["“”]\)/;

/** "(i) book a Consultation; (ii) attend": inline roman enumeration of conditions. */
const ROMAN_CLAUSES = /\(\s*i+v?\s*\)[\s\S]{0,300}?\(\s*i{1,3}v?i*\s*\)/i;

/** What is left after the structural tests: the stable words of offer and policy copy. */
const OFFER_TERMS =
  /\b(no purchase necessary|void where prohibited|terms (and|&) conditions|subject to (stock|availability|change|the terms)|while supplies last|limit(ed)? (of|to) one|per customer|per order|per household|sweepstakes?|giveaway|eligible (entrants|customers|participants)|offer (is )?valid|cannot be combined|promo(tional)? code|free shipping on|all rights reserved|privacy policy|cookie (policy|preferences)|returns? policy|excludes? taxes|at participating)\b/i;

export function isBoilerplate(p: string): boolean {
  return LEGAL_NUMERAL.test(p) || DEFINED_TERM.test(p) || ROMAN_CLAUSES.test(p) || OFFER_TERMS.test(p);
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
      ...(dropped > 0 ? [`${dropped} block(s) skipped as navigation, offer terms or boilerplate rather than article text`] : []),
      ...samples,
    ],
    reasoning: "The GEO paper measured a causal +31% citation share from adding statistics. Vague claims get paraphrased; numbers get cited.",
  };
}
