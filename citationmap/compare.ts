import type { Bucket, CitationMap } from "./types";

/**
 * Two maps of the same category, compared question by question. This is the number
 * the client is actually buying: not our internal score, but how many of their own
 * category's questions now name them, measured the same way twice.
 *
 * Only questions present in both maps are compared. A question the newer run did not
 * generate is not a loss, and saying otherwise would invent a regression.
 */

export interface QuestionMove {
  id: string;
  text: string;
  intent: string;
  from: Bucket;
  to: Bucket;
  fromOwner: string | null;
  toOwner: string | null;
}

export interface DomainMove {
  domain: string;
  fromWins: number;
  toWins: number;
  delta: number;
  isBrand: boolean;
}

export interface MapDelta {
  /**
   * `owned` is the whole-map count. `ownedComparable` counts only the questions both
   * runs asked, which is the only number the won and lost lists are computed from, so
   * it is the one the panel quotes.
   */
  before: { id: string; createdAt: string; owned: number; ownedComparable: number; questions: number };
  after: { id: string; createdAt: string; owned: number; ownedComparable: number; questions: number };
  /** Questions that exist in both runs. Everything below is counted on these only. */
  comparable: number;
  won: QuestionMove[];
  lost: QuestionMove[];
  otherMoves: QuestionMove[];
  domains: DomainMove[];
  /** Questions the newer run generated that the older one never asked. */
  newQuestions: number;
  /** Questions the older run asked that the newer one did not. */
  droppedQuestions: number;
  daysBetween: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

export function compareMaps(before: CitationMap, after: CitationMap): MapDelta {
  // matched on normalised text, not id: ids are positional and a re-run reorders them
  const beforeByText = new Map(before.questions.map((q) => [norm(q.text), q]));
  const afterByText = new Map(after.questions.map((q) => [norm(q.text), q]));

  const won: QuestionMove[] = [];
  const lost: QuestionMove[] = [];
  const otherMoves: QuestionMove[] = [];
  let comparable = 0;
  let ownedBeforeComparable = 0;
  let ownedAfterComparable = 0;

  for (const [key, a] of afterByText) {
    const b = beforeByText.get(key);
    if (!b) continue;
    comparable++;
    if (b.bucket === "owned") ownedBeforeComparable++;
    if (a.bucket === "owned") ownedAfterComparable++;
    if (b.bucket === a.bucket && b.owner === a.owner) continue;
    const move: QuestionMove = {
      id: a.id,
      text: a.text,
      intent: a.intent,
      from: b.bucket,
      to: a.bucket,
      fromOwner: b.owner,
      toOwner: a.owner,
    };
    if (a.bucket === "owned" && b.bucket !== "owned") won.push(move);
    else if (b.bucket === "owned" && a.bucket !== "owned") lost.push(move);
    else otherMoves.push(move);
  }

  const beforeWins = new Map(before.domains.map((d) => [d.domain, d]));
  const afterWins = new Map(after.domains.map((d) => [d.domain, d]));
  const domains: DomainMove[] = [...new Set([...beforeWins.keys(), ...afterWins.keys()])]
    .map((domain) => {
      const b = beforeWins.get(domain);
      const a = afterWins.get(domain);
      return {
        domain,
        fromWins: b?.wins ?? 0,
        toWins: a?.wins ?? 0,
        delta: (a?.wins ?? 0) - (b?.wins ?? 0),
        isBrand: (a ?? b)!.isBrand,
      };
    })
    // a domain that did not move has no place under a heading that says who moved
    .filter((d) => d.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || y.toWins - x.toWins);

  const ms = new Date(after.createdAt).getTime() - new Date(before.createdAt).getTime();

  return {
    before: { id: before.id, createdAt: before.createdAt, owned: before.counts.owned, ownedComparable: ownedBeforeComparable, questions: before.questions.length },
    after: { id: after.id, createdAt: after.createdAt, owned: after.counts.owned, ownedComparable: ownedAfterComparable, questions: after.questions.length },
    comparable,
    won,
    lost,
    otherMoves,
    domains,
    newQuestions: after.questions.length - comparable,
    droppedQuestions: before.questions.length - comparable,
    daysBetween: Math.max(0, Math.round(ms / 86_400_000)),
  };
}
