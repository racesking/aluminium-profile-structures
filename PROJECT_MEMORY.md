# PROJECT_MEMORY.md

> **The persistent memory of this project.** Any person, AI model or tool working here reads this first and updates it with every change (see the rule below). It holds what code and git can't: decisions and their reasons, current state, what's next, and known problems.
>
> - Architecture and invariants → `CLAUDE.md`
> - The active roadmap → `tasks/plan.md` + `tasks/todo.md`
> - This file → decisions, state, history

## The update rule (mandatory)

Every change that lands (a commit, a decision, a finished task, a newly found problem) updates this file **in the same commit**:

1. **Change log**: add one line at the top (date · commit · what changed, in user-visible terms).
2. **Current state**: edit any line that is no longer true.
3. **Decisions**: append any product or technical decision, with its reason and date. Never delete one; mark it `superseded by …`.
4. **Roadmap**: tick the task in `tasks/todo.md` and update "Next up" below.
5. **Known issues**: add newly found problems; remove fixed ones (and note the fix in the change log).

If a change also alters architecture or invariants, update `CLAUDE.md` as well. Keep entries short and factual. This file must stay readable in under 5 minutes.

---

## Product

- **What:** Profile Builder — Aluminium Structures. A browser tool for designing aluminium and metal extrusion structures. It produces an easy-to-understand **BOM and cut list** (optimized bar cutting) and a printable technical drawing.
- **Core promise:** the cut list is correct. A wrong cut list costs users real material. This outranks everything else.
- **Who:** the public, free (fabricators, makers, engineers).
- **Owner:** Razvan Cretu (repo `racesking/aluminium-profile-structures`).
- **Live:** https://racesking.github.io/aluminium-profile-structures/ (GitHub Pages, auto-deploys from `main`).

## Current state (2026-11-13)

- **Builders:**
  - **Express:** parametric templates with sliders.
  - **Advanced:** free 3D node and edge editor with real profile cross-sections (square, round, L, T, Bosch T-slot), realistic joints, part locking, a Fusion-style marking menu and flick gestures, and a live cut plan.
- **Cut list:** Advanced cut lengths include joint compensation (`core/structureCuts.ts`), matching the 3D view. Parts are lettered A, B, … and members are A1, A2 everywhere: panel, 3D labels, cut plan, drawing.
- **Persistence:** local only (localStorage + IndexedDB). Autosave and version history are Fusion-style; projects also save to and open from `.json`. No accounts, no backend.
- **Quality:**
  - 122 unit tests (`core/`) + 4 Playwright E2E tests against the production build (Express BOM + drawing, Advanced cut list + kerf, project file round-trip). E2E gates both CI and deploy.
  - CI gates deploys on typecheck, lint, test and build.
  - The impeccable design skill and design-check hook are installed (project scope).
- **Telemetry:** none yet. Planned: Sentry errors and cookieless analytics.
- **Last design review:** the Advanced builder critique scored 18/40 on 2026-11-12. All 5 priority issues were fixed the same day. Not re-scored yet.

## Next up

Roadmap (`tasks/plan.md`) has two tracks. **Track A: production readiness** (Phases 0–5, T1–T18) and **Track B: product features** (Phases 6–11, T19–T35: catalog, hardware BOM, cost, cut sheets/labels, optimizer, pattern/mirror, orientation, panels, load checks, DXF/3D export). Track B starts after Checkpoint A; Phases 6–7 are proposed for the public launch. Current: Track A, Phase 0.
- **T1 Persistent memory**: done.
- **T2 Release workflow**: done (v0.9.0 tagged).
- **T3 E2E smoke tests**: done. Checkpoint A reached; review before Phase 1.
- **Next:** T4 error reporting (Sentry) → T5 data safety → T6 in-app dialogs → T7 golden tests + unify joint rules. **T8a Rebrand** can run alongside.
- All 12 open questions answered 2026-11-13 (see Decisions and `tasks/plan.md`). New tasks: T8a rebrand, T12a move to Cloudflare Pages.

## How we work (release workflow)

- **Day to day:** commit to `main` and push (owner preference). CI (typecheck → lint → test → build) gates every deploy. Each commit updates this file.
- **Version:** semver in `package.json`. The build stamps version + short commit hash into the app (`core/appInfo.ts`; shown in Settings, used as the error-report release from T4).
- **Release:**
  1. Move `CHANGELOG.md` "Unreleased" entries under a new `## [x.y.z] - date`.
  2. Bump `package.json`.
  3. Commit "Release vX.Y.Z".
  4. `git tag vX.Y.Z && git push --tags`.
  - patch = fixes, minor = features, major = breaking project-file or behaviour changes.
- **Every user-visible change** adds a line under "Unreleased" in `CHANGELOG.md` (user wording), alongside the change-log line below.

## Decisions (append-only)

