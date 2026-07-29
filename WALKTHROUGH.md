# CITED, interview script

For the call with the two managers. Everything below is measured on this machine and can be
checked live. The figures quoted are real, not illustrations.

---

# PART 0. The opening, 90 seconds

> "The brief says you want to see my judgement, not my volume. So I'll start with the
> decision that cost the most: I threw away the first version of the part that measures
> visibility, because it was wrong. I'll show you why."

**The first version** asked `gpt-4o-mini`: *"which sites would you cite for this
question?"*. That produced one site per question, and nothing was verifiable. It's a model
describing its own imaginary behaviour.

**What killed it**: a real assistant answer cites **several** sources, and they differ from
one engine to the next. Measured on a single question: AI Overview 3 domains, AI Mode 27,
Perplexity 12, ChatGPT 11, Gemini 3. So a single owner per question is wrong by
construction.

**What I did instead**: query the six real engines.

If only one sentence from this interview sticks, it's that one.

---

# PART 1. The architecture, before clicking anything

## The principle that governs all the code

**Everything displayed has to be verifiable outside the tool.** Three concrete
consequences, and they live in the code, not in the pitch:

1. A question is a sentence you can retype into an assistant.
2. A `robots.txt` line is quoted word for word from a public file.
3. A comparison sentence is pulled from the page as is, never paraphrased.

Corollary: **when data is missing, the hole stays visible**. The fix generator emits a
`[SOURCED STAT]` placeholder and counts the fix as *refused* rather than inventing a
number.

## The repo map

```
engines/     the measurement: six engines, the board, the teardown, the exports
engine/      Case 1: ingestion, parsing, nine factors, fixes, schema
autopsy/     the Case 1 bonus: resolving the competitor page, comparison
pipeline/    Case 2: seven nodes, the gate, the originality check
adapters/    the LLM boundary, with its live / replay / auto modes
lib/         dependency-free zip, sqlite, shared topic, screen persistence
app/         Next 16, four screens and the API routes
```

## The stack, and why

| Choice | Reason |
|---|---|
| Next 16 App Router | API routes and screens in one repo, native NDJSON streaming |
| `node:sqlite` | no `better-sqlite3`: no compilation toolchain on this machine, and a native dependency is a debt for whoever picks the project up |
| In-house ZIP writer | 120 lines, CRC32 and local headers. One less dependency to produce a deliverable |
| vitest | 240 tests, each failing if the defect it documents comes back |
| GSAP + Motion | entrance animation that carries information, not decoration |
| Playwright | second-resort read path, see below |

---

# PART 2. The demo, screen by screen

## Screen 1. BOARD, "who actually gets cited"

### What you type
A topic. A domain, optional. One market out of nine. The number of questions to ask.

### What you say while typing
> "The topic can be any category. The brand field is optional, the tool still answers
> without one, because the question 'who wins in my category' comes up before you have a
> client."

### What happens, in order

**Step 1, the questions.** Eight buying angles, each asking the model for N questions,
deduplicated on a normalized form. Measured cost: **1.3 cents** for around 160 questions.

> **If you're asked why an LLM here and not elsewhere:** writing the questions a buyer asks
> is exactly what a language model is good at, and nobody is claiming these are search
> volumes. They're readable and editable on screen. Measuring who gets cited is the
> opposite: it takes observation, not generation.

**Step 2, the six engines.** Five go through a single Apify actor that exposes them as
add-ons: `aiOverview`, `aiModeSearch`, `perplexitySearch`, `chatGptSearch`, `geminiSearch`.

> **Technical detail to keep in your back pocket:** each add-on is an **object**, not a
> boolean. Passing `true` returns an HTTP 400. That cost me one round trip.

**Claude is the sixth** and is not an add-on of that actor. It's called at the source, on
the Anthropic Messages API with the `web_search` tool, **in parallel** with the actor: the
actor takes minutes, these calls take seconds, chaining them would only add waiting. It's
the only first-hand read of the six.

**Step 3, the board.**

### The device, and why it encodes three things separately

> "A single total would hide the main finding."

| Encoding | What it says |
|---|---|
| **Green blocks** on the left | how many engines cite this site |
| **Blue squares**, area on a square root | how many times, per engine |
| **Amber ticks** on the right | how many times this site **opens** the answer |

