/**
 * Real page fetch for the app. Anything the user types is untrusted input, so the
 * URL is validated and private network targets are refused (SSRF boundary).
 *
 * There is no silent fixture substitution: if the fetch fails we say so and let the
 * caller offer a clearly-labelled demo page instead. Swapping in local content for a
 * URL the user typed would be fabricating provenance.
 */

export interface FetchedPage {
  html: string;
  finalUrl: string;
  status: number;
  bytes: number;
  fetchedAt: string;
  source: "live" | "demo";
}

export class IngestError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_url"
      | "blocked_host"
      | "not_html"
      | "http_error"
      | "timeout"
      | "network"
      | "too_large",
  ) {
    super(message);
    this.name = "IngestError";
  }
}

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (compatible; CITEDBot/0.1; +https://github.com/octave1710) AppleWebKit/537.36 Chrome/126 Safari/537.36";

/**
 * Loopback, link-local and RFC1918 targets are refused. These are prefix tests on
 * purpose: an anchored full-match pattern silently lets 127.0.0.1 through.
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^0\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true; // unique-local IPv6
  if (/^fe80:/.test(h)) return true; // link-local IPv6
  return false;
}

export function normaliseUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new IngestError("Enter a URL to audit.", "invalid_url");
  // a non-http scheme must be rejected, never silently prefixed into a valid-looking URL
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    throw new IngestError("Only http and https URLs can be audited.", "invalid_url");
  }
  let url: URL;
  try {
    url = new URL(scheme ? raw : `https://${raw}`);
  } catch {
    throw new IngestError(`"${raw}" is not a valid URL.`, "invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new IngestError("Only http and https URLs can be audited.", "invalid_url");
  }
  if (isPrivateHost(url.hostname)) {
    throw new IngestError("Private and loopback addresses are refused.", "blocked_host");
  }
  return url;
}

export async function fetchPage(input: string): Promise<FetchedPage> {
  const url = normaliseUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    throw new IngestError(
      aborted
        ? `${url.hostname} did not answer within ${TIMEOUT_MS / 1000}s.`
        : `Could not reach ${url.hostname}. Check the URL or your connection.`,
      aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new IngestError(`${url.hostname} answered HTTP ${res.status}.`, "http_error");
  }
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html|xml|text\/plain/i.test(type)) {
    throw new IngestError(`That URL returned ${type.split(";")[0]}, not a web page.`, "not_html");
  }

  const html = await res.text();
  if (html.length > MAX_BYTES) {
    throw new IngestError("Page is larger than 3 MB and was not parsed.", "too_large");
  }

  return {
    html,
    finalUrl: res.url || url.toString(),
    status: res.status,
    bytes: html.length,
    fetchedAt: new Date().toISOString(),
    source: "live",
  };
}

/** Bundled pages so the demo runs with no network. Always labelled as demo in the UI. */
export const DEMO_PAGES = [
  {
    id: "medium",
    file: "fixtures/pages/medium.html",
    label: "meridianskinlab.com/guides/vitamin-c-serum",
    note: "ranks, never cited",
  },
  {
    id: "medium-fixed",
    file: "fixtures/pages/medium-fixed.html",
    label: "meridianskinlab.com/guides/vitamin-c-serum (fixed)",
    note: "same page after the fixes",
  },
  {
    id: "good",
    file: "fixtures/pages/good.html",
    label: "meridianskinlab.com/does-vitamin-c-work",
    note: "already citable",
  },
  {
    id: "bad",
    file: "fixtures/pages/bad.html",
    label: "glowmax.com/serum",
    note: "pure marketing copy",
  },
] as const;

export type DemoId = (typeof DEMO_PAGES)[number]["id"];
