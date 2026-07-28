"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Autopsy, FactorDiff, PageSide } from "../autopsy/run";
import { Favicon } from "./Territory";

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
        <form onSubmit={(e) => { e.preventDefault(); if (!busy) run(); }} className="bar">
          <input className="field" style={{ flex: "1 1 380px" }} value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} placeholder="Your page URL" aria-label="Your page URL" />
          <input className="field" style={{ width: 210 }} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="competitor.com" aria-label="Competitor domain" />
          <input className="field" style={{ flex: "1 1 320px" }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="The question they win" aria-label="The question they win" />
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Reading both pages…" : "Run the autopsy"}</button>
        </form>
        <div className="bar" style={{ marginTop: 12 }}>
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

      <div className="gut shell">
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
              <div ref={barsRef} style={{ marginTop: 40 }}>
                <div
                  style={{ display: "grid", gridTemplateColumns: "minmax(200px,260px) 74px minmax(0,1fr) 120px", gap: 18, alignItems: "end", paddingBottom: 8 }}
                >
                  <span className="m" style={{ color: "var(--meta)" }}>FACTOR, HEAVIEST GAP FIRST</span>
                  <span className="m" style={{ color: "var(--meta)" }}>GAP</span>
                  <span style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="m" style={{ color: "var(--meta)" }}>0</span>
                    <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ width: 10, height: 10, background: "var(--brand)" }} />
                        <span className="m-sm" style={{ color: "var(--meta)" }}>YOU</span>
                      </span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ width: 10, height: 10, background: "var(--d3)" }} />
                        <span className="m-sm" style={{ color: "var(--meta)" }}>THEM</span>
                      </span>
                    </span>
                    <span className="m" style={{ color: "var(--meta)" }}>100</span>
                  </span>
                  <span />
                </div>
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
  const steps = [
    ["Your page URL", "the page of yours that should be winning this question"],
    ["Their domain", "arrives filled in when you come from a seat on the map"],
    ["The question", "the exact wording the engine was asked"],
  ];
  return (
    <div style={{ paddingTop: 56, display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 56, alignItems: "start" }}>
      <div>
        <h1 className="h1" style={{ maxWidth: "16ch" }}>Why does their page win?</h1>
        <p className="lede" style={{ maxWidth: "56ch", marginTop: 20 }}>
          The same nine factors, run on the page that is actually being quoted and on yours, on one axis.
          The advice stops being an opinion and becomes a measurement of the page that is winning.
        </p>
        <div style={{ marginTop: 26 }}>
          {steps.map(([label, help], i) => (
            <div key={label} style={{ display: "flex", gap: 14, padding: "11px 0", borderTop: "1px solid var(--line)" }}>
              <span className="num" style={{ color: "var(--brand)", fontSize: 13, fontWeight: 700, width: 18 }}>{i + 1}</span>
              <span style={{ fontSize: 15, fontWeight: 600, width: 150 }}>{label}</span>
              <span style={{ fontSize: 14.5, color: "var(--meta)", flex: 1 }}>{help}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: "18px 20px" }}>
        <div className="m" style={{ color: "var(--meta)" }}>WHAT YOU LEAVE WITH</div>
        <ul style={{ listStyle: "none", marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "The nine factors on both pages, ordered by the gap that costs you most",
            "The exact text pulled off each page for every factor",
            "The rewrites that close that gap, and a corrected HTML file",
          ].map((t) => (
            <li key={t} style={{ display: "flex", gap: 10, fontSize: 14.5, lineHeight: 1.5 }}>
              <span style={{ width: 6, height: 6, background: "var(--brand)", flex: "none", marginTop: 7 }} />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The two pages, side by side, each with its own favicon and score. A page header that
 * does not show whose page it is makes the reader hold the domain in their head while
 * reading nine rows of numbers.
 */
function Sides({ data }: { data: Autopsy }) {
  const side = (label: string, page: PageSide | undefined, colour: string) => (
    <div className="card" style={{ padding: "14px 16px", borderTop: `2px solid ${colour}` }}>
      <div className="m" style={{ color: colour }}>{label}</div>
      {page ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <Favicon domain={hostOf(page.url)} size={22} />
            <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, flex: 1, minWidth: 0 }}>{page.title || hostOf(page.url)}</span>
          </div>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--meta)", marginTop: 8, wordBreak: "break-all" }}
          >
            {page.url}
          </a>
          <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "baseline" }}>
            <span className="num" style={{ fontSize: 30, fontWeight: 700, color: colour }}>
              {page.audit.overall}
              <span style={{ fontSize: 12, color: "var(--meta)", fontWeight: 400 }}>/100</span>
            </span>
            <span className="m-sm" style={{ color: "var(--meta)" }}>{page.words.toLocaleString("en-US")} WORDS</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>Not readable from here</div>
          <div className="m-sm" style={{ color: "var(--brand)", marginTop: 10 }}>NOTHING MEASURED</div>
        </>
      )}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {side("THE PAGE BEING QUOTED", data.theirs, "var(--d3)")}
      {side("YOUR PAGE", data.ours, "var(--brand)")}
    </div>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * A dumbbell on one 0-100 axis: your dot, their dot, the segment between them is the
 * gap. Facing bars split the eye across two scales and made a 10-point gap look like a
 * 60-point one; a single axis is the form for comparing two paired values, and the row
 * with the longest segment is literally the work order.
 */
function Row({ d, open, onToggle }: { d: FactorDiff; open: boolean; onToggle: () => void }) {
  const behind = d.theirs > d.ours;
  const lo = Math.min(d.ours, d.theirs);
  const hi = Math.max(d.ours, d.theirs);

  return (
    <div style={{ borderTop: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", background: "transparent", border: "none", padding: "13px 0", cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,260px) 74px minmax(0,1fr) 120px", gap: 18, alignItems: "center" }}>
          <span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{d.name}</span>
            <span className="m-sm" style={{ color: "var(--meta)" }}>
              {d.weight === null ? "BINARY GATE" : `${Math.round(d.weight * 100)}% OF SCORE`}
            </span>
          </span>

          <span
            className="num"
            style={{ fontSize: 14, fontWeight: 700, color: behind ? "var(--brand)" : d.ours === d.theirs ? "var(--meta)" : "var(--d2)" }}
          >
            {behind ? `-${d.theirs - d.ours}` : d.ours === d.theirs ? "level" : `+${d.ours - d.theirs}`}
          </span>

          {/* the axis. One scale, two dots, one connecting segment. */}
          <span style={{ position: "relative", height: 26, display: "block" }}>
            <span style={{ position: "absolute", left: 0, right: 0, top: 12, height: 2, background: "var(--s2)" }} />
            <span
              data-bar
              style={{
                position: "absolute",
                left: `${lo}%`,
                width: `${hi - lo}%`,
                top: 11,
                height: 4,
                background: behind ? "var(--brand)" : "var(--d2)",
                transformOrigin: behind ? "right center" : "left center",
              }}
            />
            <Dot at={d.theirs} colour="var(--d3)" title={`Their page: ${d.theirs}`} />
            <Dot at={d.ours} colour="var(--brand)" title={`Your page: ${d.ours}`} ring />
          </span>

          <span style={{ display: "flex", gap: 14, justifyContent: "flex-end", alignItems: "baseline" }}>
            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{d.ours}</span>
            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--d3)" }}>{d.theirs}</span>
          </span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "2px 0 22px" }}>
          <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: "82ch", color: "var(--meta)" }}>
            {d.theirReasoning || d.ourReasoning}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginTop: 18 }}>
            <Evidence label="PULLED OFF YOUR PAGE" colour="var(--brand)" items={d.ourEvidence} />
            <Evidence label="PULLED OFF THEIRS" colour="var(--d3)" items={d.theirEvidence} />
          </div>
          <p className="m-sm" style={{ color: "var(--meta)", marginTop: 16, textTransform: "none", letterSpacing: 0.2, lineHeight: 1.6 }}>
            Weight source: {d.source}
          </p>
        </div>
      )}
    </div>
  );
}

function Dot({ at, colour, title, ring }: { at: number; colour: string; title: string; ring?: boolean }) {
  return (
    <span
      title={title}
      style={{
        position: "absolute",
        left: `${at}%`,
        top: 6,
        width: 14,
        height: 14,
        marginLeft: -7,
        background: colour,
        // a 2px ring in the ground colour keeps the two dots readable when they overlap
        boxShadow: ring ? "0 0 0 2px var(--void)" : "0 0 0 2px var(--void)",
        borderRadius: 0,
      }}
    />
  );
}

/** The receipt: the exact strings the scorer pulled off each page, never a paraphrase. */
function Evidence({ label, colour, items }: { label: string; colour: string; items: string[] }) {
  return (
    <div>
      <div className="m" style={{ color: colour }}>{label}</div>
      {items.length > 0 ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.slice(0, 6).map((t, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                lineHeight: 1.6,
                borderLeft: `2px solid ${colour}`,
                background: "var(--s1)",
                padding: "8px 12px",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 15, marginTop: 12, color: "var(--meta)" }}>Nothing on the page matched this check.</p>
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
