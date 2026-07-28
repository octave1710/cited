import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBoard } from "./board";
import { extractAll } from "./extract";
import {
  FACTORS_NOT_RUN_HERE,
  SKINCARE_BRANDS,
  brandNamingTable,
  contentWords,
  leadSlots,
  namesBrand,
  pathCarriesQuestion,
  questionIntent,
  sourceClassOf,
  teardownFromCitations,
} from "./why";

/**
 * Every assertion here is a number counted off the recorded panel, not a shape check.
 * If the fixture changes, these fail, which is the point: the factor findings claim
 * arithmetic about real engine answers and a passing test has to prove that arithmetic.
 */

const questions = extractAll(
  JSON.parse(readFileSync(join(process.cwd(), "fixtures/engines/vitamin-c-serum-uk.json"), "utf8")),
);
const board = buildBoard(questions);
const brandDomains = new Set(SKINCARE_BRANDS.flatMap((b) => b.ownDomains));
const slots = leadSlots(questions, brandDomains);

const row = (d: string) => board.rows.find((r) => r.domain === d);
const numbersIn = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).map(Number);

describe("the fixture the factors are measured on", () => {
  it("is the six-question, five-engine panel with 289 citations", () => {
    expect(questions).toHaveLength(6);
    expect(questions.flatMap((q) => q.answers)).toHaveLength(30);
    expect(board.totalCitations).toBe(289);
    expect(board.rows).toHaveLength(145);
  });

  it("has reddit.com and theguardian.com on all five engines, and nobody else", () => {
    expect(row("reddit.com")!.engineReach).toBe(5);
    expect(row("theguardian.com")!.engineReach).toBe(5);
    expect(board.consensus).toEqual(["reddit.com", "theguardian.com"]);
  });

  it("has youtube.com at the top of the volume and zero lead slots", () => {
    expect(row("youtube.com")!.firstMentions).toBe(0);
    expect(row("youtube.com")!.totalCitations).toBe(20);
    expect(row("youtube.com")!.engineReach).toBe(3);
    const biggest = [...board.rows].sort((a, b) => b.totalCitations - a.totalCitations)[0];
    expect(biggest.domain).toBe("youtube.com");
  });

  it("has a tail that makes reach worth reporting: 110 domains on one engine, 96 cited once", () => {
    expect(board.rows.filter((r) => r.engineReach === 1)).toHaveLength(110);
    expect(board.rows.filter((r) => r.totalCitations === 1)).toHaveLength(96);
  });
});

