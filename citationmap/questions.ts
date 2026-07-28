import type { LLMClient, LLMUsage } from "../adapters/llm";
import type { MapQuestion } from "./types";
import { marketOf } from "./markets";

/**
 * The eight ways a buyer interrogates a category. One generation call per intent,
 * so the map covers the whole funnel instead of eighteen rewordings of "is it worth it".
 */
export const INTENTS = [
  { id: "definition", label: "what it is", brief: "what the thing is, what it does, how it works" },
  { id: "evidence", label: "does it work", brief: "whether it works, what the studies say, how strong the evidence is" },
  { id: "choose", label: "how to choose", brief: "how to pick one, what to look for, what to avoid on a label" },
  { id: "compare", label: "versus", brief: "head-to-head comparisons against the obvious alternatives" },
  { id: "safety", label: "safety", brief: "side effects, interactions, who should not use it" },
  { id: "usage", label: "how to use", brief: "how to use it, when, how often, in what order" },
  { id: "results", label: "results", brief: "how long results take, what to realistically expect" },
  { id: "value", label: "price and value", brief: "price, whether it is worth it, cheap versus expensive" },
] as const;

const system = (language: string) =>
  "You generate the sub-questions a consumer AI assistant decomposes a shopping topic into. " +
  "Real questions in the wording a person types, sentence case, no numbering, no brand names " +
  `unless the topic names one. Write every question in ${language}, because that is the language ` +
  "buyers in this market actually type. Translate the topic into that language if it arrives in " +
  'another one. Reply with JSON: {"questions": ["...", ...]}.';

/** Strips code fences, then parses. Model output is JSON-moded but fences still slip through. */
export function parseQuestions(raw: string): string[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Question generator returned unparseable JSON: ${cleaned.slice(0, 120)}`);
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(list)) throw new Error("Question generator returned no questions array");
  return list.filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim());
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Generates the question set, one call per intent, deduplicated across intents.
 * `perIntent` × 8 is the headline count; 20 gives the 140-160 the map is sized for.
 */
export async function generateQuestions(
  llm: LLMClient,
  topic: string,
  market: string,
  perIntent = 20,
  onUsage?: (u: LLMUsage | undefined, replayed: boolean) => void,
): Promise<MapQuestion[]> {
  const batches = await Promise.all(
    INTENTS.map(async (intent) => {
      const m = marketOf(market);
      const res = await llm.call(
        system(m.language),
        `Topic: ${topic}\nMarket: ${m.label}\nLanguage: ${m.language}\nAngle: ${intent.brief}\n` +
          `Write exactly ${perIntent} distinct questions on that angle, in ${m.language}.`,
      );
      onUsage?.(res.usage, res.replayed);
      return { intent, texts: parseQuestions(res.text) };
    }),
  );

  const seen = new Set<string>();
  const out: MapQuestion[] = [];
  for (const { intent, texts } of batches) {
    for (const text of texts) {
      const key = norm(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `q${String(out.length + 1).padStart(3, "0")}`, text, intent: intent.label });
    }
  }
  if (out.length < 40) {
    throw new Error(`Only ${out.length} usable questions came back. A map needs at least 40 to mean anything.`);
  }
  return out;
}
