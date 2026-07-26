import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../../../engine/parse";
import { FACTORS, GATE_FACTOR } from "../../../../engine/weights.config";
import { crawlability } from "../../../../engine/factors/crawlability";
import { answerStructure } from "../../../../engine/factors/answerStructure";
import { sourcedQuotes } from "../../../../engine/factors/sourcedQuotes";
import { factualSpecificity } from "../../../../engine/factors/factualSpecificity";
import { freshness } from "../../../../engine/factors/freshness";
import { offSiteAuthority } from "../../../../engine/factors/offSiteAuthority";
import { fanoutCoverage } from "../../../../engine/factors/fanoutCoverage";
import { googleRank } from "../../../../engine/factors/googleRank";
import { schemaValidity } from "../../../../engine/factors/schemaValidity";
import { DEMO_PAGES, IngestError, fetchPage, normaliseUrl } from "../../../../engine/ingest";
import { checkCrawlerAccess } from "../../../../engine/crawlerAccess";
import { newRunId, saveRun } from "../../../../lib/db";
import { blankSteps, type Run } from "../../../../lib/types";
import type { FactorResult, ParsedPage } from "../../../../engine/types";

export const runtime = "nodejs";

/**
 * The audit as a stream of observable work. Every check reports what it actually
 * inspected and how long it actually took, so the result is traceable instead of
 * appearing out of nowhere. Durations are measured, never invented.
 */
