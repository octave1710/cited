import { buildBundle } from "../../../lib/bundle";
import { getRun } from "../../../lib/db";
import { getMap } from "../../../lib/mapdb";

export const runtime = "nodejs";

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
