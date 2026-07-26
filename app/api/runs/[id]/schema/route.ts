import { NextResponse } from "next/server";
import { parse, generateSchemas } from "../../../../../engine/index";
import { getRun, saveRun } from "../../../../../lib/db";
import { markDone, markFailed, markRunning, stripHtml } from "../../../../../lib/run-helpers";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });
  if (!run.html) return NextResponse.json({ error: "This run has no stored page." }, { status: 409 });

  markRunning(run, "schema");
  try {
    const { blocks, warnings } = generateSchemas(parse(run.html, run.url));
    run.schema = { blocks: blocks as unknown[], warnings };
    const types = blocks.map((b) => String((b as unknown as Record<string, unknown>)["@type"]));
    markDone(run, "schema", `${types.join(" + ")} generated${warnings.length ? ` · ${warnings.length} warning` : ""}`);
    saveRun(run);
    return NextResponse.json({ run: stripHtml(run) });
  } catch (e) {
    markFailed(run, "schema", (e as Error).message);
    saveRun(run);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
