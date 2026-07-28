/**
 * Second route to a page: open it in a real browser.
 *
 * WHY THIS EXISTS, and why it does not contradict what the tool measures.
 *
 * mayoclinic.org, bmj.com and nutrition.org answer HTTP 403 to a plain fetch, whatever
 * user-agent it carries, including for their own robots.txt. Measured here, on this
 * machine, in that order: a crawler gets 403, a headless browser gets 403, and a real
 * Chrome window gets 200 with 1,151, 3,915 and 482 words respectively. The wall is not
 * "are you a robot", it is "are you a headless client".
 *
 * That difference is the product's own subject, not a nuisance to route around. A page
 * that serves people and refuses automated readers is very likely invisible to the
 * answer engines too, and the tool now says so instead of reporting "not found". Which
 * route produced the text is carried on every result and shown on screen.
 *
 * Nothing here pretends to be someone else. The crawler identifies itself as CITEDBot
 * and is refused; this route is Chrome being Chrome, rendering a public page the way a
 * person's browser would. No user-agent is forged, no bot check is defeated, no login or
 * paywall is crossed. The window is positioned off screen so a run does not steal focus.
 */

import { assertPublicHost, IngestError, normaliseUrl, type FetchedPage } from "./ingest";

const NAV_TIMEOUT_MS = 35_000;
/** The browser is expensive to start, so one instance is reused and parked when idle. */
const IDLE_CLOSE_MS = 120_000;
const MAX_BYTES = 3_000_000;

type Browser = Awaited<ReturnType<typeof launch>>;

let shared: Browser | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let starting: Promise<Browser> | null = null;

async function launch() {
  const { chromium } = await import("playwright");
  const args = [
    // off screen rather than hidden: headless is exactly what these servers refuse
    "--window-position=-3000,-3000",
    "--window-size=1280,900",
    "--mute-audio",
  ];
  try {
    return await chromium.launch({ headless: false, channel: "chrome", args });
  } catch {
    /**
     * No Chrome installed. The bundled Chromium still renders JavaScript, which is more
     * than fetch does, but it is refused by the same servers, so the caller is told.
     */
    return await chromium.launch({ headless: false, args });
  }
}

async function browser(): Promise<Browser> {
  if (idleTimer) clearTimeout(idleTimer);
  if (shared?.isConnected()) return shared;
  if (!starting) {
    starting = launch()
      .then((b) => {
        shared = b;
        return b;
      })
      .finally(() => {
        starting = null;
      });
  }
  return starting;
}

function park() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void shared?.close().catch(() => {});
    shared = null;
  }, IDLE_CLOSE_MS);
  // a parked browser must not hold the process open
  idleTimer.unref?.();
}

/** Closes the shared browser. Tests and shutdown hooks call this. */
export async function closeRenderer(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  const b = shared;
  shared = null;
  await b?.close().catch(() => {});
}

/**
 * The raw body of a text resource, read through the browser.
 *
 * robots.txt and sitemaps sit behind the same wall as the articles: mayoclinic.org
 * refuses its own robots.txt to a crawler and serves it to a browser. Playwright's
 * response.text() returns the body as sent, so an XML sitemap comes back as XML rather
 * than as Chrome's rendered XML viewer.
 */
export async function renderText(input: string): Promise<{ text: string; status: number; finalUrl: string }> {
  const url = normaliseUrl(input);
  await assertPublicHost(url.hostname);

  const b = await browser();
  const ctx = await b.newContext({ locale: "en-GB" });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    if (!res) throw new IngestError(`${url.hostname} returned no response.`, "network");
    const status = res.status();
    if (status >= 400) throw new IngestError(`HTTP ${status}`, "http_error");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new IngestError("Body larger than 3 MB.", "too_large");
    return { text, status, finalUrl: page.url() };
  } catch (e) {
    if (e instanceof IngestError) throw e;
    throw new IngestError((e as Error).message.split("\n")[0].slice(0, 110), "network");
  } finally {
    await ctx.close().catch(() => {});
    park();
  }
}

export async function renderPage(input: string): Promise<FetchedPage> {
  const url = normaliseUrl(input);
  await assertPublicHost(url.hostname);

  const b = await browser();
  const ctx = await b.newContext({ locale: "en-GB", viewport: { width: 1280, height: 900 } });

  /**
   * The browser follows its own redirects and loads its own subresources, so the DNS
   * guard has to sit on the request path too. Without this, a public page answering 302
   * to http://169.254.169.254 would be fetched by Chrome, outside safeFetch entirely.
   */
  const verdicts = new Map<string, Promise<boolean>>();
  const isPublic = (host: string) => {
    let v = verdicts.get(host);
    if (!v) {
      v = assertPublicHost(host).then(
        () => true,
        () => false,
      );
      verdicts.set(host, v);
    }
    return v;
  };

  await ctx.route("**/*", async (route) => {
    let host: string;
    try {
      host = new URL(route.request().url()).hostname;
    } catch {
      return route.abort();
    }
    return (await isPublic(host)) ? route.continue() : route.abort();
  });

  const page = await ctx.newPage();
  try {
    const res = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    const status = res?.status() ?? 0;
    if (!res || status >= 400) {
      throw new IngestError(`${url.hostname} answered HTTP ${status} in a browser too.`, "http_error");
    }
    // client-rendered pages need a beat after DOMContentLoaded before the text exists
    await page.waitForTimeout(600);

    const html = await page.content();
    if (html.length > MAX_BYTES) throw new IngestError("Page is larger than 3 MB and was not parsed.", "too_large");

    return {
      html,
      finalUrl: page.url(),
      status,
      bytes: html.length,
      fetchedAt: new Date().toISOString(),
      source: "live",
      route: "browser",
    };
  } catch (e) {
    if (e instanceof IngestError) throw e;
    const msg = (e as Error).message ?? "";
    throw new IngestError(
      /timeout/i.test(msg)
        ? `${url.hostname} did not finish rendering within ${NAV_TIMEOUT_MS / 1000}s.`
        : `${url.hostname} could not be rendered (${msg.split("\n")[0].slice(0, 90)}).`,
      /timeout/i.test(msg) ? "timeout" : "network",
    );
  } finally {
    await ctx.close().catch(() => {});
    park();
  }
}
