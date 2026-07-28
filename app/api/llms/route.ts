import * as cheerio from "cheerio";
import { checkCrawlerAccess } from "../../../engine/crawlerAccess";
import { fetchPage, IngestError, normaliseUrl } from "../../../engine/ingest";
import { buildLlmsTxt, buildRobotsDiff, type PageFacts } from "../../../engine/llmsTxt";
import { discoverSitemap } from "../../../engine/sitemap";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Bounded: a large sitemap would otherwise turn one click into hundreds of fetches. */
const MAX_PAGES = 24;
const CONCURRENCY = 6;

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Two files the client uploads and confirms with curl on their own domain. Needs no
 * citation map and no prior run, so it works on day one for any site.
 */
export async function POST(req: Request) {
  let body: { url?: string; siteName?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const raw = (body.url ?? "").trim();
  if (!raw) return Response.json({ error: "Enter the site to build these files for." }, { status: 400 });

  let origin: string;
  try {
    origin = new URL(normaliseUrl(raw).toString()).origin;
  } catch (e) {
    return Response.json({ error: e instanceof IngestError ? e.message : "That is not a URL." }, { status: 400 });
  }

  try {
    const access = await checkCrawlerAccess(origin);
    const sitemap = await discoverSitemap(origin, access.raw);

    // an even stride across the whole sitemap, not the first N: a per-locale index puts
    // twenty translations of the homepage at the front, and the head would be all of them
    const all = sitemap.entries.map((e) => e.loc);
    const stride = Math.max(1, Math.floor(all.length / MAX_PAGES));
    const targets = all.filter((_, i) => i % stride === 0).slice(0, MAX_PAGES);
    const fetched = await pool(targets, CONCURRENCY, async (url): Promise<PageFacts | { failed: string }> => {
      try {
        const page = await fetchPage(url);
        const $ = cheerio.load(page.html);
        // both strings are lifted from their own HTML, never written here
        const title = ($("title").first().text() || $("h1").first().text()).trim();
        const description = ($('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content") ?? "").trim();
        if (!title) return { failed: url };
        return { url: page.finalUrl, title, description: description || undefined };
      } catch {
        return { failed: url };
      }
    });

    const pages = fetched.filter((p): p is PageFacts => !("failed" in p));
    const failed = fetched.filter((p): p is { failed: string } => "failed" in p).length;

    const siteName = (body.siteName ?? "").trim() || new URL(origin).hostname.replace(/^www\./, "");
    const llms = buildLlmsTxt({
      siteName,
      siteUrl: origin,
      pages,
      sitemapUrl: sitemap.source || undefined,
    });

    const robots = buildRobotsDiff({
      current: access.raw,
      access,
      sitemapUrl: sitemap.source || undefined,
      sitemapDeclared: sitemap.declaredInRobots,
      addLlmsTxt: pages.length > 0,
    });

    return Response.json({
      origin,
      siteName,
      access: { blocked: access.blocked.map((b) => b.ua), robotsUrl: access.robotsUrl, found: access.found },
      sitemap: {
        source: sitemap.source,
        declaredInRobots: sitemap.declaredInRobots,
        total: sitemap.entries.length,
        attempts: sitemap.attempts,
      },
      pages: { listed: llms.listed, undescribed: llms.undescribed, unreadable: failed, sampled: targets.length },
      llmsTxt: llms.content,
      robotsDiff: robots?.diff ?? null,
      robotsMerged: robots?.merged ?? null,
      robotsAdditions: robots?.additions ?? [],
    });
  } catch (e) {
    return Response.json({ error: e instanceof IngestError ? e.message : (e as Error).message }, { status: 422 });
  }
}
