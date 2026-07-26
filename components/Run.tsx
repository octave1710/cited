"use client";

import { STEP_LABEL, STEP_ORDER, type Run, type StepId } from "../lib/types";

const STATE_WORD: Record<string, string> = {
  queued: "queued",
  running: "running",
  done: "done",
  blocked: "blocked",
  failed: "failed",
};

export function RunRail({
  run,
  active,
  onSelect,
}: {
  run: Run | null;
  active: StepId;
  onSelect: (s: StepId) => void;
}) {
  return (
    <aside
      style={{
        borderRight: "1px solid var(--rule)",
        padding: "26px 0 40px",
        minHeight: "100%",
        background: "var(--void)",
      }}
    >
      <div className="m-sm meta" style={{ padding: "0 22px 16px" }}>
        RUN STEPS
      </div>

      {STEP_ORDER.map((id) => {
        const step = run?.steps[id];
        const state = step?.state ?? "queued";
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "13px 22px",
              background: isActive ? "rgba(236,235,231,.05)" : "transparent",
              borderLeft: isActive ? "2px solid var(--red)" : "2px solid transparent",
              borderTop: "1px solid var(--rule-soft)",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className={`dot dot--${state}`} />
              <span
                style={{
                  fontFamily: "var(--body)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--ink)", // the dot carries the state; labels stay readable
                }}
              >
                {STEP_LABEL[id]}
              </span>
            </span>
            {step?.note && (
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--body)",
                  fontSize: 13,
                  color: "var(--ink)",
                  paddingLeft: 20,
                  paddingTop: 5,
                  lineHeight: 1.35,
                }}
              >
                {step.note}
              </span>
            )}
            {step?.error && (
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--red)",
                  paddingLeft: 20,
                  paddingTop: 5,
                  lineHeight: 1.5,
                }}
              >
                {step.error}
              </span>
            )}
            {!step?.note && !step?.error && (
              <span className="m-sm meta" style={{ display: "block", paddingLeft: 20, paddingTop: 5 }}>
                {STATE_WORD[state]}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
