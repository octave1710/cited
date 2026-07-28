"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DEMO_PAGES, REAL_PAGES } from "../engine/demoPages";

const LABEL: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: 1.3,
  textTransform: "uppercase",
  color: "var(--ink)",
  marginRight: 6,
  minWidth: 132,
};

/** The funnel in order: map the category, autopsy and fix a page, ship across markets. */
const ROUTES = [
  { href: "/board", label: "BOARD" },
  { href: "/map", label: "MAP" },
  { href: "/autopsy", label: "AUTOPSY" },
  { href: "/", label: "AUDIT" },
  { href: "/pipeline", label: "PIPELINE" },
];

function Nav() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 18 }}>
      {ROUTES.map((r) => {
        const on = path === r.href;
        return (
          <a
            key={r.href}
            href={r.href}
            className="m-sm"
            style={{
              color: on ? "var(--ink)" : "var(--meta)",
              textDecoration: "none",
              borderBottom: on ? "1px solid var(--red)" : "1px solid transparent",
              paddingBottom: 2,
            }}
          >
            {r.label}
          </a>
        );
      })}
    </nav>
  );
}

export function TopBar({ runId }: { runId?: string }) {
  // asked for, never assumed: the bar reported MOCK while the engine answered live
  const [mode, setMode] = useState<{ engine: string; engineWhy: string; profound: string } | null>(null);
  useEffect(() => {
    fetch("/api/mode")
      .then((r) => r.json())
      .then(setMode)
      .catch(() => {});
  }, []);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="rule-b gut topbar"
      style={{
        height: "var(--bar-h)",
        display: "flex",
        alignItems: "center",
        gap: 26,
        whiteSpace: "nowrap",
        background: "var(--void)", // opaque: a translucent bar lets scrolled text bleed through
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <span className="m" style={{ color: "var(--ink)" }}>
        <span style={{ color: "var(--red)" }}>■</span> CITED
      </span>
      <Nav />
      <span
        className="m-sm"
        style={{ color: mode?.engine === "live" ? "var(--d2)" : "var(--meta)" }}
        title={mode?.engineWhy ?? ""}
      >
        ENGINE {(mode?.engine ?? "…").toUpperCase()}
      </span>
      <span className="m-sm meta">PROFOUND {(mode?.profound ?? "…").toUpperCase()}</span>
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
  const [brand, setBrand] = useState("The Ordinary");
  const [market, setMarket] = useState("UK");

  return (
    /* paddingTop/Bottom only: the shorthand would wipe the gutter that .gut owns */
    <div className="rule-b gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--band)" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onRun({ url, brand, market });
        }}
        className="bar"
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

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <span style={LABEL}>Live pages</span>
        {REAL_PAGES.map((p) => (
          <button
            key={p.url}
            className="btn btn--ghost btn--sm"
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              setUrl(p.url);
              onRun({ url: p.url, brand, market });
            }}
            title={p.url}
          >
            {p.note}
          </button>
        ))}
      </div>

      {/* the loop that closes only on a page we hold: you cannot publish a fix to nhs.uk */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <span style={LABEL}>Pages in this repo</span>
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
        <span style={{ fontSize: 13.5, color: "var(--meta)", marginLeft: 4 }}>
          the only pages a fix can be applied to and re-scored
        </span>
      </div>
    </div>
  );
}
