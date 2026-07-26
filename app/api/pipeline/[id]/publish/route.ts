import { NextResponse } from "next/server";
import { GateError, publish } from "../../../../../pipeline/run";
import { getPipeline, savePipeline } from "../../../../../lib/pipedb";

export const runtime = "nodejs";

/**
 * The bypass attempt. Exists so the refusal can be demonstrated: calling publish
 * directly, without approvals, returns 409 because the gate lives in the domain
 * logic and not in the interface.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getPipeline(id);
  if (!run) return NextResponse.json({ error: `No pipeline "${id}".` }, { status: 404 });

  try {
    const done = publish(run);
    savePipeline(done);
    return NextResponse.json({ run: done, published: true });
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message, blocked: true }, { status: 409 });
    throw e;
  }
}
