# CITED, my demo script

Everything I say, every page I go to, every button I click.

**Stage directions are in bold brackets.** Everything in a quote block is what I say out
loud. The tested demo set is in Appendix A, and it is what I use unless they ask for
something specific.

---

# BEFORE RECORDING, 5 minutes

Use the deployed app, `https://cited-precis.vercel.app`. Every screen below was run
click by click on it on 29 July and every step landed. Nothing has to start on my
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

**[RECORD]** Browser window only, not the whole screen. Nothing else visible.

**[TIMING]** Measured on the deployed app, so I know what a pause means: the recorded
panel under a second, the audit under a second, the fix plan under a second, the
citation test about 4 seconds, apply-and-re-test under a second, the autopsy about 6
seconds, the pipeline about 40 seconds. Nothing here makes me wait on camera.

---

# PART 0. The opening, about 90 seconds

**[SCREEN]** Tab 1, `/board`, empty. Do not type anything yet. Let them look at it while I
talk.

The rule for this bit: it is about their client's money, not about me and not about how I
built anything.

> "Before I show you anything, one number from a run I did last night.
>
> I took vitamin C serum in the UK, and I asked six assistants eight of the questions a
> buyer actually types. Four hundred and thirty-eight citations came back. The Ordinary,
> which is one of the biggest brands in that category, was cited on two of those eight.
> A hospital site was on six.
>
> And the part I find interesting is that nothing in their reporting would ever tell them
> that. Because a click that doesn't happen leaves no trace. It's not in analytics, it's
> not in the ad platform, so there's no line in the monthly deck that says it happened.
> The budget just quietly stops working and nobody can point at where.
>
> So that's the gap I built for. In the next ten minutes I'll show you three things: the
> tool measuring who actually gets cited, then explaining why those sites win, then
> writing the fixes for the client's own page. And everything on the screen is something
> you can check yourself without me."

**If they look impatient, the two-sentence version:**

> "Buying research is moving into assistants, an assistant names three or four sources
> instead of ten links, and right now nobody can tell a client whether they're one of
> them. This measures it, explains it, and writes the fixes."

---

# PART 1. What each case asked for, about 60 seconds

**[SCREEN]** Still tab 1. I point at the four words in the top navigation as I name them:
BOARD, AUTOPSY, AUDIT, PIPELINE.

> "Quickly, so you know what you're looking at. There are four screens and they map onto
> your two cases.
>
> Case one was the page optimiser: a client ranks fine on Google, never shows up in an AI
> answer, they want to know why and what to change. That's three of these screens. BOARD
> finds who is being cited instead of them. AUTOPSY compares their page against the page
> that's winning. AUDIT scores their page and writes the actual edits.
>
> Case two was the multi-market content engine. That's PIPELINE, the last one. Seven steps
> from a topic to something ready for a CMS, and it refuses to publish until a named
> person signs off per market.
>
> I'll go left to right."

---

# PART 2. Screen by screen

---

## Screen 1. BOARD, about 4 minutes

**[SCREEN]** Tab 1, `/board`

### Fill the form

**[TYPE]** in the first field (placeholder *"The category, in a buyer's words"*):
`vitamin C serum`

**[TYPE]** in the second field (placeholder *"yourbrand.com (optional)"*):
`theordinary.com`

**[LEAVE]** the market dropdown on **United Kingdom**

**[SET]** the last dropdown to **6 to the engines**

> "So the category goes here, in the words a buyer would use. The brand field is optional,
> and I mean that, because the question 'who is winning in my category' is one you want to
> answer before you even have the client. The market matters because it sets the language
> the questions get written in, not just the country.
>
> And this last one is how many questions actually go to the assistants."

**[CLICK]** **Load the recorded run**. It appears in under a second.

> "I'm loading a run I did earlier rather than making you watch one happen, and I want to
> be clear about why. A live panel is about forty seconds per question, so eight questions
> is five minutes. This is that exact run: same eight questions, same six assistants, four
> hundred and thirty-eight citations, twenty-three cents actually spent. The screen says
> RECORDED PANEL rather than MEASURED LIVE so you can see which one you're looking at.
>
> The Run live button is right there and I'm happy to start one in the background if you
> want to see it land."

