import { NextResponse } from "next/server";
import { buildFactRequests, readFilledSheet, toSuppliedFacts } from "../../../../../engine/factRequest";
import { getRun, saveRun } from "../../../../../lib/db";
import { stripHtml } from "../../../../../lib/run-helpers";

export const runtime = "nodejs";

const MAX_SHEET_BYTES = 512_000;

/**
 * Takes the filled fact sheet back and stores what the client actually answered.
 * Nothing is inferred: a blank answer stays blank, and the count of rows that were
 * left empty is reported so the refusals stay visible rather than quietly resolved.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: `No run "${id}".` }, { status: 404 });
  if (!run.fixes?.length) {
    return NextResponse.json({ error: "Generate the fix plan first, otherwise there is nothing to ask about." }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { csv?: string };
  const sheet = typeof body.csv === "string" ? body.csv : "";
  if (!sheet.trim()) return NextResponse.json({ error: "Paste or upload the filled facts-needed.csv." }, { status: 400 });
  if (sheet.length > MAX_SHEET_BYTES) {
    return NextResponse.json({ error: "That sheet is larger than 500 KB and was not read." }, { status: 413 });
  }

  const requests = buildFactRequests(run.fixes);
  const filled = readFilledSheet(sheet);
  if (!filled.length) {
    return NextResponse.json(
      { error: "No rows read. The sheet needs its original header row, including the id and your_answer columns." },
      { status: 400 },
    );
  }

  const supplied = toSuppliedFacts(requests, filled);
  const answered = (supplied.claims?.length ?? 0) + (supplied.author ? 1 : 0) + (supplied.quote ? 1 : 0);

  run.supplied = supplied;
  saveRun(run);

  return NextResponse.json({
    run: stripHtml(run),
    asked: requests.length,
    answered,
    stillEmpty: requests.length - answered,
  });
}