| Date | Decision | Why |
|---|---|---|
| 2026-06 | Millimetres are canonical; display unit is UI-only. Kerf and profile section always stay in mm. | Extrusions are sold by mm section; kerf is quoted in mm everywhere. User-confirmed. |
| 2026-06 | 100% client-side, no backend. | Zero cost, no personal data, works offline. |
| 2026-07 | Fusion 360 is the UX reference for Advanced (toolbar, marking menu, history, mouse mapping: left orbit, middle pan, right menu). | User request. |
| 2026-11-12 | Advanced cut lengths come from the 3D joint rules (`jointVisuals` → `structureCuts`). | The viewport and the cut list must never disagree. |
| 2026-11-12 | Advanced cut plan is computed live (no Optimize button). | A stale plan that said "fits" was false reassurance. |
| 2026-11-12 | Members are identified by part letter + number (A1). | One language across panel, 3D, cut plan, drawing and the shop floor. User-chosen. |
| 2026-11-12 | Advanced seeds kerf (3 mm) and bar length (6000 mm) from Settings. | A 0 mm kerf is never a real saw. |
| 2026-11-13 | Production target: a public, free tool with a landing page in front of the app. | User decision. |
| 2026-11-13 | Accounts and cloud sync are planned, not built yet. Phase 5 lays the groundwork (repository abstraction + ADR). | User decision: keep shipping local-first, avoid migration pain later. |
| 2026-11-13 | Telemetry: error reporting + cookieless analytics only. No PII, no cookies, no project data. | User decision; GDPR, and no consent banner needed. |
| 2026-11-13 | `PROJECT_MEMORY.md` + the `AGENTS.md` rule are the cross-model project memory. | User request: don't depend on one model's context or memory. |
| 2026-11-13 | Feature roadmap (Track B) built on a profile catalog with section properties, from which weight, cost, hardware and load checks derive. Hardware is derived from joints, never drawn. Load checks are labelled estimates. | Order-ready BOM + shop-floor outputs are what make it a fabricator's tool; a single catalog avoids four separate data sources. Approved 2026-11-13. |
| 2026-11-13 | Hosting moves to **Cloudflare Pages**; analytics = **Cloudflare Web Analytics**. | Real security headers, preview deploys, free cookieless analytics. |
| 2026-11-13 | **Rebrand before launch** (name TBD, task T8a). Domain decided after the name. | User decision. |
| 2026-11-13 | English only at launch. Legal entity: **Razvan Cretu personally**. | User decision. |
| 2026-11-13 | **Unify joint rules on Advanced's** (through-member trims) in both builders. | The 3D view must always match the cut list; one meaning per joint name. |
| 2026-11-13 | Catalog scope: generic T-slot → Bosch Rexroth → steel tube/angle/flat → item + Misumi; factual datasheet values with attribution. Prices blank + optional marked estimates. Load checks in, as estimates. | User decisions. |
| 2026-11-13 | Commits stay direct-to-`main`; releases are tagged semver with a Keep-a-Changelog CHANGELOG. | Owner preference for fast deploys; tags + changelog give traceability. |
| 2026-11-13 | Launch scope = Track A + Track B Phases 6–7 (catalog, hardware BOM, weight, cost). | User decision. |

## Known issues and limitations

- Express and Advanced use **different joint rules under the same names**. In Express, "Square butt" means no compensation; in Advanced, butt is trimmed by half the through profile. To be resolved in T7.
- Projects saved before 2026-11-12 keep their stored kerf, often 0 mm. Users must set it to 3 mm.
- Box-frame corners have 3 members, so Mitre cuts the same as Butt there (by design; the hint says so).
- Express state and its project identity are shared across browser tabs through localStorage. Two tabs fight over them.
- Google Fonts is loaded from Google's CDN, which is a GDPR risk (T11).
- `HelpModal` content is maintained by hand and can drift from the real keymap.
- Lint: 1 pre-existing warning in `StructureScene.tsx`.

## Change log (newest first)

- 2026-11-13 · (this commit) · T3: Playwright E2E suite (4 money-path tests) gating CI and deploy; a deliberate cut-length mutation turns it red. Fixed two unlabelled controls found by the tests (Express dimension fields, menu caret).
- 2026-11-13 · (this commit) · v0.9.0: version + commit hash shown in Settings; CHANGELOG.md; release workflow documented (T2).
- 2026-11-13 · (this commit) · Recorded answers to all 12 open questions; added T8a (rebrand) and T12a (Cloudflare Pages).
- 2026-11-13 · (this commit) · Added Track B (product features, T19–T35) to the roadmap.
- 2026-11-13 · (this commit) · Production-readiness plan (`tasks/plan.md`, `tasks/todo.md`); this memory file + `AGENTS.md` update rule.
- 2026-11-12 · 0064d93 · Advanced joint hints describe what Advanced actually cuts; Express hand-off keeps the joint type.
- 2026-11-12 · 6109292 · Impeccable polish: joint-compensated live cut plan, part IDs (A1…), bar diagrams, accessible dialogs, keyboard access, 11px text floor, empty state, Y-up box frame.
- 2026-11-12 · 0d60f0e · Installed the impeccable design skill + hook.
- 2026-07-24 · 2811e89 · Fixed 24 bugs found by an adversarial multi-agent review (locks vs constraints, versioning, Bosch geometry …).
- 2026-07-23 · 11f7e7c · Marking menu: part locking, flick gestures.
- 2026-07-23 · c40fe95 · Compact one-row toolbar, in-app drawing modal, custom profile colours.
- 2026-07-23 · 6bcaf0e · Autosave, version history, recent projects.
- 2026-07-22/23 · 615b9de, eaf3429 · Real profile cross-sections; realistic joints.
- 2026-06 · Initial build: Express + Advanced builders, multi-profile cut optimizer, units, BOM CSV/drawing exports, GitHub Pages deploy.