**The finding that justifies the split, measured:** `youtube.com` has the largest citation
share in one panel and **zero first positions**. Being cited and being the source the
engine leans on are two different outcomes.

> **Why the square root:** area reads as a quantity. A linear side makes a 9 read as nine
> times a 1, when the eye is reading the square.

### The header numbers
`5/10`, `19/65`: the first is what the displayed rows contain, the second is everything
that engine returned. **Add up the column and you land on the first number.** Invite the
interviewer to do it.

### The consensus
The domains cited by **every engine that answered**. Not every engine defined: Gemini often
stays silent, and requiring its vote would empty the set for a reason unrelated to the
domains being compared.

### The WHY section

**How the target is chosen**, and it's written on screen: **first positions first**, then
engine reach, then volume. Not the biggest volume.

> **Anecdote to tell:** the initial sort was on reach. On a real panel it picked
> `smytten.com`, eight citations and **zero** first positions. A domain the engines never
> lean on teaches you nothing about how to get picked.

**Three factors, three different devices**, each naming its denominator:
- **Engine reach**: a corner, area on a square root
- **First positions by intent**: a staircase, in amber
- **Named without being cited**: a comb of 22 ticks

**The third is the most commercial.** Measured: *Simple* is named in 8 answers across the 5
engines, with its own domain cited **1 time**. *CeraVe* named in 5, cited **0**. On another
panel, **5 brands out of 6** named in the answers had zero citations of their own site.

> **What that proves, and it's the heart of the argument:** the lever is not on-page
> markup. It's being named on somebody else's page.

**The two bottom columns.** What a client can copy, and what no page will ever buy. The
second one exists so we never sell a client a plan to become Reddit.

**The honesty line, which stays on screen:** *"This teardown answers 3 of the 9 designed
factors. The other 6 need a page fetch, a second engine run, or are not measurable at all"*,
with the six named.

> "I'd rather a tool declare what it didn't measure than hand you a score across nine
> factors when six of them are guesses."

### The download
`citations.csv`, `board.csv`, `gaps.csv`, `brief.md`, `README.txt`. All built from the
numbers of the run.

---

## Screen 2. AUDIT, Case 1

### Ingestion
A URL, **or pasted HTML**. The brief asks for it explicitly.

**The SSRF guard, worth telling if they ask about security.** I found three bypasses
testing myself:
- `[::ffff:127.0.0.1]` and `2130706433` are legal spellings of localhost
- a public URL answering `302` to `169.254.169.254`, the cloud metadata endpoint

So: real parsing of the address, DNS resolution, and **redirects followed by hand** with
host revalidation on **every** hop. `redirect: "follow"` validates the first URL then goes
wherever it's sent.

### The fallback read path, and why it isn't cheating

Three sites answered 403 to any automated read, including their own robots.txt.
**Measured, in this order:**

| Route | mayoclinic.org | bmj.com | nutrition.org |
|---|---|---|---|
| `fetch` declared as CITEDBot | 403 | 403 | 403 |
| **Headless** browser | 403 | 403 | 403 |
| **Windowed Chrome** | **200, 1,151 words** | **200, 3,915 words** | **200, 482 words** |

> "The wall isn't detecting 'are you a bot', it's detecting 'are you headless'. Faking the
> user-agent would have done nothing. Opening the page in Chrome isn't impersonation:
> Chrome is Chrome. And the route used is shown on every result, because a site that serves
> humans and refuses automated readers is probably invisible to the engines too. That's a
> finding, not a workaround."

The DNS guard is applied to **every request the browser makes**, not just the main
navigation.

### The nine factors

Each one carries **its weight and its published source**. Answer structure 24%, sourced
citations 20%, numeric specificity 18%, freshness 14%, off-site authority 12%, fan-out 8%,
Google rank 3%, structured data **1%**.

> **The 1% is the detail that shows judgement.** A study across 1,885 pages found no causal
> effect from markup. I still generate it for hygiene, and I weight it at 1% instead of
> claiming it matters.

And **crawlability is a binary gate**, not a weighted factor. An engine that can't read the
page can't cite it, whatever the other eight say.

