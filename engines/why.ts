import type { Board, DomainRow } from "./board";
import { ENGINES, type EngineKey, type QuestionResult } from "./types";

/**
 * Why a domain is in the answer, taken apart factor by factor.
 *
 * The board says WHO is cited. This says WHAT about them the engines are selecting for,
 * and it only says the part it can prove from the panel it was handed. Nine factors were
 * designed against this data; three of them are answerable from the citations alone and
 * only those three are computed here. The other six need a page fetch, a second engine
 * run, or are not measurable at all, and they are listed in FACTORS_NOT_RUN_HERE rather
 * than quietly dropped, because a factor set that hides its own gaps will get credited
 * for outcomes it did not cause.
 *
 * Every number that reaches evidence[] is counted off the panel in this file. Nothing is
 * carried in as a constant, so a different panel changes every figure and none of them
 * can be stale.
 */

export interface FactorFinding {
  key: string;
  name: string;
  question: string;
  /** What the panel says about this domain on this factor, in one sentence. */
  verdict: string;
  /** Countable statements. Each one is arithmetic on the panel, checkable by hand. */
  evidence: string[];
  source: "citation-data" | "page-fetch";
  /** 0-100 on a denominator named in the evidence, never a blended score. */
  strength: number;
}

export interface Teardown {
  domain: string;
  headline: string;
  findings: FactorFinding[];
  /** Things a client can copy, each one anchored to a number above. */
  replicable: string[];
  /** Advantages that come from being this particular site. Stated so nobody sells a plan to become Reddit. */
  notReplicable: string[];
}

/**
 * The six factors this function deliberately does not answer, and why.
 * Kept next to the three it does answer so a caller cannot mistake the set for complete.
 */
export const FACTORS_NOT_RUN_HERE: { key: string; needs: string; why: string }[] = [
  {
    key: "communityThreadPresence",
    needs: "page-fetch",
    why: "needs the cited Reddit threads fetched and searched for the brand; the panel names the threads but not their contents",
  },
  {
    key: "editorialRoundupInclusion",
    needs: "page-fetch",
    why: "needs the cited roundup pages fetched and their product lists parsed",
  },
  {
    key: "videoShelfPresence",
    needs: "page-fetch",
    why: "needs each cited watch page fetched, since the description is rendered by script",
  },
  {
    key: "institutionalCorroboration",
    needs: "page-fetch",
    why: "needs the institutional pages and the brand page fetched and their stated numbers diffed",
  },
  {
    key: "citationDurability",
    needs: "engine-query",
    why: "needs the same questions re-run through the same engines and the two boards diffed; one run cannot separate engine behaviour from scrape noise",
  },
  {
    key: "parametricRecall",
    needs: "not-measurable-here",
    why: "nothing available here reads a model's weights; the count of brands named in answers that cited nothing is reported under proseNamingGap and attributed to nothing",
  },
];

/* ------------------------------------------------------------------ source classes */

export type SourceClass = "forum" | "editorial" | "institution" | "retail" | "video" | "brand" | "other";

const CLASS_LABEL: Record<SourceClass, string> = {
  forum: "forum UGC",
  editorial: "editorial press",
  institution: "institutions",
  retail: "retail",
  video: "video",
  brand: "brand-owned",
  other: "other",
};

const FORUM = /^(reddit\.com|quora\.com|mumsnet\.com|stackexchange\.com|discourse\.[a-z.]+)$|(^|\.)forum|community\./;
const VIDEO = /^(www\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com)$/;
const INSTITUTION = /(\.gov(\.[a-z]{2})?$|\.edu$|\.ac\.uk$|\.nhs\.uk$|clinic|hospital|methodist|mayo|nih\.gov|who\.int|aad\.org)/;
const RETAIL =
  /^(www\.)?(amazon\.[a-z.]+|boots\.com|superdrug\.com|johnlewis\.com|sephora\.[a-z.]+|cultbeauty\.co\.uk|lookfantastic\.com|spacenk\.com|feelunique\.com|ulta\.com|target\.com|walmart\.com|notino\.[a-z.]+|escentual\.com|beautybay\.com|asos\.com|ebay\.[a-z.]+|smytten\.com|nykaa\.com)$/;