export async function POST(req: Request) {
  let body: { url?: string; demoId?: string; brand?: string; market?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Malformed request body." }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const run: Run = {
        id: newRunId(),
        createdAt: new Date().toISOString(),
        url: "",
        brand: (body.brand ?? "").trim() || "Unnamed brand",
        market: (body.market ?? "").trim() || "UK",
        steps: blankSteps(),
      };

      send({ type: "run", id: run.id, brand: run.brand, market: run.market });

      // ---------- fetch ----------
      send({ type: "step", id: "ingest", state: "running" });
      const t0 = performance.now();
      let html = "";
      try {
        if (body.demoId) {
          const demo = DEMO_PAGES.find((d) => d.id === body.demoId);
          if (!demo) throw new IngestError(`Unknown demo page "${body.demoId}".`, "invalid_url");
          html = readFileSync(join(process.cwd(), demo.file), "utf8");
          run.url = demo.label;
          run.demoId = demo.id;
          send({
            type: "check",
            group: "ingest",
            name: "Load bundled page",
            what: `${demo.file} · ${html.length.toLocaleString("en-US")} bytes`,
            ms: +(performance.now() - t0).toFixed(1),
          });
        } else {
          const url = normaliseUrl(body.url ?? "");
          run.url = url.toString();
          send({ type: "check", group: "ingest", name: "Resolve and validate URL", what: url.toString(), ms: +(performance.now() - t0).toFixed(1) });
          const tf = performance.now();
          const page = await fetchPage(run.url);
          html = page.html;
          send({
            type: "check",
            group: "ingest",
            name: "Fetch over the network",
            what: `HTTP ${page.status} · ${page.bytes.toLocaleString("en-US")} bytes from ${new URL(page.finalUrl).hostname}`,
            ms: +(performance.now() - tf).toFixed(1),
          });
        }
      } catch (e) {
        const msg = e instanceof IngestError ? e.message : (e as Error).message;
        send({ type: "step", id: "ingest", state: "failed", error: msg });
        send({ type: "error", error: msg });
        controller.close();
        return;
      }

      const tp = performance.now();
      const page: ParsedPage = parse(html, run.url);
      send({
        type: "check",
        group: "ingest",
        name: "Parse the document",
        what: `${page.wordCount.toLocaleString("en-US")} words · ${page.sections.length} sections · ${page.headings.length} headings · ${page.jsonLd.length} JSON-LD block(s)`,
        ms: +(performance.now() - tp).toFixed(1),
      });

      run.html = html;
      run.ingest = {
        finalUrl: run.url,
        status: 200,
        bytes: html.length,
        fetchedAt: new Date().toISOString(),
        source: body.demoId ? "demo" : "live",
        title: page.title,
        words: page.wordCount,
        sections: page.sections.length,
        jsonLdTypes: page.jsonLd.map((b) => String(b["@type"] ?? "?")),
        author: page.author,
        published: page.publishedDate,
        modified: page.modifiedDate,
      };
      run.steps.ingest = {
        state: "done",
        endedAt: new Date().toISOString(),
        note: `${page.wordCount.toLocaleString("en-US")} words, ${page.sections.length} sections, ${
          page.jsonLd.length ? `${page.jsonLd.length} JSON-LD block(s)` : "no structured data"
        }`,
      };
      send({ type: "step", id: "ingest", state: "done", note: run.steps.ingest.note });

      // ---------- crawler access: verifiable by the client in their own robots.txt ----------
      if (!body.demoId) {
        const ta = performance.now();
        const access = await checkCrawlerAccess(run.url);
        run.access = access;
        send({
          type: "check",
          group: "access",
          name: "Read robots.txt",
          what: access.error
            ? access.error
            : `${access.robotsUrl} · HTTP ${access.status} · ${access.verdicts.length} AI crawlers evaluated`,
          ms: +(performance.now() - ta).toFixed(1),
        });
        for (const v of access.verdicts) {
          send({
            type: "access",
            ua: v.ua,
            operator: v.operator,
            feeds: v.feeds,
            allowed: v.allowed,
            rule: v.rule,
            group: v.group,
            robotsUrl: access.robotsUrl,
          });
        }
        if (access.blocked.length) {
          send({ type: "patch", kind: "robots", filename: "robots-patch.txt", content: access.patch ?? "" });
        }
      }

      // ---------- score, one check at a time ----------
      send({ type: "step", id: "score", state: "running" });

      const words = page.sections.flatMap((s) => s.paragraphs).join(" ").split(/\s+/).filter(Boolean).length;
      const subs = page.headings.filter((h) => h.level === 2 || h.level === 3).length;
      const paras = page.sections.flatMap((s) => s.paragraphs).length;

      const checks: { key: string; run: () => FactorResult; inspected: string }[] = [
        { key: "crawlability", run: () => crawlability(page), inspected: `robots meta · ${page.wordCount.toLocaleString("en-US")} server-rendered words · <title>` },
        { key: "answerStructure", run: () => answerStructure(page), inspected: `${subs} H2/H3 headings · ${paras} passages` },
        { key: "sourcedQuotes", run: () => sourcedQuotes(page), inspected: `${page.blockquotes.length} blockquote(s) · ${words.toLocaleString("en-US")} words scanned for attributions` },
        { key: "factualSpecificity", run: () => factualSpecificity(page), inspected: `${words.toLocaleString("en-US")} words scanned for figures, units and percentages` },
        { key: "freshness", run: () => freshness(page, new Date()), inspected: `JSON-LD dates · meta article:* · <time datetime>` },
        { key: "offSiteAuthority", run: () => offSiteAuthority(page), inspected: `byline · JSON-LD sameAs · ${page.outboundLinks.length} outbound link(s)` },
        { key: "fanoutCoverage", run: () => fanoutCoverage(page), inspected: `${page.headings.filter((h) => h.level === 2).length} H2 sections · heading vocabulary` },
        { key: "googleRank", run: () => googleRank(page, undefined), inspected: `no SERP position supplied for this run` },
        { key: "schemaValidity", run: () => schemaValidity(page), inspected: `${page.jsonLd.length} JSON-LD block(s) · required-field check` },
      ];

      const results: FactorResult[] = [];
      for (const c of checks) {
        const t = performance.now();
        const r = c.run();
        const ms = +(performance.now() - t).toFixed(2);
        results.push(r);
        const cfg = FACTORS.find((f) => f.key === c.key);
        send({
          type: "factor",
          key: r.key,
          name: r.name.replace(/\s*\(.*\)$/, ""),
          score: r.score,
          weight: cfg ? cfg.weight : null,
          gate: !cfg,
          partial: r.partial ?? false,
          inspected: c.inspected,
          evidence: r.evidence,
          reasoning: r.reasoning,
          source: cfg?.source ?? GATE_FACTOR.source,
          ms,
        });
        // yield to the event loop so the client paints each check as it lands
        await new Promise((r2) => setTimeout(r2, 0));
      }

      const byKey = new Map(results.map((r) => [r.key, r]));
      const gate = byKey.get("crawlability")!;
      const weighted = FACTORS.reduce((s, c) => s + c.weight * (byKey.get(c.key)?.score ?? 0), 0);
      const gated = gate.score === 0;
      const overall = gated ? 0 : Math.round(weighted);
      const grade = overall >= 75 ? "cited" : overall >= 55 ? "likely" : overall >= 35 ? "at-risk" : "invisible";
      const weakest = FACTORS.map((c) => ({ f: byKey.get(c.key)!, impact: (100 - byKey.get(c.key)!.score) * c.weight }))
        .filter((x) => x.f.score < 70)
        .sort((a, b) => b.impact - a.impact)
        .map((x) => x.f);

      run.audit = { overall, grade, gated, factors: results, weakest };
      const zeros = results.filter((f) => f.score === 0).length;
      const lostWeight = Math.round(
        FACTORS.filter((c) => (byKey.get(c.key)?.score ?? 0) === 0).reduce((s, c) => s + c.weight, 0) * 100,
      );
      run.steps.score = {
        state: "done",
        endedAt: new Date().toISOString(),
        note: `${overall}/100 · ${grade}${zeros ? ` · ${zeros} at zero carrying ${lostWeight}%` : ""}`,
      };
      send({ type: "step", id: "score", state: "done", note: run.steps.score.note });

      const totalMs = +(performance.now() - t0).toFixed(1);
      send({ type: "summary", overall, grade, gated, zeros, lostWeight, totalMs, checks: checks.length + 3 });

      try {
        saveRun(run);
      } catch (e) {
        console.error("saveRun failed:", (e as Error).message);
      }

      const { html: _h, fixedHtml: _f, ...clean } = run;
      void _h;
      void _f;
      send({ type: "done", run: clean });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
