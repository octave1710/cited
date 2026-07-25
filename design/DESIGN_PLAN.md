# CITED — Design plan

Working document. Written before any UI code exists, on purpose.

---

## 1. Why default AI output looks like slop

Four causes, all fixable, none of them "the model is not good enough":

1. **No reference, so the model outputs the median of the web.** Asked for "beautiful", it averages every landing page it has seen. Adjectives ("stunning", "premium") carry no gradient. A decomposed reference does.
2. **Uniformity.** Every section gets the same container, the same heading size, the same card grid. Real design varies the device per section and keeps only the grid and type scale constant.
3. **Bold everything.** Slop reaches for `font-bold` and 700 weights. Both reference sites use a *single* weight decision per role and hold it: COMPUTE runs its entire display scale at **weight 400**.
4. **Decoration instead of information.** Gradient blobs, floating orbs, glassmorphism panels that contain nothing. In both references, the visual richness *is* data: a live network graph, a live UTC clock, live counters.

The corollary that matters for CITED: this is an instrument, not a brochure. Its beauty has to come from making real data feel alive, not from ornament laid on top.

---

## 2. Octave's two references, decomposed

Measured directly in the browser (computed styles, not guesses).

### A. v0-compute-11 — "cinematic instrument"

| Property | Value |
|---|---|
| Background | `#000101` near-black, faint grid overlay |
| Ink | `#ecebe7` warm cream (never pure white) |
| Muted | `#757168` · Border `#101215` · Card `#020204` |
| Accent | comes from the imagery (pink `rgb(236,168,214)`), plus red `#e40014` for destructive |
| Display font | **Instrument Sans, weight 400**, `-0.025em` tracking, line-height 0.92 |
| Mono | **JetBrains Mono** for kickers, labels, captions |
| Radius | `0.25rem` (4px) |
| Grid | `max-w-[1400px]`, `px-6 lg:px-12`, section padding `py-24` → `py-40` |
| Scroll | 12,722px, 11 sections |

Heading scale **varies by section on purpose**: 60px standard, 72px for the CTA, **128px** for the one section that needs to shout. Tracking scales with size (-1.5px @60, -3.2px @128).

Devices, one per section: video hero → canvas + metrics → background tone shift → SVG world map with "operational" labels → full-width live canvas with a live UTC clock → full-bleed breakout for the integration grid → 128px headline with a code panel bleeding off the bottom-right → **one inverted section** (cream background, black text) for rhythm → pricing → CTA.

### B. v0-jarvis-ruby — "technical brutalist ledger"

| Property | Value |
|---|---|
| Background | `#050505` / alternating `#080808` |
| Ink | cream, accent electric blue `#2196F3` |
| Display font | **Barlow Condensed, 700, italic, ALL CAPS** — 192px hero, 96px sections, 160px final CTA, `-0.025em`, line-height 0.88 |
| Body | Barlow · **Labels: IBM Plex Mono**, 11px, `letter-spacing 1.1px` |
| Radius | **0px** everywhere |
| Sections | 11, each separated by a `1px #1e1e1e` hairline rule, alternating between two near-blacks |

Signature moves: a **top status bar** carrying system telemetry (`SYS:JARVIS-05`, `BUILD 2026.04`, `ALL_SYSTEMS_NOMINAL`, a live UTC clock). Mono labels written like machine output with underscores (`DEPLOY_NOW →`). A **live generative canvas** (glowing network graph) occupying the right 60% of the hero. One accent colour used on exactly one word of the headline and the primary button.

### What the two have in common (this is the actual brief)

Near-black canvas · warm cream ink, never pure white · monospace micro-labels in the machine's own voice · sharp or near-sharp corners · giant type at a *single* deliberate weight · one accent, used scarcely · atmosphere generated rather than decorated · and a persistent sense that something is **live**.

