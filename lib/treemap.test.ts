import { describe, expect, it } from "vitest";
import { squarify } from "./treemap";

const items = [
  { id: "a", value: 118 },
  { id: "b", value: 13 },
  { id: "c", value: 5 },
  { id: "d", value: 2 },
  { id: "e", value: 2 },
];

describe("squarify", () => {
  it("fills the container exactly, with no gap and no overflow", () => {
    const tiles = squarify(items, 900, 500);
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(area).toBeCloseTo(900 * 500, 4);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(-0.001);
      expect(t.y).toBeGreaterThanOrEqual(-0.001);
      expect(t.x + t.w).toBeLessThanOrEqual(900.001);
      expect(t.y + t.h).toBeLessThanOrEqual(500.001);
    }
  });

  it("gives each tile an area proportional to its value", () => {
    const tiles = squarify(items, 900, 500);
    const byId = new Map(tiles.map((t) => [t.item.id, t.w * t.h]));
    const total = items.reduce((s, i) => s + i.value, 0);
    for (const i of items) {
      expect(byId.get(i.id)! / (900 * 500)).toBeCloseTo(i.value / total, 5);
    }
  });

  it("keeps tiles closer to square than slice-and-dice would", () => {
    // the dominant tile must be usable as a surface, not a 900x66 sliver
    const tiles = squarify(items, 900, 500);
    const biggest = tiles.find((t) => t.item.id === "a")!;
    const ratio = Math.max(biggest.w / biggest.h, biggest.h / biggest.w);
    expect(ratio).toBeLessThan(3);
  });

  it("survives empty, zero and single inputs", () => {
    expect(squarify([], 100, 100)).toEqual([]);
    expect(squarify([{ id: "z", value: 0 }], 100, 100)).toEqual([]);
    expect(squarify(items, 0, 100)).toEqual([]);
    const one = squarify([{ id: "only", value: 7 }], 200, 100);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ x: 0, y: 0, w: 200, h: 100 });
  });

  it("orders descending regardless of input order", () => {
    const shuffled = squarify([...items].reverse(), 900, 500);
    expect(shuffled[0].item.id).toBe("a");
  });
});
