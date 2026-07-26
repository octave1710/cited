import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../../../../engine/parse";
import { audit } from "../../../../../engine/score";
import { generateFixes } from "../../../../../engine/fixes";
import { applyFixes, type SuppliedFacts } from "../../../../../engine/apply";
import { getRun, saveRun } from "../../../../../lib/db";
import { markDone, markFailed, markRunning, stripHtml } from "../../../../../lib/run-helpers";
import { getLLM } from "../../../../../adapters/llm";
import { fanout } from "../../../../../querylab/fanout";
import { toLabDoc } from "../../../../../querylab/detect";
import { runLab } from "../../../../../querylab/run";

export const runtime = "nodejs";
export const maxDuration = 120;

const COMPETITORS = ["fixtures/pages/competitor-1.html", "fixtures/pages/competitor-2.html"];

/** Facts the client supplied. Never generated here: read from disk, keyed by demo page. */
function suppliedFor(demoId?: string): SuppliedFacts {
  if (!demoId) return {};
  try {
    const all = JSON.parse(readFileSync(join(process.cwd(), "fixtures/supplied-facts.json"), "utf8")) as Record<
      string,
      SuppliedFacts
    >;
    return all[demoId] ?? {};
  } catch {
    return {};
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });
  if (!run.html) return NextResponse.json({ error: "This run has no stored page." }, { status: 409 });
  if (!run.lab) {
    return NextResponse.json(
      { error: "Run the citation test first, otherwise there is no before to compare against." },
      { status: 409 },
    );
  }

  markRunning(run, "retest");
  try {
    const page = parse(run.html, run.url);
    const before = run.audit ?? audit(page);
    const fixes = run.fixes ?? generateFixes(page, before);

    const supplied = suppliedFor(run.demoId);
    const result = applyFixes(run.html, page, fixes, supplied);
    run.fixedHtml = result.html;

    const fixedPage = parse(result.html, run.url);
    const after = audit(fixedPage);

    const llm = getLLM();
    const queries = fanout(guessTopic(run.url));
    const target = toLabDoc("this page", fixedPage);
    const competitors = COMPETITORS.map((f, i) =>
      toLabDoc(`competitor ${i + 1}`, parse(readFileSync(join(process.cwd(), f), "utf8"))),
    );
    const lab = await runLab(target, competitors, queries, llm);

    run.retest = lab;
    run.applied = result.applied;
    run.skipped = result.skipped;
    run.scoreAfter = after.overall;

    markDone(
      run,
      "retest",
      `${run.lab.citedCount}/${run.lab.total} → ${lab.citedCount}/${lab.total} cited · score ${before.overall} → ${after.overall}`,
    );
    saveRun(run);
    return NextResponse.json({ run: stripHtml(run) });
  } catch (e) {
    const msg = (e as Error).message;
    markFailed(run, "retest", msg);
    saveRun(run);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function guessTopic(url: string): string {
  const last = url.split("/").filter(Boolean).pop() ?? "";
  return last.replace(/[-_]+/g, " ").replace(/\.html?$/, "").trim() || "the page topic";
}
