import { NextResponse } from "next/server";
import { parse, generateFixes, audit } from "../../../../../engine/index";
import { needsSuppliedFact } from "../../../../../engine/fixes";
import { getRun, saveRun } from "../../../../../lib/db";
import { markDone, markFailed, markRunning, stripHtml } from "../../../../../lib/run-helpers";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });
  if (!run.html) return NextResponse.json({ error: "This run has no stored page." }, { status: 409 });

  markRunning(run, "fixes");
  try {
    const page = parse(run.html, run.url);
    const result = run.audit ?? audit(page);
    run.audit = result;
    run.fixes = generateFixes(page, result);
    const slots = run.fixes.filter((f) => needsSuppliedFact(f.after)).length;
    markDone(
      run,
      "fixes",
      `${run.fixes.length} rewrites ranked by impact × ease${slots ? ` · ${slots} need a fact you supply` : ""}`,
    );
    saveRun(run);
    return NextResponse.json({ run: stripHtml(run) });
  } catch (e) {
    markFailed(run, "fixes", (e as Error).message);
    saveRun(run);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
