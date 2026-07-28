import { describe, expect, it } from "vitest";
import { factualSpecificity } from "./factualSpecificity";
import type { ParsedPage } from "../types";

const page = (paragraphs: string[]): ParsedPage =>
  ({ sections: [{ heading: undefined, paragraphs }] }) as unknown as ParsedPage;

describe("factualSpecificity evidence", () => {
  it("quotes every paragraph that carries a figure, whatever its length or order", () => {
    const r = factualSpecificity(
      page([
        "A 2024 trial of 120 participants found a 32% improvement in skin tone after 12 weeks of daily use.",
        "Use 2 drops.",
        "Apply 3 times a week.",
      ]),
    );
    // the stateful-regex bug dropped "Use 2 drops." because lastIndex carried over
    expect(r.evidence.some((e) => e.includes("Use 2 drops."))).toBe(true);
    expect(r.evidence.filter((e) => e.startsWith('"'))).toHaveLength(3);
  });

  it("counts nothing and quotes nothing on prose with no figures", () => {
    const r = factualSpecificity(page(["Vitamin C may help brighten skin over time."]));
    expect(r.evidence[0]).toMatch(/^0 quantified facts/);
    expect(r.evidence.filter((e) => e.startsWith('"'))).toHaveLength(0);
  });
});