Both are, notably, the dark inversion of Octave's own validated V3 system. Instrument Sans and JetBrains Mono appear in both his portfolio and COMPUTE. His taste is already consistent; the job is to execute it darker and more instrumented.

---

## 3. Direction for CITED

**Name of the direction: "Answer Engine Instrument".** CITED is a measuring device pointed at a black box. It should feel like an oscilloscope for citations: dark, precise, legible, alive, and unimpressed with itself.

Rejected on purpose: light SaaS dashboard (invisible), glassmorphism (2021), gradient hero (slop signature), rounded friendly cards (wrong genre for a measurement tool).

### Non-negotiable guardrails

Never: Inter/Roboto/Open Sans · pure `#FFFFFF` background or text · blue-to-purple gradients · floating blobs or orbs · glassmorphism · emoji as UI icons · `font-bold` as the default heading weight · a card grid where every card is the same size · body copy in muted gray (lab-notes rule 10: muted is for genuine metadata only, and section titles are large, never 17px) · decorative elements at fixed pixel size pinned next to variable-width neighbours (lab-notes rule 11).

Always: verify at **1858×1027**, Octave's real resolution, not just a small agent window (lab-notes rule 11) · every visual element carries information · `prefers-reduced-motion` respected on every animation · 4.5:1 contrast on body text.

---

## 4. Section-by-section devices

The rule: **the grid and the type scale stay constant, the device changes every time.** Mapped onto what CITED actually has to show.

**Audit view (Part A)**

1. **Status rail (persistent).** Borrowed from JARVIS. Top hairline bar in mono: engine mode (`LLM_MODE=mock|real`), Profound connection state, build, live UTC clock. It tells the truth about the system at all times, which is also the honesty argument of the whole case.
2. **Ingest.** Not a form. A command line: mono input, blinking caret, the URL resolving live into `fetched · parsed · 12 sections · 446 words`. The tool starts working before you finish reading.
3. **Score reveal.** One giant number (Barlow-Condensed-scale, 160px+) counting up from 0, with the grade underneath as a mono pill. The moment of verdict deserves the largest type on the page.
4. **The eight factors as a ledger.** Hairline-ruled rows, one per factor, in weighted order: name, weight, source, score bar. Each row expands to reveal **the actual extract from the page** that produced the score, with the matched text highlighted. This is the receipt, and it is the credibility of the whole tool.
5. **Fixes.** Before/after as a diff, monospace, red-struck before and cream after, with the impact×effort priority as a mono tag. The `[SOURCED STAT]` slots render as visible empty brackets, so the refusal to invent data is *visible* rather than explained.
6. **Query Lab — the one cinematic section.** Five queries as a scoreboard. The engine's answer streams in character by character with the `[n]` citation markers illuminating as they appear. Then the after-run overlays the before: `2/5 → 5/5`. This is demo moment #1 and it gets the full-bleed treatment, a live canvas, and the only sound-of-victory the app is allowed.
7. **Production Truth (Profound).** Telemetry panel: real bot crawl rows per path (GPTBot, PerplexityBot, ClaudeBot), share of voice by market. Data table styled like machine output, alternating near-blacks, no card chrome.

**Pipeline view (Part B)**

8. **Run view as a vertical ledger.** Seven nodes down a rail, each with a live state. The rail draws itself as the run progresses.
9. **The BLOCKED gate.** The rail stops dead. Hairline turns to the destructive red, the node is labelled `BLOCKED — HUMAN APPROVAL REQUIRED`, and the rest of the pipeline is visibly greyed and unreachable. Refusing to automate is the product's spine, so it gets the most deliberate visual treatment in the app.
10. **Market diff + decision trace.** Three market columns, adaptation flagged rather than translated, each recommendation traceable to its grounding source (the Spend DNA pattern).

---

## 5. Motion system

Motion carries meaning or it does not ship.

