import * as cheerio from "cheerio";
import { IngestError, normaliseUrl, safeFetch } from "./ingest";

/**
 * Sitemap discovery, then one level of index expansion.
 *
 * A 200 is not proof: paulaschoice.com/sitemap.xml answers HTTP 200 with an empty
 * body and content-type text/html. So the body has to parse as XML with a urlset or
 * sitemapindex root before anything is reported as a sitemap.
 */

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export interface SitemapReport {
  /** Where the URLs came from, in the order tried. */
  source: string;
  declaredInRobots: boolean;
  /** The URLs actually kept, capped at MAX_ENTRIES. */
  entries: SitemapEntry[];
  /**
   * URLs seen before any cap. Reported apart from `entries.length`, because a count
   * that saturates at our own constant is our limit wearing the costume of a
   * measurement, and the client can disprove it by counting their own file.
   */
  discovered: number;
  /** True when discovery stopped early, so no total can be claimed at all. */
  truncated: boolean;
  childSitemaps: { total: number; read: number };
  attempts: { url: string; outcome: string }[];
}

const MAX_ENTRIES = 400;
const MAX_INDEX_CHILDREN = 5;

export function parseSitemapXml(xml: string): { kind: "urlset" | "index" | "none"; entries: SitemapEntry[] } {
  const $ = cheerio.load(xml, { xmlMode: true });
  const isIndex = $("sitemapindex").length > 0;
  const isUrlset = $("urlset").length > 0;
  if (!isIndex && !isUrlset) return { kind: "none", entries: [] };

  const entries: SitemapEntry[] = [];
  $(isIndex ? "sitemap" : "url").each((_, el) => {
    const loc = $(el).find("loc").first().text().trim();
    if (!loc) return;
    const lastmod = $(el).find("lastmod").first().text().trim() || undefined;
    entries.push({ loc, lastmod });
  });
  return { kind: isIndex ? "index" : "urlset", entries };
}

/** Pulls every `Sitemap:` line out of a robots.txt body. */
export function sitemapsFromRobots(robots: string): string[] {
  return robots
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => /^sitemap\s*:/i.test(l))
    .map((l) => l.slice(l.indexOf(":") + 1).trim())
    .filter(Boolean);
}

async function fetchXml(url: string): Promise<{ xml: string } | { error: string }> {
  try {
    const res = await safeFetch(url, "application/xml,text/xml,*/*");
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const xml = await res.text();
    if (!xml.trim()) return { error: "HTTP 200 with an empty body" };
    return { xml };
  } catch (e) {
    return { error: e instanceof IngestError ? e.message : (e as Error).message };
  }
}

/**
 * Finds the site's sitemap, declared or conventional, and returns its URLs.
 * Every attempt is reported so a failure is legible rather than a silent empty list.
 */
