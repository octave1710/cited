# GOAL — CITED as a working agentic app

**Objective.** Turn CITED from a CLI engine + static mockups into a real Next.js application that ingests any URL, scores it, writes the fixes, re-tests them against a live answer engine, and runs a multi-market content pipeline that structurally blocks on a human gate.

**Verify command.** `npm run verify` (typecheck + vitest + production build). The app is driven manually via Chrome DevTools MCP at 1858x1027.

---

## Done-condition checklist

| # | Condition | Provable by |
|---|---|---|
| D1 | `npm run dev` boots Next.js (App Router, TS, Tailwind v4), zero console errors | Chrome DevTools MCP console read |
| D2 | Persistent input bar accepts any public URL + brand + market, real fetch, fixture fallback | Drive the UI, observe a run on a live URL |
| D3 | Run executes in visible steps with states (queued/running/done/blocked); 9 factors scored with evidence extracted from the real text | Screenshot + DOM state |
| D4 | "Generate fix plan" button returns real before/after rewrites, priority impact×ease, `[SOURCED STAT]` slots left visibly empty | Click, read rendered output |
| D5 | "Generate schema" returns valid JSON-LD, copyable | Click, validate output round-trips through `schemaValidity` |
| D6 | Query Lab runs against the real OpenAI API (`LLM_MODE=real`); mock replays recordings offline | Network request log + both modes exercised |
| D7 | **Closed loop**: one button applies fixes to the HTML, re-runs Query Lab, shows the before/after delta (2/5 → 5/5 on fixtures) | Single click, observe the delta |
| D8 | Profound adapter: real calls when keyed, fixture fallback on failure, failure stated honestly in the UI | Force both paths |
| D9 | Part B: 7 nodes execute, the gate node **actually blocks** (cannot proceed without approval), approval shows per-market diff, output is markdown + CMS metadata + hreflang, every recommendation traceable to its source | Drive the pipeline, attempt to bypass the gate |
| D10 | Runs persist in SQLite (`DATABASE_PATH`), a run can be reloaded by id | Reload a run after restart |
| D11 | Existing 26 vitest tests still pass, plus ≥1 test per new API route | `npm run verify` output |
| D12 | Clean error handling (bad URL, API down, rate limit); no white crash | Force each failure |
| D13 | `.env` never committed, `.env.example` current, README documents real vs mocked and the switch | `git ls-files`, file read |

## Design constraints (hard, from repeated rejections)

Source: `design/DESIGN_PLAN.md` + project memory `octave-design-rejections.md`.

- It is an **app**, not a scrolling page. Persistent input bar, visible run state, **an action button next to every number**. A number with no action is reporting, and reporting is rejected.
- **No content text in grey.** Content is full ink. Grey is for dates, units, sources, column headers only.
- **One accent** across the whole app: red `#FF3B3B`, button fill `#D81E1E`. Zero blue.
- Each screen's purpose is a **real headline** in full ink, never a tiny grey mono label.
- No decorative index numbers. No walls of uniform rows. Nothing glued to the edge (the container owns the horizontal gutter; never override it).
- Every displayed datum carries a short plain-language line saying what it measures. Real queries render in sentence case, never mono caps.
- Visual direction: technical brutalist. `#050505` ground, `#ECEBE7` ink, Barlow Condensed 700 italic caps for display, Barlow for body, IBM Plex Mono for labels, radius 0, 1px `#1e1e1e` rules. Reference: `design/mockups/variant-b-brutalist.html`.
- Motion: GSAP for scroll/canvas, Motion for micro-interactions, never both on one element. All under `prefers-reduced-motion`.
- Perceived speed: every action gives feedback under 100ms (optimistic state); long calls stream progress.

## Out of scope / deny-list

- No auth, no multi-tenant accounts, no billing.
- No new component library (Aceternity, Magic UI, React Bits and friends are explicitly rejected).
- No blue anywhere. No Inter/Roboto/Open Sans/Playfair.
- Do not rewrite the existing `engine/` scoring logic or weights; the app consumes it.
- Do not commit `.env` or any key.
- No fabricated data anywhere: missing figures stay visible empty slots.

## Mandatory human checkpoints

Autonomy covers the functional build. Stop and show rendered pixels to Octave at:

- **(a)** first time the Audit screen shows a complete run
- **(b)** first time the apply-and-re-test loop works in one click
- **(c)** first time the Part B human gate blocks on screen

Aesthetic "done" is not machine-verifiable. Octave judges it.

