import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../../../../engine/parse";
import { getRun, saveRun } from "../../../../../lib/db";
import { markDone, markFailed, markRunning, stripHtml } from "../../../../../lib/run-helpers";
import { getLLM } from "../../../../../adapters/llm";
import { fanout, userQueries } from "../../../../../querylab/fanout";
import { toLabDoc } from "../../../../../querylab/detect";
import { runLab } from "../../../../../querylab/run";

export const runtime = "nodejs";
export const maxDuration = 120;

const COMPETITORS = ["fixtures/pages/competitor-1.html", "fixtures/pages/competitor-2.html"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });
  if (!run.html) return NextResponse.json({ error: "This run has no stored page." }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as { topic?: string; queries?: string[] };
  const topic = (body.topic ?? "").trim() || guessTopic(run.url);

  markRunning(run, "querylab");
  try {
    const queries = body.queries?.length ? userQueries(body.queries) : fanout(topic);
    const target = toLabDoc("this page", parse(run.html, run.url));
    const competitors = COMPETITORS.map((f, i) =>
      toLabDoc(`competitor ${i + 1}`, parse(readFileSync(join(process.cwd(), f), "utf8"))),
    );

    const llm = getLLM();
    const lab = await runLab(target, competitors, queries, llm);
    run.lab = lab;
    markDone(run, "querylab", `${lab.citedCount}/${lab.total} queries cite this page · ${llm.label}`);
    saveRun(run);
    return NextResponse.json({ run: stripHtml(run) });
  } catch (e) {
    const msg = (e as Error).message;
    markFailed(run, "querylab", msg);
    saveRun(run);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function guessTopic(url: string): string {
  const last = url.split("/").filter(Boolean).pop() ?? "";
  return last.replace(/[-_]+/g, " ").replace(/\.html?$/, "").trim() || "the page topic";
}
