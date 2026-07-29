# CITED, my demo script

This is what I say, in my own words. Everything here is measured on my machine and I can
run it again in front of them.

**The safe demo set is in the appendix.** If they don't ask for a specific brand or page,
I use that one. It is tested and I know what comes out.

---

# PART 0. How I open, about 90 seconds

The rule for this bit: it is about their client's money, not about me and not about how I
built anything. One real number, the reason nobody sees it today, and what I'm about to
show them.

> "Before I show you anything, one number from a run I did last night.
>
> I took vitamin C serum in the UK, and I asked six assistants six of the questions a
> buyer actually types. Three hundred and forty-three citations came back. The Ordinary,
> which is one of the biggest brands in that category, was cited on one of those six
> questions.
>
> And the part I find interesting is that nothing in their reporting would ever tell them
> that. Because a click that doesn't happen leaves no trace. It's not in analytics, it's
> not in the ad platform, so there's no line in the monthly deck that says it happened.
> The budget just quietly stops working and nobody can point at where.
>
> So that's the gap I built for. In the next ten minutes I'll show you three things:
> the tool measuring who actually gets cited, then explaining why those sites win, then
> writing the fixes for the client's own page. And everything on the screen is something
> you can check yourself without me."

**Why I open this way.** It puts a real figure on the table in twenty seconds, it names
the commercial problem in a way a CFO would follow, and the last sentence sets up the one
thing that makes the tool different, which is that nothing in it is unverifiable.

**If they look impatient and I need the short version:**

> "The short version is: buying research is moving into assistants, an assistant names
> three or four sources instead of ten links, and right now nobody can tell a client
> whether they're one of them. This measures it, explains it, and writes the fixes."

---

# PART 1. What the two cases asked for, and what I built for each

I want to be really explicit about this, because it's the thing they're marking.

## Case 1 asked for a page optimiser

> "The scenario was: a client has a page that ranks fine on Google but never shows up when
> someone asks an AI assistant. They want to know why, and what to change.
>
> So the tool takes a page, either from a URL or from HTML you paste in, scores it on nine
> things that decide whether an assistant can quote it, and then writes the actual edits.
> Not advice like 'improve clarity', but the sentence you have and the sentence to replace
> it with, ordered by how much each one is worth.
>
> It also generates the structured data, which is the machine-readable summary you paste
> into the page so a search engine knows what the page is about. And there was an optional
> extra in the brief, which was to compare the page against whatever is being cited today.
> I built that too, and it turned into the biggest part of the tool."

**Which screen does what for Case 1**

| Screen | What it answers |
|---|---|
| BOARD | who is actually being cited for this category, and why them |
| AUDIT | what's wrong with this specific page, and the exact edits |
| AUTOPSY | how my page compares, factor by factor, against the page being cited |

## Case 2 asked for a multi-market content engine

> "The scenario was: the same client wants content in several markets, and they've heard
> you can just use AI to generate it. And the brief is quite clear that a good engineer
> doesn't just say yes to that.
>
> So I built the pipeline they described, seven steps from a topic to something ready for
> a CMS. But the part I actually care about is that it refuses to publish. It physically
> cannot publish a market until a named person has approved that market. And that refusal
> is in the logic, not behind a greyed-out button, so if you call the publish endpoint
> directly you still get refused."

**Which screen does what for Case 2**

| Screen | What it answers |
|---|---|
| PIPELINE | the seven steps, the quality checks, and the wall that stops publishing |

---

# PART 2. The demo, screen by screen

For each screen I'll say the same three things: what you put in, what you get out, and why
that's worth money.

---

## Screen 1. BOARD

### In one line
You type a category, and it tells you which websites the six assistants actually cite for
that category, and which one to copy.

### What I say while it runs

