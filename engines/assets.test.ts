import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGeoBundle } from "./assets";
import { buildBoard } from "./board";
import { extractAll } from "./extract";
import { ENGINES, type PanelRun, type QuestionResult } from "./types";
import { crc32 } from "../lib/zip";

/**
 * Read the archive back the way a client's unzip does: walk the central directory, find
 * each local header, check the CRC. If any of that is wrong the file will not open on
 * their machine, and asserting on the entry array instead of the bytes would not catch it.
 */
function unzip(bytes: Uint8Array): Map<string, string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(dv.getUint32(end, true)).toBe(0x06054b50);

  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, string>();

  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    expect(dv.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + size);
    expect(crc32(body)).toBe(crc);

    out.set(name, dec.decode(body));
    p += 46 + nameLen + extraLen + commentLen;
  }
  expect(out.size).toBe(count);
  return out;
}

/** RFC 4180 reader, so a question containing a comma cannot silently shift a column. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') (cell += '"'), i++;
      else quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") (row.push(cell), (cell = ""));
    else if (ch === "\r" && text[i + 1] === "\n") (row.push(cell), rows.push(row), (row = []), (cell = ""), i++);
    else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function panelFrom(file: string, over: Partial<PanelRun> = {}): { panel: PanelRun; questions: QuestionResult[] } {
  const questions = extractAll(JSON.parse(readFileSync(join(process.cwd(), file), "utf8")));
  return {
    questions,
    panel: {
      topic: "vitamin C serum",
      market: "UK",
      brandDomain: BRAND,
      questions,
      source: "recorded",
      costUsd: null,
      ranAt: "2026-07-28T09:12:00.000Z",
      silentEngines: [],
      ...over,
    },
  };
}

const BRAND = "theordinary.com";
const { panel, questions } = panelFrom("fixtures/engines/vitamin-c-serum-uk.json");
const board = buildBoard(questions, BRAND);
const bundle = buildGeoBundle({ panel, board });
const files = unzip(bundle.bytes);

const REQUIRED = ["README.txt", "citations.csv", "board.csv", "gaps.csv", "brief.md"];

const allCitations = questions.flatMap((q) => q.answers.flatMap((a) => a.citations.map((c) => ({ q: q.question, a, c }))));

describe("buildGeoBundle, on the recorded vitamin C panel", () => {
  it("produces an archive that parses, entry by entry, with a matching CRC", () => {
    // unzip() asserts the signatures and every CRC; this pins the manifest
    expect([...files.keys()]).toEqual(REQUIRED);
  });

  it("gives every required file real content", () => {
    for (const name of REQUIRED) {
      const body = files.get(name);
      expect(body, `${name} missing`).toBeTypeOf("string");
      expect(body!.trim().length, `${name} is empty`).toBeGreaterThan(0);
    }
  });

  it("names the file from the run, not from a constant", () => {
    expect(bundle.name).toBe("geo-vitamin-c-serum-uk-2026-07-28.zip");
  });

  it("carries one citations.csv row per citation the engines actually returned", () => {
    const rows = parseCsv(files.get("citations.csv")!);
    expect(rows[0]).toEqual(["question", "engine", "domain", "url", "rank", "is_first"]);

    const body = rows.slice(1);
    expect(body.length).toBe(allCitations.length);
    expect(body.length).toBe(board.totalCitations);
    expect(body.length).toBeGreaterThan(0);

    const shorts = new Set<string>(ENGINES.map((e) => e.short));
    for (const r of body) {
      expect(r).toHaveLength(6);
      expect(shorts.has(r[1])).toBe(true);
      expect(r[2]).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      expect(r[3]).toMatch(/^https?:\/\//);
      expect(Number(r[4])).toBeGreaterThan(0);
      expect(r[5] === "yes" || r[5] === "no").toBe(true);
    }

    // is_first is the rank, not a re-derivation of it
    expect(body.filter((r) => r[5] === "yes").length).toBe(allCitations.filter((x) => x.c.rank === 1).length);
    // and every question in the panel reached the file
    expect(new Set(body.map((r) => r[0])).size).toBe(new Set(allCitations.map((x) => x.q)).size);
  });

  it("carries one board.csv row per domain, with one column per engine adding up", () => {
    const rows = parseCsv(files.get("board.csv")!);
    expect(rows[0]).toEqual([
      "domain",
      "is_brand",
      "ai_overview",
      "ai_mode",
      "perplexity",
      "chatgpt",
      "gemini",
      "claude",
      "questions",
      "total_citations",
      "engine_reach",
      "first_mentions",
      "share_pct",
    ]);

    const body = rows.slice(1);
    expect(body.length).toBe(board.rows.length);
    expect(body.length).toBeGreaterThan(0);

    /**
     * Column positions are read off the header rather than hardcoded. They were fixed
     * indexes, and adding a sixth engine shifted every one of them by a column while
     * the assertions still passed on the wrong fields.
     */
    const head = rows[0];
    const at = (name: string) => {
      const i = head.indexOf(name);
      expect(i, `board.csv is missing the ${name} column`).toBeGreaterThan(-1);
      return i;
    };
    const first = at("ai_overview");
    const last = at("questions");
    const iTotal = at("total_citations");
    const iReach = at("engine_reach");
    const iFirst = at("first_mentions");
    const iShare = at("share_pct");

    let share = 0;
    let citations = 0;
    for (const r of body) {
      const perEngine = r.slice(first, last).map(Number);
      const total = Number(r[iTotal]);
      // the engine columns ARE the row, not a summary of it
      expect(perEngine.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Number(r[iReach])).toBe(perEngine.filter((n) => n > 0).length);
      expect(Number(r[iFirst])).toBeLessThanOrEqual(total);
      expect(Number(r[last])).toBeGreaterThan(0);
      share += Number(r[iShare]);
      citations += total;
    }
    expect(citations).toBe(board.totalCitations);
    // the client will sum this column in a spreadsheet, so it has to say 100
    expect(Math.abs(share - 100)).toBeLessThan(0.1);

    // the fixture's own answer, so a change in extraction breaks this test
    expect(body[0][0]).toBe("reddit.com");
  });

  it("lists in gaps.csv exactly the questions the brand is absent from, and who took them", () => {
    const rows = parseCsv(files.get("gaps.csv")!);
    expect(rows[0][0]).toBe("question");
    expect(rows[0]).toContain("first_named_by_each_engine");
    expect(rows[0]).toContain("domains_that_took_it");

    const body = rows.slice(1);
    expect(body.length).toBe(board.brandAbsentFrom.length);
    expect(body.length).toBeGreaterThan(0);
    expect(body.map((r) => r[0]).sort()).toEqual([...board.brandAbsentFrom].sort());

    for (const r of body) {
      expect(r[1].length, "no engine named").toBeGreaterThan(0);
      expect(Number(r[2])).toBeGreaterThan(0);
      expect(Number(r[3])).toBeGreaterThan(0);
      // the engine attribution is real: "AI Mode=healthline.com"
      expect(r[4]).toMatch(/^[A-Za-z ]+=[a-z0-9.-]+\.[a-z]{2,}/);
      expect(r[7]).toMatch(/^[a-z0-9.-]+\.[a-z]{2,} \(\d+\)/);
      // a gap row can never name the brand, that is what makes it a gap
      expect(r[7]).not.toContain(BRAND);

      const domains = r[7].split(" | ").map((d) => d.replace(/ \(\d+\)$/, ""));
      const truth = questions.find((q) => q.question === r[0])!;
      expect(new Set(domains)).toEqual(new Set(truth.answers.flatMap((a) => a.citations.map((c) => c.domain))));
    }
  });

  it("states in README.txt what ran, on what, and what it does not prove", () => {
    const txt = files.get("README.txt")!;
    expect(txt).toContain("vitamin C serum");
    expect(txt).toContain("UK");
    expect(txt).toContain(BRAND);
    expect(txt).toContain("2026-07-28T09:12:00.000Z");
    expect(txt).toContain(`${board.questionCount} questions put to ${ENGINES.length} answer engines`);
    expect(txt).toContain(`${board.totalCitations} citations came back`);
    expect(txt).toContain(`${board.rows.length} distinct domains`);

    // every engine is named with its own count, so the section cannot be boilerplate
    for (const e of ENGINES) {
      const seen = board.engineProfile.find((p) => p.engine === e.key)!;
      expect(txt).toContain(e.label);
      expect(txt).toMatch(new RegExp(`${e.label}\\s+${seen.citations} citations,\\s+${seen.domains} domains`));
    }

    // the sections are separated. A filter that drops empty strings collapses the whole
    // file into one block, which reads as a wall and hides the limits section
    for (const head of ["WHAT WAS MEASURED", "THE ENGINES, AND WHAT EACH ONE GAVE", "FILES", "WHAT THIS DOES NOT PROVE"]) {
      expect(txt, `${head} is not separated from what precedes it`).toContain(`\n\n${head}\n`);
    }

    expect(txt).toContain("WHAT THIS DOES NOT PROVE");
    expect(txt).toMatch(/not a visit/);
    expect(txt).toMatch(/retrieval/i);
    expect(txt).toMatch(/recorded panel replayed/);
    for (const name of REQUIRED.filter((n) => n !== "README.txt")) expect(txt).toContain(name);
  });

  it("writes brief.md from the board: the consensus set, what is replicable, what is not", () => {
    const md = files.get("brief.md")!;

    expect(board.consensus.length).toBeGreaterThan(0);
    for (const d of board.consensus) expect(md).toContain(d);
    expect(md).toContain(`cited by all ${ENGINES.length} engines`);

    expect(md).toContain("## What is replicable");
    expect(md).toContain("## What is not replicable");
    // the classes are named with their members, not asserted in the abstract
    expect(md).toContain("reddit.com");
    expect(md).toContain("user-post platforms");
    expect(md).toContain("health.harvard.edu");
    expect(md).toContain("institutional hostname");

    // the brand's real standing on this fixture: absent everywhere
    expect(md).toContain(`${BRAND} is cited by no engine`);
    // the teardown target comes from the board's own ordering
    expect(md).toContain("Take apart reddit.com first");
    expect(md).toContain(`${board.totalCitations} citations`);
  });

  it("never claims more questions than the panel asked", () => {
    const md = files.get("brief.md")!;
    const claims = [...md.matchAll(/(\d+) of the (\d+) questions/g)];
    expect(claims.length).toBeGreaterThan(0);
    for (const [phrase, part, whole] of claims) {
      expect(Number(whole), phrase).toBe(board.questionCount);
      expect(Number(part), phrase).toBeLessThanOrEqual(board.questionCount);
    }
    // 18 weak seats live on 5 questions, so they are counted as slots and not as questions
    expect(md).toMatch(/engine slots? (?:is|are) held by a domain cited exactly once/);
    expect(md).not.toMatch(/\d+ questions carry/);
  });

  it("counts in the singular when the number is one", () => {
    const md = files.get("brief.md")!;
    for (const wrong of [/\b1 citations\b/, /\b1 times\b/, /\b1 questions\b/, /\b1 domains\b/, /\b1 engine slots\b/]) {
      expect(md, `${wrong} in brief.md`).not.toMatch(wrong);
    }
  });

  it("keeps the banned register out of every file", () => {
    for (const [name, body] of files) {
      expect(body, `${name} has an em dash`).not.toMatch(/—/);
      expect(body, `${name} has filler`).not.toMatch(/\b(powerful|comprehensive|seamless|robust|cutting.edge|leverage)\b/i);
    }
  });
});

