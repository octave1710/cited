import { csv, zip, type ZipEntry } from "../lib/zip";
import { ENGINES, type EngineKey, type PanelRun } from "./types";
import { primaryTarget, type Board, type DomainRow } from "./board";

/**
 * The five files a client leaves with after a panel run.
 *
 * Every line in every file is a count of citations that five real engines actually
 * returned. Nothing is templated: the README states the engine counts this run produced,
 * the brief names the domains this run found, and when the panel is thin the files are
 * thin. A bundle that cannot say something has to say nothing, not fill the gap.
 *
 * The one judgement call in here is the holder class in brief.md. It is a rule on the
 * hostname, it is printed inside the brief next to its output, and it never touches the
 * CSVs, so a reader who disagrees with the rule still has the raw rows.
 */

/** Column name per engine. Typed on EngineKey so a sixth engine fails the build. */
const ENGINE_COLUMN: Record<EngineKey, string> = {
  aiOverview: "ai_overview",
  aiMode: "ai_mode",
  perplexity: "perplexity",
  chatgpt: "chatgpt",
  gemini: "gemini",
};

const SHORT: Record<EngineKey, string> = Object.fromEntries(
  ENGINES.map((e) => [e.key, e.short]),
) as Record<EngineKey, string>;

const LABEL: Record<EngineKey, string> = Object.fromEntries(
  ENGINES.map((e) => [e.key, e.label]),
) as Record<EngineKey, string>;

/**
 * Where a seat lives. Used only by the brief, to separate what a page on your own
 * domain can take from what it cannot.
 */
export type Holder = "yours" | "platform" | "institution" | "site";

/** Domains whose citations are user posts. You can be quoted inside one, not become one. */
const PLATFORMS = new Set([
  "reddit.com",
  "quora.com",
  "youtube.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "pinterest.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "medium.com",
  "substack.com",
  "stackexchange.com",
  "stackoverflow.com",
]);

/** Suffixes that are themselves the credential. No page on your domain inherits one. */
const INSTITUTION_SUFFIX = [".edu", ".gov", ".gov.uk", ".ac.uk", ".nhs.uk", ".edu.au", ".int", ".mil"];

export function holderOf(row: DomainRow): Holder {
  if (row.isBrand) return "yours";
  if (PLATFORMS.has(row.domain)) return "platform";
  if (INSTITUTION_SUFFIX.some((s) => row.domain.endsWith(s))) return "institution";
  return "site";
}

const HOLDER_RULE =
  "yours = the domain you asked to track. " +
  "platform = one of " +
  [...PLATFORMS].join(", ") +
  ". institution = the hostname ends in " +
  INSTITUTION_SUFFIX.join(", ") +
  ". site = everything else, meaning an ordinary published page on a domain its owner controls.";

/**
 * One decimal reads well in prose. It does not survive a column: 145 domains rounded to
 * 0.1 lose 4.4 points off a total that has to say 100 when the client sums it in a
 * spreadsheet, so board.csv asks for three.
 */
