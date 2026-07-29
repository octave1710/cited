# The art direction, as it exists in code

Not a mood board. This is what `components/EngineBoard.tsx` and `components/Panel.tsx`
actually do, written down so the other four screens can be held to it. Every rule below
is checkable against a rendered pixel.

---

## 1. The shape of a screen, always in this order

1. **A meta line** in mono, 10px, uppercase, `--meta`. What was measured, where, how much it cost.
2. **A verdict headline** in the display serif, one sentence a person can repeat out loud.
   `clamp(30px, 2.6vw, 46px)` for a section, the `.h1` scale for a screen. Weight 400. Never bold.
3. **One dominant device** that encodes the numbers as shape. Not a table. Not a list of rows with
   digits in them. The reader must be able to rank the rows before reading a single numeral.
4. **The evidence ledger** underneath: the exact strings, pages or lines the device was built from.

Anything that cannot be put through those four steps does not belong on the screen.

## 2. One device per screen, never the same twice

| Screen | Device | What the shape encodes |
|---|---|---|
| Board | matrix: spine + area cells + notches | engine reach, citation volume, first position |
| Audit | weight ladder | band width is the factor's weight, fill is the score earned |
| Autopsy | facing bands | one axis, their page grows right, ours grows left |
| Map | angle columns | the question space by buying angle, lit where measured |
| Pipeline | track and wall | how far the run got, and the gate it cannot pass |

A device is legitimate only if the answer to this is yes: does the mark carry a number the
user could verify somewhere else?

## 3. Encoding rules that came from real defects

- **Separate facts get separate marks.** On the board, reach, volume and first-position are
  three encodings, because `youtube.com` had the largest volume and zero first positions and
  a single total hid it.
- **Area, not length, for counts.** Scale on `Math.sqrt(n / max)`. A linear side makes a 9 read
  as nine times a 1 when the eye is reading the square.
- **A zero is a mark, not an absence.** `NEVER 1ST` in words, a hairline where a cell would be.
  An empty cell reads as missing data.
- **A silent source says so, in `--d1`.** Gemini returning nothing is a finding.

## 4. Type

| Role | Family | Size | Weight |
|---|---|---|---|
| Screen headline | `--display` | `.h1` clamp | 400 |
| Section headline | `--display` | `clamp(30px,2.6vw,46px)` | 400 |
| Entity name (domain, page, factor) | `--display` | 21px | 400 |
| Body and verdicts | `--body` | 16.5px | 400, 600 for a label |
| Lede | `.lede` | as set | 400 |
| Every numeral | `--mono` | 12 to 15px | 600, `tabular-nums` |
| Column and section labels | `--mono` | 10 to 11px, `letter-spacing: 1.1px`, uppercase | — |

Floors: body never under 16px, labels never under 10px and only for metadata, headline never
under 30px. No content text in `--meta`; `--meta` is for dates, units, counts and sources.

## 5. Surface

One family, varied by elevation, never by inversion.
`--void` page, `--s1` a raised panel, `--s2` a track or empty slot, `--s3` a disabled mark.
A panel is `background: var(--s1)` with `borderTop: 2px solid <accent>`. Not a bordered card,
not a rounded card, no shadow, no glass. Radius is 0 everywhere.

Accents: `--d3` blue is a measured value, `--d2` green is reach or a pass, `--d1` amber is a
warning or a first-position mark, `--brand` orange is you, or a refusal.

## 6. Motion, and it must carry information

GSAP on arrival, always inside a `gsap.context` scoped to a ref, always reverted on unmount.

- a bar or segment enters with `scaleX: 0` from its own origin, `expo.out`, 0.5 to 0.8s
- a cell enters with `scale: 0`, `back.out(1.6)`, 0.55s
- rows stagger 0.008 to 0.08s depending on count
- a counter counts up with `animate(0, n, …)` from `motion`, never a static number
- `prefers-reduced-motion: reduce` returns before any tween is created, on every component

## 7. Spacing

`--gutter` 40px horizontal. A section starts at 84 to 96px of top padding. A row is 10 to 18px
of vertical padding with a 1px `--line` rule between.

**One dominant device per screen, and no second object competing with it.** The earlier wording
here said "two visual objects per screen maximum", which was carried over from a rule written for
text-heavy marketing pages and is wrong for an instrument: a screen here is a device, the evidence
under it, and the action attached to the number, which is three things by definition. What the rule
is actually protecting against is a second object of the same weight as the device. Sections below
the device are subordinate: smaller, quieter, and never a second chart.

Forty words of running text above the device. Below it, the evidence ledger is as long as the
evidence is; truncating a receipt to hit a word count would be the wrong trade.

## 8. The check before showing anything

- [ ] headline is display serif, weight 400, over 30px
- [ ] the dominant device is not a table and encodes at least two facts as shape
- [ ] every numeral is mono and tabular
- [ ] no content text in `--meta`
- [ ] zero states are marks with words, not blanks
- [ ] GSAP entry present and reduced-motion respected
- [ ] captured at 1280 and looked at, no horizontal overflow
