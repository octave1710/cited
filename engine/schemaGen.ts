import type { Article, FAQPage, HowTo, WithContext } from "schema-dts";
import type { ParsedPage } from "./types";
import { QUESTION_RE } from "./factors/answerStructure";

export interface SchemaGenResult {
  blocks: WithContext<Article | FAQPage | HowTo>[];
  warnings: string[];
}

/** Trim to whole sentences, max ~300 chars, so FAQ answers never cut mid-sentence. */
function answerText(paragraph: string): string {
  const parts = paragraph.split(/(?<=[.!?])\s+/);
  let out = "";
  for (const p of parts) {
    if (out && (out + " " + p).length > 300) break;
    out = out ? out + " " + p : p;
  }
  return out;
}

/**
 * Everything is extracted from the page itself: no invented authors, dates or answers.
 * schema-dts types make invalid shapes a compile error; runtime validity is asserted
 * in tests by round-tripping the output through the schemaValidity factor.
 */
export function generateSchemas(page: ParsedPage, opts: { now?: Date } = {}): SchemaGenResult {
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const warnings: string[] = [];
  const blocks: SchemaGenResult["blocks"] = [];

  const headline = (page.headings.find((h) => h.level === 1)?.text ?? page.title).slice(0, 110);
  const article: WithContext<Article> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    datePublished: page.publishedDate ?? today,
    dateModified: today,
    ...(page.metaDescription ? { description: page.metaDescription } : {}),
    ...(page.author ? { author: { "@type": "Person", name: page.author } } : {}),
  };
  if (!page.author) warnings.push("Article.author omitted: no named author on the page. Add one (it also feeds the authority factor).");
  if (!page.publishedDate) warnings.push(`datePublished not found on page, set to today (${today}). Correct it if the page is older.`);
  blocks.push(article);

  const qaSections = page.sections.filter(
    (s) => s.heading && (s.heading.level === 2 || s.heading.level === 3) && QUESTION_RE.test(s.heading.text) && s.paragraphs.length > 0,
  );
  if (qaSections.length >= 2) {
    const faq: WithContext<FAQPage> = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qaSections.map((s) => ({
        "@type": "Question" as const,
        name: s.heading!.text,
        acceptedAnswer: { "@type": "Answer" as const, text: answerText(s.paragraphs[0]) },
      })),
    };
    blocks.push(faq);
  } else {
    warnings.push("FAQPage skipped: fewer than 2 question-phrased sections. The answer-structure fixes create them first.");
  }

  const steps = page.orderedLists.find((l) => l.length >= 3);
  if (steps) {
    const howHeading = page.headings.find((h) => /^how to/i.test(h.text));
    const howTo: WithContext<HowTo> = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: howHeading?.text ?? headline,
      step: steps.map((s, i) => ({ "@type": "HowToStep" as const, position: i + 1, text: s })),
    };
    blocks.push(howTo);
  }

  return { blocks, warnings };
}
