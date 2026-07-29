# Security

## Reporting

Open a private security advisory on this repository. Do not open a public issue for a
vulnerability.

## What this application does with untrusted input

Every URL the user types is untrusted and reaches the network, so the boundary is
explicit and tested.

**Server-side request forgery.** `engine/ingest.ts` refuses any address that resolves
inside a reserved range. The check runs on the parsed address rather than on the text,
because `127.0.0.1`, `2130706433`, `0x7f.1` and `[::ffff:127.0.0.1]` are the same host
written five ways. Redirects are followed **by hand** with the host revalidated on every
hop: `redirect: "follow"` validates the first URL and then goes wherever it is sent, so a
public URL answering `302` to `169.254.169.254` would walk straight past a naive guard.
`engine/browserFallback.test.ts` asserts a refused host is never retried through the
browser route.

**The browser fallback.** When a server refuses the crawler, the page is rendered in a
real Chrome. Every request that browser makes passes the same DNS guard, not only the
top-level navigation. It never bypasses a login, a paywall or a bot check, and the route
used is reported on screen.

**Response size.** Bodies are capped at 3 MB and sitemap scans at 120,000 URLs, so a
hostile response cannot exhaust memory.

**Regular expressions.** `engine/crawlerAccess.ts` matches robots.txt paths with a linear
segment scan rather than a constructed pattern, after the original implementation was
found to be vulnerable to catastrophic backtracking.

## Secrets

No credential is committed. `.env` is ignored and was never added in any commit; a CI job
scans the full history on every push and fails the build if that changes. `.env.example`
lists the variable names only, with a note on what degrades when each is absent.
