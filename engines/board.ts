import { ENGINES, type EngineKey, type QuestionResult } from "./types";

/**
 * The board: who is actually cited, by which engine, how often.
 *
 * Every number here is a count of real citations returned by a real engine. Nothing is
 * modelled, weighted or inferred. A domain's standing is three separate facts kept
 * separate on purpose: how many questions cite it at all, how many engines cite it, and
 * how often it is the FIRST source an engine lists. A site can be everywhere and never
 * first, which is a different problem from being nowhere.
 */

export interface DomainRow {
  domain: string;
  /** Citations per engine, and the questions behind them. */
  perEngine: Record<EngineKey, number>;
  /** Distinct questions where this domain appears in at least one engine. */
  questions: number;
  /** Distinct engines that ever cite it. All of them means it is unavoidable. */
  engineReach: number;
  /** Times it is the first source an engine lists. */
  firstMentions: number;
  totalCitations: number;
  /** Share of all citations on the panel, 0 to 1. */
  share: number;
  isBrand: boolean;
  /** The exact pages cited, most cited first, so every row is openable. */
  pages: { url: string; title: string; count: number }[];
}

export interface Board {
  rows: DomainRow[];
  totalCitations: number;
  questionCount: number;
  /** Per engine: how many citations it gave and how many distinct domains it used. */
  engineProfile: { engine: EngineKey; citations: number; domains: number; silent: number }[];
  /** Questions where the brand appears in no engine at all. */
  brandAbsentFrom: string[];
  brandRow?: DomainRow;
  /**
   * Domains cited by every engine that ANSWERED on this panel. Requiring all six
   * defined engines made the set empty the moment one went silent, and Gemini goes
   * silent often, so the bar would have moved for a reason that has nothing to do
   * with the domains being compared.
   */
  consensus: string[];
  /** Engines that produced at least one citation here. The denominator for consensus. */
  activeEngines: EngineKey[];
}

const blank = (): Record<EngineKey, number> =>
  Object.fromEntries(ENGINES.map((e) => [e.key, 0])) as Record<EngineKey, number>;

export function buildBoard(questions: QuestionResult[], brandDomain?: string): Board {
  const brand = brandDomain?.toLowerCase().replace(/^www\./, "");
  const acc = new Map<
    string,
    { perEngine: Record<EngineKey, number>; questions: Set<string>; engines: Set<EngineKey>; first: number; pages: Map<string, { title: string; count: number }> }
  >();

  let total = 0;
  const engineCitations = blank();
  const engineDomains: Record<EngineKey, Set<string>> = Object.fromEntries(
    ENGINES.map((e) => [e.key, new Set<string>()]),
  ) as Record<EngineKey, Set<string>>;
  const engineSilent = blank();

  for (const q of questions) {
    for (const a of q.answers) {
      if (!a.citations.length) {
        engineSilent[a.engine] += 1;
        continue;
      }
      for (const c of a.citations) {
        total += 1;
        engineCitations[a.engine] += 1;
        engineDomains[a.engine].add(c.domain);

        let row = acc.get(c.domain);
        if (!row) {
          row = { perEngine: blank(), questions: new Set(), engines: new Set(), first: 0, pages: new Map() };
          acc.set(c.domain, row);
        }
        row.perEngine[a.engine] += 1;
        row.questions.add(q.question);
        row.engines.add(a.engine);
        if (c.rank === 1) row.first += 1;
        const p = row.pages.get(c.url) ?? { title: c.title, count: 0 };
        p.count += 1;
        if (!p.title && c.title) p.title = c.title;
        row.pages.set(c.url, p);
      }
    }
  }

  // an engine that never cited anything cannot be part of a consensus about who is cited
  const active: EngineKey[] = ENGINES.map((e) => e.key).filter((k) => engineCitations[k] > 0);

  const rows: DomainRow[] = [...acc.entries()]
    .map(([domain, r]) => ({
      domain,
      perEngine: r.perEngine,
      questions: r.questions.size,
      engineReach: r.engines.size,
      firstMentions: r.first,
      totalCitations: Object.values(r.perEngine).reduce((a, b) => a + b, 0),
      share: total ? Object.values(r.perEngine).reduce((a, b) => a + b, 0) / total : 0,
      isBrand: Boolean(brand) && domain === brand,
      pages: [...r.pages.entries()]
        .map(([url, p]) => ({ url, title: p.title, count: p.count }))
        .sort((a, b) => b.count - a.count),
    }))
    /**
     * Reach before volume. A domain cited once by every engine is a harder opponent
     * than one cited nine times by a single engine, and sorting on the raw total hides
     * exactly that.
     */
    .sort((a, b) => b.engineReach - a.engineReach || b.totalCitations - a.totalCitations || b.firstMentions - a.firstMentions);

  const brandAbsentFrom = brand
    ? questions.filter((q) => !q.answers.some((a) => a.citations.some((c) => c.domain === brand))).map((q) => q.question)
    : [];

  return {
    rows,
    totalCitations: total,
    questionCount: questions.length,
    engineProfile: ENGINES.map((e) => ({
      engine: e.key,
      citations: engineCitations[e.key],
      domains: engineDomains[e.key].size,
      silent: engineSilent[e.key],
    })),
    brandAbsentFrom,
    brandRow: rows.find((r) => r.isBrand),
    consensus: active.length ? rows.filter((r) => active.every((k) => r.perEngine[k] > 0)).map((r) => r.domain) : [],
    activeEngines: active,
  };
}

/**
 * The one domain worth taking apart first.
 *
 * Not the biggest. The one with the widest engine reach, because a page that satisfies
 * five different retrieval systems is the one carrying transferable properties. Ties go
 * to whoever is named first most often.
 */
export function primaryTarget(board: Board): DomainRow | undefined {
  const rivals = board.rows.filter((r) => !r.isBrand);
  if (!rivals.length) return undefined;

  /**
   * Lead slots first, then reach, then volume.
   *
   * The board is sorted for reading, so its top row is whoever has the widest reach.
   * That is the wrong pick to take apart: it selected smytten.com on a live panel,
   * a domain with eight citations and zero first slots. A domain the engines never
   * lean on has nothing to teach about being leaned on.
   */
  return [...rivals].sort(
    (a, b) => b.firstMentions - a.firstMentions || b.engineReach - a.engineReach || b.totalCitations - a.totalCitations,
  )[0];
}
