"use client";

import { useState } from "react";
import type { AccessEvent, PatchEvent } from "../lib/stream";

/**
 * The most checkable screen in the product: every verdict quotes the line from the
 * client's own robots.txt that decided it, and links to that file. Nothing here is a
 * model, an estimate or a score. It is their file, read out loud.
 *
 * The device is a gate row per crawler rather than a table: blocked reads as a closed
 * bar in the accent, allowed as an open one, so the shape of the answer is visible
 * before a word is read.
 */
export function AccessPanel({ access, patch, url }: { access: AccessEvent[]; patch: PatchEvent | null; url?: string }) {
  const [copied, setCopied] = useState(false);
  if (!access.length) return null;

  const blocked = access.filter((a) => !a.allowed);
  const robotsUrl = access[0].robotsUrl;

  return (
    <section className="sec" style={{ paddingTop: 64 }}>
      <h2 className="h1" style={{ fontSize: "clamp(32px,2.5vw,44px)", maxWidth: "22ch" }}>
        {blocked.length === 0
          ? "Every answer engine is allowed to read this page."
          : `${blocked.length} of ${access.length} answer engines cannot read this page.`}
      </h2>
      <p className="lede" style={{ marginTop: 18, maxWidth: "62ch" }}>
        {blocked.length === 0
          ? "No content work is being wasted on a door that is shut. Open the file below and check any line."
          : "No amount of content work produces a citation from an engine that is not allowed to fetch the page."}
      </p>

      <div style={{ marginTop: 34, borderTop: "1px solid var(--rule)" }}>
        {access.map((a) => (
          <div
            key={a.ua}
            style={{
              display: "grid",
              gridTemplateColumns: "190px 200px 84px minmax(0,1fr)",
              gap: 26,
              alignItems: "center",
              padding: "15px 0",
              borderBottom: "1px solid var(--rule-soft)",
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 600, color: a.allowed ? "var(--ink)" : "var(--red)" }}>{a.ua}</span>
            <span style={{ fontSize: 15 }}>{a.feeds}</span>
            {/* the gate itself: a bar that is open or closed, in one accent */}
            <span style={{ display: "flex", gap: 3, height: 14 }} aria-label={a.allowed ? "allowed" : "blocked"}>
              <span style={{ flex: 1, background: a.allowed ? "var(--go)" : "var(--red)" }} />
              <span style={{ flex: 1, background: a.allowed ? "var(--go)" : "transparent", border: a.allowed ? "none" : "1px solid var(--red)" }} />
              <span style={{ flex: 1, background: a.allowed ? "var(--go)" : "transparent", border: a.allowed ? "none" : "1px solid var(--red)" }} />
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--ink)" }}>
              {a.rule} <span className="meta">under User-agent: {a.group}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 26, alignItems: "center", flexWrap: "wrap" }}>
        <a className="btn btn--ghost" href={robotsUrl} target="_blank" rel="noopener noreferrer">
          Open their robots.txt
        </a>
        {patch && (
          <>
            <button
              className="btn btn--primary"
              onClick={() => {
                navigator.clipboard.writeText(patch.content).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? "Copied" : "Copy the robots.txt patch"}
            </button>
            <span className="m-sm meta">APPEND TO {patch.filename}</span>
          </>
        )}
      </div>

      {patch && (
        <pre
          style={{
            marginTop: 22,
            padding: "18px 20px",
            background: "#0a0a0a",
            border: "1px solid var(--rule)",
            fontFamily: "var(--mono)",
            fontSize: 12.5,
            lineHeight: 1.75,
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
          {patch.content}
        </pre>
      )}

      {url && <FilesForTheWebroot url={url} />}
    </section>
  );
}

interface LlmsResult {
  origin: string;
  siteName: string;
  sitemap: { source: string; declaredInRobots: boolean; total: number; attempts: { url: string; outcome: string }[] };
  pages: { listed: number; undescribed: number; unreadable: number; sampled: number };
  llmsTxt: string;
  robotsDiff: string | null;
  robotsAdditions: string[];
}

/**
 * Two files the client uploads to their own webroot, built entirely from strings their
 * own pages publish. Verified with two curls against their domain, so acceptance never
 * depends on believing this tool.
 */
function FilesForTheWebroot({ url }: { url: string }) {
  const [data, setData] = useState<LlmsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/llms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status}).`);
      setData(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rule-t" style={{ marginTop: 48, paddingTop: 30 }}>
      <h2 className="h2">Two files for their webroot.</h2>
      <p className="lede" style={{ marginTop: 14, maxWidth: "64ch", fontSize: 17 }}>
        An llms.txt built from their sitemap, every title and description lifted from their own pages, plus a unified
        diff that adds what is missing to robots.txt. Nothing here is written by this tool.
      </p>

      <div style={{ display: "flex", gap: 14, marginTop: 22, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn--primary" onClick={build} disabled={busy}>
          {busy ? "Reading their sitemap…" : data ? "Rebuild" : "Build llms.txt and the robots diff"}
        </button>
        {data && (
          <>
            <button className="btn" onClick={() => download("llms.txt", data.llmsTxt)}>Download llms.txt</button>
            {data.robotsDiff && (
              <button className="btn" onClick={() => download("robots.txt.diff", data.robotsDiff!)}>
                Download robots.txt.diff
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 16, marginTop: 16, color: "var(--red)" }}>{error}</p>
      )}

      {data && (
        <>
          <div style={{ display: "flex", gap: 40, marginTop: 26, flexWrap: "wrap" }}>
            {[
              [String(data.pages.listed), "pages listed, deduplicated"],
              [String(data.sitemap.total), "URLs found in the sitemap"],
              [String(data.pages.undescribed), "with no description published"],
              [String(data.pages.unreadable), "that would not load"],
            ].map(([n, label]) => (
              <div key={label}>
                <div className="h1" style={{ fontSize: 38 }}>{n}</div>
                <div className="m-sm meta" style={{ marginTop: 6 }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          <p className="m-sm meta" style={{ marginTop: 18, textTransform: "none", letterSpacing: 0.2, lineHeight: 1.7 }}>
            Sitemap {data.sitemap.source || "not found"}
            {data.sitemap.source && (data.sitemap.declaredInRobots ? ", declared in robots.txt" : ", not declared in robots.txt")}.
            Sampled {data.pages.sampled} pages evenly across it.
          </p>

          <p style={{ fontSize: 16, marginTop: 18, maxWidth: "70ch" }}>
            Upload both, then check with{" "}
            <code style={{ fontFamily: "var(--mono)", fontSize: 13.5 }}>curl {data.origin}/llms.txt</code>. Run{" "}
            <code style={{ fontFamily: "var(--mono)", fontSize: 13.5 }}>patch --dry-run</code> on the diff first and let
            your own tool accept or reject it.
          </p>

          <pre
            style={{
              marginTop: 22,
              padding: "18px 20px",
              background: "#0a0a0a",
              border: "1px solid var(--rule)",
              fontFamily: "var(--mono)",
              fontSize: 12,
              lineHeight: 1.7,
              maxHeight: 320,
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {data.llmsTxt}
          </pre>
        </>
      )}
    </div>
  );
}
