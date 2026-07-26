"use client";

import type { Run } from "../lib/types";

export function TruthPanel({ run, busy, onLoad }: { run: Run; busy: string | null; onLoad: () => void }) {
  const t = run.truth;
  const blind = t?.bots.filter((b) => b.thisPath === 0) ?? [];

  return (
    <div style={{ paddingBottom: 120 }}>
      <div className="sec" style={{ paddingTop: 52 }}>
        <div className="kicker" style={{ color: "var(--meta)" }}>
          STEP 7 · WHAT THE CRAWLERS ACTUALLY DID
        </div>
        <h1 className="h1" style={{ maxWidth: "20ch", marginTop: 24 }}>
          Our score is a model. This is observed behaviour.
        </h1>
        <p className="lede" style={{ maxWidth: "62ch", marginTop: 22 }}>
          Profound reports which answer-engine crawler touched which path. It is the one signal the on-page score
          cannot produce, and it is where a 100 on crawlability can still mean nobody came.
        </p>
        <button className="btn btn--primary" style={{ marginTop: 28 }} onClick={onLoad} disabled={busy !== null}>
          {busy === "truth" ? "Asking Profound…" : t ? "Refresh from Profound" : "Load production truth"}
        </button>
      </div>

      {t && (
        <div className="sec">
          <div
            style={{
              border: `1px solid ${t.mode === "live" ? "var(--go)" : "var(--amber)"}`,
              padding: "14px 18px",
              marginBottom: 32,
              display: "flex",
              gap: 14,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                color: t.mode === "live" ? "var(--go)" : "var(--amber)",
              }}
            >
              {t.mode === "live" ? "LIVE PROFOUND DATA" : "RECORDED FIXTURES"}
            </span>
            {t.degradedReason && <span style={{ fontSize: 15.5, fontWeight: 500 }}>{t.degradedReason}</span>}
          </div>

          <div className="trace">
            <div className="tr" style={{ gridTemplateColumns: "26px minmax(0,1fr) 150px 120px 130px", paddingTop: 0 }}>
              <span className="tr__i" />
              <span className="tr__i">CRAWLER</span>
              <span className="tr__i">OPERATOR</span>
              <span className="tr__i" style={{ textAlign: "right" }}>
                HITS / 30D
              </span>
              <span className="tr__i" style={{ textAlign: "right" }}>
                THIS PATH
              </span>
            </div>
            {t.bots.map((b, i) => (
              <div key={b.bot} className="tr" style={{ gridTemplateColumns: "26px minmax(0,1fr) 150px 120px 130px" }}>
                <span className="tr__i">{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{b.bot}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{b.operator}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13, textAlign: "right" }}>
                  {b.hits30d.toLocaleString("en-US")}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 13,
                    textAlign: "right",
                    color: b.thisPath === 0 ? "var(--red)" : "var(--ink)",
                  }}
                >
                  {b.thisPath === 0 ? "never fetched" : `${b.thisPath} hits`}
                </span>
              </div>
            ))}
          </div>

          {blind.length > 0 && (
            <p className="lede" style={{ marginTop: 26, maxWidth: "70ch" }}>
              {blind.map((b) => b.bot).join(" and ")} crawl the domain but have never fetched this URL. The
              on-page gate scored 100 and it was right. It was also incomplete, which is exactly why this panel
              exists.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