- **Page/section entrance**: staggered reveal, blur-to-sharp, 300-500ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Never on more than 3 elements at once.
- **Dashboard interactions**: 150ms, snappy, no easing theatrics.
- **The score counter**: eased count-up, ~900ms, lands slightly before the factor rows stagger in.
- **Factor row expansion**: height + opacity, 200ms, with the evidence text revealing after the row settles.
- **The Query Lab stream**: real streaming if the API is live, replayed at recorded pace in mock mode. The pace is the drama; nothing else needs to move.
- **The rail draw** in the pipeline: SVG path length animation tied to node completion, not to a timer.
- Every one of these wrapped in `prefers-reduced-motion: reduce` fallbacks.

---

## 6. Build sequence

From the transcript, and it is the right method: **do not one-shot.**

1. **Fan out.** Five static HTML variants of the *same* screen (the Audit view with real fixture data), in five distinct aesthetic families: cinematic instrument (COMPUTE-like), brutalist ledger (JARVIS-like), print-tech paper (V3 inverted), dither/mono terminal, editorial data. All five rendered, screenshotted at 1858×1027, and put in front of Octave on one screen.
2. **Pick one, iterate three.** Three variations of the chosen family, varying body layout and density, not colours.
3. **Tweaks bar.** A dev-only floating panel to live-adjust display font, scale, tracking, accent hue, section rhythm, reveal distance, motion weight. Octave turns the knobs himself instead of describing what he wants in words. This is the single highest-leverage thing in the whole plan, because taste transfers through a slider faster than through adjectives.
4. **Assets.** Only once the layout is settled: generate the atmospheric hero visual (Higgsfield MCP is connected in this session) and any texture, at 2K.
5. **Polish pass.** `impeccable` detectors, `web-design-guidelines` for accessibility, then a design review against rendered screenshots at his real resolution.

Rule for every step: no design verdict without pixels seen (lab-notes rule 1), and Octave judges each iteration on a taste question rather than a subagent (lab-notes rules 2 and 4).

---

## 7. Toolchain

Researched 2026-07-25 against primary sources (official docs, GitHub APIs, licences).

### Already installed, nothing to buy

The animation stack Octave's portfolio already runs *is* the 2026 consensus, confirmed across three independently-authored comparisons:

- **GSAP 3.15** for scroll-driven storytelling. Free since Webflow's acquisition, and that now includes ScrollTrigger, SplitText, ScrollSmoother, DrawSVG, MorphSVG, Flip. Licence is the "Standard No Charge GSAP License", commercial use explicitly permitted; the only carve-out is building a no-code animation builder that competes with Webflow. `npm install gsap` is enough, the private registry is gone. Structural advantage over the native CSS spec: **the CSS scroll-driven animations spec deliberately does not support pinning**, and pinning is what makes a scroll story feel authored.
- **Motion 12** (`motion`, MIT, imported from `motion/react`) for React micro-interactions: `AnimatePresence`, layout animations, number tickers, gesture work. 34kb full, or ~4.6kb with `LazyMotion` + `m`.
- **Native CSS** for everything simple. `@starting-style` and `transition-behavior: allow-discrete` are Baseline since August 2024 and safe.
- **Lenis** for smooth scroll, already wired to the GSAP ticker in V3.

Deliberately not used: CSS scroll-driven animations as a primary mechanism (Baseline "Limited availability", absent from stable Firefox, ~84% coverage) and the View Transitions API in Next.js (still flagged experimental and explicitly not recommended for production). Both are `@supports`-guarded enhancements at most.

Skills already on the machine and relevant: `hallmark`, `impeccable` (+ its slop detectors), `frontend-design`, `emil-design-eng`, `apple-design`, `web-animation-design`, the eight `gsap-*` skills, `building-components`, `web-design-guidelines`, `dataviz`.

### Worth connecting (the real gap)

**Chrome DevTools MCP** — the single highest-value addition, and it fixes the actual root cause rather than adding more component sources. It is the only tool in the researched set that closes a genuine render → look → fix loop: `take_screenshot`, `lighthouse_audit`, `evaluate_script` for computed styles, real console/network/performance traces from a live Chrome. Apache-2.0, Google-maintained, no API key, ~46k stars. It makes lab-notes rule 1 structurally enforceable instead of a promise.

