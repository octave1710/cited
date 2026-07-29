import { describe, expect, it } from "vitest";
import { citationsFromClaude, textFromClaude } from "./claude";
import { ENGINES } from "./types";

/**
 * The shape below is a real Anthropic response, trimmed. Sources arrive twice, once in
 * the web_search_tool_result block and again inside the citations attached to the text,
 * which is why the extractor deduplicates on the cleaned URL.
 */
const RESPONSE = {
  model: "claude-sonnet-4-5-20250929",
  content: [
    { type: "text", text: "Here are the options." },
    {
      type: "web_search_tool_result",
      content: [
        { type: "web_search_result", url: "https://www.forbes.com/a/best-vitamin-c-serum/?utm_source=anthropic", title: "Best vitamin C serums" },
        { type: "web_search_result", url: "https://truskin.com/blogs/general/best", title: "TruSkin" },
        { type: "web_search_result", url: "not-a-url", title: "junk" },
      ],
    },
    {
      type: "text",
      text: "Forbes rates it highly.",
      citations: [
        // the same Forbes page again, with the tracking parameter still attached
        { type: "web_search_result_location", url: "https://www.forbes.com/a/best-vitamin-c-serum/", title: "Best vitamin C serums" },
      ],
    },
  ],
};

describe("Claude as the sixth engine", () => {
  it("is registered so the board, the CSVs and the UI all carry a column for it", () => {
    expect(ENGINES.map((e) => e.key)).toContain("claude");
  });

  it("reads every source once, stripping the attribution parameter", () => {
    const cites = citationsFromClaude(RESPONSE);
    expect(cites.map((c) => c.domain)).toEqual(["forbes.com", "truskin.com"]);
    // the utm parameter is gone, so the two Forbes references collapse into one page
    expect(cites[0].url).toBe("https://www.forbes.com/a/best-vitamin-c-serum/");
    expect(cites).toHaveLength(2);
  });

  it("ranks sources in the order the answer used them", () => {
    const cites = citationsFromClaude(RESPONSE);
    expect(cites.map((c) => c.rank)).toEqual([1, 2]);
  });

  it("refuses anything that is not a resolvable hostname", () => {
    expect(citationsFromClaude({ content: [{ url: "not-a-url" }, { url: "javascript:alert(1)" }] })).toEqual([]);
  });

  it("returns nothing rather than throwing on an error payload", () => {
    expect(citationsFromClaude({ type: "error", error: { message: "overloaded" } })).toEqual([]);
    expect(citationsFromClaude(null)).toEqual([]);
    expect(textFromClaude(null)).toBe("");
  });

  it("joins only the text blocks, never the tool results", () => {
    expect(textFromClaude(RESPONSE)).toBe("Here are the options.\nForbes rates it highly.");
  });
});
