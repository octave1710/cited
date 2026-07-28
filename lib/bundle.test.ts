import { describe, expect, it } from "vitest";
import { buildBundle } from "./bundle";
import { crc32, csv, zip } from "./zip";
import type { CitationMap } from "../citationmap/types";

describe("csv", () => {
  it("quotes commas, quotes and newlines so a question never breaks a row", () => {
    expect(csv([["a,b", 'say "hi"', "one\ntwo", 3]])).toBe('"a,b","say ""hi""","one\ntwo",3');
  });
});

describe("zip", () => {
  it("writes a readable archive: signatures, entry count and a matching CRC", () => {
    const buf = zip([{ name: "a.txt", content: "hello" }, { name: "b.txt", content: "world" }]);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50); // first local header

    const end = buf.length - 22;
    expect(buf.readUInt32LE(end)).toBe(0x06054b50); // end of central directory
    expect(buf.readUInt16LE(end + 10)).toBe(2); // two entries

    // the CRC in the first local header must be the CRC of "hello"
    expect(buf.readUInt32LE(14)).toBe(crc32(new TextEncoder().encode("hello")));
    // central directory offset points at a central header
    expect(buf.readUInt32LE(buf.readUInt32LE(end + 16))).toBe(0x02014b50);
  });

  it("is empty-safe", () => {
    const buf = zip([]);
    expect(buf.readUInt32LE(0)).toBe(0x06054b50);
    expect(buf.readUInt16LE(10)).toBe(0);
  });
});

const map = (over: Partial<CitationMap> = {}): CitationMap => ({
  id: "m1",
  topic: "vitamin c serum",
  brand: "Us",
  brandDomain: "us.com",
  market: "UK",
  engine: "openai:gpt-4o-mini",
  createdAt: "2026-07-28T00:00:00.000Z",
  questions: [
    { id: "q1", text: "does it work, really?", intent: "evidence", domains: ["big.com"], bucket: "lost", owner: "big.com", brandRank: 0, replayed: true, ms: 1 },
    { id: "q2", text: "how do I store it?", intent: "usage", domains: [], bucket: "open", owner: null, brandRank: 0, replayed: true, ms: 1 },
  ],
  domains: [{ domain: "big.com", wins: 1, appearances: 1, isBrand: false }],
  counts: { owned: 0, lost: 1, contested: 0, reference: 0, open: 1 },
  cost: { calls: 2, replayed: 0, inTokens: 10, outTokens: 5, usd: 0.0001, rate: "test" },
  ...over,
});

describe("buildBundle", () => {
  it("ships only what a run actually produced", () => {
    const { entries } = buildBundle({ map: map() });
    expect(entries.map((e) => e.name)).toEqual(["README.txt", "citation-map.csv", "unclaimed-questions.csv", "seats.csv"]);
    // no corrected.html, no schema, no robots patch: none of those were generated
  });

  it("puts the unclaimed questions in their own file", () => {
    const { entries } = buildBundle({ map: map() });
    const open = entries.find((e) => e.name === "unclaimed-questions.csv")!;
    expect(open.content).toContain("how do I store it?");
    expect(open.content).not.toContain("does it work");
  });

  it("states the limit in the readme rather than only in the interview", () => {
    const { entries } = buildBundle({ map: map() });
    expect(entries[0].content).toMatch(/controlled comparison/);
    expect(entries[0].content).toMatch(/refuses to invent/);
  });

  it("produces an archive that carries every entry", () => {
    const { entries, buffer } = buildBundle({ map: map() });
    expect(buffer.readUInt16LE(buffer.length - 22 + 10)).toBe(entries.length);
  });
});
