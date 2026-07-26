import type { FactorResult, ParsedPage } from "../types";

const ATTRIBUTION_RE = /[Aa]ccording to (?:the )?([A-Z][\w.]+(?: (?:of )?[A-Z][\w.]+)*)|(?:says|said|notes|explains|warns)\s+((?:Dr\.|Prof\.|Professor)? ?[A-Z][a-z]+ [A-Z][a-z]+)/g;
const INSTITUTION_RE = /\b(university|institute|journal of|study published|clinical trial|academy of|association of|\.gov|pubmed)\b/i;
const CREDENTIALS_RE = /\b(Dr\.|PhD|MD|professor|board-certified|dermatologist|researcher)\b/;

/** Quotes attributed to a named expert or institution. */
export function sourcedQuotes(page: ParsedPage): FactorResult {
  const text = page.sections.flatMap((s) => s.paragraphs).join(" ");
  const attributions = [...text.matchAll(ATTRIBUTION_RE)].map((m) => m[1] ?? m[2]);
  const quoteCount = page.blockquotes.length + attributions.length;
  const hasInstitution = INSTITUTION_RE.test(text);
  const hasCredentials = CREDENTIALS_RE.test(text);

  const base = [0, 45, 70, 85][Math.min(quoteCount, 3)] ?? 0;
  const score = Math.min(100, (quoteCount >= 4 ? 95 : base) + (hasInstitution ? 5 : 0) + (hasCredentials ? 5 : 0));

  const evidence: string[] = [];
  if (page.blockquotes.length) evidence.push(`${page.blockquotes.length} blockquote(s), e.g. "${page.blockquotes[0].slice(0, 120)}"`);
  for (const a of attributions.slice(0, 3)) evidence.push(`attributed to: ${a}`);
  if (hasInstitution) evidence.push("institutional source referenced");
  if (!evidence.length) evidence.push("no attributed quotes found anywhere on the page");

  return {
    key: "sourcedQuotes",
    name: "Sourced quotes (named expert, institution)",
    score,
    evidence,
    reasoning: "The GEO paper's strongest single lever: +41% citation share from adding sourced quotes. Answer engines need a name to attribute a claim to.",
  };
}
