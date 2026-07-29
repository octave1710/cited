/**
 * The two kinds of page this tool can be pointed at.
 *
 * REAL is the normal case: any public URL, fetched live, scored on the same nine
 * factors. Those three are checked working and are what the presentation runs on.
 *
 * BUNDLED exists for one reason only, and it is not "so the demo has something to
 * show". You cannot publish a fix to healthline.com or to nhs.uk, so the loop that
 * matters most (audit, rewrite, apply, score the corrected page) cannot close on a
 * site nobody in the room owns. It closes on a page we hold in the repo. Both are
 * labelled for what they are; nothing here pretends to be a site that exists.
 *
 * Kept in its own module with no imports: the input bar renders this list in the
 * browser, and ingest.ts reaches for node:net and node:dns to validate hosts, which
 * cannot be bundled for the client. Data and network code do not belong in one file.
 */

/**
 * Three pages taken from the recorded panel itself, so the audit continues the board's
 * sentence instead of starting a new one.
 *
 * The old set did not. Its first button was labelled "the site that wins the category"
 * and pointed at a healthline article that is thirteenth on the board, cited on three of
 * the eight questions and never named first; its second pointed at a product page for a
 * different ingredient that the panel never cited at all. Both labels were false against
 * the screen the demo had just shown, which is the worst kind of false.
 *
 * Every claim below is checkable in the table one click away, and the three together are
 * the argument: the two pages the engines treat completely differently score the same,
 * and the page that scores highest is the one blocking half the crawlers.
 */
export const REAL_PAGES = [
  {
    // rank 1 on the recorded panel: 11 citations, in the answer to 6 of the 8 questions
    url: "https://health.clevelandclinic.org/vitamin-c-serum",
    note: "the page cited most on the board",
  },
  {
    // the brand's own page, cited on 2 of the 8, never named first
    url: "https://theordinary.com/en-us/blog/vitamin-c-skincare.html",
    note: "the brand's own page",
  },
  {
    // scores highest of the three and blocks 4 of the 8 AI crawlers in its own robots.txt
    url: "https://www.healthline.com/health/beauty-skin-care/vitamin-c-serums",
    note: "best page, blocks the crawlers",
  },
] as const;

export const DEMO_PAGES = [
  {
    id: "medium",
    file: "fixtures/pages/medium.html",
    label: "sample page held in the repo, before the fixes",
    note: "ranks, never cited",
  },
  {
    id: "medium-fixed",
    file: "fixtures/pages/medium-fixed.html",
    label: "the same sample page after the rewrites are applied",
    note: "same page, fixed",
  },
  {
    id: "good",
    file: "fixtures/pages/good.html",
    label: "sample page held in the repo, already answer-shaped",
    note: "already citable",
  },
  {
    id: "bad",
    file: "fixtures/pages/bad.html",
    label: "sample page held in the repo, marketing copy only",
    note: "pure marketing copy",
  },
] as const;

export type DemoId = (typeof DEMO_PAGES)[number]["id"];