### The device: the weight scale
A band's width is what the factor is worth, the fill is what the page earned. **The empty
space IS the missing score, to scale.** On `healthline.com`, the eye lands on the fully dark
20% band before reading a single number: sourced citations at 0/100, which costs exactly 20
of the 54 missing points.

### The fixes
Each one names the sentence it replaces. **The ones that call for a number or a named
expert are not invented**: they come back in `facts-needed.csv`, one row per refusal, with
the sentence from the page itself that the answer would replace.

> **Detail to own if they ask:** the ordering is `impact × (6 − effort)`, so impact against
> effort, not impact alone. That's the right commercial trade-off, and both columns are
> displayed so it can be judged.

### The closed loop
On the sample page in the repo: **33 → 81**, with **every** substance fix refused for lack
of a supplied fact. The refusal is the feature.

> **Why a page from the repo and not a real one:** you can't publish a fix on `nhs.uk`. The
> apply-then-retest loop can only close on a page you control. It's labelled as such on
> screen.

---

## Screen 3. AUTOPSY, the Case 1 bonus

### How the competitor page is found
**The site's sitemap first.** Every URL it contains is a page the site has published.

> **The anecdote that explains the decision:** the first version asked the model to name
> the URL. For a GLP-1 question on BMJ it produced three paths like
> `/content/377/bmj.n246x`. **None of them exist.** A model remembers the *shape* of a
> publisher's URLs, not which ones exist.

**Three false positives, each worse than a failure**, and the three guards that came out of
them:
- "work" matched `worksop-pharmacy` → matching on **whole segments**
- "effects", seven letters, matched `/antibiotics/side-effects/` → a set of **generic**
  words that length alone doesn't rule out
- "vitamin C" lost its C and matched `vitamin-b` → **adjacent pairs**, and if one URL
  carries the compound, the ones carrying only "vitamin" are dropped

And if the model does get called anyway, `onTopic()` checks that the title and the address
carry a discriminating word. It rejected a page about **type 1 diabetes** offered for a
vitamin C question, which loaded 200 with 736 words.

### The contradiction I fixed
The heading said "they win on X" above two cards showing **41 for our page against 27 for
theirs**. Both were true and nothing reconciled them.

> "An engine cites a **passage**, not a page. So a better page can still lose the passage.
> That's written on the screen now."

### The device: facing bars
One axis, their page pushes right, yours pushes left. A tie is a split marker, and a tie
**at zero** is a fixed stub, because a bar of zero width reads as missing data.

---

## Screen 4. PIPELINE, Case 2

### The eight steps in the brief, and where they live

| Step | Where | What happens |
|---|---|---|
| Input | `app/pipeline/page.tsx` | topic + markets, capped at six |
| Per-market grounding | `fixtures/grounding.json` | UK 40,500/month, SE 6,600, DK 3,200 |
| Brief | `pipeline/run.ts` | each angle cites its grounding row |
| Drafting | `pipeline/run.ts` | question set **per market, in its own language** |
| Optimization | `engine/score.ts` | **the Case 1 engine, imported** |
| Localization | `pipeline/run.ts` | hreflang + lines flagged for review |
| Quality gate | `pipeline/originality.ts` + gate | score, plagiarism/AI, named approval |
| CMS output | `pipeline/run.ts` | markdown, metadata, hreflang |

### The grounding point, to show slowly
> "The literal translation *vitamin c serum* gets **480** searches in Sweden.
> *c-vitaminserum*, one word, gets **6,600**. **14 to 1.** A page that targets the
> translation targets a term nobody types. And Danish **splits** where Swedish
> **compounds**. Three markets, three pages, not one page translated three times."

### The quality gate, and being honest about the plagiarism/AI check

The brief asks for "plagiarism / AI-detection checks". **What I refuse to claim is the
point.**

> "There's no honest plagiarism check without a corpus, and no classifier can tell you a
> passage was written by a machine at a false positive rate you'd want to defend. So I
> claim neither."

What is measured, local and checkable by hand:
- **8-word shingle overlap** between each draft and its siblings, with the longest shared
  run **quoted**
- **the stock phrases that survive an unedited draft**, counted, each with its sentence

**The anecdote worth gold:** the check immediately reported **95% overlap** between UK, SE
and DK. It was right. My generator was producing four identical English paragraphs and
swapping the keyword. *Adaptation, not translation* was neither.

