# CITED, my demo script

Everything I say, every page I go to, every button I click.

**Stage directions are in bold brackets.** Everything in a quote block is what I say out
loud. Every number below was run on the deployed app on 29 July and checked against what
the code computes. If a number is not on the screen, I do not say it.

---

# BEFORE RECORDING, 5 minutes

Use the deployed app, `https://cited-precis.vercel.app`. Nothing has to start on my
machine, which removes the one thing that can go wrong while recording.

**[FALLBACK]** If the deployed app is ever down, `npm run dev` in the project folder
serves the same thing at `localhost:3000`.

**[CHECK]** Open `/board`. The top bar reads **ENGINE LIVE** in green.

**[TABS]** Open these five and leave them:

| Tab | URL | Why |
|---|---|---|
| 1 | `cited-precis.vercel.app/board` | where I start |
| 2 | `cited-precis.vercel.app/` | the audit |
| 3 | `cited-precis.vercel.app/autopsy` | the comparison |
| 4 | `cited-precis.vercel.app/pipeline` | Case 2 |
| 5 | `healthline.com/robots.txt` | the raw file, it lands better if it is already open |

**[RECORD]** Browser window only, not the whole screen.

**[TIMING]** Measured, so I know what a pause means: recorded panel under a second, audit
about a second, fix plan under a second, citation test about 4 seconds, apply-and-re-test
under a second, autopsy about 5 seconds, pipeline about 40 seconds. Nothing makes me wait.

---

# PART 0. The opening, about 90 seconds

**[SCREEN]** Tab 1, `/board`, empty. Let them look at it while I talk.

> "Before I show you anything, two numbers from a run I did.
>
> I took vitamin C serum in the UK and I asked six assistants eight of the questions a
> buyer actually types. Four hundred and thirty-eight citations came back. A hospital
> site, Cleveland Clinic, is in the answer to six of those eight questions. The Ordinary,
> which is one of the biggest brands in that category, is in three of them, and it is never
> the first source named.
>
> And the part I find interesting is that nothing in their reporting would tell them that.
> A click that doesn't happen leaves no trace. It's not in analytics, it's not in the ad
> platform, so there's no line in the monthly deck that says it happened. The budget just
> quietly stops working and nobody can point at where.
>
> So in the next ten minutes I'll show you four screens: who actually gets cited, why
> those pages win, what to change on the client's own page, and how you do that across
> three markets without publishing the same page three times."

**If they look impatient, the two-sentence version:**

> "Buying research is moving into assistants, an assistant names three or four sources
> instead of ten links, and right now nobody can tell a client whether they're one of
> them. This measures it, explains it, and writes the fixes."

---

# PART 1. What each case asked for, about 45 seconds

**[SCREEN]** Still tab 1. I point at the four words in the top navigation as I name them.

> "Four screens, and they map onto your two cases.
>
> Case one was the page optimiser: a client ranks fine on Google, never shows up in an AI
> answer, they want to know why and what to change. That's three of these. BOARD finds who
> is being cited instead of them. AUDIT scores their page and writes the actual edits.
> AUTOPSY compares their page against the one that's winning.
>
> Case two was the multi-market content engine. That's PIPELINE. Seven steps from a topic
> to something ready for a CMS, and it refuses to publish until a named person signs off
> per market.
>
> I'll go left to right."

---

# PART 2. Screen by screen

---

## Screen 1. BOARD, about 4 minutes

**[SCREEN]** Tab 1, `/board`

### The form

**[POINT]** at the four fields without typing.

> "The category goes here in a buyer's words. The brand field is optional, and I mean it,
> because 'who is winning in my category' is a question you want answered before you have
> the client. The market sets the language the questions get written in, not just the
> country. And the last one is how many questions actually go to the assistants."

**[CLICK]** **Load the recorded run**. It appears in under a second and fills the form.

> "I'm loading a run I did earlier rather than making you watch one happen. A live panel is
> about forty seconds a question, so eight questions is five minutes. This is that exact
> run: same eight questions, same six assistants, four hundred and thirty-eight citations,
> twenty-three cents actually spent. The screen says RECORDED PANEL rather than MEASURED
> LIVE so you can see which one you're looking at, and the Run live button is right there
> if you want to watch one land."