> "So I type a category here. It can be anything, and the brand field is optional, because
> honestly the question 'who is winning in my category' is one you want to answer before
> you even have the client.
>
> Two things happen. First it writes the questions a buyer of this thing actually asks.
> It splits them across eight buying angles, so what is it, does it work, how do I choose,
> what's it versus, what are the risks, how do I use it, what results, and what does it
> cost. That gives about a hundred and sixty questions and it costs about one cent.
>
> I'm using an AI model for that part on purpose, because writing the questions people ask
> is exactly what a language model is good at. And I'm not pretending these are search
> volumes, they're just questions, and you can read them and edit them on the screen.
>
> Then it takes a panel of those questions and puts them to six real assistants. Google's
> AI Overview, Google's AI Mode, Perplexity, ChatGPT, Gemini, and Claude. And it records
> every source each one gives back."

> **If they ask why a panel and not all hundred and sixty:** "Because each question costs
> about two and a half cents across all six, and about ten seconds. So all of them would
> be four dollars and most of an hour. The screen tells you exactly how many it asked and
> lists the ones it didn't, so nothing is hidden."

### Reading the board out loud

> "So each row is a website. And there are three different things on the row, on purpose,
> because they're three different problems.
>
> The green blocks on the left are how many of the six assistants cite this site at all.
> Five green blocks means five of them reach for it.
>
> The blue squares are how many times, per assistant. Bigger square, more mentions.
>
> And the orange ticks on the right are how many times this site is the one that opens the
> answer. Being mentioned and being the source the assistant leans on are two different
> things.
>
> And here's why I kept them separate. On one of my test runs, YouTube had the biggest
> share of mentions of anything on the board, and it opened zero answers. Zero. If I'd put
> those in one number, that would have been invisible, and you'd have spent budget on the
> wrong thing."

> **The numbers at the top of each column:** "Those are two numbers, like five out of ten.
> The first one is what's in the rows you can see. The second is everything that assistant
> gave across the whole run. So if you add up a column you get the first number. You can
> literally check it with your finger."

### The WHY section, which is the commercial part

> "So now it picks one site and takes it apart. And the way it picks is written on the
> screen: it's the site that opens the most answers, not the one with the most mentions.
>
> That took me a wrong turn to get to, by the way. My first version sorted by how many
> assistants cite you, and on a real run it picked a site with eight mentions and zero
> first positions. Which is useless, because a site the assistants never lean on can't
> teach you anything about how to get chosen.
>
> Then there are three findings, and the third one is the one I'd lead with in a client
> meeting.
>
> It checks whether a brand is named in the actual text of the answer, even when the
> brand's own website is nowhere in the sources. And on my runs, five brands out of six
> that got named in answers had zero citations of their own site.
>
> So what that tells you is that the way into these answers is mostly not your own page.
> It's being named on somebody else's page. Which changes what you'd actually spend on."

> **The two columns at the bottom:** "One is what a client can copy. The other is what no
> amount of page work will ever buy them. That second column exists so nobody sells a
> client a plan to become Reddit, which is not a plan."

### What you leave with
A zip with every citation as a spreadsheet, the board, the list of questions you're absent
from and who took them, and a brief written from those numbers.

### Why this is worth money

> "Two reasons. One, it's a deliverable that doesn't exist today, and it's cheap enough to
> run on a prospect before you meet them.
>
> Two, and this is the bit I like, the work queue points at the weakest site sitting in an
> answer, not at the category leader. Because beating the site that wins everything is a
> year of work, and taking the seat of a site that wins nowhere else is one page."

---

## Screen 2. AUDIT

### In one line
You give it one page, and it tells you what to change on that page, with the actual
sentences.

### What I say

> "So this is the core of Case 1. You paste a URL, or you paste the HTML directly, which
> the brief specifically asked for and which is also useful because some websites refuse to
> be read automatically.
>
> It scores the page out of a hundred on nine things. And every one of the nine carries its
> weight and where that weight comes from, so it's not me deciding what matters.
>
> The thing on the screen is a bar split into nine sections. The width of each section is
> what that factor is worth, and how full it is, is what the page earned. So the dark
> empty space is literally the score you're missing, drawn to scale. You don't read numbers
> first, you look at where the biggest dark block is."

