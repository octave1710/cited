import type { ParsedPage } from "../engine/types";
import type { CitationStatus, LabDoc } from "./types";

const MARKER_RE = /\d+(?:[.,]\d+)?\s?(?:%|mg|ml|spf|weeks?|days?|months?|years?|x\b)|(?:Dr\.|Professor|Prof\.)\s+[A-Z][a-z]+ [A-Z][a-z]+/g;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Build an engine-ready source doc from a parsed page. */
export function toLabDoc(id: string, page: ParsedPage, maxChars = 1800): LabDoc {
  const body = page.sections
    .map((s) => (s.heading ? s.heading.text + "\n" : "") + s.paragraphs.join("\n"))
    .join("\n\n");
  const text = [page.title, page.metaDescription, body, page.blockquotes.join("\n")].filter(Boolean).join("\n\n");
  return {
    id,
    title: page.title || id,
    excerpt: text.slice(0, maxChars),
    markers: [...new Set((text.match(MARKER_RE) ?? []).map(norm))],
  };
}

/**
 * GhostWriter pattern: the engine is instructed to cite sources as [n].
 * cited = the target's [n] appears in the answer.
 * paraphrased = not cited, but ≥2 of the target's distinctive markers (figures,
 * named experts) surface in the answer text.
 * absent = neither.
 */
export function detect(answer: string, docs: LabDoc[], targetId: string): { status: CitationStatus; citedDocs: string[]; matchedMarkers: string[] } {
  const citedNumbers = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))];
  const citedDocs = citedNumbers.filter((n) => n >= 1 && n <= docs.length).map((n) => docs[n - 1].id);

  const target = docs.find((d) => d.id === targetId);
  const answerNorm = norm(answer);
  const matchedMarkers = (target?.markers ?? []).filter((m) => answerNorm.includes(m));

  const status: CitationStatus = citedDocs.includes(targetId) ? "cited" : matchedMarkers.length >= 2 ? "paraphrased" : "absent";
  return { status, citedDocs, matchedMarkers };
}
