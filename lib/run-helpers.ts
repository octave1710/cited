import type { Run, StepId } from "./types";

/** The raw HTML stays server-side; the client never needs it. */
export function stripHtml(run: Run): Run {
  const { html, fixedHtml, ...rest } = run;
  void html;
  void fixedHtml;
  return rest as Run;
}

export function markRunning(run: Run, step: StepId): void {
  run.steps[step] = { state: "running", startedAt: new Date().toISOString() };
}

export function markDone(run: Run, step: StepId, note?: string): void {
  run.steps[step] = {
    ...run.steps[step],
    state: "done",
    endedAt: new Date().toISOString(),
    note,
  };
}

export function markFailed(run: Run, step: StepId, error: string): void {
  run.steps[step] = {
    ...run.steps[step],
    state: "failed",
    endedAt: new Date().toISOString(),
    error,
  };
}

export function markBlocked(run: Run, step: StepId, note: string): void {
  run.steps[step] = {
    ...run.steps[step],
    state: "blocked",
    endedAt: new Date().toISOString(),
    note,
  };
}
