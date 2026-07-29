import { NextResponse } from "next/server";
import { productionTruth } from "../../../../../adapters/profound";
import { saveRun } from "../../../../../lib/db";
import { resolveRun } from "../../../../../lib/rehydrate";
import { markDone, markFailed, markRunning, stripHtml } from "../../../../../lib/run-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await resolveRun(id, await req.json().catch(() => ({})));
  if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });

  markRunning(run, "truth");
  try {
    let domain = run.url;
    let path = "/";
    try {
      const u = new URL(run.url.startsWith("http") ? run.url : `https://${run.url}`);
      domain = u.hostname;
      path = u.pathname;
    } catch {
      /* demo labels are not URLs; keep the label as the domain */
    }

    const truth = await productionTruth({ domain, path, markets: [run.market, "UK", "SE", "DK"] });
    run.truth = truth;

    const blind = truth.bots.filter((b) => b.thisPath === 0);
    markDone(
      run,
      "truth",
      truth.mode === "live"
        ? `${truth.bots.length} bots seen on the domain · ${blind.length} never fetched this path`
        : `fixtures · ${truth.degradedReason}`,
    );
    saveRun(run);
    return NextResponse.json({ run: stripHtml(run) });
  } catch (e) {
    markFailed(run, "truth", (e as Error).message);
    saveRun(run);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
