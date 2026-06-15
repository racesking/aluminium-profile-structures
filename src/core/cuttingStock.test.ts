import { describe, it, expect } from 'vitest';
import { solveCuttingStock, extractCutList } from './cuttingStock';
import type { CutPiece, StockBar } from './types';

function pieces(...lengths: number[]): CutPiece[] {
  return lengths.map((length, i) => ({ edgeId: `e${i}`, length, label: `M${i + 1}` }));
}

const stock = (length: number, quantity: number): StockBar => ({
  id: `${length}x${quantity}`,
  length,
  quantity,
});

describe('solveCuttingStock — bar minimization', () => {
  it('packs a table frame onto as few bars as possible', () => {
    // 4×750 + 2×1200 + 2×600 = 6600 mm of cuts → 2 × 6000 bars.
    const cuts = pieces(750, 750, 750, 750, 1200, 1200, 600, 600);
    const result = solveCuttingStock(cuts, [stock(6000, 8)], 3);
    expect(result.unplaced).toHaveLength(0);
    expect(result.bars).toHaveLength(2);
  });

  it('cuts 4×1000 from 2×2000 with zero waste', () => {
    const result = solveCuttingStock(pieces(1000, 1000, 1000, 1000), [stock(2000, 3)], 0);
    expect(result.unplaced).toHaveLength(0);
    expect(result.bars).toHaveLength(2);
    expect(result.totalWaste).toBe(0);
  });
});

describe('solveCuttingStock — offcut preference', () => {
  it('uses a short offcut before opening a full bar', () => {
    // 900 + 450 (+3 kerf) = 1353 mm fits the 1500 offcut; no full bar needed.
    const result = solveCuttingStock(pieces(900, 450), [stock(6000, 2), stock(1500, 1)], 3);
    expect(result.unplaced).toHaveLength(0);
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0].stockLength).toBe(1500);
  });
});

describe('solveCuttingStock — kerf', () => {
  it('charges kerf for every cut after the first', () => {
    // 1000 + 1000 + one kerf (5) = 2005 > 2000 → the second piece will not fit.
    const result = solveCuttingStock(pieces(1000, 1000), [stock(2000, 1)], 5);
    expect(result.unplaced).toHaveLength(1);
    expect(result.shortageMm).toBe(1000);
  });

  it('places both pieces when kerf still leaves room', () => {
    const result = solveCuttingStock(pieces(1000, 990), [stock(2000, 1)], 5);
    expect(result.unplaced).toHaveLength(0);
    expect(result.bars).toHaveLength(1);
  });
});

describe('solveCuttingStock — shortage reporting', () => {
  it('reports a shortage and suggests buying a longer bar', () => {
    const result = solveCuttingStock(pieces(2000), [stock(1000, 1)], 0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.shortageMm).toBe(2000);
    expect(result.suggestedBars).toEqual({ length: 2000, quantity: 1 });
  });

  it('handles having no stock at all', () => {
    const result = solveCuttingStock(pieces(1000), [], 0);
    expect(result.bars).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
    expect(result.shortageMm).toBe(1000);
    expect(result.suggestedBars).toEqual({ length: 1000, quantity: 1 });
  });
});

describe('solveCuttingStock — accounting', () => {
  it('keeps used + waste equal to the consumed stock length', () => {
    const result = solveCuttingStock(pieces(1200, 600, 600), [stock(6000, 1)], 0);
    const consumed = result.bars.reduce((s, b) => s + b.stockLength, 0);
    expect(result.totalUsed + result.totalWaste).toBeCloseTo(consumed, 1);
    expect(result.wastePercent).toBeGreaterThanOrEqual(0);
    expect(result.wastePercent).toBeLessThanOrEqual(100);
  });
});

describe('extractCutList', () => {
  it('maps edges to labelled, rounded cut pieces', () => {
    const edges = [
      { id: 'x', fromId: 'a', toId: 'b' },
      { id: 'y', fromId: 'b', toId: 'c' },
    ];
    const list = extractCutList(edges, () => 1234.56);
    expect(list).toEqual([
      { edgeId: 'x', length: 1234.6, label: 'M1' },
      { edgeId: 'y', length: 1234.6, label: 'M2' },
    ]);
  });
});
