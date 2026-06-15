import type { MultiCuttingResult } from './cuttingStock';
import { solveCuttingStockByProfile } from './cuttingStock';
import type { CutMember } from './joints';
import type { ProfileDef } from './profiles';
import type { LengthUnit } from './units';
import { toDisplay, formatLength } from './units';
import { structureDrawingSvg } from './drawing';
import { assignRoleColors } from './templates';
import { distance, roundLength } from './geometry';
import type { Edge, Node, Profile, StockBar, Vec3 } from './types';

export type BomExportInput = {
  multi: MultiCuttingResult;
  cutMembers: CutMember[];
  profileOf: (role: string) => ProfileDef;
  units: LengthUnit;
  projectName: string;
  /** Pre-formatted date string (kept out of core so it stays deterministic). */
  dateStr: string;
  /** Role → colour map, for the isometric drawing + parts list swatches. */
  roleColors?: Map<string, string>;
};

type MemberRow = {
  profileId: string;
  profileName: string;
  sectionMm: number;
  role: string;
  lengthMm: number;
  qty: number;
};

function memberRows(
  cutMembers: CutMember[],
  profileOf: (role: string) => ProfileDef,
): MemberRow[] {
  const map = new Map<string, MemberRow>();
  for (const m of cutMembers) {
    const p = profileOf(m.role);
    const key = `${p.id}|${m.role}|${m.length}`;
    const existing = map.get(key);
    if (existing) existing.qty += 1;
    else
      map.set(key, {
        profileId: p.id,
        profileName: p.name,
        sectionMm: p.sectionMm,
        role: m.role,
        lengthMm: m.length,
        qty: 1,
      });
  }
  return [...map.values()].sort(
    (a, b) => a.profileName.localeCompare(b.profileName) || b.lengthMm - a.lengthMm,
  );
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Bill of materials as CSV: member list + a per-profile stock summary. */
export function bomToCsv(input: BomExportInput): string {
  const { units, multi, cutMembers, profileOf } = input;
  const rows = memberRows(cutMembers, profileOf);
  const lines: string[] = [];

  lines.push(['Profile', 'Section (mm)', 'Member', `Length (${units})`, 'Qty'].join(','));
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.profileName),
        r.sectionMm,
        csvCell(r.role),
        toDisplay(r.lengthMm, units),
        r.qty,
      ].join(','),
    );
  }

  lines.push('');
  lines.push(['Profile', 'Section (mm)', 'Bars', `Used (${units})`, `Waste (${units})`].join(','));
  for (const g of multi.byProfile) {
    lines.push(
      [
        csvCell(g.profileName),
        g.sectionMm,
        g.result.bars.length,
        toDisplay(g.result.totalUsed, units),
        toDisplay(g.result.totalWaste, units),
      ].join(','),
    );
  }

  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * A printable technical drawing: isometric schematic with dimension lines and
 * numbered balloon callouts, a parts list, and the per-profile cut plan.
 * Open in a window → print / Save as PDF.
 */
