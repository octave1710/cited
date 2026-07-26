import type { Run, StepId, StepState } from "./types";

export interface CheckEvent {
  type: "check";
  group: string;
  name: string;
  what: string;
  ms: number;
}

export interface FactorEvent {
  type: "factor";
  key: string;
  name: string;
  score: number;
  weight: number | null;
  gate: boolean;
  partial: boolean;
  inspected: string;
  evidence: string[];
  reasoning: string;
  source: string;
  ms: number;
}

export interface StepEvent {
  type: "step";
  id: StepId;
  state: StepState;
  note?: string;
  error?: string;
}

export interface SummaryEvent {
  type: "summary";
  overall: number;
  grade: string;
  gated: boolean;
  zeros: number;
  lostWeight: number;
  totalMs: number;
  checks: number;
}

export type StreamEvent =
  | { type: "run"; id: string; brand: string; market: string }
  | CheckEvent
  | FactorEvent
  | StepEvent
  | SummaryEvent
  | { type: "done"; run: Run }
  | { type: "error"; error: string };

export type TraceEvent = CheckEvent | FactorEvent;

/** Reads an NDJSON response body and yields each event as it lands. */
export async function* readStream(res: Response): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("The server returned no stream.");
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        yield JSON.parse(t) as StreamEvent;
      } catch {
        // a partial line can never happen here (split on \n), so this is a real protocol error
        throw new Error("The server sent a malformed event.");
      }
    }
  }
}
