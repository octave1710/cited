import type { LLMClient } from "../adapters/llm.js";
import { detect } from "./detect.js";
import type { LabDoc, LabQuery, LabRun, QueryVerdict } from "./types.js";

const SYSTEM = `You are an AI answer engine. Answer the user's question using ONLY the numbered sources provided.
Cite a source inline as [1], [2] or [3] immediately after each claim it supports.
Only cite a source when it directly supports the sentence; do not cite sources that merely mention the topic.
Prefer sources with specific, attributed, recent information. Keep the answer under 150 words.
If no source answers the question, say so without citations.`;

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
