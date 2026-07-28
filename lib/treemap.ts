/**
 * Squarified treemap (Bruls, Huizing, van Wijk 2000).
 *
 * Area carries the quantity, so a domain holding 118 of 158 questions is 75% of the
 * picture and no legend is needed to feel it. Squarified rather than slice-and-dice
 * because long thin slivers cannot hold a logo, and the logo is what makes a rival
 * recognisable at a glance.
 *
 * Pure geometry, no DOM, so it is testable and runs identically on server or client.
 */

export interface TreemapInput {
  id: string;
  value: number;
}

export interface TreemapTile<T extends TreemapInput = TreemapInput> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

const worstRatio = (row: number[], side: number, scale: number): number => {
  const sum = row.reduce((a, b) => a + b, 0) * scale;
  if (sum === 0 || side === 0) return Infinity;
  const max = Math.max(...row) * scale;
  const min = Math.min(...row) * scale;
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
};

/**
 * @param items values in any order; they are sorted descending internally
 * @param width  container width in px
 * @param height container height in px
 */
export function squarify<T extends TreemapInput>(items: T[], width: number, height: number): TreemapTile<T>[] {
  const positive = items.filter((i) => i.value > 0);
  if (!positive.length || width <= 0 || height <= 0) return [];

  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, b) => a + b.value, 0);
  const scale = (width * height) / total;

  const tiles: TreemapTile<T>[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;

  let i = 0;
  while (i < sorted.length) {
    const side = Math.min(w, h);
    const row: T[] = [sorted[i]];
    let next = i + 1;

    // grow the row while the worst aspect ratio keeps improving
    while (next < sorted.length) {
      const current = worstRatio(row.map((r) => r.value), side, scale);
      const grown = worstRatio([...row.map((r) => r.value), sorted[next].value], side, scale);
      if (grown > current) break;
      row.push(sorted[next]);
      next++;
    }

    const rowValue = row.reduce((a, b) => a + b.value, 0);
    const rowThickness = (rowValue * scale) / side;

    let offset = 0;
    for (const item of row) {
      const length = (item.value * scale) / rowThickness;
      if (w >= h) {
        tiles.push({ item, x, y: y + offset, w: rowThickness, h: length });
      } else {
        tiles.push({ item, x: x + offset, y, w: length, h: rowThickness });
      }
      offset += length;
    }

    if (w >= h) {
      x += rowThickness;
      w -= rowThickness;
    } else {
      y += rowThickness;
      h -= rowThickness;
    }
    i = next;
  }

  return tiles;
}
