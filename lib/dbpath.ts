import { mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { tmpdir } from "node:os";

/**
 * Where the database can actually be written.
 *
 * The configured path is `./data/cited.db`, which is correct locally and impossible on a
 * hosted build: a serverless filesystem is read-only except for the system temp
 * directory, so `mkdirSync("./data")` threw and every pipeline request answered 500.
 *
 * So the configured path is tried first and the temp directory is the fallback. On a
 * hosted build that means the database is per-instance and does not survive, which is
 * exactly right for a demo where nothing needs to persist and nothing should silently
 * fail. Locally the behaviour is unchanged.
 */
export function writableDbPath(configured: string): string {
  try {
    mkdirSync(dirname(configured), { recursive: true });
    return configured;
  } catch {
    const fallback = join(tmpdir(), basename(configured));
    // if the temp directory is not writable either there is nothing left to try, and
    // throwing here is better than handing back a path that fails on first write
    mkdirSync(dirname(fallback), { recursive: true });
    return fallback;
  }
}
