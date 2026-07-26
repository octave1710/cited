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
    if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      current.rules.push({ allow: field === "allow", path: value });
      lastWasAgent = false;
    }
  }
  return groups;
}

/** Standard matching: longest matching rule wins, Allow wins a tie. */
function decide(groups: Group[], ua: string, path: string): { allowed: boolean; rule: string; group: string } {
  const lower = ua.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(lower));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const group = specific ?? wildcard;
  if (!group) return { allowed: true, rule: "no matching group, so nothing restricts it", group: "none" };

  let best: { allow: boolean; path: string } | null = null;
  for (const r of group.rules) {
    if (r.path === "") continue; // "Disallow:" with no value means allow everything
    if (matches(r.path, path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) {
      best = r;
    }
  }

  const groupName = specific ? ua : "*";
  if (!best) {
    const blanket = group.rules.some((r) => r.path === "" );
    return {
      allowed: true,
      rule: blanket ? "Disallow: (empty, which allows everything)" : "no rule matches this path",
      group: groupName,
    };
  }
  return { allowed: best.allow, rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}`, group: groupName };
}

function matches(pattern: string, path: string): boolean {
  if (pattern === "/") return true;
  // support the * and $ wildcards robots.txt allows
  if (pattern.includes("*") || pattern.endsWith("$")) {
    const re = new RegExp(
      "^" +
        pattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\\\$$/, "$"),
    );
    return re.test(path);
  }
  return path.startsWith(pattern);
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(robotsUrl, { signal: controller.signal, headers: { "user-agent": "CITEDBot/0.1" } });
  } catch {
    return emptyReport(robotsUrl, 0, `could not fetch ${robotsUrl}`);
  } finally {
    clearTimeout(timer);
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
