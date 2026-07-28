"use client";

import type { Run } from "../lib/types";

/**
 * Numbers only when they are about the user's own domain. With PROFOUND_MODE=mock the
 * adapter answers with recorded fixtures for any domain, and this panel used to print
 * them under the heading "this is observed behaviour", which is the single most
 * believable lie the product could tell. Fixtures are now stated, never rendered.
 */
export function TruthPanel({ run, busy, onLoad }: { run: Run; busy: string | null; onLoad: () => void }) {
  const t = run.truth;
  const live = t?.mode === "live";
  // read the real gate rather than asserting a number: a page that fails it scores 0
  const gateScore = run.audit?.factors.find((f) => f.key === "crawlability")?.score;
  const blind = live ? (t?.bots.filter((b) => b.thisPath === 0) ?? []) : [];

  return (
    <div style={{ paddingBottom: 120 }}>
      <div className="sec" style={{ paddingTop: 52 }}>
        <div className="kicker" style={{ color: "var(--meta)" }}>
          STEP 7 · WHAT THE CRAWLERS ACTUALLY DID
        </div>
        <h1 className="h1" style={{ maxWidth: "20ch", marginTop: 24 }}>
          {live ? "Our score is a model. This is observed behaviour." : "This panel has no data to show."}
        </h1>
        <p className="lede" style={{ maxWidth: "62ch", marginTop: 22 }}>
          {live ? (
            <>
              Profound reports which answer-engine crawler touched which path. It is the one signal the on-page score
              cannot produce, and it is where a 100 on crawlability can still mean nobody came.
            </>
          ) : (
            <>
              Profound authenticates but this account has rights to no useful domain, so no bot-crawl figure here would
              be about your site. Recorded fixture numbers are not shown as if they were, and the crawler ruling on the
              audit screen answers the same question from your own robots.txt instead.
            </>
          )}
        </p>
        <button className="btn btn--primary" style={{ marginTop: 28 }} onClick={onLoad} disabled={busy !== null}>
          {busy === "truth" ? "Asking Profound…" : t ? "Try Profound again" : "Try Profound"}
        </button>
      </div>

      {t && !live && (
        <div className="sec">
          <div style={{ border: "1px solid var(--amber)", padding: "16px 20px", display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="m" style={{ color: "var(--amber)" }}>NOTHING MEASURED</span>
            <span style={{ fontSize: 16, fontWeight: 500 }}>
              {t.degradedReason ?? "Profound returned no data this account is entitled to."}
            </span>
          </div>
          <p className="lede" style={{ marginTop: 24, maxWidth: "64ch" }}>
            The recorded fixtures behind this integration describe another domain. Rendering them here would put a
            number on screen that is not about your site, so the table stays empty on purpose.
          </p>
        </div>
      )}

      {t && live && (
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
              on-page gate scored {gateScore ?? "n/a"} and it was right about what it measures. It was also
              incomplete, which is exactly why this panel exists.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
