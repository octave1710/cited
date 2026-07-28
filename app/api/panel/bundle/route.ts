import { buildBoard } from "../../../../engines/board";
import { buildGeoBundle } from "../../../../engines/assets";
import { teardownFromCitations } from "../../../../engines/why";
import type { PanelRun } from "../../../../engines/types";

export const runtime = "nodejs";

/**
 * The panel leaves as files. The client is posted back the run they are looking at
 * rather than a run id, so nothing has to be persisted for a download to work and the
 * bytes always match what is on screen.
 */
export async function POST(req: Request) {
  let body: { run?: PanelRun; target?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }
  const run = body.run;
  if (!run?.questions?.length) return Response.json({ error: "No panel to export." }, { status: 400 });

  try {
    const board = buildBoard(run.questions, run.brandDomain);
    const target = body.target ?? board.rows.find((r) => !r.isBrand)?.domain;
    const teardown = target ? teardownFromCitations(board, run.questions, target) : undefined;
    const { name, bytes } = buildGeoBundle({ panel: run, board, teardown });

    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