export function bomToPrintHtml(input: BomExportInput): string {
  const { units, multi, cutMembers, profileOf, projectName, dateStr, roleColors } = input;

  const drawing = structureDrawingSvg(cutMembers, roleColors ?? new Map(), units);

  const partsList = `<table><thead><tr><th class="num">Item</th><th></th><th>Profile</th><th class="num">Section</th><th>Member</th><th class="num">Length</th><th class="num">Qty</th></tr></thead><tbody>${drawing.items
    .map((it) => {
      const p = profileOf(it.role);
      return `<tr><td class="num"><span class="balloon">${it.n}</span></td><td><span class="swatch" style="background:${it.color}"></span></td><td>${escapeHtml(p.name)}</td><td class="num">${p.sectionMm} mm</td><td>${escapeHtml(it.role)}</td><td class="num">${formatLength(it.lengthMm, units)}</td><td class="num">${it.qty}</td></tr>`;
    })
    .join('')}</tbody></table>`;

  const cutPlan = (bars: MultiCuttingResult['byProfile'][number]['result']['bars']) => {
    // Collapse identical bars into one row with a × count.
    const groups = new Map<string, { bar: (typeof bars)[number]; qty: number }>();
    for (const bar of bars) {
      const sig = `${bar.stockLength}|${bar.cuts.map((c) => `${c.length}:${c.label ?? ''}`).join(',')}`;
      const g = groups.get(sig);
      if (g) g.qty += 1;
      else groups.set(sig, { bar, qty: 1 });
    }
    return `<table><thead><tr><th class="num">×</th><th class="num">Bar</th><th>Cuts</th><th class="num">Waste</th></tr></thead><tbody>${[...groups.values()]
      .map(({ bar, qty }) => {
        const cuts = bar.cuts
          .map((c) => `${formatLength(c.length, units)}${c.label ? ` (${escapeHtml(c.label)})` : ''}`)
          .join(' + ');
        return `<tr><td class="num">${qty}</td><td class="num">${formatLength(bar.stockLength, units)}</td><td>${cuts}</td><td class="num">${formatLength(bar.waste, units)}</td></tr>`;
      })
      .join('')}</tbody></table>`;
  };

  const cutSections = multi.byProfile
    .map(
      (g) => `
      <section>
        <h3>${escapeHtml(g.profileName)} · ${g.sectionMm} mm — ${g.result.bars.length} bar(s), waste ${formatLength(g.result.totalWaste, units)}</h3>
        ${cutPlan(g.result.bars)}
      </section>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(projectName)} — Drawing</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Arial, sans-serif; color: #111; margin: 28px; font-size: 13px; }
    header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
    h1 { font-size: 18px; margin: 0; }
    .meta { color: #666; font-size: 12px; }
    .summary { display: flex; gap: 22px; margin: 0 0 16px; font-size: 12px; }
    .summary b { display: block; font-size: 16px; }
    .drawing { border: 1px solid #ccc; border-radius: 4px; padding: 8px; margin-bottom: 20px; break-inside: avoid; }
    section { margin-bottom: 18px; break-inside: avoid; }
    h2 { font-size: 14px; margin: 18px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 12px; color: #444; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e3e3e3; vertical-align: middle; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .num { text-align: right; white-space: nowrap; }
    .balloon { display: inline-flex; align-items: center; justify-content: center; width: 19px; height: 19px; border: 1.2px solid #111; border-radius: 50%; font-family: monospace; font-size: 11px; font-weight: 600; }
    .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: middle; }
    @media print { body { margin: 12mm; } }
  </style></head>
  <body>
    <header>
      <h1>${escapeHtml(projectName)}</h1>
      <span class="meta">Technical drawing · ${escapeHtml(dateStr)}</span>
    </header>
    <div class="summary">
      <span>Members<b>${cutMembers.length}</b></span>
      <span>Total cut<b>${formatLength(multi.totalCutLength, units)}</b></span>
      <span>Bars<b>${multi.totalBars}</b></span>
      <span>Waste<b>${multi.wastePercent}%</b></span>
    </div>
    <div class="drawing">${drawing.svg}</div>
    <h2>Parts list</h2>
    ${partsList}
    <h2>Cut plan</h2>
    ${cutSections}
  </body></html>`;
}

/** A, B, … Z, AA, AB … part labels by index. */
function partLabel(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `Part ${s}`;
}

/**
 * Build export input from the Advanced builder's raw nodes/edges (single
 * profile). Members are grouped by length into lettered parts so the drawing
 * gets one balloon/colour per distinct length.
 */
export function structureToExportInput(args: {
  nodes: Node[];
  edges: Edge[];
  profile: Profile;
  stock: StockBar[];
  kerf: number;
  units: LengthUnit;
  projectName: string;
  dateStr: string;
}): BomExportInput {
  const { nodes, edges, profile, stock, kerf, units, projectName, dateStr } = args;
  const posOf = (id: string) => nodes.find((n) => n.id === id)?.position;

  const raw = edges
    .map((e) => {
      const from = posOf(e.fromId);
      const to = posOf(e.toId);
      if (!from || !to) return null;
      const length = roundLength(distance(from, to));
      return length > 0 ? { id: e.id, from, to, length } : null;
    })
    .filter((x): x is { id: string; from: Vec3; to: Vec3; length: number } => x !== null);

  const lengths = [...new Set(raw.map((m) => m.length))].sort((a, b) => b - a);
  const labelOf = new Map(lengths.map((len, i) => [len, partLabel(i)]));

  const cutMembers: CutMember[] = raw.map((m) => ({
    id: m.id,
    role: labelOf.get(m.length)!,
    from: m.from,
    to: m.to,
    length: m.length,
    nominal: m.length,
  }));

  const roleColors = assignRoleColors(cutMembers);
  const sectionMm = profile.sectionSizeMm ?? 40;
  const prof: ProfileDef = { id: 'advanced', name: profile.name || 'Profile', sectionMm };
  const pieces = cutMembers.map((m) => ({ edgeId: m.id, length: m.length, label: m.role }));
  const multi = solveCuttingStockByProfile(
    [{ profileId: prof.id, profileName: prof.name, sectionMm, pieces, stock }],
    kerf,
  );

  return {
    multi,
    cutMembers,
    profileOf: () => prof,
    units,
    projectName,
    dateStr,
    roleColors,
  };
}
