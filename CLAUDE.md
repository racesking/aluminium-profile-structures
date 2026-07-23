# CLAUDE.md

Engineering reference for **Profile Builder — Aluminium Structures**. Read this before working on the codebase; it captures the architecture, the data model, and the non-obvious invariants that aren't visible from any single file.

> Public-facing overview lives in [README.md](README.md). This file is the internal map.

---

## What it is

A 100% client-side browser tool for designing aluminium extrusion structures, optimizing how members are cut from stock bars, and producing a bill of materials + isometric technical drawing. No backend, no account — projects are saved as `.json` files on disk and to `localStorage`.

- **Live:** https://racesking.github.io/aluminium-profile-structures/
- **Two builders**, chosen from the wizard:
  - **Express** — parametric templates shaped with sliders; live 3D + cut optimization + BOM.
  - **Advanced** — free node/edge 3D editor (place nodes on work planes, connect members, set lengths, parallel/perpendicular constraints, duplicate, undo).
  - Express → Advanced is a one-way hand-off ("Edit in Advanced").

## Tech stack

| Concern | Choice |
|---|---|
| Build/dev/test | Vite 6 + Vitest 3 (one `vite.config.ts` configures both) |
| UI | React 19 + TypeScript ~6 (strict, project references) |
| 3D | three.js ^0.184 + @react-three/fiber ^9 + @react-three/drei ^10 |
| State | Zustand ^5 (five independent stores) |
| Validation | zod ^3 (project-file import only) |
| IDs | uuid ^14 |
| Lint | eslint ^10 + typescript-eslint ^8 + react-hooks/react-refresh |

Package name is `beam-calculator`; disk folder is `Beam Calculator`; product/Pages name is `aluminium-profile-structures`. **Three names, one project.**

## Commands

| Script | Does |
|---|---|
| `npm run dev` | Dev server → http://localhost:5173 (base `/`) |
| `npm run build` | `tsc -b && vite build` (type error fails before bundling) |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` (Node env, `src/**/*.test.ts` only) |
| `npm run preview` | Serve the production build locally (base `/`) |

Before pushing, run typecheck + lint + test + build (CI gates on all of them). There is **one pre-existing lint warning** in `StructureScene.tsx` (`useCallback` dep) — not from your change unless the count grows.

**Strict react-hooks v6 lint rules to design around** (they reject common patterns as *errors*): no synchronous `setState` reachable from a `useEffect` body (fetch with a pure async fn + `.then(setState)` and a `cancelled` flag); no `Date.now()`/impure calls during render (compute timestamps when data loads); no mutating hook-returned objects like `useThree().scene` (do it in Canvas `onCreated` instead).

---

## Architecture

```
src/
  core/        framework-free logic (no React, no three.js except workPlane.ts) — UNIT-TESTED
  store/       Zustand stores (+ projectIO orchestration)
  components/  Advanced builder UI + shared (Wizard, Settings, ErrorBoundary)
  components/express/  Express builder UI
  styles/      theme.css (global, loaded in main.tsx) + per-page css
  App.tsx      view router (lazy-loads the two 3D builders)
  main.tsx     root mount inside the top-level ErrorBoundary
```

**View routing:** `appStore.view` ∈ `wizard | express | advanced | settings`, mirrored to the URL hash (`wizard` = empty hash). `App.tsx` renders wizard/settings eagerly and lazy-loads `ExpressBuilder`/`AdvancedBuilder` inside `<Suspense>` so three.js (~1 MB, the `Grid` chunk) only loads when a builder opens. Browser back/forward works via `pushState` + `hashchange`/`popstate` listeners registered at module load.

**The cut-list pipeline (both builders share the shape):**
```
geometry (nodes/edges or template members, in mm)
  → cut lengths (joint compensation, Express only changes LENGTH not geometry)
  → group by profile  (each profile cut only from its OWN stock — never shared)
  → solveCuttingStockByProfile(groups, kerf)  → MultiCuttingResult
  → BOM panel + CSV/print/drawing exports
