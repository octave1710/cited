import { unquote, type SuppliedFacts } from "./apply";
import type { Fix } from "./fixes";
import { needsSuppliedFact } from "./fixes";

/**
 * Turns every refusal into one sheet the client fills in.
 *
 * The two heaviest factors in the engine, sourced quotes at 0.20 and quantified
 * specificity at 0.18, are the two the tool refuses to satisfy on its own, because
 * satisfying them means inventing a figure or a person. So the ceiling on every run is
 * not the tool, it is a fact nobody has been asked for. This asks for it, in the
 * client's own words, quoting the sentence on their page that it would replace.
 */

export type FactKind = "figure" | "person" | "quote";

export interface FactRequest {
  id: string;
  kind: FactKind;
  /** The sentence on their own page this would replace, verbatim. Empty for a new insert. */
  replaces: string;
  /** What has to come back: stated as a requirement, never as a suggestion of the value. */
  needs: string;
  /** The factor it unblocks and how much of the score that factor carries. */
  factorKey: string;
  weightPct: number;
}

const WEIGHT_PCT: Record<string, number> = {
  factualSpecificity: 18,
  sourcedQuotes: 20,
  offSiteAuthority: 12,
  freshness: 14,
  answerStructure: 24,
};

const NEEDS: Record<FactKind, string> = {
  figure: "a number with its unit, the timeframe it covers, and the study or internal source it comes from",
  person: "the full name of a real person, their credential, and a URL that proves the credential",
  quote: "one sentence they actually said or wrote, their full name, and their credential",
};

function kindOf(fix: Fix): FactKind | null {
  if (fix.factorKey === "sourcedQuotes") return "quote";
  if (fix.factorKey === "offSiteAuthority") return "person";
  if (needsSuppliedFact(fix.after)) return "figure";
  return null;
}

/** One row per fix that is blocked on a fact. Nothing else is asked for. */
export function buildFactRequests(fixes: Fix[]): FactRequest[] {
  return fixes
    .map((fix, i) => {
      const kind = kindOf(fix);
      if (!kind) return null;
      return {
        id: `fact-${String(i + 1).padStart(2, "0")}`,
        kind,
        // the exact sentence as it appears on their page, so they can find it in a CMS
        replaces: unquote(fix.before),
        needs: NEEDS[kind],
        factorKey: fix.factorKey,
        weightPct: WEIGHT_PCT[fix.factorKey] ?? 0,
      } satisfies FactRequest;
    })
    .filter((r): r is FactRequest => r !== null);
}

/** Header of the sheet the client fills in. `your_answer` is the only column they touch. */
export const FACT_SHEET_HEADER = [
  "id",
  "what_is_needed",
  "sentence_on_your_page_it_replaces",
  "unlocks_factor",
  "percent_of_score",
  "your_answer",
  "source_url",
  "person_name",
  "person_credential",
] as const;

export function factSheetRows(requests: FactRequest[]): (string | number)[][] {
  return requests.map((r) => [r.id, r.needs, r.replaces, r.factorKey, r.weightPct, "", "", "", ""]);
}

export interface FilledRow {
  id: string;
  answer: string;
  sourceUrl?: string;
  personName?: string;
  personCredential?: string;
}

/**
 * Reads the filled sheet back into the exact shape applyFixes already consumes.
 * A row whose answer is blank is dropped rather than defaulted, so an unanswered
 * request keeps its visible empty slot on the page.
 */
export function toSuppliedFacts(requests: FactRequest[], filled: FilledRow[]): SuppliedFacts {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const out: SuppliedFacts = {};

  for (const row of filled) {
    const req = byId.get(row.id);
    const answer = (row.answer ?? "").trim();
    if (!req || !answer) continue;

    if (req.kind === "figure") {
      // the replacement is the client's sentence, with their own source appended
      const withSource = row.sourceUrl?.trim() ? `${answer} (${row.sourceUrl.trim()})` : answer;
      (out.claims ??= []).push({ find: req.replaces, replace: withSource });
      continue;
    }

    const name = (row.personName ?? "").trim();
    if (!name) continue; // a quote or a byline without a real name is exactly what we refuse

    if (req.kind === "person") {
      out.author = { name, credential: row.personCredential?.trim() || undefined, url: row.sourceUrl?.trim() || undefined };
    } else {
      out.quote = { text: answer, name, credential: row.personCredential?.trim() || undefined };
    }
  }
  return out;
}

/** Minimal RFC 4180 reader: enough for a sheet round-tripped through Excel or Sheets. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Maps a filled sheet back to rows by header name, so column order can change. */
export function readFilledSheet(csvText: string): FilledRow[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idI = col("id");
  const answerI = col("your_answer");
  if (idI < 0 || answerI < 0) return [];

  return rows.slice(1).map((r) => ({
    id: (r[idI] ?? "").trim(),
    answer: r[answerI] ?? "",
    sourceUrl: r[col("source_url")] ?? undefined,
    personName: r[col("person_name")] ?? undefined,
    personCredential: r[col("person_credential")] ?? undefined,
  }));
}