**[OPTIONAL, only if there is time]** **[CLICK]** **Run live** and let it run while talking
over the other screens. Come back to it at the end. **[IF IT STALLS]** click **Cancel**,
the previous result stays on screen.

### What that run did, about 90 seconds

**[SCREEN]** The three steps on the left are all green. Talk through them.

> "Two things are happening. First it's writing the questions a buyer of this thing
> actually asks, split across eight buying angles: what is it, does it work, how do I
> choose, what's it versus, what are the risks, how do I use it, what results should I
> expect, and what does it cost. That's about a hundred and sixty questions and it costs
> about a cent.
>
> I'm using an AI model for that part on purpose, because writing the questions people ask
> is exactly what a language model is good at. I'm not pretending these are search
> volumes. They're just questions, and you can read every one of them on this screen.
>
> Then it takes eight of those and puts them to six real assistants: Google's AI Overview,
> Google's AI Mode, Perplexity, ChatGPT, Gemini and Claude. Five of those come through one
> scraping service, Claude I call directly at Anthropic, and those two run at the same
> time so we're not waiting twice.
>
> And it records every single source each assistant gives back."

### The board

**[POINT]** at the meta line above the headline: `RECORDED PANEL · UK · 8 QUESTIONS · 438
CITATIONS · $0.229`

> "Eight questions, four hundred and thirty-eight citations, twenty-three cents. And the
> headline underneath is the whole point in one line: The Ordinary is cited on two of the
> eight, and a hospital site is on six."

**[POINT]** at the column headers.

> "Six columns, one per assistant. And under each one there are two numbers, like eleven
> out of eleven. The first is what's in the rows you can see, the second is everything that
> assistant gave across the whole run. So if you add up a column, you get the first number.
> You can check it with your finger, and I'd rather you did."

**[POINT]** at the green blocks on the left of the top row.

> "Now the rows. Each row is a website, and there are three separate things on it, on
> purpose, because they're three different problems.
>
> The green blocks are how many assistants cite this site at all. Five green blocks, five
> assistants reach for it.
>
> The blue squares are how many times, per assistant. Bigger square, more mentions.
>
> And these orange ticks on the right are how many times this site is the one that opens
> the answer. Because being mentioned and being the source the assistant leans on are two
> completely different outcomes."

**[SCROLL]** down slowly until a row marked `NEVER 1ST` is visible.

> "Here's why I kept them apart. On one of my runs YouTube had the biggest share of
> mentions on the whole board, and it opened zero answers. Zero. If I'd collapsed that
> into one score, it would have been invisible, and you'd have spent budget on the wrong
> thing."

**[CLICK]** any row to expand it.

> "And every row opens to the exact pages that were cited. So none of this is my tool
> asserting something. You can click through and read the page."

**[CLICK]** the same row again to close it.

### The WHY section

**[SCROLL]** to the section headed `WHY THIS DOMAIN AND NOT ANOTHER`.

**[POINT]** at that header, then at the domain name under it.

> "So now it picks one site and takes it apart, and how it picks is written right here: the
> site that opens the most answers. Not the one with the most mentions.
>
> Here it's the Cleveland Clinic, which opens five of the twenty-nine answers on this
> panel."

**[SCROLL]** to the third card, the one about a brand being named in the text.

> "Three findings, and this third one is the one I'd lead with in a client meeting.
>
> It checks whether a brand gets named in the actual text of the answer, even when that
> brand's own website is nowhere in the sources. And across my runs, five brands out of six
> that got named in answers had zero citations of their own site.
>
> Which means the way into these answers is mostly not your own page. It's being named on
> somebody else's page. And that changes what you'd actually spend money on."

**[SCROLL]** to the two columns at the bottom.

> "Then two lists. What a client can copy, and what no amount of page work will ever buy
> them. That second list exists so nobody sells a client a plan to become Reddit, which is
> not a plan."

**[POINT]** at the quiet line at the very bottom about factors not run.

> "And this line stays on screen permanently. It says the teardown answers three of the
> nine factors I designed, and names the other six and what each would need. I'd rather the
> tool tell you what it didn't measure than give you a score where two thirds is guesswork."