**[OPTIONAL, if there is time]** **[CLICK]** **Run live** and talk over the other screens
while it runs. **[IF IT STALLS]** click **Cancel**; the previous result stays on screen.

### What that run did, about 60 seconds

**[SCREEN]** The three steps on the left are green.

> "Two things happened. First it wrote the questions a buyer of this thing asks, across
> eight buying angles: what is it, does it work, how do I choose, what's it versus, what
> are the risks, how do I use it, what should I expect, what does it cost. About a hundred
> and sixty questions, and it costs about a cent.
>
> I use a language model for that part on purpose, because writing the questions people ask
> is exactly what a language model is good at. I'm not pretending these are search volumes.
> They're questions, and you can read every one of them on this screen.
>
> Then it took eight of them to six real assistants: Google's AI Overview, Google's AI Mode,
> Perplexity, ChatGPT, Gemini and Claude. Five come through one scraping service, Claude I
> call directly at Anthropic, and those two run at the same time.
>
> And it recorded every single source each assistant gave back."

### The board

**[POINT]** at the meta line: `RECORDED PANEL · UK · 8 QUESTIONS · 438 CITATIONS · $0.229`

> "Eight questions, four hundred and thirty-eight citations, twenty-three cents."

**[POINT]** at the headline, then at the first row.

> "And the headline is the whole thing in one line. You're in three of the eight. Cleveland
> Clinic is in six. That domain is the top row, and the number six is right there in its
> row, so you can check the sentence against the table without taking my word for it."

**[POINT]** at the column headed `QUESTIONS ANSWERED IN`.

> "That column is what the rows are sorted by. It's the number that matters, because being
> in one answer out of eight and being in six is a completely different business."

**[POINT]** at the green blocks, then the blue squares, then the amber ticks.

> "Then three more things, kept separate on purpose, because they're three different
> problems.
>
> Green blocks: how many of the six assistants cite this site at all. Cleveland Clinic has
> four.
>
> Blue squares: how many times, per assistant. Bigger square, more mentions.
>
> Amber ticks on the right: how many times this site is the one that opens the answer.
> There are forty of those first slots across the whole run, and Cleveland Clinic holds
> four of them, which is more than anyone else."

**[POINT]** at the youtube.com row, which reads `5.0%` and `NEVER 1ST`.

> "And this is why they're separate. YouTube has the biggest share of citations on the
> whole panel, five percent, and it is never once the first source named. If you only
> counted mentions you'd tell the client to go make videos, and you'd be wrong."

**[POINT]** at the column headers, the `shown / total` pairs.

> "Under each assistant there are two numbers, like a hundred and forty-three. The first is
> what's in the fourteen rows you can see, the second is everything that assistant gave
> across the whole run. Add up a column and you get the first number. You can check it with
> your finger, and I'd rather you did."

### The teardown

**[SCROLL]** down to `WHY THIS DOMAIN`.

> "Then it takes the top domain apart. Three factors, and each one is arithmetic on the
> citations you just looked at, with a SHOW THE COUNTS button under it.
>
> Reach: four of the six assistants. Sixty-seven out of a hundred.
>
> Lead slots: four of the forty first positions. That scores a hundred, and the line under
> it says why, nobody on this panel holds more.
>
> Named in the prose: Cleveland Clinic is written out in three of the forty-eight answers.
> Six out of a hundred. That one is about being in the sentence a person actually reads,
> not just in the source list underneath."

**[POINT]** at `NOT RUN HERE`.

> "And it says which factors it did not run and why. Six of the nine need a page fetch or a
> second run. I'd rather show you the gaps than let you assume it did everything."

**[CLICK]** **DOWNLOAD THE FILES**.

> "And the whole run leaves as a spreadsheet. Every citation, the board, the questions
> you're absent from, and a brief written from these numbers."

---

## Screen 2. AUDIT, about 4 minutes

**[CLICK]** **AUDIT** in the top navigation. Tab 2.

**[POINT]** at the row of buttons labelled `LIVE PAGES`.

