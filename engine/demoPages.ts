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

export const REAL_PAGES = [
  {
    url: "https://www.healthline.com/nutrition/vitamin-c-benefits",
    note: "the site that wins the category",
  },
  {
    url: "https://theordinary.com/en-us/azelaic-acid-suspension-10-exfoliator-100407.html",
    note: "a brand product page",
  },
  {
    url: "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-c/",
    note: "an institutional page",
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
