import { NextResponse } from "next/server";
import type { PipelineRun } from "../../../../../pipeline/run";
import { GateError, publish } from "../../../../../pipeline/run";
import { getPipeline, savePipeline } from "../../../../../lib/pipedb";

export const runtime = "nodejs";

/**
 * The bypass attempt. Exists so the refusal can be demonstrated: calling publish
 * directly, without approvals, returns 409 because the gate lives in the domain
 * logic and not in the interface.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  /**
   * The stored run first, and the one the client is holding as the fallback.
   *
   * A hosted build gives a fresh instance per request, so a run kept in memory on the
   * instance that created it is gone by the time this call lands and the chain answered
   * 404. The client has the run on screen, so it sends it back and the gate logic is
   * unchanged either way.
   */
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const run = getPipeline(id) ?? ((body.run as PipelineRun | undefined) ?? null);
  if (!run || run.id !== id) {
    return NextResponse.json({ error: `No pipeline "${id}". Re-run it, or send the run in the body.` }, { status: 404 });
  }

  try {
    const done = publish(run);
    savePipeline(done);
    return NextResponse.json({ run: done, published: true });
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message, blocked: true }, { status: 409 });
    throw e;
  }
}
