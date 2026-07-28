"use client";

import { useEffect, useState } from "react";
import type { MapDelta } from "../citationmap/compare";
import type { MapSummary } from "../lib/mapdb";

/**
 * Every map is stored, and until now none could be reopened. This is the rail plus the
 * one number a client renews a retainer for: how many of their own category's questions
 * name them now against the last run, measured the same way twice.
 *
 * The delta only ever counts questions present in BOTH runs. A question the newer run
 * did not generate is not a loss, and reporting it as one would invent a regression.
 */
export function History({ currentId, onOpen }: { currentId?: string; onOpen: (id: string) => void }) {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || maps) return;
    fetch("/api/map")
      .then((r) => r.json())
      .then((d) => setMaps(d.maps ?? []))
      .catch(() => setMaps([]));
  }, [open, maps]);

  return (
    <div>
      <button className="btn btn--ghost btn--sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide previous runs" : "Previous runs"}
      </button>

      {open && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--rule)" }}>
          {maps === null && <p style={{ fontSize: 15, padding: "12px 0" }}>Loading…</p>}
          {maps?.length === 0 && <p style={{ fontSize: 15, padding: "12px 0" }}>No stored runs yet.</p>}
          {maps?.map((m) => (
            <button
              key={m.id}
              onClick={() => onOpen(m.id)}
              disabled={m.id === currentId}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "baseline",
                width: "100%",
                padding: "11px 0",
                borderBottom: "1px solid var(--rule-soft)",
                background: "transparent",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 1,
                borderBottomColor: "var(--rule-soft)",
                color: m.id === currentId ? "var(--meta)" : "var(--ink)",
                cursor: m.id === currentId ? "default" : "pointer",
                textAlign: "left",
              }}
            >
              <span className="m-sm meta" style={{ minWidth: 92 }}>{m.createdAt.slice(0, 10)}</span>
              <span style={{ fontSize: 15.5, flex: 1, minWidth: 0 }}>{m.topic}</span>
              <span className="m-sm meta">{m.brandDomain}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{m.owned}/{m.questions}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DeltaPanel({ delta, noBaselineReason }: { delta: MapDelta | null; noBaselineReason?: string }) {
  if (!delta) {
    return noBaselineReason ? (
      <div style={{ border: "1px solid var(--rule)", padding: "14px 18px", marginTop: 24 }}>
        <span className="m meta">NO BASELINE</span>
        <p style={{ fontSize: 16, marginTop: 8 }}>{noBaselineReason}</p>
      </div>
    ) : null;
  }

  const moved = delta.won.length - delta.lost.length;
  return (
    <section style={{ paddingTop: 100 }}>
      <h2 className="h1" style={{ fontSize: "clamp(32px,2.5vw,44px)", maxWidth: "24ch" }}>
        {moved === 0
          ? "Nothing moved since the last run."
          : moved > 0
            ? `You gained ${moved} question${moved > 1 ? "s" : ""} since the last run.`
            : `You lost ${-moved} question${moved < -1 ? "s" : ""} since the last run.`}
      </h2>
      <p className="lede" style={{ marginTop: 18, maxWidth: "64ch" }}>
        {delta.before.owned} to {delta.after.owned} questions naming you, {delta.daysBetween} day
        {delta.daysBetween === 1 ? "" : "s"} apart, counted only on the {delta.comparable} questions both runs asked.
        {delta.newQuestions > 0 && ` ${delta.newQuestions} question${delta.newQuestions > 1 ? "s were" : " was"} new this run and is not counted here.`}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 56, marginTop: 36 }}>
        <MoveList title="Won" color="var(--go)" moves={delta.won} />
        <MoveList title="Lost" color="var(--red)" moves={delta.lost} />
      </div>

      {delta.domains.length > 0 && (
        <div style={{ marginTop: 44 }}>
          <div className="m" style={{ marginBottom: 12 }}>WHO MOVED, IN QUESTIONS WON</div>
          {delta.domains.slice(0, 6).map((d) => (
            <div key={d.domain} style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "9px 0", borderTop: "1px solid var(--rule-soft)" }}>
              <span style={{ fontSize: 16.5, flex: 1, color: d.isBrand ? "var(--red)" : "var(--ink)" }}>
                {d.domain}{d.isBrand ? " (you)" : ""}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 14 }}>{d.fromWins} → {d.toWins}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 14, minWidth: 48, textAlign: "right", color: d.delta > 0 ? "var(--go)" : d.delta < 0 ? "var(--red)" : "var(--meta)" }}>
                {d.delta > 0 ? `+${d.delta}` : d.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MoveList({ title, color, moves }: { title: string; color: string; moves: MapDelta["won"] }) {
  return (
    <div>
      <div className="m" style={{ color }}>{title} · {moves.length}</div>
      {moves.length === 0 && <p style={{ fontSize: 16, marginTop: 12 }}>Nothing in this column.</p>}
      {moves.slice(0, 8).map((m) => (
        <div key={m.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--rule-soft)" }}>
          <div style={{ fontSize: 16, lineHeight: 1.45 }}>{m.text}</div>
          <div className="m-sm meta" style={{ marginTop: 6, textTransform: "none", letterSpacing: 0.2 }}>
            {m.fromOwner ?? "nobody"} → {m.toOwner ?? "nobody"}
          </div>
        </div>
      ))}
    </div>
  );
}
