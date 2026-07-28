import { describe, expect, it } from "vitest";
import { onTopic } from "./run";

/**
 * The guard that exists because a resolvable URL is not a relevant one. Asked for
 * mayoclinic.org on "Is vitamin C good for skin?" the model produced a type 1 diabetes
 * expert-answers page. It returned HTTP 200 and 736 words, so every earlier check
 * passed, and it would have been shown as "the page beating you".
 */
describe("onTopic", () => {
  it("refuses a real page on a different subject", () => {
    expect(
      onTopic(
        "Is vitamin C good for skin?",
        "https://www.mayoclinic.org/diseases-conditions/type-1-diabetes/expert-answers/faq-20057832",
        "Type 1 diabetes: Can I have a low-carb diet?",
      ),
    ).toBe(false);
  });

  it("accepts a page whose address carries the subject", () => {
    expect(
      onTopic("Is vitamin C good for skin?", "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-c/", "Vitamin C - NHS"),
    ).toBe(true);
  });

  it("accepts a page whose title carries the subject even when the address does not", () => {
    expect(
      onTopic("How does semaglutide work?", "https://www.bmj.com/content/377/bmj-2021-069066", "Semaglutide for weight loss"),
    ).toBe(true);
  });

  it("does not test a question with nothing discriminating in it", () => {
    // no specific term to match on, so the guard must not reject everything
    expect(onTopic("How does it work?", "https://example.com/anything", "Anything")).toBe(true);
  });

  it("reads the address and the title only, never the body", () => {
    // a page that merely mentions the word somewhere is not a page about it, and the
    // signature gives onTopic no way to see the body at all
    expect(onTopic("vitamin C serum", "https://brand.com/blog/retinol-guide", "Retinol, a complete guide")).toBe(false);
  });
});
