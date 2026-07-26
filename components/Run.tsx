"use client";

import { STEP_LABEL, STEP_ORDER, type Run, type StepId } from "../lib/types";

export function RunRail({
  run,
  active,
  onSelect,
  live,
}: {
  run: Run | null;
  active: StepId;
  onSelect: (s: StepId) => void;
  live?: boolean;
}) {
  return (
    <aside
      style={{
        borderRight: "1px solid var(--rule)",
        paddingTop: 34,
        paddingBottom: 60,
        position: "sticky",
        top: "var(--bar-h)",
        alignSelf: "start",
        maxHeight: "calc(100vh - var(--bar-h))",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "0 30px 20px",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--ink)",
        }}
      >
        Run steps {live && <span style={{ color: "var(--amber)" }}>· working</span>}
      </div>

      {STEP_ORDER.map((id) => {
        const step = run?.steps[id];
        const state = step?.state ?? "queued";
        const isActive = active === id;
        const reached = state !== "queued";
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "18px 30px 19px",
              background: isActive ? "rgba(236,235,231,.05)" : "transparent",
              borderLeft: isActive ? "2px solid var(--red)" : "2px solid transparent",
              borderTop: "1px solid var(--rule-soft)",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i className={`dot dot--${state}`} />
              <span style={{ fontFamily: "var(--body)", fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>
                {STEP_LABEL[id]}
              </span>
            </span>

            <span
              style={{
                display: "block",
                paddingLeft: 24,
                paddingTop: 7,
                fontFamily: reached ? "var(--body)" : "var(--mono)",
                fontSize: reached ? 13.5 : 11,
                letterSpacing: reached ? 0 : 1.2,
                textTransform: reached ? "none" : "uppercase",
                lineHeight: 1.4,
                color: state === "failed" ? "var(--red)" : "var(--ink)",
              }}
            >
              {step?.error ?? step?.note ?? (state === "queued" ? "not started" : state)}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
