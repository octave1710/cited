import { describe, expect, it } from "vitest";
import { GateError, publish, runToGate } from "./run";

const base = { id: "t1", topic: "vitamin c serum", markets: ["UK", "SE", "DK"], brand: "Meridian Skin Lab" };

describe("pipeline to the gate", () => {
  const run = runToGate(base);

  it("stops at the gate with publish unreachable", () => {
    expect(run.nodes.ground.state).toBe("done");
    expect(run.nodes.localise.state).toBe("done");
    expect(run.nodes.gate.state).toBe("blocked");
    expect(run.nodes.publish.state).toBe("queued");
  });

  it("grounds each market on its own winning term, not a translation", () => {
    const se = run.plans.find((p) => p.market === "SE")!;
    const uk = run.plans.find((p) => p.market === "UK")!;
    expect(se.term).toBe("c-vitaminserum");
    expect(se.term).not.toBe(uk.term);
    expect(se.groundingNote).toMatch(/translation/i);
  });

  it("hard-stops when grounding is missing rather than guessing", () => {
    const noData = runToGate({ ...base, topic: "retinol serum" });
    expect(noData.nodes.ground.state).toBe("failed");
    expect(noData.nodes.ground.error).toMatch(/hard stop|no grounding/i);

    const noMarket = runToGate({ ...base, markets: ["UK", "JP"] });
    expect(noMarket.nodes.ground.state).toBe("failed");
    expect(noMarket.nodes.ground.error).toMatch(/JP/);
  });

  it("flags non-UK copy for a native reader", () => {
    const se = run.plans.find((p) => p.market === "SE")!;
    expect(se.flags.some((f) => /native/i.test(f.why))).toBe(true);
  });

  it("every recommendation is traceable to its source", () => {
    expect(run.trace.length).toBeGreaterThan(0);
    for (const t of run.trace) expect(t.source).toBeTruthy();
  });
});

describe("the gate refuses in the domain logic, not in the UI", () => {
  it("throws when no market is approved", () => {
    const run = runToGate(base);
    expect(() => publish(run)).toThrow(GateError);
  });

  it("still throws when only some markets are approved", () => {
    const run = runToGate(base);
    run.decisions = [{ market: "UK", approvedBy: "Octave", at: new Date().toISOString() }];
    expect(() => publish(run)).toThrow(/SE, DK not approved/);
  });

  it("publishes only once every market carries a named approval, with local hreflang", () => {
    const run = runToGate(base);
    run.decisions = run.markets.map((m) => ({ market: m, approvedBy: `reviewer ${m}`, at: new Date().toISOString() }));
    const done = publish(run);
    expect(done.nodes.gate.state).toBe("done");
    expect(done.nodes.publish.state).toBe("done");
    expect(done.output).toHaveLength(3);
    // the Swedish URL uses the Swedish term, not the English one
    expect(done.output!.flatMap((o) => o.hreflang).join(" ")).toContain("/se/c-vitaminserum");
    expect(done.output!.every((o) => o.metadata.status.includes("not published"))).toBe(true);
    expect(done.output!.every((o) => o.metadata.approvedBy.length > 0)).toBe(true);
  });
});
