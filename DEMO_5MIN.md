# CITED, the 5-minute video

Fits inside Loom's free limit with about 20 seconds of slack. Three screens: BOARD,
AUTOPSY, PIPELINE. Every number here was measured on the deployed app.

The long version, with the AUDIT screen and the before-and-after proof, is in
[WALKTHROUGH.md](WALKTHROUGH.md).

---

## Before I hit record, 2 minutes

**[TABS]** Open three, in this order, and leave them:

| Tab | URL |
|---|---|
| 1 | `cited-precis.vercel.app/board` |
| 2 | `cited-precis.vercel.app/autopsy` |
| 3 | `cited-precis.vercel.app/pipeline` |

**[CHECK]** On tab 1 the top bar reads **ENGINE LIVE** in green.

**[RECORD]** Browser window only. Not the whole screen.

**[PACE]** Read at a normal pace, do not rush. The spoken text below is 644 words, which is
4 minutes 36 at 140 words a minute, my usual speed. That leaves about 20 seconds of slack
inside Loom's 5. The clicks fit in the gaps, and the pipeline's 40-second run is covered by
the paragraph I read over it.

---

## 0:00 – 0:30 · The opener

**[SCREEN]** Tab 1, `/board`, empty.

> "Hi, quick one, five minutes. Last time this didn't run in front of you and I'm sorry
> about that. It's fixed, so I'll just show you the thing.
>
> I asked six AI assistants eight of the questions someone buying a vitamin C serum
> actually types. Four hundred and thirty-eight citations came back. Cleveland Clinic, a
> hospital site, is in six of those eight answers. The Ordinary, one of the biggest brands
> in the category, is in two, and never first.
>
> Nothing in their reporting would tell them that, because a click that doesn't happen
> leaves no trace."

---

## 0:30 – 2:00 · BOARD

**[CLICK]** **Load the recorded run**. It appears in under a second.

> "That's a run I already paid for, twenty-three cents, loading rather than making you
> watch five minutes of it happen. It says RECORDED PANEL, not MEASURED LIVE, so you know
> which one you're looking at. The Run live button is right there."

**[POINT]** at the headline.

> "The headline is the whole thing in one line. You're in two of the eight. Cleveland Clinic
> is in six."

**[POINT]** at the first row, then the `QUESTIONS ANSWERED IN` column.

> "And it's the top row, with that six in its own column, so you can check the sentence
> against the table without taking my word for it. That's what the rows are sorted by."

**[POINT]** at the green blocks, then the blue squares, then the amber ticks on the right.

> "Then three things kept separate, because they're three different problems. Green: how
> many of the six assistants cite this site at all. Blue: how many times each. Amber on the
> right: how many times it's the source that opens the answer. There are forty of those
> first positions in the run and Cleveland Clinic holds four, more than anyone."

**[POINT]** at the `youtube.com` row, which reads `5.0%` and `NEVER 1ST`.

> "And that's why they're apart. YouTube has the biggest share of citations on the panel
> and is never once named first. Count mentions only and you'd tell the client to go make
> videos, and you'd be wrong."

---

## 2:00 – 3:00 · AUTOPSY

**[CLICK]** **AUTOPSY** in the top navigation. Tab 2.

**[CLICK]** **healthline.com** under `CHECKED WORKING`. Takes about five seconds.

> "The board says who to go after. This says why they win.
>
> Their page seventy-one, ours forty-two. One axis down the middle, theirs grows right,
> ours grows left, rows ordered by the gap. The widest gap is the work order, and you see
> it before you read anything."

**[CLICK]** the top row to expand it.

> "And every row opens to the exact sentences pulled off both pages. Never paraphrased, so
> a writer can act on it."

**[POINT]** at the label above their card.

> "And the card says how it got their page, matched from their sitemap or handed to it by
> me. I'd rather it tell you which than quietly claim it found the cited page."

---

