import type { LLMClient } from "../adapters/llm.js";
import { detect } from "./detect.js";
import type { LabDoc, LabQuery, LabRun, QueryVerdict } from "./types.js";

// Citation slots are scarce on real answer engines (1-3 citations picked from
// dozens of candidate pages). With only 3 docs in context the engine must be
// forced to be selective, or it citess everything and measures nothing.
const SYSTEM = `You are an AI answer engine. Sources compete to be cited and citation slots are scarce.
Answer the user's question using ONLY the numbered sources provided.
Cite AT MOST 2 sources, inline as [n]. Pick only the sources with the most specific, attributed, recent information for THIS question.
Never cite a source that is vague, undated, or redundant with a better source. If two sources support the same claim, cite only the stronger one.
Keep the answer under 120 words. If no source answers the question, say so without citations.`;

function userPrompt(docs: LabDoc[], query: string): string {
  const sources = docs.map((d, i) => `[${i + 1}] ${d.title}\n${d.excerpt}`).join("\n\n");
  return `Sources:\n\n${sources}\n\nQuestion: ${query}`;
}

/**
 * Runs each query against the engine with the target page and competitors in
 * context. Doc order rotates per query so the target does not always sit at [1]
 * (position bias would flatter or bury it consistently).
 */
export async function runLab(target: LabDoc, competitors: LabDoc[], queries: LabQuery[], llm: LLMClient): Promise<LabRun> {
  const all = [target, ...competitors];
  const verdicts: QueryVerdict[] = [];

  for (const [i, query] of queries.entries()) {
    const rotated = all.map((_, j) => all[(j + i) % all.length]);
    const answer = await llm.answer(SYSTEM, userPrompt(rotated, query.text));
    const d = detect(answer, rotated, target.id);
    verdicts.push({ query, status: d.status, citedDocs: d.citedDocs, matchedMarkers: d.matchedMarkers, answer });
  }

  return {
    targetId: target.id,
    competitors: competitors.map((c) => c.id),
    llm: llm.label,
    verdicts,
    citedCount: verdicts.filter((v) => v.status === "cited").length,
    total: verdicts.length,
  };
}
