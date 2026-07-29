import type { LLMClient } from "../adapters/llm";
import { detect } from "./detect";
import type { LabDoc, LabQuery, LabRun, QueryVerdict } from "./types";

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
  let live = 0;
  let replayed = 0;

  for (const [i, query] of queries.entries()) {
    const rotated = all.map((_, j) => all[(j + i) % all.length]);
    // .call rather than .answer: the verdict has to record whether the network was used
    const res = await llm.call(SYSTEM, userPrompt(rotated, query.text));
    if (res.replayed) replayed++;
    else live++;
    const d = detect(res.text, rotated, target.id);
    verdicts.push({ query, status: d.status, citedDocs: d.citedDocs, matchedMarkers: d.matchedMarkers, answer: res.text });
  }

  return {
    targetId: target.id,
    competitors: competitors.map((c) => c.id),
    llm: llm.label,
    live,
    replayed,
    verdicts,
    citedCount: verdicts.filter((v) => v.status === "cited").length,
    total: verdicts.length,
  };
}

/** "5 answers off the network" or "5 replayed from the recording", never a bare label. */
export function provenance(run: { live: number; replayed: number; llm: string }): string {
  const model = run.llm.replace(/\s*\(recording\)\s*/i, "");
  if (run.live && run.replayed) return `${run.live} answered live, ${run.replayed} replayed from the recording · ${model}`;
  if (run.live) return `${run.live} answers off the network · ${model}`;
  return `${run.replayed} replayed from the recording, nothing billed · ${model}`;
}
