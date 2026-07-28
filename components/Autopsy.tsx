"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Autopsy, BriefLine, PageSide } from "../autopsy/run";
import { Favicon } from "./Territory";
import { FacingBands } from "./Facing";

/** Factor names are written for the ledger. A headline needs the first clause only. */
const shortName = (name: string) => name.split(/\s*[&/(]\s*/)[0].trim();

/**
 * Three pairs whose competitor page resolves from the site's own sitemap, each one
 * run and confirmed. A blank form that fails on the first domain someone types is
 * how this screen read before; these are the proof that resolution works, and the
 * shape to copy for a domain of your own.
 */
const OUR_PAGE = "https://theordinary.com/en-us/azelaic-acid-suspension-10-exfoliator-100407.html";
const WORKING = [
  { domain: "healthline.com", question: "What are the benefits of vitamin C for skin?", ourUrl: OUR_PAGE },
  { domain: "nhs.uk", question: "Is vitamin C good for skin?", ourUrl: OUR_PAGE },
  { domain: "medicalnewstoday.com", question: "What does vitamin C do for the skin?", ourUrl: "" },
] as const;

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
  const [theirHtml, setTheirHtml] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const [data, setData] = useState<Autopsy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  // overrides so an example can run on its own values without waiting for a re-render
  const run = useCallback(async (over?: Partial<Record<"ourUrl" | "domain" | "question" | "theirUrl" | "theirHtml", string>>) => {
    setBusy(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/autopsy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ourUrl, domain, question, theirUrl, theirHtml, ...over }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
      setData(json.autopsy);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [ourUrl, domain, question, theirUrl, theirHtml]);

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
          <input className="field" style={{ flex: "1 1 380px" }} value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} placeholder="Your page URL (optional)" aria-label="Your page URL, optional" />
          <input className="field" style={{ width: 210 }} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="competitor.com" aria-label="Competitor domain" />
          <input className="field" style={{ flex: "1 1 320px" }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="The question they win" aria-label="The question they win" />
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Reading both pages…" : "Run the autopsy"}</button>
        </form>
        <div className="bar" style={{ marginTop: 12 }}>
          <span className="m" style={{ color: "var(--meta)", minWidth: 132 }}>CHECKED WORKING</span>
          {WORKING.map((w) => (
            <button
              key={w.domain}
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => {
                setOurUrl(w.ourUrl);
                setDomain(w.domain);
                setQuestion(w.question);
                setTheirUrl("");
                setTheirHtml("");
                run({ ourUrl: w.ourUrl, domain: w.domain, question: w.question, theirUrl: "", theirHtml: "" });
              }}
              title={`${w.domain} — ${w.question}`}
            >
              {w.domain}
            </button>
          ))}
        </div>

        <div className="bar" style={{ marginTop: 12 }}>
          <span className="m" style={{ color: "var(--meta)", minWidth: 132 }}>OR THEIR EXACT PAGE</span>
          <input className="field" style={{ flex: "1 1 380px", maxWidth: 560 }} value={theirUrl} onChange={(e) => setTheirUrl(e.target.value)} placeholder="https://competitor.com/the-winning-page" aria-label="Competitor page URL" />
          <button type="button" className={`btn btn--sm ${showPaste ? "btn--primary" : "btn--ghost"}`} onClick={() => setShowPaste((v) => !v)}>
            {theirHtml ? `Source pasted, ${Math.round(theirHtml.length / 1024)} KB` : "Paste the source instead"}
          </button>
        </div>

        {showPaste && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--meta)", marginBottom: 8, maxWidth: "88ch" }}>
              Some publishers refuse every automated read from behind a firewall, including their own robots.txt. Open
              the page in your browser, press Ctrl+U for the source, select all, copy, and paste it here. The same nine
              factors run on it and nothing can block that.
            </p>
            <textarea
              className="field"
              value={theirHtml}
              onChange={(e) => setTheirHtml(e.target.value)}
              placeholder="Paste the page source here"
              aria-label="Competitor page source"
              style={{ width: "100%", height: 110, padding: 12, lineHeight: 1.5, resize: "vertical" }}
            />
          </div>
        )}
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
            <div style={{ paddingTop: 54, display: "grid", gridTemplateColumns: "minmax(0,1fr) 600px", gap: 64, alignItems: "start" }}>
              <div>
                <h1 className="h1" style={{ maxWidth: "20ch" }}>
                  {!data.theirs
                    ? `We could not reach their page.`
                    : !data.ours
                      ? "Here is the page you have to beat."
                      : top
                        ? `They win on ${shortName(top.name).toLowerCase()}.`
                        : "Your page already matches theirs on every factor."}
                </h1>
                <p className="lede" style={{ marginTop: 22, maxWidth: "58ch" }}>
                  {!data.theirs ? (
                    <>
                      Every route was tried and the log below shows what each one returned. Their sitemap was scanned
                      for the question, then the engine was asked to name a URL, then each candidate was fetched.
                      {data.blockedUs ? ` Their server refused us (${data.blockedUs}).` : ""} Some publishers block all
                      automated reads from behind a firewall, and pretending to be a browser would contradict the
                      crawler honesty this tool measures.
                      <br />
                      <br />
                      <strong>Two ways forward, both take a minute.</strong>
                    </>
                  ) : !data.ours ? (
                    <>
                      You have no page on this question yet, so there is nothing to diff. What follows is what the
                      winning page actually carries, measured, which is the bar a new page has to clear. Paste your own
                      URL above at any time and it becomes a side-by-side instead.
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

            {!data.theirs && (
              <div className="card" style={{ padding: "18px 20px", marginTop: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 24 }}>
                  <div>
                    <div className="m" style={{ color: "var(--brand)", marginBottom: 8 }}>1 · FIND THE PAGE</div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--meta)" }}>
                      Ask the engine the question yourself and read which page of theirs it names. That is also how you
                      check the row on the map is true.
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <a
                        className="btn btn--sm"
                        href={`https://chatgpt.com/?q=${encodeURIComponent(data.question ?? "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ask ChatGPT
                      </a>
                      <a
                        className="btn btn--sm"
                        href={`https://www.google.com/search?q=${encodeURIComponent(`site:${data.domain} ${data.question ?? ""}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Search {data.domain}
                      </a>
                    </div>
                  </div>
                  <div>
                    <div className="m" style={{ color: "var(--brand)", marginBottom: 8 }}>2 · GIVE IT TO THE TOOL</div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--meta)" }}>
                      Paste that URL in the field above. If their server refuses it too, open the page, press Ctrl+U,
                      copy the source and paste it with the button beside the field. Nothing can block that route.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {data.theirs && data.brief && <Brief lines={data.brief} domain={data.domain} />}

            {data.theirs && data.diffs.length > 0 && (
              <div ref={barsRef} style={{ marginTop: 44 }}>
                <FacingBands
                  diffs={data.diffs}
                  ourLabel="YOUR PAGE"
                  theirLabel={data.domain ? data.domain.toUpperCase() : "THEIR PAGE"}
                />
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
    ["Your page URL", "optional. Without it you get the specification for the page to write"],
    ["Their domain", "arrives filled in when you come from a seat on the map"],
    ["The question", "the exact wording the engine was asked"],
  ];
  return (
    <div style={{ paddingTop: 56, display: "grid", gridTemplateColumns: "minmax(0,1fr) 600px", gap: 56, alignItems: "start" }}>
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
    /* side by side, not stacked: two tall cards in a narrow column left ~220px of dead
       space under the headline, which is the void that gets reported every time */
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
      {side("THE PAGE BEING QUOTED", data.theirs, "var(--d3)")}
      {data.ours ? (
        side("YOUR PAGE", data.ours, "var(--brand)")
      ) : (
        <div className="card" style={{ padding: "14px 16px", borderTop: "2px solid var(--s3)" }}>
          <div className="m" style={{ color: "var(--meta)" }}>YOUR PAGE</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>You do not have one yet</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--meta)", marginTop: 8 }}>
            Nothing to diff, so the winning page is read on its own as the bar to clear.
          </p>
        </div>
      )}
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

/**
 * The winning page read as a specification.
 *
 * When the brand has no page on a question, a diff is impossible and a checklist would
 * be somebody's opinion. This is neither: every line is what the page that IS being
 * quoted actually carries, measured by the same nine factors, with the exact strings
 * pulled off it. That is a bar to clear, and it can be checked by opening their page.
 */
function Brief({ lines, domain }: { lines: BriefLine[]; domain: string }) {
  const strong = lines.filter((l) => l.theirs >= 60);
  const weak = lines.filter((l) => l.theirs < 60);

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 className="h2">What a page has to carry to take this.</h2>
        <span className="m" style={{ color: "var(--meta)" }}>MEASURED ON {domain.toUpperCase()}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginTop: 22 }}>
        <Column
          title="Match these"
          help="What the winning page does well. A new page that misses these starts behind."
          accent="var(--d2)"
          lines={strong}
        />
        <Column
          title="Beat these"
          help="Where the winning page is weak. This is where a new page overtakes it cheaply."
          accent="var(--brand)"
          lines={weak}
        />
      </div>
    </div>
  );
}

function Column({ title, help, accent, lines }: { title: string; help: string; accent: string; lines: BriefLine[] }) {
  return (
    <div>
      <div className="m" style={{ color: accent }}>{title} · {lines.length}</div>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--meta)", marginTop: 6, marginBottom: 12 }}>{help}</p>
      {lines.length === 0 && (
        <p style={{ fontSize: 15, color: "var(--meta)" }}>Nothing in this column on this page.</p>
      )}
      {lines.map((l) => (
        <div key={l.key} className="card" style={{ padding: "13px 15px", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{l.name}</span>
            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: accent }}>{l.theirs}</span>
            <span className="m-sm" style={{ color: "var(--meta)" }}>
              {l.weight === null ? "GATE" : `${Math.round(l.weight * 100)}%`}
            </span>
          </div>
          {l.evidence.length > 0 && (
            <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
              {l.evidence.slice(0, 3).map((e, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    color: "var(--ink)",
                    borderLeft: `2px solid ${accent}`,
                    paddingLeft: 10,
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