describe("lead slots", () => {
  it("counts 23, not 30, because 7 answers cited nothing", () => {
    expect(slots).toHaveLength(23);
    expect(questions.flatMap((q) => q.answers).filter((a) => !a.citations.length)).toHaveLength(7);
    expect(board.rows.reduce((n, r) => n + r.firstMentions, 0)).toBe(23);
  });

  it("splits 15 commercial and 8 informational on four commercial questions", () => {
    expect(questions.filter((q) => questionIntent(q.question) === "commercial")).toHaveLength(4);
    expect(slots.filter((s) => s.intent === "commercial")).toHaveLength(15);
    expect(slots.filter((s) => s.intent === "informational")).toHaveLength(8);
    expect(questionIntent("does vitamin C serum actually work")).toBe("informational");
    expect(questionIntent("best affordable vitamin C serum UK")).toBe("commercial");
  });

  it("goes to editorial press 11, forum 6, institutions 3, and never to retail or video", () => {
    const by = (c: string) => slots.filter((s) => s.cls === c).length;
    expect(by("editorial")).toBe(11);
    expect(by("forum")).toBe(6);
    expect(by("institution")).toBe(3);
    expect(by("other")).toBe(3);
    expect(by("retail")).toBe(0);
    expect(by("video")).toBe(0);
  });

  it("flips class between the two intents, which is why the split exists", () => {
    const commercial = slots.filter((s) => s.intent === "commercial");
    const informational = slots.filter((s) => s.intent === "informational");
    expect(commercial.filter((s) => s.cls === "editorial")).toHaveLength(11);
    expect(commercial.filter((s) => s.cls === "forum")).toHaveLength(1);
    expect(informational.filter((s) => s.cls === "forum")).toHaveLength(5);
    expect(informational.filter((s) => s.cls === "editorial")).toHaveLength(0);
  });

  it("gives reddit.com 3 of the 4 lead slots on the efficacy question", () => {
    const efficacy = slots.filter((s) => s.question === "does vitamin C serum actually work");
    expect(efficacy).toHaveLength(4);
    expect(efficacy.filter((s) => s.domain === "reddit.com")).toHaveLength(3);
  });

  it("lands on URLs that name the question, never on a homepage", () => {
    expect(slots.filter((s) => pathCarriesQuestion(s.url, s.question))).toHaveLength(19);
    const homepages = questions
      .flatMap((q) => q.answers)
      .flatMap((a) => a.citations)
      .filter((c) => new URL(c.url).pathname === "/");
    expect(homepages).toHaveLength(0);
  });

  it("classifies the sources it actually saw", () => {
    expect(sourceClassOf("reddit.com", brandDomains)).toBe("forum");
    expect(sourceClassOf("theguardian.com", brandDomains)).toBe("editorial");
    expect(sourceClassOf("healthline.com", brandDomains)).toBe("editorial");
    expect(sourceClassOf("health.harvard.edu", brandDomains)).toBe("institution");
    expect(sourceClassOf("health.clevelandclinic.org", brandDomains)).toBe("institution");
    expect(sourceClassOf("youtube.com", brandDomains)).toBe("video");
    expect(sourceClassOf("boots.com", brandDomains)).toBe("retail");
    expect(sourceClassOf("truskin.com", brandDomains)).toBe("brand");
  });

  it("keeps only the question's own words, so the path test is checkable by hand", () => {
    expect(contentWords("best affordable vitamin C serum UK")).toEqual(["best", "affordable", "vitamin", "serum"]);
    expect(pathCarriesQuestion("https://www.theguardian.com/thefilter/2026/apr/16/best-vitamin-c-serum-tested-uk", "best affordable vitamin C serum UK")).toBe(true);
    expect(pathCarriesQuestion("https://www.theguardian.com/", "best affordable vitamin C serum UK")).toBe(false);
  });
});

describe("brands named in the prose", () => {
  const naming = brandNamingTable(questions);
  const named = (n: string) => naming.find((r) => r.name === n);

  it("counts CeraVe named five times with its own site cited zero times", () => {
    expect(named("CeraVe")).toMatchObject({ answers: 5, engines: 4, answersCitingOwnDomain: 0 });
  });

  it("counts TruSkin named three times with its own site cited every time", () => {
    expect(named("TruSkin")).toMatchObject({ answers: 3, answersCitingOwnDomain: 3 });
  });

  it("keeps naming and citing as two numbers: 9 of the 13 named brands were never cited", () => {
    expect(naming).toHaveLength(13);
    expect(naming.filter((r) => r.answersCitingOwnDomain === 0)).toHaveLength(9);
  });

  it("does not mistake 'a simple routine' for the brand Simple", () => {
    const simple = SKINCARE_BRANDS.find((b) => b.name === "Simple")!;
    expect(namesBrand("Here is a simple routine for you.", simple)).toBe(false);
    expect(namesBrand("A simple guide: 5-10% is best if you are new to it.", simple)).toBe(false);
    expect(namesBrand("Best under £10: Simple 10% Vitamin C+E+F Booster Serum", simple)).toBe(true);
    expect(named("Simple")).toMatchObject({ answers: 4, engines: 4, answersCitingOwnDomain: 1 });
  });

  it("finds brands inside the answers that cited nothing at all", () => {
    const uncited = naming.filter((r) => r.answersWithNoCitations > 0);
    expect(uncited.length).toBeGreaterThan(0);
    expect(named("Superdrug")!.answersWithNoCitations).toBe(2);
  });
});