describe("buildGeoBundle, on a different panel", () => {
  /** Same code path, one question. If any file were templated the numbers would not move. */
  const other = panelFrom("fixtures/engines/single-probe.json", { topic: "sensitive skin serum", market: "US" });
  const otherBoard = buildBoard(other.questions, "cerave.com");
  const otherFiles = unzip(buildGeoBundle({ panel: other.panel, board: otherBoard }).bytes);

  it("reports its own counts, not the first panel's", () => {
    expect(other.questions.length).toBe(1);
    expect(otherBoard.totalCitations).not.toBe(board.totalCitations);

    const txt = otherFiles.get("README.txt")!;
    expect(txt).toContain(`${otherBoard.questionCount} question put to`);
    expect(txt).toContain(`${otherBoard.totalCitations} citations came back`);
    expect(txt).not.toContain(`${board.totalCitations} citations came back`);
    expect(txt).toContain("sensitive skin serum");

    expect(parseCsv(otherFiles.get("citations.csv")!).length - 1).toBe(otherBoard.totalCitations);
    expect(parseCsv(otherFiles.get("board.csv")!).length - 1).toBe(otherBoard.rows.length);
  });

  it("names its own market and date in the filename", () => {
    expect(buildGeoBundle({ panel: other.panel, board: otherBoard }).name).toBe(
      "geo-sensitive-skin-serum-us-2026-07-28.zip",
    );
  });
});