> **The detail I'd point at:** "Structured data is weighted at one percent. And that's
> deliberate, because there's a study on eighteen hundred and eighty-five pages that found
> no causal effect from it. I still generate it, because it's basic hygiene, but I'm not
> going to tell a client it's important when the evidence says it isn't.
>
> And crawlability isn't weighted at all, it's a gate. If an assistant literally can't
> fetch your page, nothing else matters, so it either passes or the rest is off."

### The bit I'm proudest of

> "The fix list writes the actual replacement sentences. But some fixes need a real number
> or a real named expert, and the tool refuses to make those up. It leaves a marked gap and
> puts that fix in a separate list, which comes out as a spreadsheet the client fills in.
>
> On the sample page in the repo, the automatic fixes take it from thirty-three to
> eighty-one out of a hundred, and every single substantive fix is refused for lack of a
> supplied fact. That refusal is the feature, not a limitation."

### Why this is worth money

> "It's the shape an agency invoices. The client leaves with a corrected file and a ranked
> to-do list, not a slide. And the facts sheet turns the thing that normally stalls a
> content project, which is getting a real number out of the client, into a form their team
> fills in."

---

## Screen 3. AUTOPSY

### In one line
Your page and the page that's actually being cited, side by side, on the same nine things.

### What I say

> "So the board tells you who to go after. This tells you why they win, on one axis. Their
> page grows to the right, yours grows to the left, and the widest gap is the work order.
>
> The part I want to explain is how it finds their page. It reads the website's own sitemap,
> which is the list of pages a site publishes for search engines. Every URL in there is a
> page that actually exists.
>
> I did it the other way first. I asked a model to name the URL. And for a medical question
> on the BMJ it gave me three addresses that looked completely real and none of them
> existed. Because a model remembers the shape of a publisher's URLs, not which ones are
> real.
>
> And even then, if it does fall back to the model, there's a check that the page is
> actually about the question. It caught a page about type 1 diabetes being offered for a
> vitamin C question. That page loaded fine, it had seven hundred words. It was just the
> wrong page, and a confidently wrong page is worse than no page."

> **One thing I fixed that I'd mention:** "At one point the headline said 'they win on
> this factor' while the two score cards showed my page higher overall. Both were true and
> the screen never reconciled them. So now it says both, and it says why they can disagree:
> an assistant quotes a passage, not a page, so a better page can still lose the passage."

---

## Screen 4. PIPELINE

### In one line
A topic goes in, three market-ready pages come out, and nothing publishes until a named
person signs off.

### What I say

> "So this is Case 2. Seven steps, and I'll go through the two that matter.
>
> Step one is grounding each market separately, and this is where the whole argument sits.
> In the UK the term is 'vitamin c serum' and it gets forty thousand five hundred searches
> a month. In Sweden the literal translation gets four hundred and eighty. The word Swedes
> actually type is c-vitaminserum, one word, and that gets six thousand six hundred. So
> that's fourteen to one against the translation.
>
> And Danish splits the word where Swedish joins it. So it's three different pages, not one
> page translated three times.
>
> Each market gets its own set of questions, in its own language, with its own angle. The
> Swedish page leads on pigmentation across the year, because there are four hours of
> daylight in Stockholm in December so the sun protection angle doesn't land. The Danish
> page has to deal with EU rules on health claims, which are stricter than the tone British
> pages use, so copying the British text isn't a language problem, it's a compliance
> problem."

### The quality gate

> "The brief asked for quality scoring, plagiarism and AI-detection checks, and a human
> approval step.
>
> The scoring reuses the exact same engine as Case 1, the same nine factors, so a draft
> gets scored before anyone sees it.
>
> On the plagiarism and AI-detection part, I want to be straight about what I refuse to
> claim. There's no honest plagiarism check without a database of everything ever written,
> and no classifier can tell you a piece of text was written by a machine at an error rate
> you'd want to act on. So I don't claim either.
>
> What it does instead is measure two things you can check by hand. It compares every draft
> against the other drafts, eight words at a time, and it quotes the longest passage they
> share. And it counts the phrases that survive an unedited AI draft, and shows you the
> sentence each one is in.
>
> And here's the good part. When I first ran that check, it reported ninety-five percent
> overlap between my three markets. And it was right. My own generator was writing four
> identical English paragraphs and just swapping the keyword. So the tool caught me doing
> exactly what the brief warns about. After I fixed it, it's zero percent."

