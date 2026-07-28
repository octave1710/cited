"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Autopsy, FactorDiff } from "../autopsy/run";

/** Factor names are written for the ledger. A headline needs the first clause only. */
const shortName = (name: string) => name.split(/\s*[&/(]\s*/)[0].trim();

/**
 * The device here is a facing bar: one axis down the middle, their page growing
 * right, yours growing left, rows ordered by the weighted gap. The widest
 * asymmetry is the work order, and it is visible before anything is read.
 */
export function AutopsyScreen({ initialDomain, initialQuestion }: { initialDomain?: string; initialQuestion?: string }) {
  const [ourUrl, setOurUrl] = useState("");
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [theirUrl, setTheirUrl] = useState("");

  const [data, setData] = useState<Autopsy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setData(null);
    setOpen(null);
    try {
      const res = await fetch("/api/autopsy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ourUrl, domain, question, theirUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
      setData(json.autopsy);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [ourUrl, domain, question, theirUrl]);

  /* The bars grow out of the axis once, on arrival. Scale on the x axis only,
     so nothing reflows and the numbers stay put. */
  useEffect(() => {
    if (!data || !barsRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-bar]", {
        scaleX: 0,
        duration: 0.62,
        ease: "expo.out",
        stagger: 0.045,
      });
    }, barsRef);
    return () => ctx.revert();
  }, [data]);

    const top = data?.diffs.find((d) => d.impact > 0);

  return (
    <div style={{ paddingBottom: 140 }}>
      <div className="rule-b gut" style={{ paddingTop: 24, paddingBottom: 22, background: "var(--band)", position: "sticky", top: "var(--bar-h)", zIndex: 40 }}>
        <form onSubmit={(e) => { e.preventDefault(); if (!busy) run(); }} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="field" style={{ flex: "1 1 380px" }} value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} placeholder="Your page URL" aria-label="Your page URL" />
          <input className="field" style={{ width: 210 }} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="competitor.com" aria-label="Competitor domain" />
          <input className="field" style={{ flex: "1 1 320px" }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="The question they win" aria-label="The question they win" />
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Reading both pages…" : "Run the autopsy"}</button>
        </form>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <span className="m" style={{ color: "var(--meta)" }}>OR PASTE THEIR EXACT PAGE</span>
          <input className="field" style={{ flex: "1 1 420px", maxWidth: 620 }} value={theirUrl} onChange={(e) => setTheirUrl(e.target.value)} placeholder="https://competitor.com/the-winning-page" aria-label="Competitor page URL" />
        </div>
      </div>

      {error && (
        <div className="gut" style={{ background: "rgba(255,59,59,.08)", borderBottom: "1px solid var(--red)", paddingTop: 16, paddingBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <span className="m" style={{ color: "var(--red)" }}>FAILED</span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{error}</span>
        </div>
      )}

      <div className="gut">
        {!data && !busy && <AutopsyEmpty />}
        {busy && (
          <div style={{ paddingTop: 84 }}>
            <h1 className="h1" style={{ maxWidth: "18ch" }}>Reading the page that beats yours.</h1>
            <p className="lede" style={{ marginTop: 20 }}>Resolving their URL, fetching it, running the same nine factors on both.</p>
          </div>
        )}

        {data && (
          <>
            <div style={{ paddingTop: 54, display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 88, alignItems: "start" }}>
              <div>
                <h1 className="h1" style={{ maxWidth: "20ch" }}>
                  {!data.theirs
                    ? `${data.domain} will not let us read it.`
                    : top
                      ? `They win on ${shortName(top.name).toLowerCase()}.`
                      : "Your page already matches theirs on every factor."}
                </h1>
                <p className="lede" style={{ marginTop: 22, maxWidth: "58ch" }}>
                  {!data.theirs ? (
                    <>
                      Their server refused our fetch{data.blockedUs ? ` (${data.blockedUs})` : ""}. A site can win
                      citations while staying closed to everyone except the engines it allows. Paste the page above and
                      the same nine factors run on it.
                    </>
                  ) : top ? (
                    `They sit at ${top.theirs} out of 100 on it and you sit at ${top.ours}, on a factor carrying ${Math.round((top.weight ?? 0) * 100)}% of the score. ${top.theirReasoning}`
                  ) : (
                    "The gap is not on the page. It is off-site authority, and no edit inside a CMS closes that."
                  )}
                </p>
              </div>
              <Sides data={data} />
            </div>

            {data.theirs && (
              <div ref={barsRef} style={{ marginTop: 52 }}>
                {data.diffs.map((d) => (
                  <Row key={d.key} d={d} open={open === d.key} onToggle={() => setOpen(open === d.key ? null : d.key)} />
                ))}
              </div>
            )}

            <Attempts data={data} />
          </>
        )}
      </div>
    </div>
  );
}

function AutopsyEmpty() {
  return (
    <div style={{ paddingTop: 92, maxWidth: 980 }}>
      <h1 className="h1" style={{ maxWidth: "15ch", fontSize: "clamp(48px,4.8vw,82px)" }}>
        Why does their page win?
      </h1>
      <p className="lede" style={{ maxWidth: "56ch", marginTop: 28, fontSize: 19 }}>
        The same nine factors, run on the page that is actually being quoted and on yours.
        The advice stops being an opinion and becomes a measurement.
      </p>
    </div>
  );
}

function Sides({ data }: { data: Autopsy }) {
  const side = (label: string, url: string, title: string, words: number, score: number, color: string) => (
    <div style={{ borderTop: `2px solid ${color}`, paddingTop: 14 }}>
      <div className="m" style={{ color }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, marginTop: 8, lineHeight: 1.35 }}>{title || url}</div>
      <div className="m-sm meta" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0.2, wordBreak: "break-all" }}>{url}</div>
      <div style={{ display: "flex", gap: 22, marginTop: 12, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 22, color }}>{score}<span className="meta" style={{ fontSize: 12 }}>/100</span></span>
        <span className="m-sm meta">{words.toLocaleString("en-US")} WORDS</span>
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {data.theirs ? (
        side("THE PAGE BEING QUOTED", data.theirs.url, data.theirs.title, data.theirs.words, data.theirs.audit.overall, "var(--ink)")
      ) : (
        <div style={{ borderTop: "2px solid var(--rule)", paddingTop: 14 }}>
          <div className="m meta">THE PAGE BEING QUOTED</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 8 }}>Not readable from here</div>
          <div className="m-sm" style={{ color: "var(--red)", marginTop: 10 }}>NOTHING MEASURED</div>
        </div>
      )}
      {side("YOUR PAGE", data.ours.url, data.ours.title, data.ours.words, data.ours.audit.overall, "var(--red)")}
    </div>
  );
}