### The download

**[SCROLL]** to the orange panel headed *"Take the run with you"*.

**[CLICK]** **Download the files**.

**[OPEN]** the zip if the file manager shows it.

> "And it all comes out as files. Every citation as a spreadsheet, the board, the list of
> questions you're absent from and who took them, and a brief written from those numbers.
> Nothing in there is templated, it's all built from this run."

---

## Screen 2. AUDIT, about 3 minutes

**[CLICK]** **AUDIT** in the top navigation. That is tab 2, `cited-precis.vercel.app/`

**[POINT]** at the row of buttons labelled `LIVE PAGES`.

**[CLICK]** **the site that wins the category**

> "So this is case one proper. I've put three real pages on one-click buttons so I'm not
> typing URLs in front of you, but the field takes any public URL, and there's a paste HTML
> button next to it because some sites refuse to be read automatically and I wanted a route
> nobody can block."

**[SCREEN]** The score appears in about a second.

**[POINT]** at the big number, 43.

> "Forty-three out of a hundred. And this is the site that wins the category we just looked
> at, so straight away that's interesting.
>
> Nine factors, and each one carries its weight and where the weight comes from, so it's
> not me deciding what matters."

**[POINT]** at the horizontal bar split into sections.

> "This bar is the whole score. The width of each section is what that factor is worth, and
> how full it is, is what the page earned. So the dark empty space is literally the score
> they're missing, drawn to scale. You look at where the biggest dark block is, you don't
> read numbers."

**[POINT]** at the widest dark section.

> "Here it's sourced quotes, worth twenty points, and they score zero. That's twenty of
> their fifty-seven missing points in one factor."

### Two details worth saying

**[SCROLL]** to the row for structured data, at 1%.

> "One thing I'd flag. Structured data is weighted at one percent, and that's deliberate.
> There's a study on eighteen hundred and eighty-five pages that found no causal effect
> from it. I still generate it, because it's basic hygiene, but I'm not going to tell a
> client it's important when the evidence says it isn't."

**[SCROLL]** to the crawlability row at the top, the one with its own rule above it.

> "And crawlability isn't weighted at all, it's a gate. If an assistant literally can't
> fetch the page, nothing else matters."

### The robots.txt moment

**[SCROLL]** down to the crawler verdicts.

**[POINT]** at the four rows showing blocked.

> "And this is my favourite thing the tool has ever found. Healthline wins this category,
> they're cited everywhere. And in their own robots.txt, which is the file a site uses to
> tell robots what they're allowed to read, they block four of the eight AI crawlers.
> GPTBot, ClaudeBot, Applebot-Extended and CCBot."

**[SWITCH]** to tab 5, the raw `healthline.com/robots.txt`.

**[SCROLL]** to a `Disallow: /` line.

> "That's their file, not my tool. A lot of publishers blocked these in 2023 and 2024 so
> they weren't feeding AI for free, and most marketing teams have no idea it happened,
> because it's one line in a file the dev team owns."

**[SWITCH BACK]** to tab 2.

> "And the tool writes the exact block to paste to undo it. That's probably the only thing
> in here a client can fix this afternoon."

### The fixes

**[CLICK]** **Write the fix plan**.

> "And this writes the actual replacements. Not 'improve clarity', the sentence they have
> and the sentence to replace it with, ranked."

**[SCROLL]** to a fix marked as needing a supplied fact.

> "And this is the part I'm most attached to. Some fixes need a real number or a real named
> expert, and the tool refuses to invent them. It leaves a marked gap and puts that fix on
> a separate list, which comes out as a spreadsheet the client fills in. Five of these
> eight are waiting on the client, not on me."

### Then I prove it, on a page I can actually change

**[CLICK]** **the left rail, step 5, Test citations on a live engine**, then **Test
citations now**. About four seconds.

**[POINT]** at `0/5 queries cite this page`.

> "Before anything is changed: five buyer questions, this page is cited on none of them.
> That's the before, and it's measured, not asserted."

**[CLICK]** **Apply the fixes and re-test**.

**[POINT]** at `0/5 → 2/5 cited · score 33 → 78`.

