import { NextResponse } from "next/server";
import { GateError, publish } from "../../../../../pipeline/run";
import { getPipeline, savePipeline } from "../../../../../lib/pipedb";

export const runtime = "nodejs";

/** Records one named approval per market. Publishing is attempted only when all are in. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getPipeline(id);
  if (!run) return NextResponse.json({ error: `No pipeline "${id}".` }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { market?: string; approvedBy?: string; note?: string };
  const market = (body.market ?? "").toUpperCase();
  const approvedBy = (body.approvedBy ?? "").trim();

  if (!market || !run.markets.includes(market)) {
    return NextResponse.json({ error: `"${market}" is not a market in this run.` }, { status: 400 });
  }
  if (!approvedBy) {
    return NextResponse.json(
      { error: "An approval needs a name. Anonymous sign-off is not an approval." },
      { status: 400 },
    );
  }

  run.decisions = [
    ...run.decisions.filter((d) => d.market !== market),
    { market, approvedBy, at: new Date().toISOString(), note: body.note },
  ];

  const pending = run.markets.filter((m) => !run.decisions.some((d) => d.market === m));
  if (pending.length) {
    run.nodes.gate = { state: "blocked", note: `${run.decisions.length}/${run.markets.length} approved · waiting on ${pending.join(", ")}` };
    savePipeline(run);
    return NextResponse.json({ run, published: false, pending });
  }

  try {
    const done = publish(run);
    savePipeline(done);
    return NextResponse.json({ run: done, published: true, pending: [] });
  } catch (e) {
    if (e instanceof GateError) {
      savePipeline(run);
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
