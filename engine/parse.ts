import * as cheerio from "cheerio";
import type { Heading, ParsedPage, Section } from "./types.js";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function findDate(ld: Record<string, unknown>[], $: cheerio.CheerioAPI, keys: string[], metas: string[]): string | undefined {
  for (const block of ld) {
    for (const k of keys) {
      const v = block[k];
      if (typeof v === "string" && v) return v;
    }
  }
  for (const m of metas) {
    const v = $(`meta[property="${m}"], meta[name="${m}"]`).attr("content");
    if (v) return v;
  }
  const t = $("time[datetime]").first().attr("datetime");
  return t || undefined;
}

function findAuthor(ld: Record<string, unknown>[], $: cheerio.CheerioAPI): string | undefined {
  for (const block of ld) {
    const a = block["author"];
    if (typeof a === "string") return a;
    if (a && typeof a === "object") {
      const name = (Array.isArray(a) ? a[0] : a)?.["name"];
      if (typeof name === "string") return name;
    }
  }
  return $('meta[name="author"]').attr("content") || $('[rel="author"]').first().text().trim() || undefined;
}

function collectSameAs(ld: Record<string, unknown>[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (Array.isArray(o["sameAs"])) out.push(...(o["sameAs"] as unknown[]).filter((s): s is string => typeof s === "string"));
      Object.values(o).forEach(walk);
    }
  };
  ld.forEach(walk);
  return [...new Set(out)];
}

export function parse(html: string, url?: string): ParsedPage {
  const $ = cheerio.load(html);

  const jsonLd: Record<string, unknown>[] = [];
  const jsonLdErrors: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed = JSON.parse(raw);
      const blocks = Array.isArray(parsed) ? parsed : parsed["@graph"] && Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      for (const b of blocks) if (b && typeof b === "object") jsonLd.push(b);
    } catch (e) {
      jsonLdErrors.push(`Invalid JSON-LD: ${(e as Error).message}`);
    }
  });

  $("script, style, nav, footer, noscript").remove();

  const headings: Heading[] = [];
  const sections: Section[] = [];
  let current: Section = { heading: null, paragraphs: [] };
  sections.push(current);
  $("h1, h2, h3, h4, h5, h6, p, li, blockquote").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = clean($(el).text());
    if (!text) return;
    if (tag.startsWith("h")) {
      const h = { level: Number(tag[1]), text };
      headings.push(h);
      current = { heading: h, paragraphs: [] };
      sections.push(current);
    } else if (tag === "p" || tag === "li") {
      // ponytail: <li> counted as a paragraph, good enough for passage scoring
      current.paragraphs.push(text);
    }
  });

  const orderedLists: string[][] = [];
  $("ol").each((_, el) => {
    const items = $(el)
      .find("li")
      .map((_, li) => clean($(li).text()))
      .get()
      .filter(Boolean);
    if (items.length) orderedLists.push(items);
  });

  const blockquotes: string[] = [];
  $("blockquote").each((_, el) => {
    const t = clean($(el).text());
    if (t) blockquotes.push(t);
  });

  const outboundLinks: { href: string; text: string }[] = [];
  $("a[href^='http']").each((_, el) => {
    outboundLinks.push({ href: $(el).attr("href")!, text: clean($(el).text()) });
  });

  const bodyText = clean($("body").text());

  return {
    url,
    title: clean($("title").text() || $("h1").first().text()),
    metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? "",
    robotsMeta: $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "",
    lang: $("html").attr("lang") ?? "",
    headings,
    sections: sections.filter((s) => s.heading !== null || s.paragraphs.length > 0),
    wordCount: bodyText ? bodyText.split(" ").length : 0,
    textToHtmlRatio: html.length ? bodyText.length / html.length : 0,
    jsonLd,
    jsonLdErrors,
    publishedDate: findDate(jsonLd, $, ["datePublished"], ["article:published_time"]),
    modifiedDate: findDate(jsonLd, $, ["dateModified"], ["article:modified_time"]),
    author: findAuthor(jsonLd, $),
    blockquotes,
    outboundLinks,
    sameAsLinks: collectSameAs(jsonLd),
    orderedLists,
  };
}