> "Same page with the rewrites applied, re-tested on the same five questions: two out of
> five now. And the score goes thirty-three to seventy-eight.
>
> One thing about that number, because it's the honest version. The fixes the tool can make
> on its own get it from thirty-three to fifty-three. Seventy-eight is with the client's
> fact sheet filled in, because the two heaviest factors, sourced quotes at twenty percent
> and hard numbers at eighteen, need a fact I will not invent. So most of the gain is
> unlocked by the client answering seven questions, and I think that's the right split.
>
> And this loop only closes on a page held in the repo, on purpose. I can't publish a fix
> to healthline.com, so the before-and-after would be a claim rather than a measurement."

**[CLICK]** **Download 4 files**.

> "And it leaves as files, not as a report. The corrected HTML, the structured data, the
> robots.txt block, and the fix plan as a spreadsheet. A developer can deploy that without
> me in the room."

---

## Screen 3. AUTOPSY, about 2 minutes

**[CLICK]** **AUTOPSY** in the top navigation. Tab 3.

**[POINT]** at the row labelled `CHECKED WORKING`.

**[CLICK]** **HEALTHLINE.COM**

> "So the board tells you who to go after. This tells you why they win.
>
> These three are pre-checked pairs so nothing fails live, but the fields take any domain
> and any question."

**[SCREEN]** Two cards appear, then the rows.

**[POINT]** at the two score cards.

> "Their page forty-three, ours forty-two. Almost identical. And we still lose."

**[POINT]** at the paragraph under the headline.

> "And the tool says why, right here: an assistant quotes a passage, not a page. So a
> better page overall can still lose the passage. That's the whole reason page-level SEO
> thinking doesn't transfer to this."

**[POINT]** at the widest bands.

> "One axis. Their page grows right, ours grows left, and the widest gap is the work order.
> Here it's authority signals, zero against fifty-five."

**[CLICK]** the top row to expand it.

> "And every row opens to the exact sentences pulled off both pages. Never paraphrased."

**[SCROLL]** to the bottom, `How their page was found`.

> "And this is how it found their page. It reads the website's own sitemap, which is the
> list of pages a site publishes for search engines, so every URL in there is a page that
> actually exists.
>
> I did it the other way first. I asked a model to name the URL, and for a medical question
> on the BMJ it gave me three addresses that looked completely real and none of them
> existed. Because a model remembers the shape of a publisher's URLs, not which ones are
> real."

---

## Screen 4. PIPELINE, about 3 minutes

**[CLICK]** **PIPELINE** in the top navigation. Tab 4.

**[CHECK]** the topic field reads `vitamin c serum`

**[CLICK]** **Run the pipeline**

**[SCREEN]** Seven columns fill in, then a hatched orange bar appears at step 06.

> "Case two. Seven steps, a topic in, market-ready content out. Watch where it stops."

**[POINT]** at the orange hatched bar.

> "There. It ran five steps and then it hit a wall, and everything past the wall is a thin
> line because it's unreachable."

### The grounding, which is the argument

**[SCROLL]** down to the three market cards.

**[POINT]** at the UK card, then the SE card.

> "But first the bit that matters most. Each market gets grounded on its own.
>
> In the UK the term is 'vitamin c serum', forty thousand five hundred searches a month. In
> Sweden, the literal translation gets four hundred and eighty. The word Swedes actually
> type is c-vitaminserum, one word, and that gets six thousand six hundred. So that's
> fourteen to one against the translation.
>
> And Danish splits the word where Swedish joins it. So that's three different pages, not
> one page translated three times."

**[POINT]** at the Swedish grounding note on the card.

> "And each market gets its own angle. The Swedish page leads on pigmentation across the
> year, because there are four hours of daylight in Stockholm in December so the sun
> protection angle doesn't land. The Danish one has to deal with EU rules on health claims,
> which are stricter than the tone British pages use, so copying the British text isn't a
> language problem, it's a compliance problem."

### The originality check

**[POINT]** at the overlap meter on any market card.

