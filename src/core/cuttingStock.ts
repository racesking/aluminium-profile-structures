import type { CutPiece, CuttingResult, StockBar, BarAssignment } from './types';
import { roundLength } from './geometry';

function expandStock(stock: StockBar[]): number[] {
  const bars: number[] = [];
  for (const s of stock) {
    for (let i = 0; i < s.quantity; i++) {
      bars.push(s.length);
    }
  }
  return bars;
}

type Bin = { stockLength: number; remaining: number; cuts: BarAssignment['cuts'] };

type PackOutcome = { bins: Bin[]; unplaced: CutPiece[] };

/**
 * Place pieces (in the given order) into bins.
 * - 'best': tightest remaining space that fits (consolidates onto fewer bars)
 * - 'worst': most remaining space first (spreads cuts; rarely optimal but kept as a candidate)
 * With openOnDemand, untouched bars are only started when no started bar fits,
 * preferring the shortest untouched bar that fits (uses offcuts before full bars).
 */
function pack(
  pieces: CutPiece[],
  stockLengths: number[],
  kerf: number,
  strategy: 'best' | 'worst',
  openOnDemand: boolean,
): PackOutcome {
  const bins: Bin[] = stockLengths.map((len) => ({
    stockLength: len,
    remaining: len,
    cuts: [],
  }));

  const unplaced: CutPiece[] = [];

  const fits = (bin: Bin, piece: CutPiece) => {
    // First cut in a bar costs no kerf; each further cut costs one kerf.
    const kerfCost = bin.cuts.length > 0 && kerf > 0 ? kerf : 0;
    return bin.remaining >= piece.length + kerfCost;
  };

  const place = (bin: Bin, piece: CutPiece) => {
    const kerfCost = bin.cuts.length > 0 && kerf > 0 ? kerf : 0;
    bin.cuts.push({ length: piece.length, edgeId: piece.edgeId, label: piece.label });
    bin.remaining -= piece.length + kerfCost;
  };

  for (const piece of pieces) {
    let candidates = bins.filter((b) => fits(b, piece));
    if (openOnDemand) {
      const open = candidates.filter((b) => b.cuts.length > 0);
      if (open.length > 0) {
        candidates = open;
      } else {
        // Start the shortest untouched bar that fits.
        candidates.sort((a, b) => a.stockLength - b.stockLength);
        candidates = candidates.slice(0, 1);
      }
    }
    if (candidates.length === 0) {
      unplaced.push(piece);
      continue;
    }
    candidates.sort((a, b) =>
      strategy === 'best' ? a.remaining - b.remaining : b.remaining - a.remaining,
    );
    place(candidates[0], piece);
  }

  return { bins, unplaced };
}

/** Try several packing strategies and keep the best outcome. */
function improvePacking(
  pieces: CutPiece[],
  stockLengths: number[],
  kerf: number,
): PackOutcome {
  const desc = [...pieces].sort((a, b) => b.length - a.length);
  const asc = [...pieces].sort((a, b) => a.length - b.length);

  const attempts: PackOutcome[] = [
    pack(desc, stockLengths, kerf, 'best', true),
    pack(desc, stockLengths, kerf, 'best', false),
    pack(desc, stockLengths, kerf, 'worst', false),
    pack(asc, stockLengths, kerf, 'best', true),
  ];

  const score = (o: PackOutcome) => {
    const unplacedLen = o.unplaced.reduce((s, p) => s + p.length, 0);
    const barsUsed = o.bins.filter((b) => b.cuts.length > 0).length;
    return { unplacedLen, waste: totalWaste(o.bins), barsUsed };
  };

  let best = attempts[0];
  let bestScore = score(best);
  for (const attempt of attempts.slice(1)) {
    const s = score(attempt);
    const better =
      s.unplacedLen < bestScore.unplacedLen ||
      (s.unplacedLen === bestScore.unplacedLen &&
        (s.waste < bestScore.waste ||
          (s.waste === bestScore.waste && s.barsUsed < bestScore.barsUsed)));
    if (better) {
      best = attempt;
      bestScore = s;
    }
  }

  return best;
}

