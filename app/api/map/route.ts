import { compareMaps } from "../../../citationmap/compare";
import { getMap, listMaps, previousMapFor } from "../../../lib/mapdb";

export const runtime = "nodejs";

/**
 * GET /api/map                 the history rail
 * GET /api/map?id=<id>         one map, reopened
 * GET /api/map?id=<id>&delta=1 that map against the previous run of the same category,
 *                              brand and market. Absent baseline is reported, never faked.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return Response.json({ maps: listMaps() });

  const map = getMap(id);
  if (!map) return Response.json({ error: `No map ${id} on file.` }, { status: 404 });

  if (url.searchParams.get("delta") !== "1") return Response.json({ map });

  const before = previousMapFor(map);
  return Response.json({
    map,
    delta: before ? compareMaps(before, map) : null,
    noBaselineReason: before
      ? undefined
      : `This is the first run on "${map.topic}" for ${map.brandDomain} in ${map.market}. A delta needs two.`,
  });
}