describe("buildGeoBundle, edge cases", () => {
  it("still ships the five files when no brand was supplied, with gaps.csv reduced to its header", () => {
    const noBrand = buildGeoBundle({
      panel: { ...panel, brandDomain: undefined },
      board: buildBoard(questions, undefined),
    });
    const got = unzip(noBrand.bytes);
    expect([...got.keys()]).toEqual(REQUIRED);

    const rows = parseCsv(got.get("gaps.csv")!);
    expect(rows[0][0]).toBe("question");
    expect(rows).toHaveLength(1);
    expect(got.get("README.txt")).toContain("no rows");
    expect(got.get("brief.md")).toContain("No brand domain was supplied");
  });

  it("survives a panel with nothing in it", () => {
    const empty: PanelRun = { ...panel, questions: [], brandDomain: undefined, ranAt: "not-a-date" };
    const got = unzip(buildGeoBundle({ panel: empty, board: buildBoard([], undefined) }).bytes);
    expect([...got.keys()]).toEqual(REQUIRED);
    expect(got.get("README.txt")).toContain("0 citations came back");
    expect(got.get("brief.md")).toContain(`No domain is cited by all ${ENGINES.length} engines`);
  });

  it("adds teardown.csv only when a teardown carries rows", () => {
    const withTeardown = unzip(
      buildGeoBundle({
        panel,
        board,
        teardown: {
          domain: "reddit.com",
          question: "best vitamin C serum",
          diffs: [{ key: "answerFirst", name: "Answer first", source: "the first 200 words", ours: 2, theirs: 9, impact: 1.4 }],
          brief: [{ key: "freshness", name: "Freshness", weight: 0.1, theirs: 8, evidence: [], requirement: "a dated review" }],
          attempts: [],
          blockedUs: "403 from their edge",
        },
      }).bytes,
    );
    expect([...withTeardown.keys()]).toEqual([...REQUIRED, "teardown.csv"]);
    const rows = parseCsv(withTeardown.get("teardown.csv")!);
    expect(rows[0][0]).toBe("kind");
    expect(rows.slice(1).map((r) => r[1])).toEqual(["Answer first", "Freshness"]);
    expect(withTeardown.get("brief.md")).toContain("## Page teardown");
    expect(withTeardown.get("brief.md")).toContain("403 from their edge");

    for (const junk of [undefined, null, {}, "reddit.com", { domain: "reddit.com", diffs: [], brief: [] }]) {
      expect([...unzip(buildGeoBundle({ panel, board, teardown: junk }).bytes).keys()]).toEqual(REQUIRED);
    }
  });
});