> "And this is the plagiarism and AI-detection part your brief asked for, and I want to be
> straight about what I refuse to claim.
>
> There's no honest plagiarism check without a database of everything ever written, and no
> classifier can tell you text was machine-written at an error rate you'd act on. So I
> claim neither.
>
> What it does is compare every draft against the other drafts, eight words at a time, and
> quote the longest passage they share. Zero percent here.
>
> And when I first ran that check it said ninety-five percent. And it was right. My own
> generator was writing four identical English paragraphs and swapping the keyword. So the
> tool caught me doing exactly what your brief warns about."

### The wall

**[SCROLL]** to a market card with an approver field.

**[CLICK]** **Send it unsigned**

**[SCREEN]** It refuses.

> "An approval with no name isn't an approval."

**[SCROLL]** to the panel headed *"Try to publish with the names missing"*.

**[CLICK]** **Attempt the publish**

**[SCREEN]** It refuses with a 409.

> "And that's hitting the same endpoint a CMS would. So the refusal is in the logic, not
> behind a greyed-out button. You can't get round it from outside."

**[TYPE]** a name into each of the three approver fields, `Octave` is fine

**[CLICK]** **Sign UK**, then **Sign SE**, then **Sign DK**

**[SCREEN]** The content payloads appear.

**[POINT]** at the Swedish payload.

> "And now it publishes. And the Swedish page has Swedish headings and an sv-SE language
> tag, not English headings with Swedish body text, which is what it was doing until I
> caught it."

---

# PART 3. Closing, about 45 seconds

**[CLICK]** back to **BOARD**, tab 1, so the board is the last thing on screen.

> "So to close. Everything you saw is checkable without me. The questions are sentences you
> can retype into ChatGPT. The robots.txt lines are quoted from a public file. The
> comparison sentences are pulled off the pages as they are.
>
> And where the tool doesn't know something, it says so and leaves the gap visible rather
> than filling it in.
>
> With another week I'd do three things: put the keyword data behind an interface so
> plugging in a real provider is a config change, wire the before-and-after test to the
> real questions from the board instead of template queries, and add a proper entity
> clarity check."

---

# PART 4. Questions I expect

**Why a scraping service and not the APIs directly?**
> "Perplexity and Gemini have APIs, but Google's AI Overview and AI Mode don't. One Apify
> actor exposes five of them, so that's one integration instead of five and one bill
> instead of five. Claude isn't in it so I call Anthropic directly. If I wanted to move to
> direct APIs later it's one file."

**What does it cost to run?**
> "About two and a half cents per question across all six. Writing the hundred and sixty
> questions is about one cent. The run you just watched was sixteen cents."

**What's real and what's mocked?**
> "Real: the six assistants, fetching pages, the scoring, the fixes, the structured data,
> the exports. Mocked: the search volumes per market, which come from a fixture that's
> labelled on screen as a recorded sample. Your brief allowed real data or a realistic mock
> for that."

**What did you get wrong, or what would you do differently?**
> "The main measurement. I built it once and threw it away. The first version asked an AI
> model which websites it would cite for a question, and it answered, and it gave me one
> site per question, and it looked completely fine on the screen.
>
> Then I looked at real answers and two things were wrong. A real answer cites several
> sources, not one. And the sources differ per assistant: three domains from AI Overview,
> twenty-seven from AI Mode, twelve from Perplexity, on the same question.
>
> The model was describing what it imagines it does, and I had no way to check it. So the
> rule I ended up with, and it's the rule the whole build follows now, is that if I can't
> verify a number outside the tool, it doesn't go on the screen."

**How did you use AI to build this?**
> "Claude Code, in short loops. The thing I'd point at is adversarial sub-agents: I'd run
> an agent whose only job was to try to break a claim by reading the code. That's how I
> found that my language tags were declaring the British page as Ukrainian, that the
> Swedish pages had English subheadings, and that one screen's headline named one website
> while the section underneath took apart a different one."

**Where do you refuse to automate?**
> "Four places, all in the logic rather than the interface. Nothing publishes without a
> named person per market. A market with no grounding data stops the run rather than being
> translated from English. Language tags are proposed and never pushed. And a draft below
> the quality bar needs an explicit override with a written reason, stored with the name."

**What's weak?**
> "Three things. The board records what an assistant cites today, not what it will index
> tomorrow. The authority factor only reads what's on the page, and the screen says so. And
> the pipeline runs on one grounded topic across three markets, the six-market cap is in
> the code but not in the data."

