import type { FactorResult, ParsedPage } from "../types";

const CITABLE_TYPES = ["Article", "NewsArticle", "BlogPosting", "FAQPage", "HowTo", "Product"];

/**
 * Scored for hygiene, weighted at 1% on purpose: Ahrefs (May 2026, 1,885 pages)
 * measured a NULL causal effect of schema.org on citations. We still generate
 * valid JSON-LD (the brief asks for it, and it costs nothing) — we just refuse
 * to pretend it moves citations.
 */
export function schemaValidity(page: ParsedPage): FactorResult {
  const evidence: string[] = [];
  let score = 0;

  if (page.jsonLdErrors.length) evidence.push(...page.jsonLdErrors);

  if (page.jsonLd.length) {
    score += 40;
    const types = page.jsonLd.map((b) => String(b["@type"] ?? "?"));
    evidence.push(`JSON-LD blocks: ${types.join(", ")}`);

    const citable = page.jsonLd.find((b) => CITABLE_TYPES.includes(String(b["@type"])));
    if (citable) {
      score += 30;
      const type = String(citable["@type"]);
      const missing: string[] = [];
      if (/Article|Posting/.test(type)) {
        for (const k of ["headline", "author", "datePublished"]) if (!citable[k]) missing.push(k);
      } else if (type === "FAQPage") {
        if (!Array.isArray(citable["mainEntity"]) || !(citable["mainEntity"] as unknown[]).length) missing.push("mainEntity");
      } else if (type === "HowTo") {
        if (!citable["step"]) missing.push("step");
      }
      if (missing.length) evidence.push(`${type} missing required fields: ${missing.join(", ")}`);
      else {
        score += 30;
        evidence.push(`${type} has all required fields`);
      }
    }
  } else {
    evidence.push("no JSON-LD structured data");
  }

  return {
    key: "schemaValidity",
    name: "Structured data validity (near-zero by design)",
    score: Math.min(100, score),
    evidence,
    reasoning: "Weighted at 1% deliberately: Ahrefs measured zero causal effect on citations. Generated for hygiene, not for score.",
  };
}
