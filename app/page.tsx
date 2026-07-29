"use client";

import { useCallback, useState } from "react";
import { InputBar, TopBar } from "../components/Chrome";
import { useKept } from "../lib/keep";
import { RunRail } from "../components/Run";
import { AuditPanel } from "../components/Audit";
import { FixesPanel } from "../components/Fixes";
import { LabPanel } from "../components/Lab";
import { TruthPanel } from "../components/Truth";
import { AccessPanel } from "../components/Access";
import { readStream, type AccessEvent, type FactorEvent, type PatchEvent, type SummaryEvent, type TraceEvent } from "../lib/stream";
import type { Run, StepId } from "../lib/types";

export default function Page() {
  const [run, setRun] = useKept<Run | null>("cited.audit.run", null);
  const [trace, setTrace] = useKept<TraceEvent[]>("cited.audit.trace", []);
  const [factors, setFactors] = useKept<FactorEvent[]>("cited.audit.factors", []);
  const [summary, setSummary] = useKept<SummaryEvent | null>("cited.audit.summary", null);
  const [access, setAccess] = useState<AccessEvent[]>([]);
  const [patch, setPatch] = useState<PatchEvent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<StepId>("score");
  const [target, setTarget] = useState<{ url: string; mode: "live" | "demo" }>({ url: "", mode: "live" });

  const start = useCallback(async (input: { url?: string; demoId?: string; html?: string; sourceUrl?: string; brand: string; market: string }) => {
    setBusy("run");
    setError(null);
    setRun(null);
    setTrace([]);
    setFactors([]);
    setSummary(null);
    setAccess([]);
    setPatch(null);
    setActive("score");
    setTarget({ url: input.html ? input.sourceUrl?.trim() || "pasted HTML" : input.url || "", mode: input.demoId ? "demo" : "live" });

    try {
      const res = await fetch("/api/runs/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status}).`);
      }

      // a partial run must still be visible, so state is applied per event
      const steps: Partial<Record<StepId, { state: never; note?: string; error?: string }>> = {};
      for await (const ev of readStream(res)) {
        if (ev.type === "run") setTarget((t) => ({ ...t, url: t.url || "" }));
        if (ev.type === "check" || ev.type === "factor") setTrace((prev) => [...prev, ev]);
        if (ev.type === "factor") setFactors((prev) => [...prev, ev]);
        if (ev.type === "summary") setSummary(ev);
        if (ev.type === "access") setAccess((prev) => [...prev, ev]);
        if (ev.type === "patch") setPatch(ev);
        if (ev.type === "step") {
          setRun((prev) =>
            prev
              ? { ...prev, steps: { ...prev.steps, [ev.id]: { state: ev.state, note: ev.note, error: ev.error } } }
              : prev,
          );
          steps[ev.id] = { state: ev.state as never, note: ev.note, error: ev.error };
        }
        if (ev.type === "done") {
          setRun(ev.run);
          setTarget({ url: ev.run.url, mode: ev.run.demoId ? "demo" : "live" });
        }
        if (ev.type === "error") throw new Error(ev.error);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  const step = useCallback(
    async (name: "fixes" | "schema" | "querylab" | "retest" | "truth") => {
      if (!run) return;
      setBusy(name);
      setError(null);
      try {
        const res = await fetch(`/api/runs/${run.id}/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
        setRun(data.run);
        setActive(name === "retest" ? "retest" : name);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [run],
  );

  const showFixes = active === "fixes" && run?.fixes;
  const showLab = run && (active === "querylab" || active === "retest");
  const showTruth = run && active === "truth";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar runId={run?.id} />
      <InputBar onRun={start} busy={busy === "run"} />

      {error && (
        <div
          className="gut"
          style={{
            background: "rgba(255,59,59,.08)",
            borderBottom: "1px solid var(--red)",
            paddingTop: 16,
            paddingBottom: 16,
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span className="m" style={{ color: "var(--red)" }}>
            FAILED
          </span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{error}</span>
          <button className="btn btn--sm btn--ghost" style={{ marginLeft: "auto" }} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "var(--rail) minmax(0,1fr)", flex: 1, minHeight: 0 }}>
        <RunRail run={run} active={active} onSelect={setActive} live={busy === "run"} />

        <main className="gut" style={{ minWidth: 0, maxWidth: 1500 }}>
          {!run && !trace.length && <Empty />}
          {showTruth && <TruthPanel run={run!} busy={busy} onLoad={() => step("truth")} />}
          {!showTruth && showLab && (
            <LabPanel
              run={run!}
              busy={busy}
              onRunLab={() => step("querylab")}
              onRetest={() => step("retest")}
            />
          )}
          {!showTruth && !showLab && showFixes && <FixesPanel run={run!} busy={busy} onSchema={() => step("schema")} />}
          {!showTruth && !showLab && !showFixes && (trace.length > 0 || run) && (
            <>
              <AuditPanel
                url={target.url || run?.url || ""}
                mode={target.mode}
                trace={trace}
                factors={factors}
                summary={summary}
                busy={busy}
                hasFixes={Boolean(run?.fixes)}
                onFixes={() => step("fixes")}
              />
              {/* the crawler ruling was streamed and dropped on the floor until now,
                  which meant the single most checkable finding never reached the screen */}
              <AccessPanel access={access} patch={patch} url={run?.url || target.url} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ paddingTop: 96, paddingBottom: 96 }}>
      <h1 className="h1" style={{ maxWidth: "17ch", fontSize: "clamp(48px,4.6vw,78px)" }}>
        Ranked on Google. Never quoted.
      </h1>
      <p className="lede" style={{ maxWidth: "56ch", marginTop: 28, fontSize: 19 }}>
        Paste any page above. CITED fetches it, reads it the way an answer engine does, and reports every check it
        ran with the exact text it pulled off the page. Then it writes the rewrites and proves the gain by re-testing
        on a live engine.
      </p>
      <div style={{ display: "flex", gap: 40, marginTop: 46, flexWrap: "wrap" }}>
        {[
          ["9", "weighted factors, sourced"],
          ["12", "checks per run"],
          ["0", "invented facts"],
        ].map(([n, l]) => (
          <div key={l}>
            <div className="h1" style={{ fontSize: 56 }}>
              {n}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--meta)", marginTop: 8 }}>
              {l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
