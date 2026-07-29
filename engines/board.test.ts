import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBoard, primaryTarget } from "./board";
import type { PanelRun } from "./types";

/**
 * One screen, one order.
 *
 * The board used to run three metrics at once: the table sorted on engine reach, the
 * headline counted the questions a domain appears in, and the deep dive picked whoever
 * held the most lead slots. So the sentence at the top named a domain sitting in row
 * four, while row one showed a lower number in every column a viewer could see. Nothing
 * on the screen was wrong on its own and the screen as a whole was indefensible.
 *
 * These tests fix the agreement rather than the numbers, so they survive a new fixture.
 */

const panel = (
  JSON.parse(readFileSync(join(process.cwd(), "fixtures/engines/demo-panel.json"), "utf8")) as { run: PanelRun }
).run;

describe("the board agrees with itself", () => {
  const board = buildBoard(panel.questions, panel.brandDomain);

  it("ranks on question coverage, which is the number the headline quotes", () => {
    for (let i = 1; i < board.rows.length; i++) {
      expect(board.rows[i - 1].questions).toBeGreaterThanOrEqual(board.rows[i].questions);
    }
  });

  it("puts the deep-dive target at the top of the table", () => {
    const target = primaryTarget(board);
    expect(target).toBeDefined();
    expect(target!.domain).toBe(board.rows.find((r) => !r.isBrand)!.domain);
  });

  it("never ranks a row above one that beats it on every visible column", () => {
    const inversions: string[] = [];
    const shown = board.rows.slice(0, 14);
    for (let i = 0; i < shown.length; i++) {
      for (let j = i + 1; j < shown.length; j++) {
        const a = shown[i];
        const b = shown[j];
        if (
          a.questions < b.questions &&
          a.engineReach < b.engineReach &&
          a.totalCitations < b.totalCitations &&
          a.firstMentions < b.firstMentions
        ) {
          inversions.push(`${a.domain} is ranked above ${b.domain} while losing on all four columns`);
        }
      }
    }
    expect(inversions).toEqual([]);
  });

  it("counts the brand's questions the way the headline states them", () => {
    const brand = board.rows.find((r) => r.isBrand);
    expect(brand).toBeDefined();
    // the headline reads "cited on N of M questions", so both halves come from here
    expect(brand!.questions).toBe(
      panel.questions.filter((q) =>
        q.answers.some((a) => a.citations.some((c) => c.domain === panel.brandDomain)),
      ).length,
    );
    expect(board.questionCount).toBe(panel.questions.length);
    expect(board.brandAbsentFrom.length).toBe(board.questionCount - brand!.questions);
  });

  it("keeps share of citations and lead slots as two separate measures", () => {
    // one column carries both, and the header has to name both: a domain with zero lead
    // slots still shows a share, and reading that share as a share of firsts is the bug
    const neverFirst = board.rows.filter((r) => r.firstMentions === 0 && r.share > 0);
    expect(neverFirst.length).toBeGreaterThan(0);
    const sum = board.rows.reduce((a, r) => a + r.share, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });
});