**After the fix: 95% → 0%.** Each market has its own question set, its own language, its own
angle:
- **SE**: four hours of daylight in December, the UV argument is weak, the angle is
  year-round pigmentation
- **DK**: the European cosmetics regulation bans drug claims, so reusing the UK copy is a
  **compliance** problem

> "The tool caught my own pipeline doing exactly what the brief holds against 'just use AI
> to generate it'. That's the best proof the check is worth having."

### The three refusals the brief explicitly asks for

| Refusal | Where it's enforced |
|---|---|
| Publishing without a name, per market | `publish()` throws, the route returns **409** |
| Anonymous sign-off | the approval route returns **400** |
| Guessing a market | no grounding, hard stop with the reason |
| Deploying a localization | hreflang **proposed, never pushed** |

> "The refusal lives in the business logic, not behind a disabled button. Call the publish
> endpoint directly and you get a 409."

---

# PART 3. The questions they will ask

**"Why Apify and not the direct APIs?"**
Perplexity and Gemini have APIs, but AI Overview and AI Mode don't. One actor that exposes
the five as add-ons is one integration instead of five, and a single bill. Claude isn't on
it, so I call it at the source. The seam is `engines/run.ts`: swapping the actor for direct
APIs doesn't touch the rest.

**"What does it cost, and does it scale?"**
2.5 cents per question across the six engines, measured. The panel is a subset **by
design**: the full 160 questions would cost four dollars and take an hour. The screen says
how many were asked and lists the ones that weren't.

**"What's real and what's simulated?"**
Real: the six engines, the page fetches, the scoring, the fixes, the schema, the zip.
Simulated: the per-market search volumes, which come from a fixture labelled as a recorded
sample. The brief explicitly allows "real data or a realistic mock".

**"What would you do with another week?"**
1. Pull a `GroundingClient` out behind an interface like the LLM boundary, so DataForSEO or
   Semrush can be plugged in by configuration instead of a `readFileSync`.
2. Wire the retest to the real questions from the board and the real competitors cited,
   instead of the current template query set.
3. A dedicated *entity clarity* factor: does the H1 subject appear in the first 100 words,
   is the name consistent, is there an `Organization` node with a `sameAs`.

**"How did you use AI to build this?"**
Claude Code, in short loops with adversarial subagents: I have every claim reread by an
agent whose instruction is to **break** it by reading the code. That's how I found the
Ukrainian hreflang, the English titles on the Nordic pages, and the fact that one screen's
heading named one domain while the section below it took apart another.

**"What's weak?"**
Three things, and I say them before anyone asks:
- The board records what an engine **cites today**, not what it will index tomorrow.
- Off-site authority is an on-page **proxy**, written on screen on the row concerned.
- The pipeline runs on **one grounded topic**, across three markets. The cap of six is in
  the code, not in the data.

---

# PART 4. The demo running order, 12 minutes

| Time | Screen | The point to land |
|---|---|---|
| 0:00 | . | "I threw away the first version because it was wrong" |
| 1:30 | **BOARD**, live run | six engines, real citations, the board fills up |
| 4:00 | **BOARD**, the WHY | named without being cited: the lever isn't on-page |
| 6:00 | **AUDIT** | the weight scale, the empty space IS the missing score |
| 8:00 | **AUDIT**, fixes | the fix refused for lack of a supplied fact |
| 9:30 | **PIPELINE** | 480 against 6,600, then the wall and the 409 |
| 11:30 | . | what I'd do with another week |

**Do not show**: the `/map` route, taken out of the navigation. It carries the old,
invalidated method.

---

# APPENDIX. The numbers to know by heart

| | |
|---|---|
| Engines queried | **6** |
| Cost per question, six engines | **~2.5 cents** |
| Cost of the ~160 questions written | **1.3 cents** |
| Demo run, 8 questions | **$0.229**, ~4 min |
| Tests | **240**, typecheck and build clean |
| Closed loop on the sample page | **33 → 81** |
| Swedish: literal translation vs real term | **480 vs 6,600** |
| Cross-market overlap, before / after | **95% → 0%** |
| Weight of structured data | **1%**, study across 1,885 pages |
