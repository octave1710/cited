import { NextResponse } from "next/server";
import type { PipelineRun } from "../../../../../pipeline/run";
import { GateError, publish } from "../../../../../pipeline/run";
import { getPipeline, savePipeline } from "../../../../../lib/pipedb";

export const runtime = "nodejs";

/** Records one named approval per market. Publishing is attempted only when all are in. */
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

  const market = ((body.market as string) ?? "").toUpperCase();
  const approvedBy = ((body.approvedBy as string) ?? "").trim();

  if (!market || !run.markets.includes(market)) {
    return NextResponse.json({ error: `"${market}" is not a market in this run.` }, { status: 400 });
  }
  if (!approvedBy) {
    return NextResponse.json(
      { error: "An approval needs a name. Anonymous sign-off is not an approval." },
      { status: 400 },
    );
  }

  /**
   * The score floor was computed, printed in the gate note, and never enforced: a named
   * person could sign a market scoring 20 out of 100 and nothing objected. The human
   * still has the authority, which is the point of the gate, but signing off something
   * below the bar is now a deliberate act with a recorded reason rather than the default.
   */
  const plan = run.plans.find((p) => p.market === market);
  const belowFloor = plan ? plan.score < 55 : false;
  const flaggedOriginality = plan?.originality?.needsReview ?? false;
  if ((belowFloor || flaggedOriginality) && !(body.override as boolean | undefined)) {
    return NextResponse.json(
      {
        error:
          `${market} ` +
          (belowFloor ? `scores ${plan?.score}/100, under the 55 minimum. ` : "") +
          (flaggedOriginality ? `The originality check flagged it: ${plan?.originality?.reasons.join(" ")} ` : "") +
          `Approving it anyway needs override:true and a note saying why, which is stored with your name.`,
        needsOverride: true,
        market,
        score: plan?.score ?? null,
      },
      { status: 409 },
    );
  }
  if ((belowFloor || flaggedOriginality) && !((body.note as string | undefined) ?? "").trim()) {
    return NextResponse.json(
      { error: "An override needs a reason. It is stored with your name and travels to the CMS payload." },
      { status: 400 },
    );
  }

  run.decisions = [
    ...run.decisions.filter((d) => d.market !== market),
    {
      market,
      approvedBy,
      at: new Date().toISOString(),
      note: (body.override as boolean | undefined) ? `OVERRIDE: ${(body.note as string | undefined)}` : (body.note as string | undefined),
    },
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
