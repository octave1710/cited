import { csv, zip, type ZipEntry } from "./zip";
import type { Run } from "./types";
import type { CitationMap } from "../citationmap/types";
import { BUCKET_LABEL } from "../citationmap/types";

/**
 * The bundle is the point of the tool: the client leaves with files they can ship,
 * not a report. Nothing is included that was not actually produced by a run, so a
 * thin bundle is an honest bundle.
 */
export function buildBundle(input: { run?: Run | null; map?: CitationMap | null }): { entries: ZipEntry[]; buffer: Buffer } {
  const { run, map } = input;
  const entries: ZipEntry[] = [];
  const manifest: string[] = [];

  const add = (name: string, content: string, note: string) => {
    entries.push({ name, content });
    manifest.push(`${name}\n    ${note}`);
  };

  if (map) {
    add(
      "citation-map.csv",
      csv([
        ["question", "intent", "status", "cited_first", "all_cited_domains", "your_rank"],
        ...map.questions.map((q) => [
          q.text,
          q.intent,
          BUCKET_LABEL[q.bucket],
          q.owner ?? "",
          q.domains.join(" | "),
          q.brandRank || "",
        ]),
      ]),
      `${map.questions.length} questions on "${map.topic}". Retype any of them into ChatGPT to check the row.`,
    );

    add(
      "unclaimed-questions.csv",
      csv([
        ["question", "intent"],
        ...map.questions.filter((q) => q.bucket === "open").map((q) => [q.text, q.intent]),
      ]),
      `${map.counts.open} questions where the engine names no site. One brief each.`,
    );
  }

  if (run?.fixedHtml) {
    add("corrected.html", run.fixedHtml, "Your page with the structural fixes applied. Diff it before shipping.");
  }

  if (run?.schema?.blocks?.length) {
    add(
      "schema.jsonld",
      JSON.stringify(run.schema.blocks.length === 1 ? run.schema.blocks[0] : run.schema.blocks, null, 2),
      "Paste inside a <script type=\"application/ld+json\"> tag in the page head.",
    );
  }

  if (run?.access?.patch) {
    add("robots-patch.txt", run.access.patch, `Append to robots.txt. ${run.access.blocked.length} AI crawler(s) are blocked today.`);
  }

  if (run?.fixes?.length) {
    add(
      "fix-plan.csv",
      csv([
        ["rank", "factor", "title", "why", "before", "after", "needs_a_fact_you_supply"],
        ...[...run.fixes]
          .sort((a, b) => b.priority - a.priority)
          .map((f, i) => [
            i + 1,
            f.factorKey,
            f.title,
            f.rationale,
            f.before,
            f.after,
            /\[[A-Z ]+\]/.test(f.after) ? "yes" : "no",
          ]),
      ]),
      `${run.fixes.length} rewrites, ranked by impact times ease. Rows marked yes are left blank on purpose.`,
    );
  }

  // conditional lines are dropped by identity, so the blank lines that carry the
  // paragraph rhythm survive the filter
  const SKIP = Symbol();
  const readme = ([
    "CITED, artefact bundle",
    `Generated ${new Date().toISOString()}`,
    run ? `Audit run ${run.id} on ${run.url}` : SKIP,
    map ? `Citation map ${map.id} on "${map.topic}" for ${map.brand} (${map.market}), engine ${map.engine}` : SKIP,
    "",
    "FILES",
    ...manifest.map((m) => `  ${m}`),
    "",
    "WHAT THIS PROVES, AND WHAT IT DOES NOT",
    "  The re-test is a controlled comparison: given your page as a candidate source,",
    "  the engine now prefers it over the competitors it preferred before. Live citation",
    "  also depends on the engine's own index and retrieval, which nobody outside the",
    "  vendor controls. Nothing here is a promise about production ChatGPT.",
    "",
    "  Empty slots marked [SOURCED STAT] or [NAMED SOURCE] are deliberate. The tool",
    "  refuses to invent a figure, a study or a person. Fill them or drop the sentence.",
  ] as (string | symbol)[])
    .filter((l): l is string => l !== SKIP)
    .join("\n");

  entries.unshift({ name: "README.txt", content: readme });
  return { entries, buffer: zip(entries) };
}