function Row({ d, open, onToggle }: { d: FactorDiff; open: boolean; onToggle: () => void }) {
  const behind = d.theirs > d.ours;
  return (
    <div style={{ borderTop: "1px solid var(--rule-soft)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", background: "transparent", border: "none", padding: "15px 0 16px", cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 9 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{d.name}</span>
          <span className="m-sm meta">{d.weight === null ? "GATE" : `${Math.round(d.weight * 100)}% OF SCORE`}</span>
          <span className="m-sm" style={{ marginLeft: "auto", color: behind ? "var(--red)" : "var(--meta)" }}>
            {behind ? `${d.theirs - d.ours} POINTS BEHIND` : d.ours === d.theirs ? "LEVEL" : `${d.ours - d.theirs} AHEAD`}
          </span>
        </div>

        {/* facing bars on one axis, yours left and theirs right. Full strength is
            reserved for the side that is winning, so the rows to act on stand out
            instead of nine equally loud stripes. */}
        <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1px 1fr 48px", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, textAlign: "right", color: behind ? "var(--red)" : "var(--ink)" }}>{d.ours}</span>
          <span style={{ display: "flex", justifyContent: "flex-end", height: 16 }}>
            <span data-bar style={{ display: "block", height: 16, width: `${d.ours}%`, background: behind ? "var(--red)" : "rgba(255,59,59,.42)", transformOrigin: "right center" }} />
          </span>
          <span style={{ height: 28, background: "var(--rule)" }} />
          <span style={{ display: "flex", height: 16 }}>
            <span data-bar style={{ display: "block", height: 16, width: `${d.theirs}%`, background: behind ? "var(--ink)" : "rgba(236,235,231,.42)", transformOrigin: "left center" }} />
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14 }}>{d.theirs}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "4px 0 26px" }}>
          {/* the factor definition is a property of the factor, not of either page:
              printing it in both columns just says the same thing twice */}
          <p style={{ fontSize: 16.5, lineHeight: 1.55, maxWidth: "78ch" }}>{d.theirReasoning || d.ourReasoning}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, marginTop: 22 }}>
            <Evidence label="PULLED OFF YOUR PAGE" color="var(--red)" items={d.ourEvidence} />
            <Evidence label="PULLED OFF THEIRS" color="var(--ink)" items={d.theirEvidence} />
          </div>
          <p className="m-sm meta" style={{ marginTop: 20, textTransform: "none", letterSpacing: 0.2, lineHeight: 1.7 }}>
            Weight source: {d.source}
          </p>
        </div>
      )}
    </div>
  );
}

function Evidence({ label, color, items }: { label: string; color: string; items: string[] }) {
  return (
    <div>
      <div className="m" style={{ color }}>{label}</div>
      {items.length > 0 ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          {items.slice(0, 6).map((t, i) => (
            <span key={i} style={{ fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6, borderLeft: `1px solid ${color}`, paddingLeft: 12 }}>
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 16, marginTop: 12 }}>Nothing on the page matched this check.</p>
      )}
    </div>
  );
}

/** The work, shown: every URL tried on the way to the page that was compared. */
function Attempts({ data }: { data: Autopsy }) {
  return (
    <div style={{ paddingTop: 96 }}>
      <h2 className="h2">How their page was found</h2>
      <div style={{ marginTop: 22, borderTop: "1px solid var(--rule)" }}>
        {data.attempts.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 30, padding: "14px 0", borderBottom: "1px solid var(--rule-soft)", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, flex: "1 1 auto", minWidth: 0, wordBreak: "break-all" }}>{a.url}</span>
            <span style={{ fontSize: 15, flex: "0 1 460px", color: a.url === data.theirs?.url ? "var(--go)" : "var(--ink)" }}>{a.outcome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