function totalWaste(bins: Bin[]): number {
  return bins.reduce((sum, b) => {
    if (b.cuts.length === 0) return sum;
    return sum + b.remaining;
  }, 0);
}

export function extractCutList(
  edges: { id: string; fromId: string; toId: string }[],
  getLength: (fromId: string, toId: string) => number,
): CutPiece[] {
  return edges.map((e, i) => ({
    edgeId: e.id,
    length: roundLength(getLength(e.fromId, e.toId)),
    label: `M${i + 1}`,
  }));
}

export function solveCuttingStock(
  pieces: CutPiece[],
  stock: StockBar[],
  kerf: number,
): CuttingResult {
  const stockLengths = expandStock(stock);
  const totalStock = stockLengths.reduce((a, b) => a + b, 0);
  const totalNeed = pieces.reduce((a, p) => a + p.length, 0);

  if (stockLengths.length === 0) {
    return {
      bars: [],
      unplaced: pieces,
      totalWaste: 0,
      totalUsed: 0,
      wastePercent: 0,
      shortageMm: totalNeed,
      suggestedBars: pieces.length
        ? { length: Math.max(...pieces.map((p) => p.length)), quantity: 1 }
        : null,
    };
  }

  const { bins } = improvePacking(pieces, stockLengths, kerf);
  const unplaced = pieces.filter(
    (p) => !bins.some((b) => b.cuts.some((c) => c.edgeId === p.edgeId)),
  );

  const bars: BarAssignment[] = bins
    .map((bin, barIndex) => {
      const used = bin.stockLength - bin.remaining;
      return {
        barIndex: barIndex + 1,
        stockLength: bin.stockLength,
        cuts: bin.cuts,
        used: roundLength(used),
        waste: roundLength(bin.remaining),
      };
    })
    .filter((b) => b.cuts.length > 0);

  const usedBins = bins.filter((b) => b.cuts.length > 0);
  const totalWaste = usedBins.reduce((s, b) => s + b.remaining, 0);
  const totalUsed = usedBins.reduce((s, b) => s + (b.stockLength - b.remaining), 0);
  const shortageMm = unplaced.reduce((s, p) => s + p.length, 0);

  let suggestedBars: CuttingResult['suggestedBars'] = null;
  if (unplaced.length > 0) {
    const maxCut = Math.max(...unplaced.map((p) => p.length));
    const commonStock = stock.length > 0 ? Math.max(...stock.map((s) => s.length)) : maxCut;
    const barLen = Math.max(commonStock, maxCut);
    const need = unplaced.reduce((s, p) => s + p.length + kerf, 0);
    suggestedBars = {
      length: barLen,
      quantity: Math.ceil(need / barLen),
    };
  }

  const wastePercent =
    totalStock > 0 ? roundLength((totalWaste / totalStock) * 100) : 0;

  return {
    bars,
    unplaced,
    totalWaste: roundLength(totalWaste),
    totalUsed: roundLength(totalUsed),
    wastePercent,
    shortageMm: roundLength(shortageMm),
    suggestedBars,
  };
}

export function formatCutList(result: CuttingResult): string {
  const lines: string[] = ['CUT LIST — Aluminium Profile Builder', ''];
  for (const bar of result.bars) {
    const cuts = bar.cuts.map((c) => `${c.length} mm (${c.label ?? c.edgeId.slice(0, 6)})`).join(' + ');
    lines.push(
      `Bar ${bar.barIndex} (${bar.stockLength} mm): ${cuts} | waste ${bar.waste} mm`,
    );
  }
  lines.push('');
  lines.push(`Total used: ${result.totalUsed} mm`);
  lines.push(`Total waste: ${result.totalWaste} mm (${result.wastePercent}%)`);
  if (result.unplaced.length > 0) {
    lines.push(`SHORTAGE: ${result.shortageMm} mm`);
    if (result.suggestedBars) {
      lines.push(
        `Suggested: ${result.suggestedBars.quantity}× ${result.suggestedBars.length} mm bar(s)`,
      );
    }
  } else {
    lines.push('All cuts fit available stock.');
  }
  return lines.join('\n');
}
