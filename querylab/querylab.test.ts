import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../engine/parse.js";
import { fanout } from "./fanout.js";
import { detect, toLabDoc } from "./detect.js";
import { runLab } from "./run.js";
import { mockLLM } from "../adapters/llm.js";
import type { LabDoc } from "./types.js";

const load = (name: string) => parse(readFileSync(join(__dirname, "..", "fixtures", "pages", name), "utf8"));

const doc = (id: string, markers: string[] = []): LabDoc => ({ id, title: id, excerpt: "x", markers });

describe("fanout", () => {
  it("is deterministic and topic-anchored", () => {
    const q = fanout("vitamin c serum");
    expect(q).toHaveLength(5);
    expect(q.every((x) => x.text.includes("vitamin c serum"))).toBe(true);
    expect(fanout("vitamin c serum")).toEqual(q);
  });
});

describe("toLabDoc", () => {
  it("extracts distinctive markers (figures, named experts) from the page", () => {
    const d = toLabDoc("good", load("good.html"));
    expect(d.markers).toContain("dr. lena voss");
    expect(d.markers.some((m) => m.includes("%"))).toBe(true);
    expect(d.excerpt.length).toBeLessThanOrEqual(1800);
  });
});

describe("detect", () => {
  const docs = [doc("target", ["29%", "12 weeks", "dr. sofia reyes"]), doc("c1"), doc("c2")];

  it("cited when the target's [n] appears", () => {
    const r = detect("Vitamin C works [1]. Results take 12 weeks [2].", docs, "target");
    expect(r.status).toBe("cited");
    expect(r.citedDocs).toEqual(["target", "c1"]);
  });

  it("paraphrased when uncited but 2+ target markers surface", () => {
    const r = detect("Studies show a 29% improvement after 12 weeks of use [3].", docs, "target");
    expect(r.status).toBe("paraphrased");
    expect(r.matchedMarkers).toEqual(["29%", "12 weeks"]);
  });

  it("absent otherwise", () => {
    expect(detect("Use sunscreen daily [2].", docs, "target").status).toBe("absent");
  });
});

describe("runLab", () => {
  it("rotates doc order so the target is not always source [1]", async () => {
    const seen: string[] = [];
    const stub = {
      label: "stub",
      async answer(_s: string, user: string) {
        seen.push(user.split("\n")[2]); // first source's excerpt line
        return "Answer [1].";
      },
    };
    const run = await runLab(doc("t"), [doc("a"), doc("b")], fanout("x"), stub);
    // [1] is a different doc depending on rotation: target cited only when rotation puts it first
    expect(run.citedCount).toBe(2);
    expect(run.total).toBe(5);
    expect(new Set(seen).size).toBeGreaterThan(1);
  });
});

describe("mockLLM", () => {
  it("refuses to invent an answer for an unrecorded prompt", async () => {
    await expect(mockLLM("./nonexistent.json").answer("s", "u")).rejects.toThrow(/No recorded answer/);
  });
});
