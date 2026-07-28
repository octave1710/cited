import { ENGINES, type Citation, type EngineAnswer, type EngineKey, type QuestionResult } from "./types";

/**
 * One Apify dataset item carries five differently-shaped answers. This turns them into
 * one shape without losing which engine said what.
 *
 * The shapes were read off real runs, not off documentation:
 *   aiOverview             { type, content, sources:[{url,title,description}] }
 *   aiModeResult           { text, sources:[{id,title,url,description,section}] }
 *   perplexitySearchResult { text, sources:[{title,url,snippet,date}], citationUrls:[] }
 *   chatGptSearchResult    { text, sources:[{id,title,url,section}], queryFanOut:[] }
 *   geminiSearchResult     { text, sources:[...] }
 */

export function toDomain(url: string): string | null {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    // a hostname is the only thing allowed through; anything else is not a citation
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) ? h : null;
  } catch {
    return null;
  }
}

/** Strips the attribution parameter engines append, so the same page is one page. */
export function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"]) {
      u.searchParams.delete(p);
    }
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
}

interface RawSource {
  url?: unknown;
  title?: unknown;
}

function citationsFrom(sources: unknown, extraUrls: unknown = []): Citation[] {
  const list: Citation[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: unknown, rawTitle: unknown) => {
    if (typeof rawUrl !== "string") return;
    const url = cleanUrl(rawUrl);
    const domain = toDomain(url);
    if (!domain || seen.has(url)) return;
    seen.add(url);
    list.push({ url, domain, title: typeof rawTitle === "string" ? rawTitle : "", rank: list.length + 1 });
  };

  if (Array.isArray(sources)) for (const s of sources as RawSource[]) push(s?.url, s?.title);
  // perplexity repeats its citations as bare strings; they are the same pages, deduped above
  if (Array.isArray(extraUrls)) for (const u of extraUrls) push(u, "");

  return list;
}

interface RawItem {
  searchQuery?: { term?: string };
  organicResults?: { url?: string; title?: string }[];
  aiOverview?: { content?: string; sources?: unknown };
  aiModeResult?: { text?: string; sources?: unknown };
  perplexitySearchResult?: { text?: string; sources?: unknown; citationUrls?: unknown };
  chatGptSearchResult?: { text?: string; sources?: unknown; queryFanOut?: unknown };
  geminiSearchResult?: { text?: string; sources?: unknown };
}

const SLOTS: Record<EngineKey, (i: RawItem) => { text: string; citations: Citation[] } | null> = {
  aiOverview: (i) =>
    i.aiOverview ? { text: i.aiOverview.content ?? "", citations: citationsFrom(i.aiOverview.sources) } : null,
  aiMode: (i) =>
    i.aiModeResult ? { text: i.aiModeResult.text ?? "", citations: citationsFrom(i.aiModeResult.sources) } : null,
  perplexity: (i) =>
    i.perplexitySearchResult
      ? {
          text: i.perplexitySearchResult.text ?? "",
          citations: citationsFrom(i.perplexitySearchResult.sources, i.perplexitySearchResult.citationUrls),
        }
      : null,
  chatgpt: (i) =>
    i.chatGptSearchResult
      ? { text: i.chatGptSearchResult.text ?? "", citations: citationsFrom(i.chatGptSearchResult.sources) }
      : null,
  gemini: (i) =>
    i.geminiSearchResult ? { text: i.geminiSearchResult.text ?? "", citations: citationsFrom(i.geminiSearchResult.sources) } : null,
};

export function extractQuestion(item: RawItem): QuestionResult {
  const answers: EngineAnswer[] = ENGINES.map(({ key }) => {
    const got = SLOTS[key](item);
    if (!got) return { engine: key, text: "", citations: [], empty: "this engine returned no answer for this question" };
    if (!got.citations.length) {
      return {
        engine: key,
        text: got.text,
        citations: [],
        // an answer with no sources is a real and reportable state, not a gap in the data
        empty: got.text ? "answered without citing any source" : "this engine returned no answer for this question",
      };
    }
    return { engine: key, text: got.text, citations: got.citations };
  });

  const organic = (item.organicResults ?? [])
    .map((r, idx) => {
      const domain = r.url ? toDomain(r.url) : null;
      return domain ? { url: cleanUrl(r.url as string), domain, title: r.title ?? "", rank: idx + 1 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const fan = item.chatGptSearchResult?.queryFanOut;
  return {
    question: item.searchQuery?.term ?? "",
    answers,
    fanOut: Array.isArray(fan) ? fan.filter((q): q is string => typeof q === "string") : [],
    organic,
  };
}

export function extractAll(items: unknown[]): QuestionResult[] {
  return items.map((i) => extractQuestion(i as RawItem)).filter((q) => q.question);
}