> "Three real pages on one-click buttons so I'm not typing URLs in front of you. The field
> takes any public URL, and there's a paste-HTML button next to it because some sites refuse
> to be read automatically and I wanted a route nobody can block."

### The comparison that makes the point

**[CLICK]** **the page cited most on the board**

**[POINT]** at the score, 42.

> "That's the Cleveland Clinic page, the one that's in six of the eight answers. Forty-two
> out of a hundred."

**[CLICK]** **the brand's own page**

**[POINT]** at the score, also 42.

> "And that's The Ordinary's own page, the one that's in three of the eight and never named
> first. Also forty-two.
>
> Same score. Completely different outcome. So the page score is not the answer, and that's
> the honest version of what this tool is: it tells you what a page is missing, it does not
> tell you that fixing it guarantees a citation. If it did I'd be selling you something."

**[IF THEY PUSH ON THAT]**

> "I checked. Across the ten most-cited domains on that panel the page score doesn't
> separate them at all, and that makes sense, because all ten are already winning. You
> can't learn what separates winners from losers by only looking at winners. The one
> controlled test in here is the last step of this screen, where the same page is changed
> and re-tested on the same five questions."

### The nine factors

**[POINT]** at the horizontal bar split into sections.

> "This bar is the whole score. The width of each section is what that factor is worth, and
> how full it is is what the page earned. The dark space is the score they're missing, drawn
> to scale. You look at where the biggest dark block is, you don't read numbers."

**[POINT]** at the widest dark section.

> "Eight factors carry a weight and one is a gate that carries none. Each weight comes with
> where it came from, so it's not me deciding what matters."

**[SCROLL]** to the structured data row at 1%.

> "One thing worth flagging. Structured data is weighted at one percent, deliberately.
> There's a study on eighteen hundred and eighty-five pages that found no causal effect. I
> still generate it because it's basic hygiene, but I'm not going to tell a client it's
> important when the evidence says it isn't."

### The robots.txt moment

**[CLICK]** **best page, blocks the crawlers**

**[POINT]** at the score, 71, then at the gate row at the top.

> "This is the healthline page, and it's the best-scoring of the three, seventy-one. And
> look at the top row. The gate says PARTLY BLOCKED."

**[SCROLL]** down to the crawler verdicts.

> "Healthline blocks four of the eight AI crawlers in their own robots.txt. GPTBot,
> ClaudeBot, Applebot-Extended and CCBot. Robots.txt is the file a site uses to tell robots
> what they're allowed to read.
>
> So the best page of the three is the one half the assistants are not allowed to fetch."

**[SWITCH]** to tab 5, the raw `healthline.com/robots.txt`. **[SCROLL]** to a `Disallow: /`.

> "That's their file, not my tool. A lot of publishers blocked these in 2023 and 2024 so
> they weren't feeding AI for free, and most marketing teams have no idea it happened,
> because it's one line in a file the dev team owns."

**[SWITCH BACK]** to tab 2.

> "And the tool writes the exact block to paste to undo it. That's probably the only thing
> in here a client can fix this afternoon."

### The fixes, and the proof

**[CLICK]** the button **ranks, never cited** under `PAGES IN THIS REPO`.

> "Now I switch to a page we hold in the repo, and I'll say why in a second. Thirty-three
> out of a hundred."

**[CLICK]** **Write the fix plan**.

> "This writes the actual replacements. Not 'improve clarity'. The sentence they have, and
> the sentence to replace it with, ranked by what it buys."

**[SCROLL]** to a fix with a red bracketed gap.

> "And this is the part I'm most attached to. Some fixes need a real number or a real named
> expert, and the tool refuses to invent them. It leaves a marked gap and puts that fix on
> a separate list that comes out as a spreadsheet the client fills in. Five of these eight
> are waiting on the client, not on me."

**[CLICK]** the left rail, step 5, **Test citations on a live engine**, then **Test
citations now**. About four seconds.

**[POINT]** at `0/5 queries cite this page`.

> "Before anything changes: five buyer questions, this page is cited on none of them.
> That's the before, and it's measured."