### Where I refuse to automate

> "The brief says explicitly that they want to know where I refuse to automate, so here it
> is, and all four are in the logic rather than the interface.
>
> Nothing publishes without a named person, per market. If you call the publish endpoint
> directly, you get refused. An approval with no name gets refused too, because an anonymous
> sign-off isn't a sign-off.
>
> If a market has no grounding data, the run stops. It doesn't translate from English.
>
> The hreflang tags, which are what tells Google which language version is which, are
> proposed but never pushed.
>
> And if a draft scores below the bar, or the overlap check flags it, approving it anyway
> needs an explicit override with a written reason, and that reason is stored with your
> name and follows the content into the CMS."

---

# PART 3. Questions I expect, and what I say

**Why Apify and not the APIs directly?**
> "Perplexity and Gemini have APIs, but Google's AI Overview and AI Mode don't. There's one
> Apify actor that exposes five of them, so that's one integration instead of five and one
> bill instead of five. Claude isn't in it, so I call Anthropic directly, and that one runs
> at the same time as the others. If I wanted to swap to direct APIs later it's one file."

**What does it cost?**
> "About two and a half cents per question across all six assistants. Writing the hundred
> and sixty questions is about one cent. A demo run of six questions was sixteen cents."

**What's real and what's mocked?**
> "Real: the six assistants, fetching pages, the scoring, the fixes, the structured data,
> the exports. Mocked: the search volumes per market, which come from a fixture that's
> labelled as a recorded sample on the screen. The brief allowed real data or a realistic
> mock for that."

**What would you do with another week?**
> "Three things. First, put the keyword data behind an interface the way I did with the AI
> models, so plugging in a real provider like DataForSEO is a config change and not a
> rewrite. Second, wire the before-and-after test to the real questions and the real
> competitors from the board, instead of the template queries it uses now. Third, a proper
> entity clarity check, which is basically: does the page say what it's about in the first
> hundred words, and does it call itself the same name all the way through."

**How did you use AI to build it?**
> "Claude Code, in short loops. And the thing I'd point at is that I used adversarial
> sub-agents: I'd have an agent whose only job was to try to break a claim by reading the
> code. That's how I found that my hreflang tags were declaring the British page as
> Ukrainian, that the Swedish pages had English subheadings, and that one screen's headline
> named one website while the section underneath took apart a different one."

**What did you get wrong, or what would you do differently?**
> "The main measurement, I built it once and threw it away. The first version asked an AI
> model which websites it would cite for a question. And it answered, and it gave me one
> site per question, and it looked completely fine on the screen.
>
> Then I actually went and looked at real answers, and two things were wrong. A real answer
> cites several sources, not one. And the sources are different depending on which
> assistant you ask. On a single question I got three domains from Google's AI Overview,
> twenty-seven from AI Mode, twelve from Perplexity. So the idea that one site owns a
> question is just false.
>
> What I'd take from that is that the model was describing what it imagines it does, and I
> had no way to check it. So the rule I ended up with, and it's the rule the whole build
> follows now, is that if I can't verify a number outside the tool, I don't put it on the
> screen."

**What's weak?**
> "Three things and I'll say them before you ask. The board records what an assistant cites
> today, not what it will index tomorrow. The authority factor only reads what's on the
> page, and the screen says so. And the pipeline runs on one grounded topic across three
> markets, the six-market cap is in the code but not in the data."

---

# PART 4. Running order, about twelve minutes

| Time | Screen | The one point |
|---|---|---|
| 0:00 | . | one number: The Ordinary cited on 1 of 6 questions, and nothing reports it |
| 1:30 | BOARD, live run | six real assistants, real citations |
| 4:00 | BOARD, the WHY | named without being cited: the lever isn't your own page |
| 6:00 | AUDIT | the dark space is the score you're missing |
| 8:00 | AUDIT, fixes | the fix it refuses to write without a real number |
| 9:30 | PIPELINE | 480 against 6,600, then the wall |
| 11:30 | . | what I'd do with another week |