export async function discoverSitemap(siteUrl: string, robotsBody = ""): Promise<SitemapReport> {
  const origin = new URL(normaliseUrl(siteUrl).toString()).origin;
  const declared = sitemapsFromRobots(robotsBody);
  const candidates = [...declared, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const attempts: { url: string; outcome: string }[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    const got = await fetchXml(candidate);
    if ("error" in got) {
      attempts.push({ url: candidate, outcome: got.error });
      continue;
    }
    const parsed = parseSitemapXml(got.xml);
    if (parsed.kind === "none") {
      attempts.push({ url: candidate, outcome: "answered, but the body is not a sitemap" });
      continue;
    }

    if (parsed.kind === "urlset") {
      attempts.push({ url: candidate, outcome: `${parsed.entries.length} URLs` });
      return {
        source: candidate,
        declaredInRobots: declared.includes(candidate),
        entries: parsed.entries.slice(0, MAX_ENTRIES),
        discovered: parsed.entries.length,
        truncated: parsed.entries.length > MAX_ENTRIES,
        childSitemaps: { total: 0, read: 0 },
        attempts,
      };
    }

    // one level of index expansion, bounded: a large site indexes hundreds of children
    attempts.push({ url: candidate, outcome: `index of ${parsed.entries.length} sitemaps` });
    const entries: SitemapEntry[] = [];
    let discovered = 0;
    let childrenRead = 0;
    for (const child of parsed.entries.slice(0, MAX_INDEX_CHILDREN)) {
      const childGot = await fetchXml(child.loc);
      if ("error" in childGot) {
        attempts.push({ url: child.loc, outcome: childGot.error });
        continue;
      }
      const childParsed = parseSitemapXml(childGot.xml);
      attempts.push({ url: child.loc, outcome: `${childParsed.entries.length} URLs` });
      childrenRead++;
      discovered += childParsed.entries.length;
      entries.push(...childParsed.entries);
      if (entries.length >= MAX_ENTRIES) break;
    }
    if (parsed.entries.length > MAX_INDEX_CHILDREN) {
      attempts.push({
        url: candidate,
        outcome: `stopped after ${MAX_INDEX_CHILDREN} of ${parsed.entries.length} child sitemaps`,
      });
    }
    return {
      source: candidate,
      declaredInRobots: declared.includes(candidate),
      entries: entries.slice(0, MAX_ENTRIES),
      discovered,
      // an index whose children were not all read has no knowable total at all
      truncated: entries.length > MAX_ENTRIES || childrenRead < parsed.entries.length,
      childSitemaps: { total: parsed.entries.length, read: childrenRead },
      attempts,
    };
  }

  return { source: "", declaredInRobots: false, entries: [], discovered: 0, truncated: false, childSitemaps: { total: 0, read: 0 }, attempts };
}

/** Child sitemaps whose name promises editorial pages, tried before directories of profiles. */
const CONTENT_FIRST = /(content|article|blog|page|post|guide|condition|medicine|health|news)/i;
const CONTENT_LAST = /(profile|dentist|gp|pharmacy|gdos|video|image|campaign|location|store|branch)/i;

/**
 * Streams every URL of a domain's sitemap through a scorer without keeping them.
 *
 * discoverSitemap caps at 400 URLs because llms.txt only needs a sample. Finding ONE
 * page is the opposite problem: nhs.uk keeps its editorial pages in a child sitemap of
 * many thousands, so a 400-URL sample matched nothing and the resolver fell through to
 * a model that invented URLs. Here the whole file is read and only the best few kept.
 */
export async function scanSitemap(
  siteUrl: string,
  robotsBody: string,
  score: (entries: SitemapEntry[]) => void,
  maxChildren = 6,
): Promise<{ source: string; urlsScanned: number; attempts: { url: string; outcome: string }[] }> {
  const origin = new URL(normaliseUrl(siteUrl).toString()).origin;
  const declared = sitemapsFromRobots(robotsBody);
  const attempts: { url: string; outcome: string }[] = [];
  let scanned = 0;

  for (const candidate of [...declared, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
    const got = await fetchXml(candidate);
    if ("error" in got) {
      attempts.push({ url: candidate, outcome: got.error });
      continue;
    }
    const parsed = parseSitemapXml(got.xml);
    if (parsed.kind === "none") {
      attempts.push({ url: candidate, outcome: "answered, but the body is not a sitemap" });
      continue;
    }

    if (parsed.kind === "urlset") {
      score(parsed.entries);
      scanned += parsed.entries.length;
      attempts.push({ url: candidate, outcome: `${parsed.entries.length} URLs scanned` });
      return { source: candidate, urlsScanned: scanned, attempts };
    }

    // editorial children first: a directory of 40,000 GP profiles will never hold the answer
    const children = [...parsed.entries].sort((a, b) => {
      const rank = (l: string) => (CONTENT_LAST.test(l) ? 2 : CONTENT_FIRST.test(l) ? 0 : 1);
      return rank(a.loc) - rank(b.loc);
    });

    attempts.push({ url: candidate, outcome: `index of ${parsed.entries.length} sitemaps` });
    for (const child of children.slice(0, maxChildren)) {
      const childGot = await fetchXml(child.loc);
      if ("error" in childGot) {
        attempts.push({ url: child.loc, outcome: childGot.error });
        continue;
      }
      const childParsed = parseSitemapXml(childGot.xml);
      score(childParsed.entries);
      scanned += childParsed.entries.length;
      attempts.push({ url: child.loc, outcome: `${childParsed.entries.length} URLs scanned` });
    }
    return { source: candidate, urlsScanned: scanned, attempts };
  }

  return { source: "", urlsScanned: 0, attempts };
}
