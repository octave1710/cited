# CITED

Finds the questions in a category where an answer engine quotes somebody else, explains why
that page wins, writes the fixes, and re-measures on the same engine.

Built for the Precis technical case, July 2026.

---

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Four screens at http://localhost:3000

| Route | What it does |
|---|---|
| `/map` | Generates 120 to 160 real buyer questions for a category, asks a live engine each one, records which domains it names. |
| `/autopsy` | Runs the same nine factors on the page that is being quoted and on yours, ordered by weighted gap. |
| `/` | Audits any public URL: crawler access, nine factors with the extracts, fix plan, JSON-LD, apply and re-test. |
| `/pipeline` | Seven-node multi-market content run with a gate that structurally blocks on a named human approval. |

```bash
npm run verify   # typecheck + 70 tests + production build
```

---

## Real against mocked, and the switch

One environment variable decides, and it is the only one that does.

```
LLM_MODE=mock   # replays recorded answers, no network, the default
LLM_MODE=real   # live OpenAI calls, needs OPENAI_API_KEY
```

**Real.** Every engine answer in this repository was produced by a live `gpt-4o-mini`
call at temperature 0 and recorded to `fixtures/llm/recordings.json`. Page fetches are
always live: the auditor and the autopsy fetch over the network with an SSRF guard and
never substitute a local file for a URL you typed.

**Mock.** Replays those recordings by prompt hash. It refuses to answer a prompt it has
no recording for, rather than inventing one. So a demo runs offline and shows exactly
what the live run showed, and a question nobody has ever asked fails loudly.

**Cost.** Measured, not estimated: the token counts come from the API response and the
rate is printed next to the figure. A full 158-question map cost **$0.0123**. The ask
prompt carries no brand name, so once a category is mapped, scoring a different brand
against it costs nothing.

**Not used.** Profound. The key authenticates but the account has rights to no useful
domain, so the production-truth panel was replaced by a live robots.txt check of eight
named AI crawlers. That is verifiable by the client on their own file, which the
Profound panel would not have been.

---

## What it proves, and what it refuses to claim

The number that moves is **the count of questions where the brand is cited**, measured on
the same engine against the same competing sources, before and after the fixes. Measured
on the bundled fixtures: 2 of 5 to 5 of 5, internal score 33 to 78, with one fix refused
for lack of a fact nobody supplied.

**The limit, stated here and out loud in the walkthrough.** This is a controlled
comparison, not a promise about production ChatGPT. Live citation also depends on the
engine's own index and retrieval, which nobody outside the vendor controls. What the tool
proves is that, given the page as a candidate source, the engine now prefers it over the
competitors it previously preferred. That is the honest claim and it is still the
strongest claim anyone in this space can make.

**The lever the tool cannot pull.** Off-site authority. If the autopsy shows the winner is
cited because it is referenced across the web and you are not, that is a real finding and
an unfixable one inside a CMS. It is reported as a human action item with the evidence,
never folded into a score.

**No invented data.** Fixes that need a figure, a study or a named person leave a visible
`[SOURCED STAT]` slot and are counted as refused. The mock refuses unrecorded prompts. The
autopsy fetches and proves every candidate URL before comparing it, and reports the ones
that failed.

---

## Two things the build found

**The sites that win citations often block the crawler you would use to study them.**
`healthline.com` owns 118 of the 158 questions mapped on vitamin C serum in the UK, and
answers our fetch with HTTP 500. The autopsy reports that as a finding with the full
attempt log, then runs on the page anyway if you paste the URL.

**An engine will not name a URL it is unsure of.** Asked for exact article URLs on a
domain, `gpt-4o-mini` returns an empty list more often than not. Automatic resolution is
a convenience that sometimes works, never a guarantee, and every attempt is shown with
what happened to it.

---

## How a lost question becomes a won one

The map produces lost questions. Each one goes down exactly one of two routes and both end
with the same question re-measured on the same engine.

**A competitor owns it.** Autopsy their page against yours on the nine factors. The gap is
the work order. The fix plan writes the edits that close *that* gap rather than a generic
checklist, applies the structural ones to the HTML, re-runs the query, and records cited,
paraphrased or absent.

**Nobody is cited.** No amount of editing fixes an absent page. The question becomes a
brief for the pipeline: grounded on the term that actually wins in that market, drafted
answer-first around that one question, scored before anyone reads it, gated on a named
human approval, and shipped as a CMS payload.

---

## The nine factors

Weights live in `engine/weights.config.ts` and each carries its published source. They are
rendered as-is in the UI, so the number on screen and the number in the code cannot drift.
Crawlability is not weighted; it is a binary gate, because a page no answer-engine bot can
read scores zero no matter how well it is written.

## Artefacts, not a report

`GET /api/bundle?map=<id>&run=<id>` returns one zip: the citation map as CSV, the unclaimed
questions as their own brief list, the corrected HTML, the JSON-LD block, the robots.txt
patch, and the ranked fix plan. Every row of the map can be checked by typing that question
into ChatGPT.

## Stack

Next 16, React 19, Tailwind v4, TypeScript, vitest. GSAP for the two moments that carry
information (the map regrouping into territories, the autopsy bars growing out of the
axis), Motion for counters, everything under `prefers-reduced-motion`. SQLite via
`node:sqlite` for run and map persistence. No component library.

Secrets live in `.env`, which is gitignored and has never been committed.
