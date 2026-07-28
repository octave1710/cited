import { describe, expect, it } from "vitest";
import { isKnownMarket, marketOf, MARKETS } from "./markets";

describe("marketOf", () => {
  it("maps a code to the language buyers actually type in", () => {
    expect(marketOf("SE").language).toBe("Swedish");
    expect(marketOf("DE").language).toBe("German");
    expect(marketOf("FR").language).toBe("French");
    expect(marketOf("US").language).toBe("American English");
  });

  it("is case and whitespace tolerant", () => {
    expect(marketOf(" se ").code).toBe("SE");
    expect(marketOf("fr").code).toBe("FR");
  });

  it("falls back rather than throwing on an unknown code", () => {
    expect(marketOf("ZZ").code).toBe("UK");
    expect(marketOf("").code).toBe("UK");
    expect(isKnownMarket("ZZ")).toBe(false);
    expect(isKnownMarket("dk")).toBe(true);
  });

  it("every market declares a language and a locale", () => {
    for (const m of MARKETS) {
      expect(m.language.length, m.code).toBeGreaterThan(2);
      expect(m.locale, m.code).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });
});