**[POINT]** at the line saying how many answers were live and how many replayed.

> "And it tells you whether those answers came off the network or out of the recording, so
> you're never guessing whether a fast result was real."

**[CLICK]** **Apply the fixes and re-test**.

**[POINT]** at `0/5 → 2/5 cited · score 33 → 78`.

> "Same page with the rewrites applied, re-tested on the same five questions. Two out of
> five now, and the score goes thirty-three to seventy-eight.
>
> The honest split on that number: the fixes the tool makes on its own get it from
> thirty-three to fifty-three. Seventy-eight is with the client's fact sheet filled in,
> because the two heaviest factors, sourced quotes at twenty percent and hard numbers at
> eighteen, need a fact I won't invent. Most of the gain is unlocked by the client answering
> seven questions, and I think that's the right split.
>
> And this loop only closes on a page we hold, on purpose. I can't publish a fix to
> healthline.com, so a before-and-after there would be a claim, not a measurement."

**[CLICK]** **Download 4 files**.

> "And it leaves as files, not a report. The corrected HTML, the structured data, the
> robots.txt block, and the fix plan as a spreadsheet. A developer can deploy that without
> me in the room."

---

## Screen 3. AUTOPSY, about 2 minutes

**[CLICK]** **AUTOPSY** in the top navigation. Tab 3.

**[CLICK]** **healthline.com** under `CHECKED WORKING`. About five seconds.

> "The board tells you who to go after. This tells you why they win, on one axis."

**[POINT]** at the two cards.

> "Their page seventy-one, ours forty-two. One axis down the middle, their page grows
> right, ours grows left, rows ordered by the weighted gap. The widest asymmetry is the
> work order, and you see it before you read anything."

**[POINT]** at the label above their card: `THEIR PAGE, THE URL YOU GAVE ME`.

> "And the card says how it got their page. This one I gave it, because healthline serves
> that page fine and doesn't list it in their sitemap, so nothing that reads a sitemap can
> find it. I'd rather the screen say which of the two happened than pretend."

**[CLICK]** the **nhs.uk** button.

> "This one it finds on its own."

**[SCROLL]** to `How their page was found`.

> "It reads the site's own sitemap, which is the list of pages a site publishes for search
> engines, so every URL in there is a page that actually exists. It says how many it scanned,
> how many matched, and how many of those it actually fetched.
>
> I did it the other way first. I asked a model to name the URL, and for a medical question
> on the BMJ it gave me three addresses that looked completely real and none of them
> existed. A model remembers the shape of a publisher's URLs, not which ones are real."

**[CLICK]** the top row to expand it.

> "And every row opens to the exact sentences pulled off both pages. Never paraphrased."

---

## Screen 4. PIPELINE, about 4 minutes

**[CLICK]** **PIPELINE** in the top navigation. Tab 4.

**[CHECK]** the topic field reads `vitamin c serum`

**[CLICK]** **Run the pipeline**. About forty seconds.

> "Case two. Seven steps, a topic in, market-ready content out. Watch where it stops."

**[POINT]** at the hatched orange bar at step 06.

> "There. Five steps ran and then it hit a wall, and everything past the wall is a thin
> line because it's unreachable."

### The grounding, which is the argument

**[SCROLL]** to the three market cards. **[POINT]** at UK, then SE.

> "Each market is grounded on its own.
>
> In the UK the term is 'vitamin c serum', forty thousand five hundred searches a month. In
> Sweden the literal translation gets four hundred and eighty. The word Swedes actually type
> is c-vitaminserum, one word, and that gets six thousand six hundred. Fourteen to one
> against the translation. And Danish splits the word where Swedish joins it.
>
> So that's three different pages, not one page translated three times."

### The check that catches me

**[POINT]** at the two meters on the SE card.

> "And this is the part I'd want you to push on. There are two duplication checks, because
> one of them can't work.
>
> The first is word overlap. Do these two drafts share the same eight-word runs. It reads
> zero percent, and zero is meaningless here, because one draft is Swedish and the other is
> Danish. Word overlap between two languages is zero whatever you wrote. The label says so.
>
> The second one counts the figures, in order. Numbers don't translate. And on the Swedish
> card it reads eighty-two percent against the Danish draft, and on the Danish card a
> hundred percent against the Swedish.
>
> So my own pipeline produced two drafts that are the same page in two languages, and my own
> check caught it. That's why the gate exists and why it's a human who signs."

