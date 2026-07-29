import { buildBundle } from "../../../lib/bundle";
import { getRun } from "../../../lib/db";
import { getMap } from "../../../lib/mapdb";
import type { Run } from "../../../lib/types";

export const runtime = "nodejs";

/**
 * The same download, from a run the client posts back.
 *
 * The GET below reads the run by id, which needs a server that still holds it. A hosted
 * build gives each request a fresh instance, so on the deployed app every download link
 * answered `No run on file` while the files were sitting on screen. Posting the run is
 * the same pattern the panel bundle already uses, and it has the better property: the
 * bytes always match what the user is looking at.
 */
export async function POST(req: Request) {
  let body: { run?: Run };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }
  if (!body.run?.id) return Response.json({ error: "No run to bundle." }, { status: 400 });

  const { buffer } = buildBundle({ run: body.run, map: null });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="cited-${body.run.id}-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}

/** One download. Everything the run produced, nothing it did not. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("run");
  const mapId = url.searchParams.get("map");

  const run = runId ? getRun(runId) : null;
  const map = mapId ? getMap(mapId) : null;
  if (runId && !run) return Response.json({ error: `No run ${runId} on file.` }, { status: 404 });
  if (mapId && !map) return Response.json({ error: `No map ${mapId} on file.` }, { status: 404 });
  if (!run && !map) return Response.json({ error: "Nothing to bundle. Run an audit or a map first." }, { status: 400 });

  const { buffer } = buildBundle({ run, map });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="cited-${map?.brandDomain ?? run?.id ?? "bundle"}-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}
