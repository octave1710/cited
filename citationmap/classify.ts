import type { Bucket, DomainStat, QuestionResult } from "./types";

/**
 * Reference works, governments and academia. A question whose only named sources are
 * these has no commercial owner, which is what makes it the cheapest win on the map.
 */
const INSTITUTIONAL = /(^|\.)(wikipedia\.org|who\.int|europa\.eu|cochrane\.org|nhs\.uk)$|\.gov(\.[a-z]{2})?$|\.edu$|\.ac\.[a-z]{2}$/;

/** A domain has to own this many questions outright before a loss counts as consolidated. */
export const OWNER_THRESHOLD = 3;

/** "https://www.Healthline.com/nutrition/x" and "Healthline.com" both become healthline.com. */
export function toDomain(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/[.,;:)\]]+$/, "");
  // a hostname is letters, digits, dots and hyphens. Anything else (a space, a CRLF that
  // would forge a header, a brand name) is refused rather than lowercased into a domain.
  if (!s || !s.includes(".") || !/^[a-z0-9.-]+$/.test(s) || s.startsWith(".") || s.endsWith(".")) return null;
  return s;
}

export const isInstitutional = (d: string) => INSTITUTIONAL.test(d);

/** Ranks domains by questions won, then by total appearances. Brand is flagged, never boosted. */
export function rankDomains(results: QuestionResult[], brandDomain: string): DomainStat[] {
  const stats = new Map<string, DomainStat>();
  const get = (d: string) =>
    stats.get(d) ?? (stats.set(d, { domain: d, wins: 0, appearances: 0, isBrand: d === brandDomain }), stats.get(d)!);

  for (const r of results) {
    r.domains.forEach((d, i) => {
      const s = get(d);
      s.appearances++;
      if (i === 0) s.wins++;
    });
  }
  return [...stats.values()].sort((a, b) => b.wins - a.wins || b.appearances - a.appearances);
}

/**
 * owned     the brand appears in the source list
 * open      the engine named nothing at all
 * reference only encyclopedias, governments or academia were named, so no commercial
 *           page holds it. Kept apart from `open` because saying "no site was named"
 *           about an answer that named nhs.uk is a claim the user disproves in one retype.
 * lost      one domain owns it and owns at least OWNER_THRESHOLD questions across the map
 * contested cited, but by a site with no consolidated hold on the category
 */
export function bucketOf(r: QuestionResult, consolidated: Set<string>): Bucket {
  if (r.brandRank > 0) return "owned";
  if (r.domains.length === 0) return "open";
  if (r.domains.every(isInstitutional)) return "reference";
  return r.owner && consolidated.has(r.owner) ? "lost" : "contested";
}

/** Second pass: needs every result, because "consolidated owner" is a property of the whole map. */
export function classify(results: QuestionResult[], brandDomain: string) {
  const domains = rankDomains(results, brandDomain);
  const consolidated = new Set(
    domains.filter((d) => !d.isBrand && d.wins >= OWNER_THRESHOLD).map((d) => d.domain),
  );
  const questions = results.map((r) => ({ ...r, bucket: bucketOf(r, consolidated) }));
  const counts: Record<Bucket, number> = { owned: 0, lost: 0, contested: 0, reference: 0, open: 0 };
  for (const q of questions) counts[q.bucket]++;
  return { questions, domains, counts };
}
