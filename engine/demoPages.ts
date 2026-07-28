/**
 * Bundled pages so the demo runs with no network. Always labelled as demo in the UI.
 *
 * Kept in its own module with no imports: the input bar renders this list in the
 * browser, and ingest.ts reaches for node:net and node:dns to validate hosts, which
 * cannot be bundled for the client. Data and network code do not belong in one file.
 */
export const DEMO_PAGES = [
  {
    id: "medium",
    file: "fixtures/pages/medium.html",
    label: "meridianskinlab.com/guides/vitamin-c-serum",
    note: "ranks, never cited",
  },
  {
    id: "medium-fixed",
    file: "fixtures/pages/medium-fixed.html",
    label: "meridianskinlab.com/guides/vitamin-c-serum (fixed)",
    note: "same page after the fixes",
  },
  {
    id: "good",
    file: "fixtures/pages/good.html",
    label: "meridianskinlab.com/does-vitamin-c-work",
    note: "already citable",
  },
  {
    id: "bad",
    file: "fixtures/pages/bad.html",
    label: "glowmax.com/serum",
    note: "pure marketing copy",
  },
] as const;

export type DemoId = (typeof DEMO_PAGES)[number]["id"];
