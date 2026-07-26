import { NextResponse } from "next/server";
import { getRun } from "../../../../lib/db";
import { stripHtml } from "../../../../lib/run-helpers";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const run = getRun(id);
    if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });
    return NextResponse.json({ run: stripHtml(run) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