```bash
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

**shadcn MCP** — free, MIT, no key. Returns real component source and an audit checklist instead of hallucinated markup. Used for the boring accessible primitives (dialog, table, tabs) only, never for the aesthetic.

```bash
npx shadcn@latest mcp init --client claude
```

**taste-skill** (the one repo from Octave's list not installed) — worth having purely as a *second* generator, so the fan-out step can produce variants from two different design engines and compare.

```bash
npx skills add Leonxlnx/taste-skill -g
```

### Deliberately skipped, with the reason

- **Aceternity UI, Magic UI, React Bits, Kokonut UI, motion-primitives.** These are the 2026 slop generators, not the cure. Independent criticism converges on the same point: their spotlight cards, 3D tilts, animated beams and particle backgrounds now read as a recognizable "AI-startup premium" template across Product Hunt and AI-SaaS landing pages. No verified Awwwards-tier site built on them was found. They are also marketing-hero libraries, and CITED is a data instrument. Aceternity additionally breaks on Tailwind v4 (its PostCSS plugin depends on the v3 JS config). Using them would produce precisely the look Octave is rejecting.
- **21st.dev Magic MCP.** No LICENSE file in the repo, credit-metered generation, and its ceiling is whatever is in its registry, which is the templated look again.
- **Figma MCP.** Best-in-class for conforming to an existing design, but there is no Figma file here, and the official server's real capability is gated behind a paid Dev seat.
- **Playwright MCP.** Redundant with Chrome DevTools MCP for visual verification (it is accessibility-tree-first by design, screenshots are secondary).
- **Tailwind Plus, $299.** Catalyst is genuinely good application UI, but paying does not buy uniqueness, and its look is identifiable.

### Assets (the atmospheric hero visual)

Higgsfield MCP is connected in this session but the account is on the free plan with **3 credits left**, which is not enough to generate anything meaningful. The real capacity is the **OpenArt MCP** (also connected, roughly 10,200 credits) using `nano_banana_pro` or equivalent at 2K. Assets get generated in step 4 of the build sequence, once the layout is settled, never before.

### Type and colour decision

Fonts stay **Space Grotesk (display) + Instrument Sans (UI/body) + JetBrains Mono (all instrument labels)** — V3's exact trio, all already proven on Octave's own site. This is not laziness: COMPUTE runs on Instrument Sans + JetBrains Mono, literally a subset of his own system, which is evidence his taste was already right. One fan-out variant will swap the display face to **Barlow Condensed 700 italic caps** (JARVIS's move) so the difference is visible rather than argued.

Palette, dark inversion of V3:

```
--void      #08090A   page
--void-2    #0E0F11   alternating band
--ink       #ECEBE7   body copy and headlines (warm cream, never #FFF)
--ink-muted #8A8C92   metadata ONLY (dates, units, sources) — never body copy
--line      rgba(236,235,231,0.10)
--accent    lifted cobalt from V3's #3A5BDC, raised for dark-background contrast
--alarm     #E40014   BLOCKED gate, absent citations
```

Contrast gets measured with real numbers during the build, not asserted. Radius 4px, following COMPUTE, with 0px reserved for the brutalist variant.

---

## 8. Verification protocol

Non-negotiable, because this is where past attempts failed:

1. Every screen screenshotted at **1858×1027** (Octave's real resolution) *and* at 1280 and 390 wide.
2. No PASS claimed on anything visual until those screenshots have been looked at.
3. `lighthouse_audit` on the main views once Chrome DevTools MCP is connected.
4. `impeccable detect` for slop patterns, `web-design-guidelines` for accessibility.
5. Octave judges each iteration himself. A subagent verdict on my own work is a contract check, never proof of quality.