**[POINT]** at the red reason line under the meter.

> "And it says it in words, not a score."

### The gate

**[CLICK]** **Attempt the publish** before signing anything.

> "Publishing with nothing signed."

**[POINT]** at the refusal at the top of the screen.

> "Refused. Not a disabled button, a real call that comes back rejected."

**[TYPE]** my name in `Who approves this market?` on the UK card. **[CLICK]** **Sign UK**.

**[POINT]** at the SE card, which has a second field.

> "And a flagged market needs more than a name. It needs a written reason, and that reason
> is stored with my name and travels into the payload the CMS gets. So if someone signs off
> a page the tool flagged, there's a record of who did it and what they said."

**[TYPE]** a name and a reason on SE and DK. **[CLICK]** **Sign SE over the flag**, then
**Sign DK over the flag**.

**[CLICK]** **Attempt the publish**.

**[SCROLL]** to the CMS output.

> "Three payloads, one per market, with the hreflang tags that tell Google which page is
> for which language. en-GB, sv-SE, da-DK, and an x-default.
>
> And the Swedish and Danish headings are actually Swedish and Danish, with the accents,
> because I got that wrong first and shipped English headings on Nordic pages."

**[POINT]** at the status on each payload.

> "Ready for CMS, not published. It writes the file and hands it over. It never pushes."

**[SCROLL]** to `DECISION TRACE`.

> "And every claim on this screen has a row saying which file produced it."

---

# PART 3. Closing, about 45 seconds

> "So that's the four screens. What I'd want you to take from it isn't the tool, it's the
> three decisions inside it.
>
> One, I measure against real assistants instead of asking a model what it would cite,
> because a model guessing about itself is worth nothing.
>
> Two, everything on screen carries the count it came from, so you can check me. That's why
> the same page shows forty-two on two screens and why the board's sentence and its table
> agree.
>
> Three, it refuses. It refuses to invent a statistic, it refuses to publish without a named
> person, and it tells you which factors it did not run. A tool that always has an answer is
> a tool you can't trust with a client's money."