describe("teardownFromCitations", () => {
  const reddit = teardownFromCitations(board, questions, "reddit.com");
  const youtube = teardownFromCitations(board, questions, "youtube.com");
  const guardian = teardownFromCitations(board, questions, "theguardian.com");

  it("runs the three citation-data factors and nothing else", () => {
    expect(reddit.findings.map((f) => f.key)).toEqual(["engineReach", "leadSlotByIntent", "proseNamingGap"]);
    expect(reddit.findings.every((f) => f.source === "citation-data")).toBe(true);
    expect(FACTORS_NOT_RUN_HERE).toHaveLength(6);
    expect(FACTORS_NOT_RUN_HERE.map((f) => f.key)).not.toContain("engineReach");
  });

  it("puts reddit.com at full reach and the top of the lead slots", () => {
    expect(reddit.headline).toBe("reddit.com: cited by 5 of 5 engines, 6 of 23 lead slots, 14 of 289 citations.");
    const reach = reddit.findings.find((f) => f.key === "engineReach")!;
    expect(reach.strength).toBe(100);
    expect(reach.evidence[0]).toBe(
      "reddit.com is cited by 5 of 5 engines: Google AI Overview 2, Google AI Mode 3, Perplexity 5, ChatGPT search 3, Gemini 1.",
    );
    const lead = reddit.findings.find((f) => f.key === "leadSlotByIntent")!;
    expect(lead.strength).toBe(100);
    expect(lead.verdict).toContain("6 times out of 23");
    expect(lead.verdict).toContain("1 on commercial questions and 5 on informational ones");
  });

  it("says plainly that youtube.com never leads, despite holding the most citations", () => {
    expect(youtube.headline).toBe("youtube.com: cited by 3 of 5 engines, 0 of 23 lead slots, 20 of 289 citations.");
    const lead = youtube.findings.find((f) => f.key === "leadSlotByIntent")!;
    expect(lead.strength).toBe(0);
    expect(lead.verdict).toContain("never takes the first slot");
    expect(youtube.notReplicable.join(" ")).toContain("Volume is not a recommendation slot");
    expect(youtube.findings.find((f) => f.key === "engineReach")!.strength).toBe(60);
  });

  it("scores theguardian.com on reach 5 of 5 and half of reddit's lead slots", () => {
    expect(guardian.findings.find((f) => f.key === "engineReach")!.strength).toBe(100);
    expect(guardian.findings.find((f) => f.key === "leadSlotByIntent")!.strength).toBe(50);
    expect(guardian.replicable.join(" ")).toContain(
      "theguardian.com is cited 8 times from 3 distinct pages, and its most cited page carries 6 of those",
    );
  });

  it("names what a client cannot copy, per source class", () => {
    expect(reddit.notReplicable[0]).toContain("reddit.com is a forum");
    expect(reddit.notReplicable[0]).toContain("participation in threads, not publishing a page");
    expect(guardian.notReplicable[0]).toContain("A brand cannot become the masthead");
    expect(youtube.notReplicable[0]).toContain("is the platform");
  });

  it("declares the six factors it did not run, on every teardown", () => {
    for (const t of [reddit, youtube, guardian]) {
      expect(t.notReplicable.join(" ")).toContain("This teardown answers 3 of the 9 designed factors");
      expect(t.notReplicable.join(" ")).toContain("citationDurability");
    }
  });

  it("reports a domain that is not on the panel as absent rather than inventing a score", () => {
    const absent = teardownFromCitations(board, questions, "example-brand.co.uk");
    expect(absent.headline).toBe(
      "example-brand.co.uk: not cited once in this panel of 289 citations across 6 questions.",
    );
    expect(absent.findings.every((f) => f.strength === 0)).toBe(true);
    expect(absent.findings.find((f) => f.key === "leadSlotByIntent")!.verdict).toContain("0 of the 23 lead slots");
  });

  it("uses no number in evidence that is larger than the panel it came from", () => {
    // A crude but real guard against invented figures: 289 citations, 30 answers, 145 domains
    // and 23 lead slots bound everything the factors can honestly count.
    for (const t of [reddit, youtube, guardian]) {
      for (const f of t.findings) {
        for (const line of f.evidence) {
          for (const n of numbersIn(line)) {
            expect(n).toBeLessThanOrEqual(board.totalCitations);
          }
        }
      }
    }
  });

  it("keeps every count in the reach evidence consistent with the board", () => {
    const r = row("reddit.com")!;
    const reach = reddit.findings.find((f) => f.key === "engineReach")!;
    const joined = reach.evidence.join(" ");
    expect(joined).toContain(`${r.questions} of the ${board.questionCount} questions`);
    expect(joined).toContain(`${r.totalCitations} citations in total`);
    expect(joined).toContain(`${board.consensus.length} of ${board.rows.length} domains are cited by all 5 engines`);
  });
});