**Don't show:** the `/map` route. It's off the navigation, it holds the old broken method.

---

# APPENDIX A. The safe demo set

This is tested. These exact inputs produce these exact outputs, and I've run them.

## BOARD

```
Topic     vitamin C serum
Domain    theordinary.com
Market    United Kingdom
Panel     6 to the engines
```

**What comes out**

| | |
|---|---|
| Cost | $0.1635 |
| Time | about 4 minutes |
| Citations | 343 across 162 domains |
| Engines that answered | 5 of 6, Gemini silent and it says so |
| Per engine | AI Mode 112, Perplexity 92, ChatGPT 75, Claude 53, AI Overview 11, Gemini 0 |
| Cited by every engine that answered | health.harvard.edu, health.clevelandclinic.org, skincare.com |
| The Ordinary | cited on 1 of the 6 questions |
| Target for the teardown | health.clevelandclinic.org, 5 of 29 first positions |

**The line to say:** "Three sites are cited by every assistant that answered. The Ordinary
is on one question out of six. And the site to copy is the one that opens five of the
twenty-nine answers, not the one with the most mentions."

## AUDIT

```
URL   https://www.healthline.com/nutrition/vitamin-c-benefits
```

**What comes out**

| | |
|---|---|
| Score | 43 out of 100, at-risk |
| Biggest hole | Sourced quotes at 0, worth 20 points |
| Facts | 33 in 1,581 words of prose |
| Skipped | 92 blocks of navigation, not counted as article text |
| Crawlers blocked | GPTBot, ClaudeBot, Applebot-Extended, CCBot |

**The line to say:** "This is the site that wins the category, and four of the eight AI
crawlers are blocked in its own robots.txt. I can open that file with them in one click."

## AUTOPSY

```
Your page    https://theordinary.com/en-us/azelaic-acid-suspension-10-exfoliator-100407.html
Competitor   healthline.com
Question     What are the benefits of vitamin C for skin?
```

**What comes out**

| | |
|---|---|
| Their page | healthline.com/nutrition/vitamin-c-benefits, 43 out of 100 |
| Your page | the azelaic acid page, 42 out of 100 |
| Biggest gaps | authority signals 0 against 55, freshness 0 against 20 |
| How it was found | their own sitemap, HTTP 200, 1,794 words |

**The line to say:** "Almost the same overall score, and we still lose. Because the
assistant quotes a passage, not a page."

## PIPELINE

```
Topic     vitamin c serum
Markets   UK, SE, DK
```

**What comes out**

| | |
|---|---|
| Terms | UK vitamin c serum 40,500/mo, SE c-vitaminserum 6,600/mo, DK c-vitamin serum 3,200/mo |
| Scores | 67, 68, 68, all above the 55 floor |
| Overlap between markets | 0 percent |
| Flagged for a human | 2 lines |
| Gate | blocked, publish unreachable |

**Then:** try to publish with no names. It refuses. Approve one market with an empty name.
It refuses. Approve all three with names. It publishes, and the Swedish page has Swedish
headings and an `sv-SE` language tag.

## If they want a page of their own

The tool works on any public URL. If it refuses to be read automatically, there's a paste
HTML button, and that route can't be blocked by anyone.

If they want a different category, the safest second choice is one I've already run:
`marketing attribution software` in US English, which returns 301 citations across 132
domains and gives properly B2B questions like "are there scenarios where this could be a
waste".

---

# APPENDIX B. Numbers I should know without looking

| | |
|---|---|
| Assistants queried | 6 |
| Cost per question, all six | about 2.5 cents |
| Cost of writing 160 questions | about 1 cent |
| Demo run, 6 questions | $0.1635, 4 minutes |
| Tests | 240, typecheck and build clean |
| Sample page, before and after fixes | 33 to 81 |
| Swedish, literal translation against real term | 480 against 6,600 |
| Cross-market overlap, before and after | 95 percent to 0 |
| Structured data weight | 1 percent, from a study of 1,885 pages |