---

## Progress log

### Loop 1 — framing
- GOAL.md written. Checklist D1-D13 fixed. Next: scaffold Next.js + Tailwind v4 over the existing engine, then build toward checkpoint (a).

### Loop 2 — app shell to checkpoint (a)

Shipped: Next 16 + React 19 + Tailwind v4 scaffold, brutalist token layer, persistent input bar,
run rail with live step states, weight-bar factor display, factor evidence panel, fix-plan screen
with visible refusal slots, JSON-LD generation, SQLite run persistence.

Routes: `POST/GET /api/runs`, `GET /api/runs/[id]`, `POST /api/runs/[id]/fixes`, `POST /api/runs/[id]/schema`.

**Verified by driving the app, not by assertion:**
- D1 boots clean, zero console errors (Chrome DevTools console read: empty).
- D2 live fetch works on a real public URL: `en.wikipedia.org/wiki/Vitamin_C` → 1.12 MB, 15,400 words, scored 60/likely.
- D3 steps move queued → running → done with real notes; 9 factors scored from the real text.
- D4 fix plan returns 8 real rewrites, 5 carrying `[SOURCED STAT]` slots left visibly empty.
- D5 schema returns Article + FAQPage with 1 honest warning.
- D10 a run reloads from SQLite by id after the request that created it.
- D11 31 tests pass (26 existing + 5 new ingest/SSRF), typecheck clean.
- D12 bad URL and non-http scheme return a clean message, no crash.

**Decisions and deviations:**
- `better-sqlite3` cannot build here (node-gyp, no Windows build tools). Swapped to `node:sqlite`,
  stdlib, no toolchain. Ceiling noted in `lib/db.ts`.
- TypeScript 7 no longer exposes the compiler API Next reads → `experimental.useTypeScriptCli`.
- Turbopack does not resolve `./x.js` → `./x.ts`; all relative imports normalised to extensionless.

**Bug found and fixed during verification:** the SSRF guard was anchored (`/^(127\.|…)$/`) so
`127.0.0.1` and the cloud metadata endpoint `169.254.169.254` both passed. Rewritten as prefix
tests with a dedicated test file. Confirmed refused end to end.

**Residual risk:** the fix plan is generated but not yet applied to the HTML, so the closed loop
(checkpoint b) is not built. Query Lab, re-test, Profound and Part B remain.

STOPPED at checkpoint (a) for Octave's judgment, per the contract.

### Loop 3 - closed loop (checkpoint b)

Apply + re-test works in one click. Verified with real OpenAI calls, then replayed offline:
2/5 to 5/5 cited, score 33 to 78, 7 fixes applied, 1 refused (needs a fact nobody supplied).
Remaining: Profound panel (D8) and Part B pipeline with the blocking gate (D9).

### Loop 4 - v2 front of the funnel (F1, F2, F8)

**F1 citation map** (`/map`). 158 questions generated across eight buyer intents, each asked
to a live engine, each answer parsed for the domains it names. Measured on vitamin c serum /
UK: healthline.com owns 118, theordinary.com is quoted on 2, 8 are unclaimed. 166 calls,
33,838 tokens, $0.0123 at the published rate. Cached, so a re-run is free and the demo
replays offline (verified: `LLM_MODE=mock` reproduces all 158 with 0 live calls).

**F2 competitor autopsy** (`/autopsy`). Same nine factors on their page and ours, ordered by
weighted gap, evidence from both sides on every row. Verified on two live fetches.

**F8 artefact bundle** (`GET /api/bundle`). Store-only ZIP writer, no dependency. Verified by
opening the archive in a real unzip, all CRCs valid.

**Two findings the build surfaced, both stated in the UI rather than hidden:**
- healthline.com, which owns 118 of 158 questions, answers our crawler with HTTP 500. The
  autopsy reports the block as a finding with the attempt log, then runs on a pasted URL.
- gpt-4o-mini returns an empty URL list rather than invent one, for most domains. Automatic
  competitor-page resolution is a convenience, never a guarantee.

70 tests, typecheck clean, production build clean. Screenshots at 1858x1027, 1280 and 390.

**Known weak, not hidden:** `owned` is 0 for a brand the engine has never heard of, which is
honest but makes a fictional-brand demo look empty; use a real domain. The `open` bucket is
strict (8 of 158) because a category with a consolidated owner genuinely has few holes.
Mobile is usable but was not designed for; this is a desktop instrument.