---

# PART 5. Running order

| Time | Screen | The one point |
|---|---|---|
| 0:00 | board, empty | one number: The Ordinary cited on 1 of 6, and nothing reports it |
| 1:30 | board, form | fill it, explain the cost, click Run |
| 2:00 | board, running | what the two steps are doing |
| 6:00 | board, result | reach, mentions, first position are three different problems |
| 7:30 | board, WHY | named in the answer without being cited |
| 9:00 | audit | the dark space is the score they're missing |
| 10:00 | robots.txt tab | healthline blocks four of eight AI crawlers |
| 11:00 | audit, fixes | the fix it refuses to write without a real number |
| 12:00 | autopsy | 43 against 42, and we still lose |
| 13:30 | pipeline | 480 against 6,600, then the wall and the 409 |
| 16:00 | back to board | everything is checkable without me |

**Never open** the `/map` route. It is off the navigation and holds the old broken method.

---

# APPENDIX A. The tested demo set

Run and recorded. These exact inputs give these exact outputs.

## BOARD

```
Topic     vitamin C serum
Domain    theordinary.com
Market    United Kingdom
Panel     6 to the engines
```

| | |
|---|---|
| Cost | $0.2285 |
| Time | 5 min 18 s live, under a second recorded |
| Citations | 438 across 206 domains |
| Engines that answered | 5 of 6, Gemini silent and the screen says so |
| Per engine | AI Mode 112, Perplexity 92, ChatGPT 75, Claude 53, AI Overview 11, Gemini 0 |
| Cited by every engine that answered | health.harvard.edu, health.clevelandclinic.org, skincare.com |
| The Ordinary | cited on 1 of the 6 questions |
| Teardown target | health.clevelandclinic.org, 5 of 29 first positions |

## AUDIT

**[CLICK]** the button labelled **the site that wins the category**, which is
`healthline.com/nutrition/vitamin-c-benefits`

| | |
|---|---|
| Score | 43 out of 100, at-risk |
| Biggest hole | sourced quotes at 0, worth 20 points |
| Facts | 33 in 1,581 words of prose |
| Skipped | 92 blocks of navigation, not counted as article text |
| Crawlers blocked | GPTBot, ClaudeBot, Applebot-Extended, CCBot |

## AUTOPSY

**[CLICK]** **HEALTHLINE.COM** under `CHECKED WORKING`

| | |
|---|---|
| Their page | healthline.com/nutrition/vitamin-c-benefits, 43 out of 100 |
| Your page | the azelaic acid page, 42 out of 100 |
| Biggest gaps | authority signals 0 against 55, freshness 0 against 20 |
| Found via | their own sitemap, HTTP 200, 1,794 words |

## PIPELINE

```
Topic     vitamin c serum
Markets   UK, SE, DK
```

| | |
|---|---|
| Terms | UK 40,500/mo, SE 6,600/mo, DK 3,200/mo |
| Scores | 67, 68, 68, all above the 55 floor |
| Overlap between markets | 0 percent |
| Flagged for a human | 2 lines |
| Gate | blocked, publish unreachable |

## If they ask for a different category

`marketing attribution software`, US English, is also tested: 301 citations across 132
domains, and it produces properly B2B questions like "are there scenarios where investing
in this could be a waste".

## If they ask for a page of their own

Any public URL works. If the site refuses to be read, the **Paste HTML instead** button
takes the page source and nobody can block that route.

---

# APPENDIX B. Numbers to know without looking

| | |
|---|---|
| Assistants queried | 6 |
| Cost per question, all six | about 2.5 cents |
| Cost of writing 160 questions | about 1 cent |
| The demo run | $0.2285, 8 questions, six engines |
| Tests | 240, typecheck and build clean |
| Sample page, automatic fixes only | 33 to 53 |
| Sample page, with the fact sheet filled | 33 to 78 |
| Swedish, literal translation against real term | 480 against 6,600 |
| Cross-market overlap, before and after | 95 percent to 0 |
| Structured data weight | 1 percent, from a study of 1,885 pages |
| Healthline | wins the category, blocks 4 of 8 AI crawlers |