## 3:00 – 4:25 · PIPELINE

**[CLICK]** **PIPELINE** in the top navigation. Tab 3.

**[CLICK]** **Run the pipeline**. It runs for about forty seconds. Keep talking.

> "Second case. A topic goes in, market-ready content comes out. Watch where it stops.
>
> Each market is grounded on its own. In the UK the term is vitamin c serum, forty thousand
> five hundred searches a month. In Sweden the literal translation gets four hundred and
> eighty. What Swedes actually type is c-vitaminserum, one word, six thousand six hundred.
> Fourteen to one against the translation. So that's three different pages, not one page
> translated three times."

**[POINT]** at the hatched orange bar at step 06 when it appears.

> "And there's the wall. Everything past it is a thin line because it's unreachable."

**[SCROLL]** to the Swedish market card. **[POINT]** at the two meters.

> "This is the part I'd push on. Two duplication checks, because one of them can't work.
>
> The first is word overlap. Zero percent, and zero is meaningless, because one draft is
> Swedish and the other Danish. Word overlap between two languages is zero whatever you
> wrote, and the label says so.
>
> The second counts the figures in order, because numbers don't translate. Eighty-two
> percent.
>
> So my own pipeline made two drafts that are the same page in two languages, and my own
> check caught it. That's why a human signs, and signing a flagged market needs a written
> reason that travels with the file."

---

## 4:25 – 4:45 · Close

> "That's the short version. What I'd take from it is that every number carries the count
> it came from, so you can check me, and that the tool refuses. It won't invent a statistic
> and it won't publish without a named person.
>
> The link's in the message, it's live, click anything. Happy to walk the rest whenever
> suits you."

---

## What I am leaving out, and why it matters

The AUDIT screen is not in this cut. It holds the two strongest pieces of evidence:

- **The before and after.** Same page, same five buyer questions, changed and re-tested:
  cited on 0 of 5, then 2 of 5, score 33 to 78. It is the only controlled measurement in
  the whole tool.
- **The robots.txt finding.** The best-scoring of the three real pages is healthline, and
  it blocks four of the eight AI crawlers in its own robots.txt. The tool writes the exact
  patch.

There are 20 seconds of slack already. To buy the other 10, drop the "never paraphrased"
line on the autopsy and the second half of the close. Then:

**[CLICK]** **AUDIT**, then **best page, blocks the crawlers**.

> "One last thing, thirty seconds. This page scores the best of the three, seventy-one. And
> the gate at the top says partly blocked, because healthline blocks four of the eight AI
> crawlers in their own robots.txt. Most marketing teams have no idea, because it's one line
> in a file the dev team owns. The tool writes the exact fix."

---

## If Loom still cuts me off

The free tier is 5 minutes per video. Three ways out, cheapest first.

**1. Windows records this natively, no install, no limit.**
Press `Win` + `Alt` + `R` to start and stop. The MP4 lands in
`C:\Users\octav\Videos\Captures`. Upload it to Google Drive, set the link to "anyone with
the link", and send that. If Game Bar is off, the Snipping Tool also records screen with
no time limit.

**2. Two Loom videos.** Part 1 board and autopsy, part 2 pipeline. Send both links in one
message with a line saying which is which. Slightly worse, works today.

**3. Recordly**, the repo you sent. Open-source screen recorder and editor, and it does
solve the limit: no recording cap, exports MP4, and there is a prebuilt Windows installer
so nothing needs compiling.

```
https://github.com/webadderallorg/recordly/releases
```

Download `Recordly-windows-x64.exe` from v1.3.3, about 208 MB, run it, record the display,
export as MP4. Windows will warn about an unknown publisher because the build is not signed.
Take the stable v1.3.3, not the v1.3.5 beta, which is explicitly unsigned.

I would only reach for this if you want the built-in zoom and cursor smoothing for a
polished cut. For sending a demo tonight, option 1 is two keystrokes.