```

---

## Data model & critical conventions

These are the invariants that aren't obvious from one file. **Violating them causes silent bugs.**

1. **Millimetres are canonical.** Every stored/persisted length and position is mm. The display unit (`mm|cm|m|in`) is purely a UI concern. Convert at the edges only: `toDisplay(mm,unit)` / `fromDisplay(value,unit)` / `formatLength(mm,unit)` from `core/units.ts`. Never store a display-unit value.

2. **Units convention — two fields ALWAYS stay mm by design** (user-confirmed): **saw kerf** and **profile cross-section size** (`sectionMm`, the `40` in `40×40`). Extrusions are named by their mm section and kerf is universally mm. Do NOT pass these through the unit converters even though everything else (member lengths, coords, bar/stock lengths, grid size, offsets, cut plan, totals, box-frame dims) does follow the setting. This was once reported as a bug ("units don't change") — it is intentional.

3. **Graph is normalized by id.** `Edge` references `fromId`/`toId`; `EdgeConstraint` references edge ids; `edgeProfile` maps `edgeId → profileId`. Resolve ids against the node/edge arrays — nothing embeds objects.

4. **`edgeId` is the stable identity; member labels are NOT.** `M{i+1}` labels in the UI and `optimize()` come from the **array index**, so deleting/reordering edges renumbers everything. Anything persistent must key on `edgeId`.

5. **Two unrelated "Profile" types** — don't mix them:
   - `core/types.ts` `Profile` = display metadata `{ name, sectionLabel?, sectionSizeMm? }` (legacy v1 / Express→Advanced hand-off).
   - `core/profiles.ts` `ProfileDef` = `{ id, name, sectionMm }` (the real multi-profile model used everywhere now).

6. **Per-profile cutting isolation.** A section's pieces can never be cut from another section's bars. The optimizer solves each profile independently then aggregates.

7. **An unassigned edge belongs to `profiles[0]`.** `getEdgeProfileId` returns `edgeProfile[id] ?? profiles[0].id`. Many selectors assume `profiles` is non-empty — the "can't delete the last profile" rule (`removeProfile` no-ops at ≤1) keeps that invariant.

8. **Axis convention is NOT globally consistent.** `templates.ts` / `drawing.ts` / the viewport use **X=width, Y=up, Z=depth**. But `boxFrame.ts` uses **width=X, depth=Y, height=Z** (height on Z). Reconcile when consuming both. The isometric projection in `drawing.ts` (`p[0]-p[2]`, `p[0]+p[2]`) is load-bearing on the X/Y/Z=width/up/depth convention.

9. **Default divergences between builders** (intentional, easy to trip on):
   - Initial profile: Advanced `20×20` (20 mm) vs Express `40×40` (40 mm).
   - Default kerf: `structureStore` **0**, `expressStore` **3**, `settingsStore` **3**.

---

## core/ reference (framework-free, unit-tested)

| File | Responsibility | Watch out |
|---|---|---|
| `types.ts` | Shared vocabulary: `Vec3, Node, Edge, EdgeConstraint, StockBar, CutPiece, BarAssignment, CuttingResult, Selection, ToolMode, WorkPlane, AxisLock, HistorySnapshot`. | `CuttingResult.suggestedBars` is nullable. Two `Profile` types (see above). |
| `units.ts` | mm↔display conversion + formatting. `MM_PER` (in=25.4), `DECIMALS`, `INPUT_STEP`. Stateless. | `toDisplay` rounds, `fromDisplay` doesn't → round-trips are lossy for non-mm. Adding a unit means editing 3 private Records + `LENGTH_UNITS` + the type. |
| `geometry.ts` | Pure Vec3 math: `distance, direction, snapValue/Vec3, maybeSnapVec3, midpoint, edgeLength, setEdgeLength, roundLength, nodeDistance`. | Missing-endpoint conventions differ: `edgeLength`→0, `nodeDistance`→null, `setEdgeLength`→unchanged. `direction` of a zero-length edge returns `[1,0,0]`. `roundLength` = 1 decimal, the canonical length rounding. |
| `profiles.ts` | `ProfileDef` (`id,name,sectionMm,shape?,color?`), `ProfileStock`, `makeProfile`, `defaultProfileStock`, `profileForRole`, `PROFILE_PALETTE`, `profileColorAt`, **`resolveProfileColor`** (custom `color` else palette-by-index — use this, not `profileColorAt`, wherever a profile is colored), `isProfileHexColor`. | Section clamped 1–500 mm. `PROFILE_PALETTE` (6 colors) is deliberately separate from templates' `ROLE_PALETTE` — don't unify. Custom colors color the 3D view/panel/cut plan; the DRAWING keeps per-Part role colors on purpose (balloon readability). |
| `joints.ts` | `JOINTS` (blind/bracket/mitre/butt), `applyJointToMembers`. Turns centreline length → cut length. | Formula: `cut = max(1, length + factor*section*buttEnds)`. `buttEnds` is hard-coded **2** (assumes both ends butt — fine for Express templates, wrong for arbitrary geometry). Through-member (blind, `respectContinuity`) shortens butting members by the **through member's** section, not their own. |
| `cuttingStock.ts` | The 1D bin-packing optimizer: `solveCuttingStock` (single), `solveCuttingStockByProfile` (multi), `extractCutList`, `formatCutList`. | **Heuristic** (4 fixed strategies), not optimal. Kerf: first cut in a bar is free, each subsequent costs one kerf. **Two different `wastePercent` denominators** — single divides by *all* stock, multi by *used* stock; not comparable. Placement detected by `edgeId` match. |
| `templates.ts` | Express engine: 8 `TEMPLATES`, `defaultParams`, `assignRoleColors`, `continuousRolesFor`, **`membersToStructure`** (Express→Advanced bridge, merges coincident endpoints within 0.05 mm). | Role **strings** are the contract between `generate()` and the `continuity` arrays — a typo silently makes a member non-continuous (no validation). `rectFrame` mutates the `{w,d}` index counter passed in. |
| `boxFrame.ts` | `createBoxFrame(w,d,h)` → fixed 8-node/12-edge tube frame (Advanced quick-start). | Height on **Z** (contradicts templates.ts). |
| `constraints.ts` | Parallel/perpendicular edge alignment: `enforceConstraints`, `alignEdgeParallel/Perpendicular`. Moves only **edge B**, pivots on a shared node. | **Single pass, no convergence** — conflicting/chained constraints depend on order and can break each other. |
| `selection.ts` | `getActiveEdgeIds` (multi-select wins over single click), `getConstraintEdgePair` (A=reference, B=moved), `getSelectedNodeIds`. Re-exports `connectedEdgeGroup`. | The actual `connectedEdgeGroup` body lives in `duplicate.ts`. `getConstraintEdgePair` returns null (doesn't throw) when no valid pair. |
| `duplicate.ts` | `connectedEdgeGroup` (flood-fill, despite the name uses LIFO/DFS), `duplicateEdges` (deep-copy edges+nodes+internal constraints at an offset, fresh uuids). | Only constraints whose **both** edges are in the selection are cloned. Relies on internally consistent input (non-null assertions on the node map). |
| `workPlane.ts` | **Only three.js file in core/.** `makeWorkPlane`, `makeCameraPlane`, `raycastToPlane`, `applyAxisLock`, `WORK_PLANE_LABELS`. | `workPlaneNormal('free')` falls through to the XZ normal — for true free placement use `makeCameraPlane`. Keep three.js isolated here so the rest of core stays testable. |
| `visualScale.ts` | Section→render radius, label parsing, `getStructureBounds`, `cameraDistanceForSpan`. | `parseSectionSizeMm` reads only the FIRST number (`40x80`→40). Empty structure → span 100 / center origin. |
| `profileShapes.ts` | `ProfileShape` (`square\|round\|angle\|tee\|bosch`), `PROFILE_SHAPES`, `isProfileShape`, `profileShapeOf` (legacy → square), `sectionOutline` (pure 2D contours, mm, origin-centered), `contourArea`. | Outer contours wind CCW, holes CW — the 3D extruder relies on it. Tiny sections drop their holes (solid). `ProfileDef.shape` is OPTIONAL — always read via `profileShapeOf`. |
| `jointVisuals.ts` | `computeJointTreatments` (per-edge-end `trim` + mitre `clipNormal` from the node graph), `computeBracketPlacements`. Drives realistic joint rendering in Advanced. | Through member at a node = largest section (ties by edge order). Negative trim = extend (mitre). Collinear splices are left touching. Mitre only for exactly-2-member nodes; ≥3 falls back to butt rule. Visual only — cut-length math stays in `joints.ts`. |
| `versionStore.ts` | IndexedDB layer for Fusion-style projects: `ProjectMeta`/`VersionRecord`, list/put/delete project, list/add/get version, `pruneAutosaves` (keep 50), `pruneCandidates` + `relativeTime` (pure, tested). | Every function degrades to no-op/empty without IndexedDB. Labeled/manual versions are never pruned. DB `profile-builder-projects`, stores `projects` + `versions` (index `byProject`). |
| `projectFile.ts` | On-disk `.json` format + zod schemas + File System Access API (download/upload fallback). `StructurePayload`, `ExpressPayload`, `ProjectFile`, `parseProjectFile`. | `.passthrough()` keeps unknown keys. `version` is informational, not gated. **v1↔v2 fields coexist; the actual migration lives in the stores' `hydrateFromPayload`, not here.** Cancelled fallback-`<input>` open never resolves (documented "harmless"). |
| `bomExport.ts` | `structureToExportInput` (Advanced geom → BOM model, groups members into lettered **Parts** A,B,… by distinct profile+length), `bomToCsv`, `bomToPrintHtml`. | Edges with missing endpoints or length rounding to 0 are silently dropped. "Roles" in exports are synthetic Part labels, not semantic roles. |
| `drawing.ts` | Pure SVG isometric drawing: `iso` projection, `structureDrawingSvg` (member lines + W/D/H dimension lines + numbered balloon callouts). | Fixed width 720, dynamic height. No depth sorting/occlusion. `items[]` order == balloon numbering (parts list stays consistent). |

## store/ reference (Zustand)

All four data stores persist to `localStorage` via a module-level `subscribe`, validate/migrate on load, and wrap storage in try/catch (disabled storage = silent no-persist).

| Store | Key | Holds | Notes |
|---|---|---|---|
| `appStore` | — | `view` + `setView`. | Hash-synced router. Registers global `hashchange`/`popstate` at import (side effect). View name ≠ kind name (`structure`→`advanced`). |
| `settingsStore` | `profile-builder-settings` | `units`, `defaultKerf`, `defaultBarLength`, `defaultSectionMm` (all mm). | Defaults mm/3/6000/40. Clamps in setters (kerf ≥0, bar 100–20000, section 1–500). Read **cross-store** by `expressStore.addProfile`. |
| `layoutStore` | `profile-builder-layout` | `leftWidth`, `rightWidth`. | Clamped 180–620. Purely presentational. |
| `expressStore` | `express-builder-state` | `templateId`, **`paramsByTemplate`** (per-template, switching templates keeps each one's edits), `kerf`, `jointId`, `throughIndex` (0\|1), `profiles`, `roleProfileByTemplate`, `stockMode`, `stockByProfile`. | Persisted shape `satisfies Partial<ExpressPayload>` — localStorage and disk format share the type + `migrateProfiles` migration. `addProfile` seeds from settingsStore; migrated/first profiles hardcode 40. |
| `structureStore` | `profile-builder-project` | **The big one.** nodes/edges/constraints, profiles/edgeProfile/stockByProfile/kerf, grid/snap/workPlane/axisLock/duplicateOffset, selection/selectedEdgeIds/secondEdgeId/toolMode/connectFromId/viewPreset/clipboard, `cuttingResult`, undo/redo history. ~50 actions. | See below. |

`store/projectIO.ts` is the only place that assembles the `ProjectFile` envelope (`app:'profile-builder'`, `version:1`, ISO `savedAt`). `openProjectAndRoute` hydrates the matching store **and** routes the view. Lazy-imported by the wizard.

`store/autosave.ts` — the Fusion-style autosave engine. `startAutosave()` (idempotent; called from both builders' mount effects) subscribes to both builder stores and, 1.5 s after the last change, writes a version to IndexedDB (`core/versionStore`), creating the project record on first save and pruning old autosaves. Skips when the (name + payload JSON) signature is unchanged, so selection-only changes don't spam versions. Also: `saveCheckpoint` (manual, always writes), `restoreVersion` (autosaves current state first, then hydrates), `renameProject`, and `restoreLastStructureProject` — reload continuity for Advanced (reopens the last project when mounting empty; Express doesn't need it, its full state lives in localStorage). Express project identity lives in `localStorage['profile-builder-express-project']`; Advanced's in the store (`projectId`/`projectName`) mirrored to `localStorage['profile-builder-last-project']`.

### structureStore specifics (read before editing it)
- **Undo/redo covers ONLY `{nodes, edges, constraints, edgeProfile}`** (deep-cloned, capped 80). It does **not** restore profiles, stock, kerf, snap settings, or selection. Mutating actions call `pushHistory()` *before* mutating. To extend coverage you must edit `HistorySnapshot` + `cloneSnapshot` + `applySnapshot` together.
- **`cuttingResult` is invalidated (→ null) by almost every mutation** (and even some selections) so a stale optimization can't survive an edit.
- History is **inconsistent across profile ops**: `removeProfile`/`assignSelectedToProfile` push history; `addProfile`/`updateProfile` do **not** (a section change can't be undone).
- `optimize()` labels pieces `M<globalIndex+1>` (global, not per-profile).
- `exportCutList()` is **not read-only** — it lazily runs `optimize()` (mutating `cuttingResult`) when none exists.
- Drag model: `Nodes` calls `pushHistory()` at drag start, `moveNode(..., {skipEnforce:true})` during the drag (constraints NOT enforced mid-drag), and `finishNodeDrag()` enforces once at the end.
- `saveProject`/`getStructurePayload`/`loadProject`/`hydrateFromPayload` enumerate persisted fields **by hand** — adding a field means editing all four. (`saveProject`/`loadProject` are legacy dead code — real persistence is `store/autosave.ts` → IndexedDB.)
- Also holds `jointId` (rendering joint type, persisted in payloads) and `projectId`/`projectName` (version-store identity; NOT in payloads — `importStructure` resets them so an Express hand-off starts a fresh project).
- `duplicateSelection`/`pasteSelection` carry profiles by **positional correspondence** between source edges and new edge ids — don't break that ordering.

---

## components/ reference

### Express (`components/express/`)
- **`ExpressBuilder.tsx`** — page shell + the data pipeline (`generate → applyJointToMembers → groups → solveCuttingStockByProfile`). Owns Save/Open/CSV/Drawing/Edit-in-Advanced. Hand-off picks the **dominant profile** (most-used) since Advanced import is single-profile. ⚠ Several `useMemo`s `eslint-disable` exhaustive-deps and list `profiles, roleMap` manually — re-verify if you change profile resolution. Assumes `stockByProfile[p.id]` exists (no guard on that path).
- **`ExpressScene.tsx`** — r3f preview; members as oriented boxes (local +Y aligned to member). Camera auto-fits only when the bounds *string* changes (so dragging doesn't yank the camera).
- **`ExpressBOM.tsx`** — read-only stat cards + per-profile cut-length table + proportional `CutStrip` diagrams. All lengths through `formatLength`/`formatLengthValue`.
- **`ProfilesPanel.tsx`** — profiles (name/section), per-role assignment (multi only), stock buy/inventory toggle. Length inputs unit-aware; `sectionMm` stays mm; clearing the section field snaps to 40.
- **`ParamSlider.tsx`** — slider + exact number input + toggle variant. Length params: number field shows display units, **slider track stays in raw mm**. Number entry clamps lengths to 10–20000 mm.
- **`TemplateMoreMenu.tsx`** — non-featured templates in a `createPortal(document.body)` hover popover (escapes panel overflow).

### Advanced (`components/`)
- **`AdvancedBuilder.tsx`** — layout shell + the single global **keyboard handler** (headless, returns null). Hotkeys ignore input/textarea targets. Ctrl+Z/Y/D/C/V; V/B/N/C tool switches; X/Y/Z momentary axis lock; arrows/PgUp/PgDn nudge selection by `max(gridCellSize, snap) × (shift?10:1)`. Note `snap` is a distinct field from `snapToGrid`.
- **`Viewport.tsx`** — the Canvas, orbit camera, grid (its `raycast` is a no-op so empty clicks = deselect), gizmo, **marquee box-select** (DOM pointer → 3D projection; L→R = window/both endpoints inside, R→L = crossing/any sampled point), mode badge, context menu, modals. `onPointerMissed` clears selection (drag-guarded).
- **`Toolbar.tsx`** — ONE compact row (`.toolbar-row.compact`, ~43px): visible tool buttons; work plane / camera view / file actions (save/open/export/settings) live in `ToolbarMenu` dropdowns (defined in this file; outside-click + Escape close); glyph undo/redo; grid field + Snap; project name + History + Drawing. `handleDrawing` renders the print HTML into **DrawingModal** (no popup). Brand hides < 1460px so the row never wraps. ⚠ `input.toolbar-project-name` needs the `input.` prefix — a generic `input[type='text'] { width:100% }` rule outranks a bare class.
- **`DrawingModal.tsx`** — in-app viewer for `bomToPrintHtml` output: iframe `srcDoc` + "Print / Save PDF" via `iframe.contentWindow.print()`. Used by both builders (this shared import is why Rollup names the common three.js chunk after it).
- **`Sidebar.tsx`** — stats, selected-member length, constraint creation (∥/⊥) + active list, node-distance compare, Members/Nodes lists. `DuplicatePanel` renders here when something is selected.
- **`StockPanel.tsx`** — profiles (name/section/color/member-count), assign-selection-to-profile, kerf, per-profile stock rows, Optimize, cut plan + waste. `Optimize` disabled until some bar has quantity>0.
- **3D scene:** `StructureScene` (composes the group + invisible 400³ placement surface, active only in placeNode mode) → `StructureLines` (members as **ExtrudeGeometry** of the profile's real cross-section — stable orientation frame, metallic material, joint trims/extensions from `jointVisuals`, mitre clipping planes, bracket meshes; click = `setEdgeSelection(id, shift, alt)`), `Nodes` (spheres; drag/connect), `DimensionLabels` (HTML labels; culled to selection-only when >8 edges), `WorkPlaneVisual` (faint plane, hidden in free mode). The Canvas `onCreated` sets `gl.localClippingEnabled = true` (mitres) and attaches a PMREM `RoomEnvironment` map (no network) for metal reflections.
- **`HistoryPanel.tsx`** — version-history modal shared by both builders (`kind` prop). Lists autosaves/checkpoints with restore, rename, save-version. Times are computed at load, not render (react-hooks purity rules — see below).
- **Modals/chrome:** `ContextMenu` — a Fusion-style **marking menu**: 8 radial quick actions around the cursor (selection-aware; picks close it; ring order lives in `markingActions.ts` — shared with the flick gesture, keep them in sync by construction) + a linear list with **Lock part** (pins members: move/translate/re-dimension/delete all refuse locked members and their endpoints; grey render + 🔒 in the member list; `lockedEdgeIds` persisted as `lockedEdges`), work-plane segment, Translate/Member-dimension/Optimize/Help. **Flick gestures** in `Viewport`: right-press + drag ≥30px toward a sector runs that ring action without opening the menu (suppresses the following `contextmenu`). Mouse buttons are Fusion-style: left orbit, middle pan, right = menu/flick. Also `MemberDimensionModal`, `BoxFrameDialog` (state persists across open/close), `HelpModal` (⚠ maintained separately from the real key handler — they can drift), `PanelResizer` (writes raw px; store clamps).

### Shell
- **`main.tsx`** — `createRoot('root')` → `StrictMode > ErrorBoundary > App`. Loads `theme.css` (only global stylesheet).
- **`App.tsx`** — view router; lazy-loads the two builders. Adding a view = edit `AppView` *and* this branch logic.
- **`WizardPage.tsx`** — Express/Advanced/Settings entry + open-project (lazy-imports projectIO; errors via `alert`).
- **`SettingsPage.tsx`** — units segmented control + defaults; only bar-length is unit-aware (section/kerf fixed mm). Back uses `history.back()` when possible.
- **`ErrorBoundary.tsx`** — app-wide boundary + `CanvasErrorFallback` (wraps each builder's canvas so WebGL failures degrade gracefully). Inline styles so it renders even if CSS failed. Catches render/lifecycle only — not async/event-handler errors.

---

## Testing

- `vitest run`, **Node environment, no jsdom** — only `core/` (framework-free logic) is unit-tested (`src/**/*.test.ts`). React components are not unit-tested. 80 tests across geometry/units/cuttingStock/joints/projectFile/templates/drawing/bomExport.
- When adding logic, prefer putting it in `core/` so it's testable, and add a `.test.ts`.
- **Live-preview testing gotcha:** eval-based `import('/src/store/...')` in the running preview returns a **different store instance** than the app's bundled module (HMR duplication) — store mutations via eval won't affect the rendered app. Drive features through the app DOM or do a full reload. Also `canvas.__r3f` isn't exposed in this r3f version, and screenshots often time out while the 3D canvas is mounted. Verify layout via computed-style / `getBoundingClientRect` measurements rather than screenshots.

## Deployment / CI

- **`ci.yml`** (push to main + all PRs): checkout → node 22 → `npm ci` → typecheck → lint → test → build.
- **`deploy.yml`** (push to main + manual): re-runs lint+test+build → uploads `dist` → GitHub Pages via OIDC. Both workflows fire on a normal merge, so main is checked twice.
- **Base path:** `vite.config.ts` sets `base = '/aluminium-profile-structures/'` for `build` only (dev/preview use `/`). If the repo/Pages path changes, update `REPO_BASE` or assets 404.
- **GitHub Pages serves stale builds for ~1 min** after a push and needs a hard refresh — a "still broken" right after deploy is usually the old build.
- Pages "Source" must be **GitHub Actions** (not a branch) or the deploy step fails.

## Persistence summary

| What | Where |
|---|---|
| Express state | `localStorage['express-builder-state']` |
| Advanced state | `localStorage['profile-builder-project']` (legacy, dead code) |
| **Autosave versions + projects** | **IndexedDB `profile-builder-projects`** (via `core/versionStore` + `store/autosave`) |
| Project identity | `localStorage['profile-builder-last-project']` (Advanced), `['profile-builder-express-project']` (Express) |
| Settings | `localStorage['profile-builder-settings']` |
| Panel widths | `localStorage['profile-builder-layout']` |
| Saved projects | `.json` files on disk (File System Access API, download/upload fallback) |

The localStorage Express/Advanced shapes share the `ExpressPayload`/`StructurePayload` types and v1→v2 migrations with the on-disk format — change the type and you affect both.
