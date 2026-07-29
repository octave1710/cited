import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildBoard, primaryTarget } from "../../../../engines/board";
import { teardownFromCitations } from "../../../../engines/why";
import type { PanelRun } from "../../../../engines/types";

export const runtime = "nodejs";

const FILE = "fixtures/engines/demo-panel.json";

/**
 * The same run, served in under a second.
 *
 * A live panel is eight questions across six engines and it takes five minutes and
 * eighteen seconds, measured. That is fine when you are working and impossible when three
 * people are watching you on a call: it failed exactly there, and the honest reading is
 * that a five minute wait IS a failure regardless of what the server eventually returns.
 *
 * So the recorded run is a real run, kept whole. Same questions, same six engines, same
 * 438 citations, $0.2285 actually spent on 2026-07-29. It is not a mock and it is not a
 * fixture invented to look good, it is one afternoon's measurement frozen. The screen
 * says RECORDED PANEL rather than MEASURED LIVE so nobody can mistake one for the other,
 * and the live button is still right there for anyone who wants to watch it happen.
 *
 * The board and the teardown are recomputed from the stored citations rather than stored
 * alongside them, so a change to the scoring rules shows up here too instead of this
 * quietly serving yesterday's arithmetic.
 */
export function GET() {
  const path = join(process.cwd(), FILE);
  if (!existsSync(path)) {
    return Response.json(
      { error: `No recorded panel at ${FILE}. Run one live and it will be saved.` },
      { status: 404 },
    );
  }

  try {
    const stored = JSON.parse(readFileSync(path, "utf8")) as { run: PanelRun; allQuestions?: string[] };
    const run: PanelRun = { ...stored.run, source: "recorded" };
    const board = buildBoard(run.questions, run.brandDomain);
    const target = primaryTarget(board);
    const teardown = target ? teardownFromCitations(board, run.questions, target.domain) : null;

    return Response.json(
      { run, board, teardown, target: target?.domain ?? null, allQuestions: stored.allQuestions ?? [] },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: `The recorded panel could not be read: ${(e as Error).message}` }, { status: 500 });
  }
}
