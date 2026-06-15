# Profile Builder — Aluminium Structures

Minimal black-and-white 3D structure builder for aluminium extrusion frames, with cutting-stock optimization.

## Features

- **3D builder** — place nodes, connect members, drag nodes, edit member lengths
- **Box frame** — parametric width × depth × height (e.g. 80×50×50 mm)
- **Stock planner** — enter available bar lengths; optimize cuts with minimal waste
- **Export** — cut list as `.txt`, save/load project in browser storage

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Example workflow

1. Click **Box frame** → 80 × 50 × 50 mm → **Create frame**
2. Stock defaults to `6 × 1000 mm`
3. Click **Optimize cuts** — all 720 mm of cuts fit on one bar with ~280 mm waste
4. **Export cuts** for the shop floor

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| V | Select |
| N | Place node |
| C | Connect members |
| X / Y / Z (hold) | Lock drag to axis |
| Shift+click member | Select second member for constraints |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Del | Delete selection |
| Esc | Cancel connect / clear axis lock |

## Work planes

Toolbar: **XZ** (floor), **XY** (front), **YZ** (side), **3D** (free placement on camera plane).

Use **3D** mode to build frames at any height and angle. Constraints (∥ / ⊥) keep members aligned when you move nodes.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview production build
