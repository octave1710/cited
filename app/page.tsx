"use client";

import { useCallback, useState } from "react";
import { InputBar, TopBar } from "../components/Chrome";
import { RunRail } from "../components/Run";
import { AuditPanel } from "../components/Audit";
import { FixesPanel } from "../components/Fixes";
import type { Run, StepId } from "../lib/types";

export default function Page() {
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<StepId>("score");

  const start = useCallback(
    async (input: { url?: string; demoId?: string; brand: string; market: string }) => {
      setBusy("run");
      setError(null);
      setRun(null);
      try {
        const res = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
        setRun(data.run);
        setActive("score");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const step = useCallback(
    async (name: "fixes" | "schema") => {
      if (!run) return;
      setBusy(name);
      setError(null);
      try {
        const res = await fetch(`/api/runs/${run.id}/${name}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
        setRun(data.run);
        setActive(name);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [run],
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar runId={run?.id} engineMode={process.env.NEXT_PUBLIC_LLM_MODE ?? "mock"} profoundMode="mock" />
      <InputBar onRun={start} busy={busy === "run"} />

      {error && (
        <div
          className="gut rule-b"
          style={{
            background: "rgba(255,59,59,.08)",
            borderBottom: "1px solid var(--red)",
            padding: "14px 0",
            display: "flex",
            gap: 14,
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

      <div style={{ display: "grid", gridTemplateColumns: "308px minmax(0,1fr)", flex: 1, minHeight: 0 }}>
        <RunRail run={run} active={active} onSelect={setActive} />

        <main style={{ minWidth: 0 }}>
          {!run && <Empty busy={busy === "run"} />}
          {run && active === "fixes" && run.fixes && (
            <FixesPanel run={run} busy={busy} onSchema={() => step("schema")} />
          )}
          {run && (active !== "fixes" || !run.fixes) && (
            <AuditPanel run={run} busy={busy} onFixes={() => step("fixes")} />
          )}
        </main>
      </div>
    </div>
  );
}

function Empty({ busy }: { busy: boolean }) {
  return (
    <div className="gut" style={{ padding: "84px 0" }}>
      <h1 className="d" style={{ fontSize: "clamp(48px,5.4vw,88px)", maxWidth: "15ch" }}>
        {busy ? "Reading the page…" : "Ranked on Google. Never quoted."}
      </h1>
      <p style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.5, maxWidth: "54ch", marginTop: 22 }}>
        {busy
          ? "Fetching, parsing, and scoring against nine weighted citability factors."
          : "Paste a URL above. CITED reads it the way an answer engine does, scores nine weighted factors against the real text, writes the fixes, then proves the gain by re-testing on a live engine."}
      </p>
    </div>
  );
}
