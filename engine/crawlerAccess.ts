import { IngestError, safeFetch } from "./ingest";
/**
 * Can the answer-engine crawlers even reach this page?
 *
 * This replaces the Profound dependency with something better for a demo: instead of
 * "did a bot visit" (needs someone else's dashboard and their entitlements), it answers
 * "is the bot allowed to visit, and here is the line in your own file that decides it".
 *
 * Everything here is verifiable by the client without this tool: open
 * https://their-site.com/robots.txt and read the quoted line.
 */

export const AI_CRAWLERS = [
  { ua: "GPTBot", operator: "OpenAI", feeds: "ChatGPT answers and training" },
  { ua: "OAI-SearchBot", operator: "OpenAI", feeds: "ChatGPT search results" },
  { ua: "ChatGPT-User", operator: "OpenAI", feeds: "live page fetches inside a chat" },
  { ua: "PerplexityBot", operator: "Perplexity", feeds: "Perplexity answers" },
  { ua: "ClaudeBot", operator: "Anthropic", feeds: "Claude answers" },
  { ua: "Google-Extended", operator: "Google", feeds: "AI Overviews and Gemini" },
  { ua: "Applebot-Extended", operator: "Apple", feeds: "Apple Intelligence" },
  { ua: "CCBot", operator: "Common Crawl", feeds: "the corpus most open models train on" },
] as const;

export interface CrawlerVerdict {
  ua: string;
  operator: string;
  feeds: string;
  allowed: boolean;
  /** The exact rule that decided it, quoted from their file. */
  rule: string;
  /** Which user-agent group the rule came from. */
  group: string;
}

export interface AccessReport {
  robotsUrl: string;
  status: number;
  found: boolean;
  raw: string;
  verdicts: CrawlerVerdict[];
  blocked: CrawlerVerdict[];
  /** A ready-to-paste robots.txt patch, only when something is actually blocked. */
  patch: string | null;
  error?: string;
}

type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    // ANY other directive ends the run of user-agent lines. Clearing the flag only on
    // allow/disallow let a Crawl-delay or Sitemap line between two User-agent lines
    // merge them into one group, so the next agent inherited rules that were never
    // written for it and the tool reported crawlers as blocked that were not.
    lastWasAgent = false;
    if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      current.rules.push({ allow: field === "allow", path: value });
    }
  }
  return groups;
}

/**
 * Standard matching: longest matching rule wins, Allow wins a tie.
 *
 * RFC 9309 says every group naming the same user-agent is merged. Taking only the first
 * meant our own emitted patch changed nothing: appending `User-agent: GPTBot / Allow: /`
 * to a file that already disallowed GPTBot left the earlier group deciding, so the tool
 * handed over a fix and then reported that the fix had no effect.
 */
