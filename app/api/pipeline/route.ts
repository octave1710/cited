import { NextResponse } from "next/server";
import { runToGate } from "../../../pipeline/run";
import { newPipelineId, savePipeline } from "../../../lib/pipedb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { topic?: string; markets?: string[]; brand?: string };
  const topic = (body.topic ?? "").trim() || "vitamin c serum";
  const markets = (body.markets?.length ? body.markets : ["UK", "SE", "DK"]).map((m) => m.toUpperCase());
  const brand = (body.brand ?? "").trim() || "The Ordinary";

  if (markets.length > 6) {
    return NextResponse.json({ error: "Volume cap: six markets per run." }, { status: 400 });
  }

  const run = runToGate({ id: newPipelineId(), topic, markets, brand });
  savePipeline(run);
  return NextResponse.json({ run });
}
