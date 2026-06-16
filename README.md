# Profile Builder — Aluminium Structures

A browser-based tool for designing aluminium extrusion structures, optimizing how
they're cut from stock bars, and producing an intuitive bill of materials and
technical drawings. Everything runs client-side — no backend, no account; projects
are saved as files on your computer.

**Live:** https://racesking.github.io/aluminium-profile-structures/

## Two ways to build

The wizard ("What are you building today?") lets you pick:

- **Express Builder** — pick a parametric template and shape it with sliders. The
  3D preview, cut optimization and BOM update live as you drag. Best for common
  structures and fast quoting.
- **Advanced Builder** — a free node/edge 3D editor for custom geometry: place
  nodes on work planes, connect members, set exact lengths, add parallel /
  perpendicular constraints, duplicate and copy-paste, with full undo history.

Express designs convert to Advanced projects with one click ("Edit in Advanced").

## Features

- **Templates** (Express) grouped into categories — box frame, cabinet, table /
  workbench, shelving rack, bench, flat panel, gate / picket panel, ladder. Three
  are featured as cards; the rest live in a hover menu.
- **Joint types** — blind (default), angle bracket, mitre 45°, square butt. The
  joint adjusts each member's *cut length* from its centreline length, using the
  through member's section (a thin rail butting a thick post loses half the post's
  width). A "through member" toggle picks which members run full-length.
- **Multi-profile** (Express) — define several extrusion profiles, assign each
  member role to a profile, and the optimizer cuts each section from its own
  stock. Different sections never share a bar.
- **Cutting-stock optimizer** — multi-strategy bin packing that minimizes bars,
  then waste, and uses existing offcuts before opening full bars. Stock can be
  "buy new bars" (unlimited) or "my inventory" (the bars you have on hand).
- **Units** — display in mm / cm / m / inches (model is always stored in mm).
- **Intuitive BOM** — per-profile member list, visual cut diagrams (each bar drawn
  proportionally with colour-coded cuts and waste), and shortage warnings.
- **Exports** — CSV (members + stock summary), and a printable **technical
  drawing**: an isometric schematic with dimension lines and numbered balloon
  callouts, a parts list, and the cut plan → print / Save as PDF.
- **Resizable side panels** (Fusion-style), light theme, keyboard shortcuts.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit tests for the core logic) |

## Advanced builder — keyboard shortcuts

| Key | Action |
|-----|--------|
| V | Select |
| N | Place node |
| C | Connect members |
| X / Y / Z (hold) | Lock drag to axis |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+D / Ctrl+C / Ctrl+V | Duplicate / Copy / Paste |
| Del | Delete selection |
| Esc | Cancel connect / clear axis lock |

Work planes (toolbar): **XZ** floor, **XY** front, **YZ** side, **3D** free placement.

## Architecture

- `src/core/` — framework-free logic: cutting-stock optimizer, parametric
  templates, joint compensation, profiles, units, geometry, project file format
  (zod-validated), BOM/CSV/drawing export. Unit-tested with Vitest.
- `src/store/` — Zustand stores: `appStore` (view routing), `expressStore`,
  `structureStore` (Advanced), `settingsStore`, `layoutStore`.
- `src/components/` — React UI; the 3D viewports use react-three-fiber / three.js
  and are lazy-loaded so the landing page stays light.

Stack: Vite + React 19 + TypeScript + three.js (react-three-fiber) + Zustand + zod.

## Deployment

Static site deployed to GitHub Pages via `.github/workflows/deploy.yml` (build,
gated on lint + tests, on every push to `main`). CI (`ci.yml`) runs typecheck →
lint → test → build on pushes and PRs.
