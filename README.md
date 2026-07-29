# CITED

Asks **six real answer engines** a category's buyer questions, records every source they
actually cite, explains why the winners win, and writes the fixes for the client's page.

Built for the Precis technical case, July 2026. Part A is the page optimiser, Part B is
the multi-market content engine, and they share one scoring engine.

**The correction that shaped this build.** The first version asked a model *which sites it
would cite*. That is a model describing its own imagined behaviour: one site per question,
nothing checkable. It was replaced with live calls to the engines themselves.

---

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Five screens at http://localhost:3000

| Route | What it does |
|---|---|
| `/board` | **The entry point.** Writes ~160 buyer questions for a category, puts a panel of them to six live engines, and counts who each one cites. Reach, volume and first-position are kept as three separate encodings. Then it takes the widest-reaching rival apart on the same citations and exports the run as spreadsheets plus a brief. |
| `/map` | Generates 120 to 160 real buyer questions for a category, asks a live engine each one, records which domains it names, and routes each question at the weakest site holding a seat in that answer. |
| `/autopsy` | Runs the same nine factors on the page that is being quoted and on yours, ordered by weighted gap. |
| `/` | Audits any public URL: crawler access with the deciding line quoted, nine factors with the extracts, fix plan, the fact sheet, JSON-LD, llms.txt and a robots.txt diff, apply and re-test. |
| `/pipeline` | Seven-node multi-market content run with a gate that structurally blocks on a named human approval. |

```bash
npm run verify   # typecheck + 237 tests + production build
```

---

## What you leave with

Files, from `GET /api/bundle?map=<id>&run=<id>` or the download buttons on each screen.

| File | What it is | How you check it without us |
|---|---|---|
| `seats.csv` | Every question you do not hold, easiest first, each routed at the site holding the weakest seat in that answer with its record across the whole map | Retype the question into ChatGPT and read the source list |
| `citation-map.csv` | Every question, who was cited, in what order | Same |
| `unclaimed-questions.csv` | Questions no commercial page holds, split between "nothing named" and "reference sites only" | Same |
| `llms.txt` | Built from your live sitemap, every title and description lifted verbatim from your own pages | `curl your-site.com/llms.txt` after upload; Ctrl-F any line on the page it points to |
| `robots.txt.diff` | A unified diff that adds only what is missing | `patch --dry-run` and let your own tool accept or reject it |
| `corrected.html` | Your page with the structural fixes applied | Diff it |
| `fix-plan.csv` | Every rewrite ranked, with the refusals marked | Read it |
| `facts-needed.csv` | One row per rewrite blocked on a fact only you can supply, quoting the sentence on your page it would replace | Fill the `your_answer` column, upload it back, re-run |
| `schema.jsonld` | Structured data built from the page's own content | Paste into validator.schema.org |

The seat routing is the difference between a report and a plan. On the measured map,
8 questions have no commercial page to beat, which is a thin story. **147 of the 158
carry a site that wins nothing anywhere on the map**: `verywellhealth.com` is named in
125 answers and chosen first in none, `cosmopolitan.com` in 100 and none. Beating the
domain that owns 118 questions is a year. Taking the seat next to it is a page.

---

## The six engines, and how each is reached

| Engine | Route |
|---|---|
| Google AI Overview | Apify actor `apify/google-search-scraper`, add-on `aiOverview` |
| Google AI Mode | same actor, `aiModeSearch` |
| Perplexity | same actor, `perplexitySearch` |
| ChatGPT search | same actor, `chatGptSearch` |
| Gemini | same actor, `geminiSearch` |
| **Claude** | **Anthropic Messages API with the `web_search` tool, called at the source** |

Claude is not one of the actor's add-ons, so it is called directly and runs in parallel
with the actor. It is the only first-party read of the six.

Every add-on is an **object**, not a boolean. Passing `true` returns HTTP 400.

**Measured, live, on 2026-07-28.** Four questions across six engines: `$0.0985`, about
four minutes, 254 citations over 136 domains. AI Mode 72, Perplexity 61, Claude 57,
ChatGPT 37, Gemini 18, AI Overview 9. Roughly 2.5 cents per question across all six.

The panel is a subset **by design**: all ~160 questions across six engines would be about
four dollars and most of an hour. The screen states how many were asked and lists the rest.

## Real against mocked, and the switch

```
APIFY_TOKEN         # five of the six engines. Absent, the panel replays a recorded run and says so.
ANTHROPIC_API_KEY   # Claude. Absent, its column reads "not asked" rather than silently empty.
OPENAI_API_KEY      # writes the questions
LLM_MODE=mock       # replays recorded question sets by prompt hash
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

## What the build found

**The sites that win citations often block the crawler you would use to study them.**
`healthline.com` owns 118 of the 158 questions mapped on vitamin C serum in the UK, and
its article URLs answer our fetch with HTTP 500, redirects followed. The autopsy reports
that as a finding with the full attempt log, then runs on the page anyway if you paste
the URL. `medicalnewstoday.com` blocks four of the eight named AI crawlers in its own
robots.txt, which the audit screen quotes line by line.

**An engine will not name a URL it is unsure of.** Asked for exact article URLs on a
domain, `gpt-4o-mini` returns an empty list more often than not. Automatic resolution is
a convenience that sometimes works, never a guarantee, and every attempt is shown with
what happened to it.

**Two adversarial audits, thirty-six confirmed defects.** Every finding was checked by an
independent verifier whose job was to refute it, and each surviving one is closed with a
test that fails if it returns. The three worst are worth naming because they are the
shapes this kind of tool fails in:

- The SSRF guard tested the hostname as text, so `[::ffff:127.0.0.1]`, `2130706433` and a
  302 to `169.254.169.254` all walked past it. It now parses addresses, resolves DNS, and
  follows redirects by hand, revalidating every hop.
- The robots.txt diff was rejected by `patch` on every real file, because splitting a
  newline-terminated body left a phantom line that inflated the hunk header. The tests
  were green because they asserted on the text rather than on applicability. They now
  shell out to GNU patch.
- "URLs found in the sitemap" printed our own 400-entry cap as if it were a measurement.
  motion.dev really has 651. Any number that saturates at a constant in our own source is
  our limit wearing the costume of a fact, and the screen now says "400+ read".

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