export function decide(groups: Group[], ua: string, path: string): { allowed: boolean; rule: string; group: string } {
  const lower = ua.toLowerCase();
  const specific = groups.filter((g) => g.agents.includes(lower));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const matching = specific.length ? specific : wildcard;
  if (!matching.length) return { allowed: true, rule: "no matching group, so nothing restricts it", group: "none" };
  const rules = matching.flatMap((g) => g.rules);

  let best: { allow: boolean; path: string } | null = null;
  for (const r of rules) {
    if (r.path === "") continue; // "Disallow:" with no value means allow everything
    if (matches(r.path, path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) {
      best = r;
    }
  }

  const groupName = specific.length ? ua : "*";
  if (!best) {
    const blanket = rules.some((r) => r.path === "");
    return {
      allowed: true,
      rule: blanket ? "Disallow: (empty, which allows everything)" : "no rule matches this path",
      group: groupName,
    };
  }
  return { allowed: best.allow, rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}`, group: groupName };
}

/**
 * Greedy left-to-right scan over the literal segments between the wildcards.
 *
 * This used to compile a RegExp from the raw robots.txt value, turning every `*`
 * into an unbounded `.*`. Chained `.*` against a non-matching path backtracks
 * exponentially: a 12-star pattern measured at 69 seconds of blocked event loop on
 * a file any third party controls. This version is O(pattern x path) and cannot
 * backtrack, so a hostile robots.txt costs the same as a friendly one.
 */
export function matches(pattern: string, path: string): boolean {
  if (pattern === "/" || pattern === "") return true;

  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const segments = body.split("*");

  // the text before the first wildcard must sit at the very start
  const first = segments[0];
  if (!path.startsWith(first)) return false;
  let cursor = first.length;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === "") continue;
    const isLast = i === segments.length - 1;
    if (isLast && anchored) {
      // the tail has to land exactly at the end, and cannot overlap what is consumed
      if (!path.endsWith(seg) || path.length - seg.length < cursor) return false;
      cursor = path.length;
      continue;
    }
    const at = path.indexOf(seg, cursor);
    if (at < 0) return false;
    cursor = at + seg.length;
  }

  return anchored ? cursor === path.length : true;
}

export async function checkCrawlerAccess(pageUrl: string): Promise<AccessReport> {
  let robotsUrl = "";
  let path = "/";
  try {
    const u = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
    robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    path = u.pathname || "/";
  } catch {
    return emptyReport("", 0, "the audited target is not a URL, so there is no robots.txt to read");
  }

  // safeFetch, not a raw fetch: this had its own fetch with the default redirect:follow,
  // so it was a second, unguarded door into the same SSRF the ingest path had just closed
  /**
   * Some sites refuse their own robots.txt to anything that is not a browser window.
   * mayoclinic.org answers 403 to a crawler and 200 to Chrome, and what that file says
   * is the whole point of this check, so a refusal is retried in a browser.
   *
   * A 403 arrives as a resolved Response, not as a thrown error, so the retry has to
   * cover both. It did not, and the domain stayed unreadable.
   */
  let res: Response;
  const inBrowser = async (why: string): Promise<Response | null> => {
    try {
      const { renderText } = await import("./render");
      const got = await renderText(robotsUrl);
      return new Response(got.text, { status: got.status });
    } catch {
      void why;
      return null;
    }
  };

  try {
    res = await safeFetch(robotsUrl, "text/plain,*/*");
    if (!res.ok && res.status !== 404) {
      res = (await inBrowser(`HTTP ${res.status}`)) ?? res;
    }
  } catch (e) {
    const why = e instanceof IngestError ? e.message : `could not fetch ${robotsUrl}`;
    const rendered = await inBrowser(why);
    if (!rendered) return emptyReport(robotsUrl, 0, why);
    res = rendered;
  }

  if (res.status === 404) {
    // no robots.txt means nothing is blocked, which is a real and reportable finding
    return {
      robotsUrl,
      status: 404,
      found: false,
      raw: "",
      verdicts: AI_CRAWLERS.map((c) => ({ ...c, allowed: true, rule: "no robots.txt exists, so nothing is disallowed", group: "none" })),
      blocked: [],
      patch: null,
    };
  }
  if (!res.ok) return emptyReport(robotsUrl, res.status, `${robotsUrl} answered HTTP ${res.status}`);

  const raw = (await res.text()).slice(0, 200_000);
  const groups = parseRobots(raw);
  const verdicts: CrawlerVerdict[] = AI_CRAWLERS.map((c) => ({ ...c, ...decide(groups, c.ua, path) }));
  const blocked = verdicts.filter((v) => !v.allowed);

  return {
    robotsUrl,
    status: res.status,
    found: true,
    raw,
    verdicts,
    blocked,
    patch: blocked.length ? buildPatch(blocked) : null,
  };
}

function emptyReport(robotsUrl: string, status: number, error: string): AccessReport {
  return { robotsUrl, status, found: false, raw: "", verdicts: [], blocked: [], patch: null, error };
}

/** A file the client pastes. Not advice, an artefact. */
function buildPatch(blocked: CrawlerVerdict[]): string {
  const lines = [
    "# Added by CITED — allow answer-engine crawlers to read this site.",
    "# Paste these blocks at the END of your robots.txt, then reload",
    "# https://your-domain.com/robots.txt to confirm they are live.",
    "",
  ];
  for (const b of blocked) {
    lines.push(`# ${b.operator} · feeds ${b.feeds}`, `User-agent: ${b.ua}`, "Allow: /", "");
  }
  return lines.join("\n");
}
