"use client";

import { useEffect, useState } from "react";
import { DEMO_PAGES } from "../engine/ingest";

export function TopBar({ runId, engineMode, profoundMode }: { runId?: string; engineMode: string; profoundMode: string }) {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="rule-b gut"
      style={{
        height: "var(--bar-h)",
        display: "flex",
        alignItems: "center",
        gap: 26,
        background: "rgba(5,5,5,.92)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <span className="m" style={{ color: "var(--ink)" }}>
        <span style={{ color: "var(--red)" }}>■</span> CITED
      </span>
      <span className="m-sm meta">ENGINE {engineMode.toUpperCase()}</span>
      <span className="m-sm meta">PROFOUND {profoundMode.toUpperCase()}</span>
      <span className="m-sm meta">WEIGHTS LOCKED</span>
      <span style={{ marginLeft: "auto" }} className="m-sm meta">
        {runId ? `RUN ${runId.toUpperCase()}` : "NO RUN"}
      </span>
      <span className="m-sm meta" style={{ minWidth: 66, textAlign: "right" }}>
        {clock ? `${clock} UTC` : ""}
      </span>
    </div>
  );
}

export function InputBar({
  onRun,
  busy,
  disabled,
}: {
  onRun: (input: { url?: string; demoId?: string; brand: string; market: string }) => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [brand, setBrand] = useState("Meridian Skin Lab");
  const [market, setMarket] = useState("UK");

  return (
    /* paddingTop/Bottom only: the shorthand would wipe the gutter that .gut owns */
    <div className="rule-b gut" style={{ paddingTop: 18, paddingBottom: 16, background: "var(--band)" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onRun({ url, brand, market });
        }}
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
      >
        <input
          className="field"
          style={{ flex: "1 1 460px" }}
          placeholder="Paste any page URL to audit"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Page URL to audit"
          disabled={disabled}
        />
        <input
          className="field"
          style={{ width: 200 }}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          aria-label="Brand"
          disabled={disabled}
        />
        <select
          className="field"
          style={{ width: 110 }}
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          aria-label="Market"
          disabled={disabled}
        >
          {["UK", "SE", "DK", "US", "FR"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button className="btn btn--primary" type="submit" disabled={busy || disabled}>
          {busy ? "Running…" : "Run audit"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <span className="m-sm meta" style={{ marginRight: 4 }}>
          OR RUN A BUNDLED DEMO PAGE
        </span>
        {DEMO_PAGES.map((d) => (
          <button
            key={d.id}
            className="btn btn--ghost btn--sm"
            type="button"
            disabled={busy || disabled}
            onClick={() => onRun({ demoId: d.id, brand, market })}
            title={d.label}
          >
            {d.note}
          </button>
        ))}
      </div>
    </div>
  );
}
