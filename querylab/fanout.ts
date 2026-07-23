import type { LabQuery } from "./types.js";

/**
 * Deterministic query fan-out from a topic: the strategic sub-queries an answer
 * engine decomposes the topic into. Production mode swaps this for real observed
 * fan-outs (Profound query-fanouts report); user-supplied queries always win.
 */
export function fanout(topic: string): LabQuery[] {
  const t = topic.trim().toLowerCase();
  return [
    `what is ${t} and does it actually work`,
    `how long does ${t} take to show results`,
    `how do I choose a ${t}`,
    `${t} benefits backed by studies`,
    `is ${t} worth it`,
  ].map((text, i) => ({ id: `fanout-${i + 1}`, text, source: "fanout" as const }));
}

export function userQueries(texts: string[]): LabQuery[] {
  return texts.map((text, i) => ({ id: `user-${i + 1}`, text: text.trim(), source: "user" as const }));
}