/** Publishers and magazines. Health publishers sit here too: they are media businesses, not institutions. */
const EDITORIAL =
  /^(www\.)?(theguardian\.com|forbes\.com|vogue\.(com|co\.uk)|allure\.com|healthline\.com|medicalnewstoday\.com|verywellhealth\.com|webmd\.com|byrdie\.com|elle\.com|cosmopolitan\.com|harpersbazaar\.com|glamour(magazine)?\.(com|co\.uk)|marieclaire\.(com|co\.uk)|refinery29\.com|self\.com|goodhousekeeping\.com|instyle\.com|womenshealthmag\.com|womanandhome\.com|prevention\.com|shape\.com|realsimple\.com|whowhatwear\.(com|co\.uk)|stylist\.co\.uk|independent\.co\.uk|telegraph\.co\.uk|thetimes\.(com|co\.uk)|standard\.co.uk|dailymail\.co\.uk|mirror\.co\.uk|bbc\.(com|co\.uk)|nytimes\.com|wired\.com|popsugar\.com)$/;

export function sourceClassOf(domain: string, brandDomains: Set<string>): SourceClass {
  const d = domain.toLowerCase();
  if (VIDEO.test(d)) return "video";
  if (FORUM.test(d)) return "forum";
  if (INSTITUTION.test(d)) return "institution";
  if (RETAIL.test(d)) return "retail";
  if (EDITORIAL.test(d)) return "editorial";
  if (brandDomains.has(d)) return "brand";
  return "other";
}

/* ---------------------------------------------------------------------- intent */

/**
 * Shallow on purpose. It reads the question string, nothing else, so anyone can check
 * the split by looking at the six questions. A model classifier would be less checkable
 * and no more right on a panel this size.
 */
const COMMERCIAL = /\b(best|affordable|cheap(est)?|top|vs|versus|worth (it|buying)|which)\b/i;

export type Intent = "commercial" | "informational";

export function questionIntent(question: string): Intent {
  return COMMERCIAL.test(question) ? "commercial" : "informational";
}

/* ------------------------------------------------------------- url path matching */

const STOP = new Set([
  "can", "you", "the", "and", "for", "are", "was", "its", "with", "what", "which", "how",
  "why", "when", "who", "does", "did", "this", "that", "your", "from", "has", "have",
  "been", "should", "would", "could",
]);

/** Words of the question that carry the topic, deduped. Three letters or more. */
export function contentWords(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((w) => w.length >= 3 && !STOP.has(w)),
    ),
  ];
}

/** True when at least half the question's content words appear in the URL's path. */
export function pathCarriesQuestion(url: string, question: string): boolean {
  const words = contentWords(question);
  if (!words.length) return false;
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  return words.filter((w) => path.includes(w)).length / words.length >= 0.5;
}

