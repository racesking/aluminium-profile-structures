import type { MultiCuttingResult } from './cuttingStock';
import type { CutMember } from './joints';
import type { ProfileDef } from './profiles';
import type { LengthUnit } from './units';
import { toDisplay, formatLength } from './units';

export type BomExportInput = {
  multi: MultiCuttingResult;
  cutMembers: CutMember[];
  profileOf: (role: string) => ProfileDef;
  units: LengthUnit;
  projectName: string;
  /** Pre-formatted date string (kept out of core so it stays deterministic). */
  dateStr: string;
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

/** A clean, printable cut sheet (open in a window → print / Save as PDF). */
export function bomToPrintHtml(input: BomExportInput): string {
  const { units, multi, cutMembers, profileOf, projectName, dateStr } = input;
  const rows = memberRows(cutMembers, profileOf);

  const memberTable = (profileId: string) => {
    const r = rows.filter((x) => x.profileId === profileId);
    return `<table><thead><tr><th>Member</th><th class="num">Length</th><th class="num">Qty</th></tr></thead><tbody>${r
      .map(
        (x) =>
          `<tr><td>${escapeHtml(x.role)}</td><td class="num">${formatLength(x.lengthMm, units)}</td><td class="num">${x.qty}</td></tr>`,
      )
      .join('')}</tbody></table>`;
  };

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

  const sections = multi.byProfile
    .map(
      (g) => `
      <section>
        <h2>${escapeHtml(g.profileName)} · ${g.sectionMm} mm</h2>
        ${memberTable(g.profileId)}
        <h3>Cut plan — ${g.result.bars.length} bar(s), waste ${formatLength(g.result.totalWaste, units)}</h3>
        ${cutPlan(g.result.bars)}
      </section>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(projectName)} — Cut sheet</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Arial, sans-serif; color: #111; margin: 28px; font-size: 13px; }
    header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 18px; }
    h1 { font-size: 18px; margin: 0; }
    .meta { color: #666; font-size: 12px; }
    .summary { display: flex; gap: 22px; margin: 0 0 20px; font-size: 12px; }
    .summary b { display: block; font-size: 16px; }
    section { margin-bottom: 22px; break-inside: avoid; }
    h2 { font-size: 14px; margin: 0 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 12px; color: #444; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .num { text-align: right; white-space: nowrap; }
    @media print { body { margin: 12mm; } }
  </style></head>
  <body>
    <header>
      <h1>${escapeHtml(projectName)}</h1>
      <span class="meta">Cut sheet · ${escapeHtml(dateStr)}</span>
    </header>
    <div class="summary">
      <span>Members<b>${cutMembers.length}</b></span>
      <span>Total cut<b>${formatLength(multi.totalCutLength, units)}</b></span>
      <span>Bars<b>${multi.totalBars}</b></span>
      <span>Waste<b>${multi.wastePercent}%</b></span>
    </div>
    ${sections}
  </body></html>`;
}
