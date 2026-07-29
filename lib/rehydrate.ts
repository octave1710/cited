import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_PAGES, fetchPage } from "../engine/ingest";
import { getRun, saveRun } from "./db";
import type { Run } from "./types";

/**
 * Find the run this request is about, on a runtime that keeps nothing between requests.
 *
 * The audit is a chain: score, then fix plan, then schema, then the citation test, then
 * apply and re-test. Each link was a separate POST that read the run the previous POST
 * had stored. That holds locally, where one process serves every request, and breaks on
 * a hosted build, where each request can land on a fresh instance with an empty store.
 * The observed failure was `No run "rms675s0fx3"` on the third click, which is the click
 * that produces the deliverable.
 *
 * So the client carries the run and posts it back, and the server treats its own store
 * as a cache rather than the source. The one thing the client does not hold is the raw
 * page, deliberately, so it is restored here from wherever it came from: a bundled
 * fixture is read off disk, a live URL is fetched again, and pasted source is sent back
 * up by the only party that has it.
 */
export async function resolveRun(id: string, body: { run?: Run; html?: string }): Promise<Run | null> {
  const stored = getRun(id);
  if (stored?.html) return stored;

  const posted = body.run;
  if (!posted || posted.id !== id) return stored;

  // a stored run without a page is of no use here, and the posted one is the fresher state
  const run: Run = { ...posted, html: await pageOf(posted, body.html) };
  saveRun(run);
  return run;
}

async function pageOf(run: Run, posted?: string): Promise<string | undefined> {
  if (run.demoId) {
    const demo = DEMO_PAGES.find((d) => d.id === run.demoId);
    if (demo) {
      try {
        return readFileSync(join(process.cwd(), demo.file), "utf8");
      } catch {
        /* fall through to the other routes */
      }
    }
  }

  // pasted source: the client is the only holder, and the stream route already accepts it
  if (posted?.trim()) return posted.slice(0, 4_000_000);

  if (/^https?:\/\//i.test(run.url)) {
    try {
      return (await fetchPage(run.url)).html;
    } catch {
      return undefined;
    }
  }

  return undefined;
}