function isHomepage(url: string): boolean {
  try {
    const p = new URL(url).pathname;
    return p === "" || p === "/";
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- brand vocabulary */

export interface BrandEntry {
  name: string;
  /** Strings to look for in the prose. Matched on word boundaries. */
  aliases: string[];
  /** The brand's own sites, so naming and citing can be counted separately. */
  ownDomains: string[];
  /**
   * Set when the name is also an ordinary English word. "Simple" appears in this panel
   * as "a simple routine" five times and as the brand four times. An ambiguous name must
   * match its own capitalisation and sit next to a product word, or the factor reports a
   * brand presence that is not there.
   */
  ambiguous?: boolean;
}

/**
 * The topic vocabulary for this panel. It is data, not logic: pass a different list for a
 * different category. Nothing downstream depends on these particular brands.
 */
export const SKINCARE_BRANDS: BrandEntry[] = [
  { name: "The Ordinary", aliases: ["the ordinary"], ownDomains: ["theordinary.com", "deciem.com"] },
  { name: "CeraVe", aliases: ["cerave"], ownDomains: ["cerave.com", "cerave.co.uk"] },
  { name: "La Roche-Posay", aliases: ["la roche-posay", "la roche posay"], ownDomains: ["laroche-posay.co.uk", "laroche-posay.com", "laroche-posay.us"] },
  { name: "Simple", aliases: ["Simple"], ownDomains: ["simpleskincare.com", "simpleskincare.co.uk", "simple.co.uk"], ambiguous: true },
  { name: "Garnier", aliases: ["garnier"], ownDomains: ["garnier.co.uk", "garnier.com"] },
  { name: "Boots", aliases: ["Boots"], ownDomains: ["boots.com"], ambiguous: true },
  { name: "Superdrug", aliases: ["superdrug"], ownDomains: ["superdrug.com"] },
  { name: "TruSkin", aliases: ["truskin"], ownDomains: ["truskin.com"] },
  { name: "SkinCeuticals", aliases: ["skinceuticals"], ownDomains: ["skinceuticals.com", "skinceuticals.co.uk"] },
  { name: "Medik8", aliases: ["medik8"], ownDomains: ["medik8.com"] },
  { name: "Paula's Choice", aliases: ["paula's choice", "paulas choice"], ownDomains: ["paulaschoice.com", "paulaschoice.co.uk"] },
  { name: "Naturium", aliases: ["naturium"], ownDomains: ["naturium.com"] },
  { name: "Vichy", aliases: ["vichy"], ownDomains: ["vichy.co.uk", "vichyusa.com"] },
  { name: "No7", aliases: ["no7"], ownDomains: ["no7beauty.com"] },
  { name: "Olay", aliases: ["olay"], ownDomains: ["olay.com", "olay.co.uk"] },
  { name: "Timeless", aliases: ["Timeless"], ownDomains: ["timelessha.com"], ambiguous: true },
  { name: "Maelove", aliases: ["maelove"], ownDomains: ["maelove.com"] },
  { name: "Drunk Elephant", aliases: ["drunk elephant"], ownDomains: ["drunkelephant.com"] },
  { name: "Sunday Riley", aliases: ["sunday riley"], ownDomains: ["sundayriley.com"] },
  { name: "Kiehl's", aliases: ["kiehl's", "kiehls"], ownDomains: ["kiehls.com", "kiehls.co.uk"] },
  { name: "Murad", aliases: ["murad"], ownDomains: ["murad.com", "murad.co.uk"] },
  { name: "Beauty Pie", aliases: ["beauty pie"], ownDomains: ["beautypie.com"] },
  { name: "Revolution", aliases: ["revolution skincare", "revolution beauty"], ownDomains: ["revolutionbeauty.com"] },
];

/** A product word within this many characters after an ambiguous name makes it the brand. */
const CONTEXT_WINDOW = 40;
const PRODUCT_CONTEXT = /(serum|booster|skincare|skin care|brand|®|£|\d\s?ml)/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the prose names this brand, as opposed to using the same word for something else. */
export function namesBrand(text: string, brand: BrandEntry): boolean {
  if (!text) return false;
  for (const alias of brand.aliases) {
    const re = new RegExp(`\\b${escape(alias)}\\b`, brand.ambiguous ? "g" : "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!brand.ambiguous) return true;
      if (PRODUCT_CONTEXT.test(text.slice(m.index + m[0].length, m.index + m[0].length + CONTEXT_WINDOW))) return true;
    }
  }
  return false;
}

export interface NamingRow {
  name: string;
  /** Answers whose prose names the brand. */
  answers: number;
  /** Distinct engines that name it. */
  engines: number;
  /** Of those answers, how many also cite one of the brand's own domains. Never merged with the above. */
  answersCitingOwnDomain: number;
  /** Of those answers, how many cited no source at all. Attributable to nothing. */
  answersWithNoCitations: number;
}

export function brandNamingTable(questions: QuestionResult[], brands: BrandEntry[] = SKINCARE_BRANDS): NamingRow[] {
  return brands
    .map((b) => {
      const own = new Set(b.ownDomains);
      let answers = 0;
      let cited = 0;
      let uncited = 0;
      const engines = new Set<EngineKey>();
      for (const q of questions) {
        for (const a of q.answers) {
          if (!namesBrand(a.text, b)) continue;
          answers += 1;
          engines.add(a.engine);
          if (a.citations.some((c) => own.has(c.domain))) cited += 1;
          if (!a.citations.length) uncited += 1;
        }
      }
      return { name: b.name, answers, engines: engines.size, answersCitingOwnDomain: cited, answersWithNoCitations: uncited };
    })
    .filter((r) => r.answers > 0)
    .sort((a, b) => b.answers - a.answers || b.engines - a.engines);
}

/* -------------------------------------------------------------------- lead slots */

export interface LeadSlot {
  question: string;
  intent: Intent;
  engine: EngineKey;
  domain: string;
  url: string;
  cls: SourceClass;
}

export function leadSlots(questions: QuestionResult[], brandDomains: Set<string>): LeadSlot[] {
  const out: LeadSlot[] = [];
  for (const q of questions) {
    const intent = questionIntent(q.question);
    for (const a of q.answers) {
      for (const c of a.citations) {
        if (c.rank !== 1) continue;
        out.push({ question: q.question, intent, engine: a.engine, domain: c.domain, url: c.url, cls: sourceClassOf(c.domain, brandDomains) });
      }
    }
  }
  return out;
}

const countBy = <T extends string>(items: T[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const i of items) m[i] = (m[i] ?? 0) + 1;
  return m;
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const SUFFIX = new Set(["com", "co", "uk", "org", "net", "edu", "gov", "io", "us", "ac", "nhs", "int", "info", "eu", "fr", "de", "se", "dk", "nl", "es", "it"]);

/**
 * A name to look for in the prose for a domain that is not in the brand list.
 * health.harvard.edu becomes harvard, theguardian.com becomes guardian, vogue.co.uk stays vogue.
 */
export function nameTokenFor(domain: string): string {
  const parts = domain.split(".").filter((p) => !SUFFIX.has(p));
  const label = parts[parts.length - 1] ?? domain;
  return label.length > 4 ? label.replace(/^the(?=[a-z])/, "") : label;
}

/* --------------------------------------------------------------------- the teardown */

export function teardownFromCitations(
  board: Board,
  questions: QuestionResult[],
  domain: string,
  brands: BrandEntry[] = SKINCARE_BRANDS,
): Teardown {
  const target = domain.toLowerCase().replace(/^www\./, "");
  const row = board.rows.find((r) => r.domain === target);
  const brandDomains = new Set(brands.flatMap((b) => b.ownDomains));
  const cls = sourceClassOf(target, brandDomains);

  /* --- panel-wide counts every factor leans on, all counted here, once --- */
  const engineAnswers = questions.flatMap((q) => q.answers);
  const answersTotal = engineAnswers.length;
  const answersWithoutCitations = engineAnswers.filter((a) => !a.citations.length).length;
  const answersWithText = engineAnswers.filter((a) => a.text.trim().length > 0).length;
  const reachOne = board.rows.filter((r) => r.engineReach === 1).length;
  const citedOnce = board.rows.filter((r) => r.totalCitations === 1).length;
  const byVolume = [...board.rows].sort((a, b) => b.totalCitations - a.totalCitations)[0];

  const slots = leadSlots(questions, brandDomains);
  const slotsByClass = countBy(slots.map((s) => s.cls));
  const commercialSlots = slots.filter((s) => s.intent === "commercial");
  const informationalSlots = slots.filter((s) => s.intent === "informational");
  const commercialQuestions = questions.filter((q) => questionIntent(q.question) === "commercial").length;
  const leaderOf = (list: LeadSlot[]) => {
    const c = countBy(list.map((s) => s.cls));
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top ? { cls: top[0] as SourceClass, n: top[1] } : null;
  };
  const commercialLeader = leaderOf(commercialSlots);
  const informationalLeader = leaderOf(informationalSlots);

  const allCitations = engineAnswers.flatMap((a) => a.citations);
  const homepages = allCitations.filter((c) => isHomepage(c.url)).length;
  const slotsOnTopic = slots.filter((s) => pathCarriesQuestion(s.url, s.question)).length;
  const maxLead = board.rows.reduce((m, r) => Math.max(m, r.firstMentions), 0);

  const naming = brandNamingTable(questions, brands);
  const namedWithoutOwnCitation = naming.filter((n) => n.answersCitingOwnDomain === 0).length;

  const findings: FactorFinding[] = [
    engineReachFinding(target, row, board, { reachOne, citedOnce, byVolume }),
    leadSlotFinding(target, row, {
      slots,
      slotsByClass,
      commercialSlots,
      informationalSlots,
      commercialQuestions,
      commercialLeader,
      informationalLeader,
      answersTotal,
      answersWithoutCitations,
      slotsOnTopic,
      homepages,
      totalCitations: board.totalCitations,
      byVolume,
      maxLead,
      questionCount: board.questionCount,
    }),
    proseNamingFinding(target, row, questions, brands, { naming, namedWithoutOwnCitation, answersWithText, answersTotal, answersWithoutCitations }),
  ];

  const headline = row
    ? `${target}: cited by ${row.engineReach} of ${ENGINES.length} engines, ${row.firstMentions} of ${slots.length} lead slots, ${row.totalCitations} of ${board.totalCitations} citations.`
    : `${target}: not cited once in this panel of ${board.totalCitations} citations across ${board.questionCount} questions.`;

  return {
    domain: target,
    headline,
    findings,
    replicable: replicable(target, row, cls, { slots, slotsOnTopic, homepages, totalCitations: board.totalCitations, naming, namedWithoutOwnCitation, questionCount: board.questionCount }),
    notReplicable: notReplicable(target, row, cls, { slots, slotsByClass, byVolume, totalCitations: board.totalCitations, consensus: board.consensus }),
  };
}

/* ------------------------------------------------------------------- factor 1 */

function engineReachFinding(
  target: string,
  row: DomainRow | undefined,
  board: Board,
  panel: { reachOne: number; citedOnce: number; byVolume: DomainRow | undefined },
): FactorFinding {
  const base = {
    key: "engineReach",
    name: "Engine reach across the five-engine panel",
    question: "Do all five engines reach for this domain, or is it one engine's habit?",
    source: "citation-data" as const,
  };

  const floor = `On this panel ${panel.reachOne} of the ${board.rows.length} cited domains are reached by exactly one engine and ${panel.citedOnce} are cited exactly once, so one engine is the noise floor and two or more is already above it.`;
  const consensusLine = board.consensus.length
    ? `${board.consensus.length} of ${board.rows.length} domains are cited by all ${ENGINES.length} engines: ${board.consensus.join(", ")}.`
    : `No domain on this panel is cited by all ${ENGINES.length} engines.`;

  if (!row) {
    return {
      ...base,
      verdict: `${target} is cited by 0 of the ${ENGINES.length} engines on this panel.`,
      evidence: [`${target} appears in none of the ${board.totalCitations} citations across ${board.questionCount} questions.`, floor, consensusLine],
      strength: 0,
    };
  }

  const per = ENGINES.filter((e) => row.perEngine[e.key] > 0).map((e) => `${e.label} ${row.perEngine[e.key]}`);
  const volumeLine = !panel.byVolume
    ? ""
    : panel.byVolume.domain === target
      ? `Reach and volume stay separate numbers: ${target} holds the largest citation share on the panel (${row.totalCitations} of ${board.totalCitations}, ${pct(row.totalCitations, board.totalCitations)}%) on only ${row.engineReach} of ${ENGINES.length} engines, so its volume is not reach.`
      : `Reach and volume stay separate numbers: ${panel.byVolume.domain} holds the largest citation share on the panel (${panel.byVolume.totalCitations} of ${board.totalCitations}, ${pct(panel.byVolume.totalCitations, board.totalCitations)}%) on ${panel.byVolume.engineReach} of ${ENGINES.length} engines, while ${target} holds ${row.totalCitations} (${pct(row.totalCitations, board.totalCitations)}%) on ${row.engineReach}.`;

  return {
    ...base,
    verdict:
      row.engineReach === ENGINES.length
        ? `Every engine reaches for ${target}, so what it carries transfers across five different retrieval stacks.`
        : `${target} is reached by ${row.engineReach} of the ${ENGINES.length} engines, so part of its standing is one stack's behaviour rather than a property all five select for.`,
    evidence: [
      `${target} is cited by ${row.engineReach} of ${ENGINES.length} engines: ${per.join(", ")}.`,
      `It appears on ${row.questions} of the ${board.questionCount} questions, ${row.totalCitations} citations in total, ${pct(row.totalCitations, board.totalCitations)}% of the panel.`,
      floor,
      consensusLine,
      volumeLine,
    ].filter(Boolean),
    strength: clamp((row.engineReach / ENGINES.length) * 100),
  };
}

/* ------------------------------------------------------------------- factor 2 */

interface SlotPanel {
  slots: LeadSlot[];
  slotsByClass: Record<string, number>;
  commercialSlots: LeadSlot[];
  informationalSlots: LeadSlot[];
  commercialQuestions: number;
  commercialLeader: { cls: SourceClass; n: number } | null;
  informationalLeader: { cls: SourceClass; n: number } | null;
  answersTotal: number;
  answersWithoutCitations: number;
  slotsOnTopic: number;
  homepages: number;
  totalCitations: number;
  byVolume: DomainRow | undefined;
  maxLead: number;
  questionCount: number;
}

function leadSlotFinding(target: string, row: DomainRow | undefined, p: SlotPanel): FactorFinding {
  const mine = p.slots.filter((s) => s.domain === target);
  const mineCommercial = mine.filter((s) => s.intent === "commercial").length;
  const mineInformational = mine.length - mineCommercial;

  const classLine = `Lead slots by source class: ${Object.entries(p.slotsByClass)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${CLASS_LABEL[c as SourceClass]} ${n}`)
    .join(", ")}.`;

  const splitLine = `Split by intent, the class that leads flips: on the ${p.commercialQuestions} commercial questions ${p.commercialLeader ? `${CLASS_LABEL[p.commercialLeader.cls]} takes ${p.commercialLeader.n} of ${p.commercialSlots.length} lead slots` : "no engine named a first source"}; on the ${p.questionCount - p.commercialQuestions} informational ones ${p.informationalLeader ? `${CLASS_LABEL[p.informationalLeader.cls]} takes ${p.informationalLeader.n} of ${p.informationalSlots.length}` : "no engine named a first source"}.`;

  const shapeLine = `${p.slotsOnTopic} of the ${p.slots.length} lead-slot URLs carry at least half of the question's content words in their path, and ${p.homepages} of the ${p.totalCitations} citations on the panel point at a homepage.`;

  const divergence = p.byVolume
    ? `Being in the list and being the source leaned on are different outcomes: ${p.byVolume.domain} holds the largest citation share (${p.byVolume.totalCitations} of ${p.totalCitations}, ${pct(p.byVolume.totalCitations, p.totalCitations)}%) and ${p.byVolume.firstMentions} lead slots.`
    : "";

  const perQuestion = mine.length
    ? [...new Set(mine.map((s) => s.question))]
        .map((q) => {
          const here = mine.filter((s) => s.question === q);
          const answering = p.slots.filter((s) => s.question === q).length;
          return `"${q}": first source in ${here.length} of the ${answering} engines that named one.`;
        })
    : [];

  return {
    key: "leadSlotByIntent",
    name: "Lead-slot ownership, split by question intent",
    question: "When an engine has to name one source first, does it pick this domain, and for which kind of question?",
    source: "citation-data",
    verdict: mine.length
      ? `${target} is the first source an engine names ${mine.length} times out of ${p.slots.length}, ${mineCommercial} on commercial questions and ${mineInformational} on informational ones.`
      : `${target} never takes the first slot: 0 of the ${p.slots.length} lead slots on this panel, so it is in the list rather than being the source the engine leans on.`,
    evidence: [
      `The panel has ${p.slots.length} lead slots, not ${p.answersTotal}, because ${p.answersWithoutCitations} of the ${p.answersTotal} engine answers cited nothing.`,
      row
        ? `${target} holds ${mine.length} of them, against ${row.totalCitations} citations overall, a lead rate of ${pct(mine.length, row.totalCitations)}% of its own citations.`
        : `${target} holds 0 of them and is not cited on this panel at all.`,
      ...perQuestion,
      classLine,
      splitLine,
      shapeLine,
      divergence,
    ].filter(Boolean),
    strength: p.maxLead ? clamp((mine.length / p.maxLead) * 100) : 0,
  };
}

/* ------------------------------------------------------------------- factor 3 */

function proseNamingFinding(
  target: string,
  row: DomainRow | undefined,
  questions: QuestionResult[],
  brands: BrandEntry[],
  p: { naming: NamingRow[]; namedWithoutOwnCitation: number; answersWithText: number; answersTotal: number; answersWithoutCitations: number },
): FactorFinding {
  // The target's own name in the prose, counted the same way as any brand's.
  const own =
    brands.find((b) => b.ownDomains.includes(target)) ??
    ({ name: nameTokenFor(target), aliases: [nameTokenFor(target)], ownDomains: [target] } as BrandEntry);
  const mine = brandNamingTable(questions, [own])[0] ?? {
    name: own.name,
    answers: 0,
    engines: 0,
    answersCitingOwnDomain: 0,
    answersWithNoCitations: 0,
  };

  const table = p.naming
    .slice(0, 7)
    .map(
      (n) =>
        `${n.name}: named in ${plural(n.answers, "answer")} across ${plural(n.engines, "engine")}, own domain cited in ${n.answersCitingOwnDomain} of them.`,
    );

  const uncitedNaming = p.naming.filter((n) => n.answersWithNoCitations > 0);
  const uncitedLine = uncitedNaming.length
    ? `Named with no source shown, attributable to nothing measurable here: ${uncitedNaming
        .map((n) => `${n.name} in ${n.answersWithNoCitations}`)
        .join(", ")}, inside the ${p.answersWithoutCitations} answers that cited no source at all.`
    : `None of the ${p.answersWithoutCitations} answers that cited no source named a brand from this list.`;

  return {
    key: "proseNamingGap",
    name: "Named in the answer without being cited",
    question: "Is the brand named in the prose the reader actually reads, even when its own site is nowhere in the source list?",
    source: "citation-data",
    verdict: mine.answers
      ? `"${own.name}" is named in the prose of ${mine.answers} of the ${p.answersWithText} answers that carry text, and ${mine.answersCitingOwnDomain} of those also cite ${target}.`
      : `"${own.name}" is never named in the prose on this panel, so whatever standing ${target} has is in the source list, not in the sentence a person reads.`,
    evidence: [
      mine.answers
        ? `${own.name} named in ${plural(mine.answers, "answer")} across ${plural(mine.engines, "engine")}; ${target} cited in ${mine.answersCitingOwnDomain} of those answers. The two counts are reported separately on purpose.`
        : `${own.name} named in 0 answers; ${target} cited in ${row?.totalCitations ?? 0}.`,
      `Brands named in the prose on this panel, with how often their own site was cited in the same answer:`,
      ...table,
      `${p.namedWithoutOwnCitation} of the ${p.naming.length} named brands were named with zero citations of their own domain, so the usual route into an answer here is somebody else's page.`,
      uncitedLine,
    ].filter(Boolean),
    strength: p.answersWithText ? clamp((mine.answers / p.answersWithText) * 100) : 0,
  };
}

/* ------------------------------------------------------- copyable and not copyable */

function replicable(
  target: string,
  row: DomainRow | undefined,
  cls: SourceClass,
  p: { slots: LeadSlot[]; slotsOnTopic: number; homepages: number; totalCitations: number; naming: NamingRow[]; namedWithoutOwnCitation: number; questionCount: number },
): string[] {
  const out: string[] = [
    `One page per question, at a path that says the question. ${p.slotsOnTopic} of the ${p.slots.length} lead-slot URLs carry at least half the question's content words in their path, and ${p.homepages} of the ${p.totalCitations} citations point at a homepage.`,
  ];

  if (row) {
    const top = row.pages[0];
    if (top && row.pages.length > 0) {
      out.push(
        `Concentrate the topic on one URL rather than spreading it. ${target} is cited ${row.totalCitations} times from ${row.pages.length} distinct pages, and its most cited page carries ${top.count} of those on its own: ${top.url}`,
      );
    }
    out.push(
      `Cover the whole question set, not one question. ${target} appears on ${row.questions} of the ${p.questionCount} questions on this panel.`,
    );
  }

  if (p.naming.length) {
    out.push(
      `Get named on the pages that are already cited. ${p.namedWithoutOwnCitation} of the ${p.naming.length} brands named in these answers were named with zero citations of their own site, so the naming came from someone else's page.`,
    );
  }

  if (cls === "editorial") {
    out.push(
      `The page format is copyable even though the masthead is not: a dated, tested, list-shaped page on one URL that answers one buying question.`,
    );
  }
  if (cls === "institution") {
    out.push(
      `The claim style is copyable: stated concentrations and pH values in plain prose on a single stable URL. Whether the brand's own numbers agree with these pages is the institutionalCorroboration factor, which needs a page fetch and is not run here.`,
    );
  }
  return out;
}

function notReplicable(
  target: string,
  row: DomainRow | undefined,
  cls: SourceClass,
  p: { slots: LeadSlot[]; slotsByClass: Record<string, number>; byVolume: DomainRow | undefined; totalCitations: number; consensus: string[] },
): string[] {
  const mine = p.slots.filter((s) => s.domain === target).length;
  const out: string[] = [];

  if (cls === "forum") {
    out.push(
      `${target} is a forum. Its ${mine} of ${p.slots.length} lead slots come from engines treating community discussion as the answer, and a brand cannot become a forum. The action this implies is participation in threads, not publishing a page, and this tool does not claim it can close that gap.`,
    );
  }
  if (cls === "institution") {
    out.push(
      `${target} carries institutional standing that a commercial site cannot acquire. Copy the claim style, do not expect to inherit the trust.`,
    );
  }
  if (cls === "editorial") {
    out.push(
      `${target} is the outlet. A brand cannot become the masthead, the byline or the testing desk. What is available is inclusion in the page, which is the editorialRoundupInclusion factor and needs a page fetch to answer.`,
    );
  }
  if (cls === "video") {
    out.push(
      `${target} is the platform, not a publisher a brand can become. Presence on it is possible, being it is not.`,
    );
  }
  if (row && row.engineReach === ENGINES.length) {
    out.push(
      `${target} is one of ${p.consensus.length} domains on this panel cited by all ${ENGINES.length} engines. That position is the hardest to displace and no page a client publishes removes it.`,
    );
  }
  if (p.byVolume && p.byVolume.firstMentions === 0) {
    out.push(
      `Volume is not a recommendation slot, so do not sell it as one: ${p.byVolume.domain} holds the largest citation share on this panel (${p.byVolume.totalCitations} of ${p.totalCitations}, ${pct(p.byVolume.totalCitations, p.totalCitations)}%) and 0 of the ${p.slots.length} lead slots.`,
    );
  }
  out.push(
    `This teardown answers 3 of the 9 designed factors, the ones the citations alone can settle. The other ${FACTORS_NOT_RUN_HERE.length} need a page fetch, a second engine run, or are not measurable at all: ${FACTORS_NOT_RUN_HERE.map((f) => f.key).join(", ")}.`,
  );
  return out;
}
