# CITED v2 — spec

## The reframe

v1 answered "is this page well written for answer engines". That is a checker, and any
agency can hand-audit a page. It never answered the question a client actually pays for.

v2 answers four questions in order, and each one produces an artefact the client can use
without us:

1. **Where are we losing, and to whom?** → the citation map
2. **Why does the winner win?** → the competitor autopsy
3. **If we fix it, does it move?** → the closed loop, measured on a live engine
4. **Can we do this across markets without publishing blind?** → the pipeline with the gate

The page audit is step 2 of that flow, not the product.

---

## F1 · Citation map (NEW, the missing front)

**What it does.** Takes a topic and a brand. Generates 120-200 real sub-questions the way
an answer engine decomposes a category. Runs every one against a live engine. Records
which domains get cited, per question.

**Output.** A map of question → who owns it, plus three ranked lists:
- **Lost**: questions a competitor owns outright
- **Contested**: questions where citations are split
- **Open**: questions where nobody is cited well, the cheapest wins available

**Why the client cares.** For the first time they see their category the way a buyer using
ChatGPT sees it. "Across 143 questions in your category, Healthline owns 61, you own 3, and
22 are unclaimed." That is a sentence a CMO acts on immediately, and it is not a metric we
invented, it is the observed behaviour of the engine their customers use.

**Why Precis cares.** This is a pitch weapon. Run it on a prospect before the meeting and
walk in with their category map. It is also a quarterly deliverable that justifies retainer.

**Verifiable without us.** Any row can be checked by typing that question into ChatGPT.

---

## F2 · Competitor autopsy (NEW, cheap, high impact)

**What it does.** For every question a competitor wins, fetch the competitor's page and run
the same nine factors on it. Compare factor by factor against the client's page.

**Output.** "They win this question because their page carries 12 quantified figures and a
named MD. Yours carries 0 and nobody signs it." Plus the exact passages the engine lifted.

**Why it matters.** It stops the argument. The advice is no longer our opinion about
citability, it is a measurement of the page that is actually winning. This is the single
strongest thing to show in an interview, because it is the moment the tool stops describing
and starts explaining.

**Cost to build.** Low. The scoring engine already exists and already runs on any URL.

---

## F3 · Crawler access (BUILT)

Reads the target's robots.txt live, rules on 8 named AI crawlers for that exact path,
quotes the deciding line, and emits `robots-patch.txt` when anything is blocked.

**Value.** Binary and brutal. If GPTBot is disallowed, no content work will ever produce a
citation, and most brands do not know their own file blocks it. Verified live: nytimes.com
blocks all 8.

---

## F4 · Page diagnosis with evidence (BUILT, re-positioned)

Nine weighted factors with published sources, each returning the exact text pulled off the
page, streamed as observable work with measured durations.

**Re-positioned.** Runs on the pages the map says are worth winning, not on a page picked
at random. That is what makes it worth running.

---

## F5 · Fix plan, apply, re-test (BUILT)

Writes real before/after rewrites ranked by impact × ease, applies the structural ones to
the HTML automatically, refuses to invent a figure, a source or an author, then re-runs the
same queries on the same engine against the same competitors and reports the delta.

**Artefact.** The corrected HTML file and the JSON-LD block. Not a report, files to ship.

**Measured.** 2/5 → 5/5 cited, score 33 → 78, with 1 of 8 fixes refused for lack of a
supplied fact.

---

## F6 · Factor experiment (NEW, optional, the credibility flex)

Take one page, generate two variants differing in exactly one factor, run the same query
set, measure which variant gets cited.

**Why.** It converts the nine weights from "research I read" into "research I re-verified on
this brand's own content". For an engineering-flavoured marketing role, this is the artefact
that says the candidate tests rather than believes.

---

## F7 · Multi-market pipeline with a blocking gate (BUILT)

Seven nodes. Grounds each market on the term that actually wins there (Swedish
`c-vitaminserum` beats the literal translation 14 to 1). Missing grounding is a hard stop.
The gate throws in the domain logic, so calling publish directly returns 409. Approval is
per market and must carry a name.

**Artefact.** Markdown + CMS metadata + hreflang built from the local term, marked ready
for CMS, never published.

**Now fed by F1.** The unclaimed questions from the map become the topics the pipeline
produces content for. That is what makes Part B reuse Part A instead of sitting next to it.

---

## F8 · Artefact bundle (NEW, small)

One download containing: the corrected HTML, the JSON-LD, the robots patch, the gap list as
CSV, and the per-market CMS payloads.

**Why.** The client leaves the meeting with files, not a slide.

---

## Build order

1. F1 citation map (the reframe, unlocks everything)
2. F2 competitor autopsy (cheap, biggest interview moment)
3. F8 bundle (makes the value physical)
4. F6 experiment if time allows

F3, F4, F5, F7 are built and stay.

## Cost and constraints

- 150 queries on gpt-4o-mini is a few cents per map and a few minutes of wall clock.
  Needs caching, concurrency control, and a visible cost counter in the UI.
- Citation detection must move from "our page vs 2 competitors" to "which domains appear
  in the answer", which means parsing cited sources rather than numbered slots.
- Everything stays replayable offline from recordings for the demo.

---

## The mechanism: from "we lose this query" to "we win it"

The map produces lost queries. Each one is routed to exactly one of two actions, and both
end with the same query being re-measured on the same engine.

### Route 1 · a page of ours exists but loses

1. Pick our best candidate page for that query (best factor+topic match).
2. Autopsy the winner's page with the same nine factors.
3. Diff the two. The gap is the work order, e.g. winner carries 12 figures and a named MD,
   ours carries 0 and is unsigned.
4. The fix plan writes the specific edits that close *that* gap, not a generic checklist:
   the question becomes an H2 verbatim, the first sentence becomes the answer, the hedges
   get slots for figures the client supplies, the quote slot names a real person.
5. Apply, re-run that exact query, record cited / paraphrased / absent.

### Route 2 · no page of ours answers the question

No amount of editing fixes an absent page. The question becomes a brief for the pipeline:
grounded on the local winning term, drafted answer-first around that single question,
scored by the same engine before anyone reads it, gated on a named human approval, and
shipped as a CMS payload. Then the new page is tested on the query that motivated it.

### What actually improves, and what we refuse to promise

The number that moves is **the count of queries where the brand is cited**, measured on the
same engine, with the same competing sources, before and after. Not our internal 0-100,
which is only a predictor.

Hard limit, stated in the README and out loud in the walkthrough: this is a controlled
comparison, not a promise about production ChatGPT. Live citation also depends on the
engine's own index and retrieval, which nobody outside OpenAI controls. What the tool proves
is that, given the page as a candidate source, the engine now prefers it over the
competitors it previously preferred. That is the honest claim, and it is still the strongest
claim anyone in this space can make.

### The lever the tool cannot pull

Off-site authority. If the autopsy shows the winner is cited because they are referenced
across the web and the client is not, that is a real finding and an unfixable one inside a
CMS. It is reported as a human action item with the evidence, never silently folded into a
score. Roughly one lost query in four lands here, and saying so is what keeps the other
three credible.
