/**
 * Real page fetch for the app. Anything the user types is untrusted input, so the
 * URL is validated and private network targets are refused (SSRF boundary).
 *
 * There is no silent fixture substitution: if the fetch fails we say so and let the
 * caller offer a clearly-labelled demo page instead. Swapping in local content for a
 * URL the user typed would be fabricating provenance.
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const dnsLookup = lookup;

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
 * Refuses an IP inside any range that is not a public internet destination.
 * Works on the parsed address, not on the text, because the same loopback address
 * can be written 127.0.0.1, 2130706433, 0x7f.1, [::ffff:127.0.0.1] or [::ffff:7f00:1].
 */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 + test-net
    if (a >= 224) return true; // multicast and reserved
    return false;
  }
  if (v !== 6) return true; // not an IP at all: never treat it as safe here

  const h = ip.toLowerCase();
  // an IPv4-mapped address is an IPv4 destination wearing IPv6 syntax
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  if (mapped) return isPrivateIp(mapped[1]);
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mappedHex) {
    const n = (parseInt(mappedHex[1], 16) << 16) | parseInt(mappedHex[2], 16);
    return isPrivateIp([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  if (h === "::" || h === "::1") return true;
  if (/^f[cd]/.test(h)) return true; // unique-local fc00::/7
  if (/^fe[89ab]/.test(h)) return true; // link-local fe80::/10
  return false;
}

/** Hostname-level refusal. Text only: the DNS check happens separately, at fetch time. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (isIP(h)) return isPrivateIp(h);
  // a bare integer or hex host is a legal IPv4 spelling that never survives isIP()
  if (/^(0x[0-9a-f]+|\d+)$/.test(h)) return true;
  return false;
}

/**
 * The only guard that cannot be spoofed by spelling: ask DNS where the name points
 * and refuse if any answer is private. A name that resolves to 127.0.0.1 is refused
 * however it is written.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (isPrivateHost(h)) throw new IngestError("Private and loopback addresses are refused.", "blocked_host");
  if (isIP(h)) return; // already validated above, no name to resolve

  let addrs: { address: string }[];
  try {
    addrs = await dnsLookup(h, { all: true });
  } catch {
    throw new IngestError(`${hostname} does not resolve.`, "network");
  }
  if (!addrs.length) throw new IngestError(`${hostname} does not resolve.`, "network");
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new IngestError(`${hostname} resolves to a private address (${a.address}) and was refused.`, "blocked_host");
    }
  }
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

const MAX_HOPS = 5;

/**
 * Fetches with redirects followed by hand, revalidating the host on every hop.
 * `redirect: "follow"` checks the first URL and then goes wherever it is sent, so a
 * public URL answering 302 to http://169.254.169.254 walks straight past the guard.
 */
export async function safeFetch(input: string, accept: string): Promise<Response> {
  let url = normaliseUrl(input);

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": UA, accept },
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

    if (res.status < 300 || res.status > 399) return res;

    const location = res.headers.get("location");
    if (!location) return res;
    if (hop === MAX_HOPS) throw new IngestError(`${url.hostname} redirected more than ${MAX_HOPS} times.`, "network");
    try {
      url = normaliseUrl(new URL(location, url).toString());
    } catch (e) {
      if (e instanceof IngestError) throw e;
      throw new IngestError(`${url.hostname} redirected to something that is not a usable URL.`, "network");
    }
  }
  throw new IngestError("Too many redirects.", "network");
}

export async function fetchPage(input: string): Promise<FetchedPage> {
  const url = normaliseUrl(input);
  const res = await safeFetch(input, "text/html,application/xhtml+xml");

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

// DEMO_PAGES lives in its own import-free module so client components can read it
export { DEMO_PAGES, type DemoId } from "./demoPages";