**[IF THEY ASK WHAT I'D DO NEXT]**

> "Run the panel weekly and diff the boards, because one run can't separate an engine
> changing its behaviour from scrape noise. That's the factor I list as not run, and it's
> the one I'd build next."

---

# APPENDIX A. The tested demo set

Everything here was run on the deployed app on 29 July and matched.

## BOARD

**[CLICK]** **Load the recorded run**

| | |
|---|---|
| Topic, brand, market | vitamin C serum · theordinary.com · United Kingdom |
| Cost | $0.2285 |
| Time | under a second recorded, 5 min 18 s live |
| Citations | 438 across 206 domains, 8 questions |
| Per engine | AI Mode 143, Perplexity 128, ChatGPT 77, Claude 67, AI Overview 17, Gemini 6 |
| Engines that answered | 6 of 6 |
| Top row | health.clevelandclinic.org, 6 of 8 questions, 4 engines, 11 citations, 4 lead slots, 2.5% |
| The Ordinary | 3 of 8 questions, 0 lead slots, row 18; the row merges theordinary.com and theordinary.es |
| youtube.com | 5.0% of all citations, 0 lead slots |
| Lead slots on the panel | 40 |
| Teardown | reach 67, lead slots 100, named in prose 6 |
| Cited by all six engines | none, and the screen says so |

## AUDIT, the three live buttons

| Button | Page | Score | Gate | Crawlers blocked |
|---|---|---|---|---|
| the page cited most on the board | health.clevelandclinic.org/vitamin-c-serum | 42 | open | 0 of 8 |
| the brand's own page | theordinary.com/en-us/blog/vitamin-c-skincare.html | 42 | open | 0 of 8 |
| best page, blocks the crawlers | healthline.com/health/beauty-skin-care/vitamin-c-serums | 71 | partly blocked | 4 of 8 |

13 checks on a live URL, 11 on a bundled page. The header count and the "show all N checks"
toggle always agree.

## AUDIT, the proof loop

**[CLICK]** **ranks, never cited**, then the four steps.

| | |
|---|---|
| Before | 33 out of 100 |
| Fix plan | 8 rewrites, 5 waiting on a fact from the client |
| Citation test | 0 of 5 |
| Apply and re-test | 2 of 5, score 78 |
| Automatic fixes alone | 33 to 53 |
| With the fact sheet filled | 33 to 78 |

## AUTOPSY

**[CLICK]** **healthline.com** under `CHECKED WORKING`

| | |
|---|---|
| Their page | healthline.com/health/beauty-skin-care/vitamin-c-serums, 71 out of 100 |
| Our page | theordinary.com/en-us/blog/vitamin-c-skincare.html, 42 out of 100 |
| How it was found | supplied by hand, and the card says so |
| Why supplied | healthline serves it at HTTP 200 and lists no serum page in its sitemap |
| nhs.uk button | resolves from the sitemap, 21,057 URLs scanned |

## PIPELINE

```
Topic     vitamin c serum
Markets   UK, SE, DK
```

| | |
|---|---|
| Terms | UK 40,500/mo · SE 6,600/mo · DK 3,200/mo |
| Scores | 67, 68, 68, all above the 55 floor |
| Same words as another market | 0% everywhere, and the label says why that is meaningless across languages |
| Same figures, same order | UK 25%, SE 82%, DK 100% |
| Flagged | SE and DK, each with a written reason |
| Publish with nothing signed | refused |
| Signing a flagged market | needs a name and a written reason, both travel to the payload |
| Output | 3 payloads, hreflang en-GB / sv-SE / da-DK / x-default |

## If they ask for a different category

`marketing attribution software`, US English, is also tested: 301 citations across 132
domains, and it produces properly B2B questions.

## If they ask for a page of their own

Any public URL works. If the site refuses to be read, **Paste HTML instead** takes the page
source and nobody can block that route.

---

# APPENDIX B. Numbers to know without looking

| | |
|---|---|
| Assistants queried | 6 |
| Cost per question, all six | about 2.5 cents |
| Cost of writing 160 questions | about 1 cent |
| The demo run | $0.2285, 8 questions, 438 citations |
| Tests | 246, typecheck and build clean |
| Weighted factors | 8, plus 1 unweighted gate |
| Sample page, automatic fixes only | 33 to 53 |
| Sample page, with the fact sheet filled | 33 to 78 |
| Swedish, literal translation against real term | 480 against 6,600 |
| Structured data weight | 1 percent, from a study of 1,885 pages |
| Healthline | best page of the three, blocks 4 of 8 AI crawlers |
| Two pages at 42 out of 100 | one cited on 6 of 8 questions, one on 2 |

---

# APPENDIX C. Questions I should expect

**"Does your score actually predict whether a page gets cited?"**

> "Not on its own, and I checked rather than assumed. Across the ten most-cited domains on
> that panel the score doesn't separate them, and that's expected, because all ten are
> already winning. You can't learn what separates winners from losers by only looking at
> winners. The controlled test is the last step of the audit: same page, same five
> questions, changed and re-tested. That goes zero of five to two of five. That's the claim
> I'll defend."

**"Why is the site that wins only 42 out of 100?"**

> "Because an assistant quotes a passage, not a page. The composite tells you what a page is
> missing. It doesn't rank two pages against each other for one specific question, which is
> what the autopsy screen is for."

**"How do I know the recorded run is real?"**

> "The cost is on the screen, twenty-three cents, and Run live is right there. It takes five
> minutes and costs about the same. I'd rather show you the run than make you sit through
> one, but the button works."

**"What can't it do?"**

> "Three things I'd say up front. It can't tell you whether a citation moved revenue, that
> needs their analytics. It can't run the six factors that need a page fetch or a second
> engine run, and it lists them by name rather than hiding them. And it can't prove a fix
> causes a citation on a site I don't control, which is why the before-and-after runs on a
> page held in the repo."