const pct = (n: number, d: number, places = 1): string => (d ? ((100 * n) / d).toFixed(places) : (0).toFixed(places));
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function dateOf(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- teardown */

/**
 * The teardown is typed `unknown` on the way in because the page-level comparison is
 * produced by a different pipeline and may not have run. It is read defensively and
 * dropped whole if it does not carry rows, rather than emitting an empty file.
 */
interface TeardownView {
  domain: string;
  question?: string;
  diffs: { name: string; source: string; ours: number; theirs: number; impact: number }[];
  brief: { name: string; theirs: number; requirement: string }[];
  blockedUs?: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function readTeardown(input: unknown): TeardownView | null {
  if (!input || typeof input !== "object") return null;
  const t = input as Record<string, unknown>;
  const domain = str(t.domain);
  if (!domain) return null;

  const diffs = Array.isArray(t.diffs)
    ? (t.diffs as Record<string, unknown>[])
        .filter((d) => d && typeof d === "object" && str(d.name))
        .map((d) => ({
          name: str(d.name),
          source: str(d.source),
          ours: num(d.ours),
          theirs: num(d.theirs),
          impact: num(d.impact),
        }))
    : [];

  const brief = Array.isArray(t.brief)
    ? (t.brief as Record<string, unknown>[])
        .filter((b) => b && typeof b === "object" && str(b.name))
        .map((b) => ({ name: str(b.name), theirs: num(b.theirs), requirement: str(b.requirement) }))
    : [];

  if (!diffs.length && !brief.length) return null;
  const question = str(t.question);
  const blockedUs = str(t.blockedUs);
  return { domain, question: question || undefined, diffs, brief, blockedUs: blockedUs || undefined };
}

/* ------------------------------------------------------------------ files */

function citationsCsv(panel: PanelRun): { content: string; rows: number } {
  const rows: (string | number)[][] = [];
  for (const q of panel.questions) {
    for (const a of q.answers) {
      for (const c of a.citations) {
        rows.push([q.question, SHORT[a.engine], c.domain, c.url, c.rank, c.rank === 1 ? "yes" : "no"]);
      }
    }
  }
  return {
    content: csv([["question", "engine", "domain", "url", "rank", "is_first"], ...rows]),
    rows: rows.length,
  };
}

function boardCsv(board: Board): string {
  return csv([
    [
      "domain",
      "is_brand",
      ...ENGINES.map((e) => ENGINE_COLUMN[e.key]),
      "questions",
      "total_citations",
      "engine_reach",
      "first_mentions",
      "share_pct",
    ],
    ...board.rows.map((r) => [
      r.domain,
      r.isBrand ? "yes" : "no",
      ...ENGINES.map((e) => r.perEngine[e.key]),
      r.questions,
      r.totalCitations,
      r.engineReach,
      r.firstMentions,
      pct(r.totalCitations, board.totalCitations, 3),
    ]),
  ]);
}

const GAP_HEADER = [
  "question",
  "engines_that_cited",
  "citations",
  "distinct_domains",
  "first_named_by_each_engine",
  "weakest_holder",
  "its_citations_on_the_whole_panel",
  "domains_that_took_it",
];

function gapsCsv(panel: PanelRun, board: Board): { content: string; rows: number } {
  const absent = new Set(board.brandAbsentFrom);
  const panelTotal = new Map(board.rows.map((r) => [r.domain, r.totalCitations]));

  const rows = panel.questions
    .filter((q) => absent.has(q.question))
    .map((q) => {
      const counts = new Map<string, number>();
      const firstPer: string[] = [];
      const engines: string[] = [];
      let cites = 0;

      for (const a of q.answers) {
        if (!a.citations.length) continue;
        engines.push(SHORT[a.engine]);
        cites += a.citations.length;
        for (const c of a.citations) counts.set(c.domain, (counts.get(c.domain) ?? 0) + 1);
        const first = a.citations.find((c) => c.rank === 1) ?? a.citations[0];
        firstPer.push(`${SHORT[a.engine]}=${first.domain}`);
      }

      const ordered = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
      // the seat worth taking first: whoever holds one here and almost nothing anywhere
      const weakest = [...counts.keys()].sort(
        (x, y) => (panelTotal.get(x) ?? 0) - (panelTotal.get(y) ?? 0) || x.localeCompare(y),
      )[0];

      return [
        q.question,
        engines.join(" | "),
        cites,
        ordered.length,
        firstPer.join(" | "),
        weakest ?? "",
        weakest ? (panelTotal.get(weakest) ?? 0) : "",
        ordered.map(([d, n]) => `${d} (${n})`).join(" | "),
      ];
    });

  return { content: csv([GAP_HEADER, ...rows]), rows: rows.length };
}

function teardownCsv(t: TeardownView): string {
  const rows: (string | number)[][] = [
    ...t.diffs.map((d) => ["gap", d.name, d.source, d.ours, d.theirs, d.impact.toFixed(2), ""]),
    ...t.brief.map((b) => ["requirement", b.name, "", "", b.theirs, "", b.requirement]),
  ];
  return csv([["kind", "factor", "measured_from", "your_page", "their_page", "impact", "what_it_takes"], ...rows]);
}

/* ----------------------------------------------------------------- README */

function readme(panel: PanelRun, board: Board, files: { name: string; note: string }[]): string {
  const answered = panel.questions.reduce(
    (n, q) => n + q.answers.filter((a) => a.citations.length).length,
    0,
  );
  const uncited = panel.questions.reduce(
    (n, q) => n + q.answers.filter((a) => !a.citations.length && a.text).length,
    0,
  );
  const silentNames = panel.silentEngines.map((k) => LABEL[k]);

  // conditional lines are dropped by identity, so the blank lines carrying the section
  // breaks survive the filter. Dropping "" instead turns the whole file into one block.
  const SKIP = Symbol();
  const lines: (string | symbol)[] = [
    "GEO PANEL BUNDLE",
    `Topic: ${panel.topic || "not named"}`,
    `Market: ${panel.market}`,
    `Brand tracked: ${panel.brandDomain ?? "none supplied, so gaps.csv has a header and no rows"}`,
    `Panel ran: ${panel.ranAt}`,
    `Bundle written: ${new Date().toISOString()}`,
    "",
    "WHAT WAS MEASURED",
    `  ${plural(board.questionCount, "question", "questions")} put to ${ENGINES.length} answer engines.`,
    `  ${plural(board.totalCitations, "citation", "citations")} came back, naming ${plural(board.rows.length, "distinct domain", "distinct domains")}.`,
    `  ${answered} of the ${board.questionCount * ENGINES.length} question-and-engine pairs cited at least one source.`,
    `  ${uncited} answers were written without citing anything.`,
    panel.source === "live"
      ? `  This was a live run${panel.costUsd !== null ? `, billed at $${panel.costUsd.toFixed(4)}` : ""}.`
      : "  This is a recorded panel replayed from disk, not a live call made today.",
    silentNames.length ? `  Cited nothing anywhere on this panel: ${silentNames.join(", ")}.` : SKIP,
    "",
    "THE ENGINES, AND WHAT EACH ONE GAVE",
    ...board.engineProfile.map(
      (e) =>
        `  ${LABEL[e.engine].padEnd(20)} ${String(e.citations).padStart(4)} citations, ${String(e.domains).padStart(3)} domains, cited nothing on ${e.silent} of ${board.questionCount}`,
    ),
    "",
    "FILES",
    ...files.flatMap((f) => [`  ${f.name}`, `    ${f.note}`]),
    "",
    "WHAT THIS DOES NOT PROVE",
    "  It is one run, at one moment, in one market. Engines re-rank between runs, so a",
    "  domain missing here can be cited tomorrow and the reverse is just as true.",
    "",
    `  It covers ${plural(board.questionCount, "question", "questions")}, not every question a buyer asks. A domain absent`,
    "  from this file is absent from these questions, nothing wider.",
    "",
    "  A citation is not a visit, a click or a sale. Nothing in this bundle measures",
    "  traffic or revenue, and no number here should be read as either.",
    "",
    "  An engine citing nothing is a fact about this run. It is not evidence that the",
    "  engine has no answer, and it is not evidence that a seat is free forever.",
    "",
    "  The board says who is cited. It does not say why. That takes reading the pages,",
    "  which is what the teardown does, one domain at a time.",
    "",
    "  Nothing here promises that publishing a page gets it cited. Retrieval is the",
    "  engine vendor's, and no one outside the vendor controls it.",
  ];

  return lines.filter((l): l is string => l !== SKIP).join("\n") + "\n";
}

/* ------------------------------------------------------------------ brief */

function brief(panel: PanelRun, board: Board, teardown: TeardownView | null): string {
  const out: string[] = [];
  const w = (s = "") => out.push(s);

  const top = board.rows.slice(0, 20);
  const classed = top.map((r) => ({ row: r, holder: holderOf(r) }));
  const sites = classed.filter((c) => c.holder === "site").map((c) => c.row);
  const platforms = classed.filter((c) => c.holder === "platform").map((c) => c.row);
  const institutions = classed.filter((c) => c.holder === "institution").map((c) => c.row);

  const single = board.rows.filter((r) => r.totalCitations === 1);
  const brandRow = board.brandRow;
  const absent = board.brandAbsentFrom.length;
  const target = primaryTarget(board);

  const name = (r: DomainRow) =>
    `${r.domain} (${plural(r.totalCitations, "citation", "citations")}, ${r.engineReach} of ${ENGINES.length} engines, ` +
    `named first ${plural(r.firstMentions, "time", "times")})`;

  w(`# GEO brief: ${panel.topic || "unnamed panel"}, ${panel.market}`);
  w();
  w(
    `Panel run ${dateOf(panel.ranAt)}. ${plural(board.questionCount, "question", "questions")} put to ${ENGINES.length} answer engines. ` +
      `${board.totalCitations} citations came back across ${board.rows.length} domains.`,
  );
  w();

  /* who holds the answer */
  w("## Who holds the answer");
  w();
  if (board.consensus.length) {
    const rows = board.consensus
      .map((d) => board.rows.find((r) => r.domain === d))
      .filter((r): r is DomainRow => Boolean(r));
    w(
      `${plural(rows.length, "domain is", "domains are")} cited by all ${ENGINES.length} engines: ${rows.map((r) => r.domain).join(", ")}. ` +
        "That is the set no single engine's preference explains.",
    );
    w();
    for (const r of rows) {
      w(
        `- ${r.domain}: ${r.totalCitations} citations, ${pct(r.totalCitations, board.totalCitations)} percent of the panel, ` +
          `on ${r.questions} of ${board.questionCount} questions, named first ${plural(r.firstMentions, "time", "times")}.`,
      );
    }
  } else {
    const reach = board.rows.length ? board.rows[0].engineReach : 0;
    w(
      `No domain is cited by all ${ENGINES.length} engines. The widest reach on this panel is ${reach} ` +
        `engines, held by ${board.rows.filter((r) => r.engineReach === reach).map((r) => r.domain).join(", ") || "nobody"}.`,
    );
  }
  w();
  w(
    `${board.rows.length} domains split ${board.totalCitations} citations. ${single.length} of them are cited exactly once, ` +
      `which is ${pct(single.length, board.rows.length)} percent of the board.`,
  );
  w();

  /* where the brand stands */
  w("## Where you stand");
  w();
  if (!panel.brandDomain) {
    w("No brand domain was supplied for this run, so there is no position to report. Re-run with one.");
  } else if (brandRow) {
    w(
      `${panel.brandDomain} is cited ${brandRow.totalCitations} times by ${brandRow.engineReach} of ${ENGINES.length} engines, ` +
        `on ${brandRow.questions} of ${board.questionCount} questions, named first ${plural(brandRow.firstMentions, "time", "times")}. ` +
        `It is absent from ${absent} of the ${board.questionCount} questions.`,
    );
    w();
    w(
      `By citations it ranks ${board.rows.findIndex((r) => r.isBrand) + 1} of ${board.rows.length} domains on this panel.`,
    );
  } else {
    w(
      `${panel.brandDomain} is cited by no engine on any of the ${board.questionCount} questions. ` +
        `It holds none of the ${board.totalCitations} citations on this panel.`,
    );
  }
  w();

  /* replicable */
  w("## What is replicable");
  w();
  if (sites.length) {
    w(
      `${sites.length} of the top ${top.length} domains hold their seat with an ordinary published page on a domain ` +
        "their owner controls. A page on your domain competes with those on the same terms:",
    );
    w();
    for (const r of sites.slice(0, 8)) w(`- ${name(r)}`);
    w();
  } else {
    w(`None of the top ${top.length} domains is an ordinary published site. Every seat up there is a platform or an institution.`);
    w();
  }

  const weakSeats = weakSeatsOn(panel, board);
  if (weakSeats.length) {
    // one seat is one engine's slot on one question, so the count is seats and not
    // questions. Five questions can carry eighteen seats and saying "18 questions" is false
    const across = new Set(weakSeats.map((s) => s.question)).size;
    w(
      `${plural(weakSeats.length, "engine slot is", "engine slots are")} held by a domain cited exactly once across the ` +
        `whole panel, spread over ${across} of the ${board.questionCount} questions. Those are the cheapest to take, ` +
        "because the incumbent has no repeat standing to defend:",
    );
    w();
    for (const s of weakSeats.slice(0, 8)) w(`- ${s.question}: ${s.engine} cited ${s.domain}`);
    if (weakSeats.length > 8) w(`- and ${weakSeats.length - 8} more, all of them in gaps.csv`);
    w();
  }

  const emptySlots = panel.questions.reduce(
    (n, q) => n + q.answers.filter((a) => !a.citations.length && a.text).length,
    0,
  );
  if (emptySlots) {
    w(
      `${plural(emptySlots, "engine answer was", "engine answers were")} written without citing any source. ` +
        "There is no incumbent to displace in those slots.",
    );
    w();
  }

  /* not replicable */
  w("## What is not replicable");
  w();
  if (platforms.length) {
    w(
      `${platforms.length} of the top ${top.length} are user-post platforms: ${platforms.map((r) => r.domain).join(", ")}. ` +
        `Together they take ${platforms.reduce((n, r) => n + r.totalCitations, 0)} citations, ` +
        `${pct(platforms.reduce((n, r) => n + r.totalCitations, 0), board.totalCitations)} percent of the panel. ` +
        "The seat lives inside posts you do not own. You can be named in one. You cannot publish as one.",
    );
    w();
  }
  if (institutions.length) {
    w(
      `${institutions.length} of the top ${top.length} sit on an institutional hostname: ${institutions.map((r) => r.domain).join(", ")}. ` +
        `Together they take ${institutions.reduce((n, r) => n + r.totalCitations, 0)} citations. ` +
        "The domain itself is the credential, and no page on your domain inherits it.",
    );
    w();
  }
  if (!platforms.length && !institutions.length) {
    w(`No platform and no institutional hostname is in the top ${top.length}. Every seat up there is on a site somebody publishes.`);
    w();
  }
  w(`The three classes are assigned by a rule on the hostname, printed here so you can check it. ${HOLDER_RULE}`);
  w();

  /* what to do first */
  w("## Where to start");
  w();
  if (target) {
    w(
      `Take apart ${target.domain} first. It is cited by ${target.engineReach} of ${ENGINES.length} engines, ` +
        `which means its pages satisfy retrieval systems that disagree with each other, ` +
        `and it holds ${target.totalCitations} citations across ${target.questions} of ${board.questionCount} questions.`,
    );
    if (target.pages.length) {
      w();
      w("The exact pages the engines cited:");
      w();
      for (const p of target.pages.slice(0, 5)) w(`- ${p.url} (${plural(p.count, "citation", "citations")})`);
    }
    w();
  }
  if (weakSeats.length) {
    w(`Then the ${plural(weakSeats.length, "weak seat", "weak seats")} listed above, in the order gaps.csv gives them.`);
    w();
  }

  /* teardown, only when one ran */
  if (teardown) {
    w("## Page teardown");
    w();
    w(
      `${teardown.domain} was read page by page${teardown.question ? ` on the question "${teardown.question}"` : ""}. ` +
        `${plural(teardown.diffs.length, "factor gap", "factor gaps")} and ${plural(teardown.brief.length, "requirement", "requirements")} came out of it. ` +
        "The rows are in teardown.csv.",
    );
    if (teardown.blockedUs) {
      w();
      w(`Their server refused our crawler: ${teardown.blockedUs}. They can be cited while being unreadable to anyone the site has not allowed.`);
    }
    const worst = [...teardown.diffs].sort((a, b) => b.impact - a.impact).slice(0, 5);
    if (worst.length) {
      w();
      w("The gaps that cost the most, largest first:");
      w();
      for (const d of worst) w(`- ${d.name}: you ${d.ours}, them ${d.theirs}, measured from ${d.source || "the page"}`);
    }
    w();
  }

  /* limits */
  w("## What this file does not say");
  w();
  w(
    `These are ${board.totalCitations} citations from one run on ${dateOf(panel.ranAt)}, market ${panel.market}, on ` +
      `${plural(board.questionCount, "question", "questions")}. Engines re-rank between runs. A citation is not a visit and not a sale. ` +
      "Nothing here says a page you publish will be cited, because retrieval belongs to the engine vendor.",
  );
  if (panel.source === "recorded") {
    w();
    w("This panel was replayed from a recording on disk. It was not called live today.");
  }
  w();

  return out.join("\n");
}

/** Absent questions whose incumbent is a domain the whole panel cites exactly once. */
function weakSeatsOn(
  panel: PanelRun,
  board: Board,
): { question: string; domain: string; engine: string }[] {
  const absent = new Set(board.brandAbsentFrom);
  const once = new Set(board.rows.filter((r) => r.totalCitations === 1).map((r) => r.domain));
  const seats: { question: string; domain: string; engine: string }[] = [];

  for (const q of panel.questions) {
    if (!absent.has(q.question)) continue;
    for (const a of q.answers) {
      for (const c of a.citations) {
        if (once.has(c.domain)) {
          seats.push({ question: q.question, domain: c.domain, engine: SHORT[a.engine] });
          break;
        }
      }
    }
  }
  return seats;
}

/* ----------------------------------------------------------------- bundle */

export function buildGeoBundle(input: { panel: PanelRun; board: Board; teardown?: unknown }): {
  name: string;
  bytes: Uint8Array;
} {
  const { panel, board } = input;
  const teardown = readTeardown(input.teardown);

  const cites = citationsCsv(panel);
  const gaps = gapsCsv(panel, board);

  const files: { name: string; content: string; note: string }[] = [
    {
      name: "citations.csv",
      content: cites.content,
      note: `${cites.rows} rows, one per citation. Every url is openable, so any row can be checked against the engine that gave it.`,
    },
    {
      name: "board.csv",
      content: boardCsv(board),
      note: `${board.rows.length} domains, sorted by how many engines cite them before how often. Reach beats volume: one citation from all five engines is a harder opponent than nine from one.`,
    },
    {
      name: "gaps.csv",
      content: gaps.content,
      note: panel.brandDomain
        ? `${gaps.rows} of the ${board.questionCount} questions where ${panel.brandDomain} is cited by no engine, with who took them.`
        : "No brand domain was supplied for this run, so this file carries its header and no rows.",
    },
    {
      name: "brief.md",
      content: brief(panel, board, teardown),
      note: "The read of the two files above: the consensus set, what a page on your domain can take, and what it cannot.",
    },
  ];

  if (teardown) {
    files.push({
      name: "teardown.csv",
      content: teardownCsv(teardown),
      note: `${teardown.diffs.length} factor gaps and ${teardown.brief.length} requirements read off ${teardown.domain}.`,
    });
  }

  const entries: ZipEntry[] = [
    { name: "README.txt", content: readme(panel, board, files) },
    ...files.map((f) => ({ name: f.name, content: f.content })),
  ];

  const stamp = dateOf(panel.ranAt);
  const topic = slug(panel.topic) || "panel";
  const name = `geo-${topic}-${slug(panel.market) || "market"}-${stamp}.zip`;

  return { name, bytes: zip(entries) };
}
