import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, audit } from "../../../engine/index";
import { fetchPage, IngestError, DEMO_PAGES, normaliseUrl } from "../../../engine/ingest";
import { listRuns, newRunId, saveRun } from "../../../lib/db";
import { blankSteps, type Run } from "../../../lib/types";
import { stripHtml } from "../../../lib/run-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ runs: listRuns() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { url?: string; demoId?: string; brand?: string; market?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const brand = (body.brand ?? "").trim() || "Meridian Skin Lab";
  const market = (body.market ?? "").trim() || "UK";

  const run: Run = {
    id: newRunId(),
    createdAt: new Date().toISOString(),
    url: "",
    brand,
    market,
    steps: blankSteps(),
  };

  // ---- step 1: ingest
  run.steps.ingest = { state: "running", startedAt: new Date().toISOString() };
  let html: string;
  try {
    if (body.demoId) {
      const demo = DEMO_PAGES.find((d) => d.id === body.demoId);
      if (!demo) return NextResponse.json({ error: `Unknown demo page "${body.demoId}".` }, { status: 400 });
      html = readFileSync(join(process.cwd(), demo.file), "utf8");
      run.url = demo.label;
      run.demoId = demo.id;
      run.ingest = {
        finalUrl: demo.label,
        status: 200,
        bytes: html.length,
        fetchedAt: new Date().toISOString(),
        source: "demo",
        title: "",
        words: 0,
        sections: 0,
        jsonLdTypes: [],
      };
    } else {
      const url = normaliseUrl(body.url ?? "");
      run.url = url.toString();
      const page = await fetchPage(run.url);
      html = page.html;
      run.ingest = {
        finalUrl: page.finalUrl,
        status: page.status,
        bytes: page.bytes,
        fetchedAt: page.fetchedAt,
        source: "live",
        title: "",
        words: 0,
        sections: 0,
        jsonLdTypes: [],
      };
    }
  } catch (e) {
    const err = e instanceof IngestError ? e : new Error((e as Error).message);
    run.steps.ingest = {
      state: "failed",
      endedAt: new Date().toISOString(),
      error: err.message,
    };
    return NextResponse.json(
      { error: err.message, code: e instanceof IngestError ? e.code : "unknown", demoAvailable: true },
      { status: 422 },
    );
  }

  const page = parse(html, run.url);
  run.html = html;
  run.ingest = {
    ...run.ingest!,
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
    note: `${page.wordCount} words, ${page.sections.length} sections, ${
      page.jsonLd.length ? page.jsonLd.length + " JSON-LD block(s)" : "no structured data"
    }`,
  };

  // ---- step 2: score
  run.steps.score = { state: "running", startedAt: new Date().toISOString() };
  run.audit = audit(page);
  const zeros = run.audit.factors.filter((f) => f.score === 0).length;
  run.steps.score = {
    state: "done",
    endedAt: new Date().toISOString(),
    note: `${run.audit.overall}/100 · ${run.audit.grade}${zeros ? ` · ${zeros} factors at zero` : ""}`,
  };

  try {
    saveRun(run);
  } catch (e) {
    // persistence must never take the run down
    console.error("saveRun failed:", (e as Error).message);
  }

  return NextResponse.json({ run: stripHtml(run) });
}
