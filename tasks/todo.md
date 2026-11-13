# Todo: Production readiness

The plan, decisions and risks are in `tasks/plan.md`. Tick tasks here as they land, and record each completed task in `PROJECT_MEMORY.md`.

**Standing Definition of Done for every task:**
- `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` are green.
- E2E smoke tests are green once Task 3 exists.
- `PROJECT_MEMORY.md` is updated, and `CLAUDE.md` too if the architecture changed.
- Committed with a descriptive message and pushed.

---

## Phase 0: Foundation and workflow

## Task 1: Persistent project memory and update rule

**Description:** Create the model-agnostic memory file that holds product decisions, current state and history, so work can continue in any session, model or tool. Make updating it a rule.

**Acceptance criteria:**
- [x] `PROJECT_MEMORY.md` exists at the repo root and covers decisions, current state, roadmap pointer, known issues and a change log.
- [x] `CLAUDE.md` (top) and `AGENTS.md` (read by Codex, Cursor, Copilot and others) both require updating it with every change.

**Verification:**
- [x] A fresh session that reads only `AGENTS.md` can name the current phase, the next task and the 3 key product decisions.

**Dependencies:** None
**Files:** `PROJECT_MEMORY.md`, `AGENTS.md`, `CLAUDE.md`
**Scope:** S

## Task 2: Release workflow: versioning, changelog, version in the app

**Description:** Give every deploy an identity, so users can report it, errors can be grouped by release, and changes are traceable.

**Acceptance criteria:**
- [x] `package.json` version follows semver (start at `0.9.0`). `CHANGELOG.md` uses the Keep-a-Changelog format.
- [x] The build injects the version and short git SHA. They are shown in Settings ("Version 0.9.0 (abc1234)").
- [x] Workflow documented in PROJECT_MEMORY. Adjusted 2026-11-13: commits go straight to `main` (owner preference; CI gates deploy); releases are tagged `vX.Y.Z`. A PR flow can be switched on later.

**Verification:**
- [x] Build succeeds; Settings shows the version on the live preview.

**Dependencies:** T1
**Files:** `package.json`, `vite.config.ts`, `src/components/SettingsPage.tsx`, `CHANGELOG.md`, `src/vite-env.d.ts`
**Scope:** S

## Task 3: End-to-end smoke tests in CI

**Description:** Playwright tests that drive the real app through the money paths, so UI regressions in the cut list are caught. UI is untested today.

**Acceptance criteria:**
- [ ] Express: choose shelving → change width → BOM total changes → open Drawing modal → it contains a parts table.
- [ ] Advanced: create box frame 600×400×400 → the cut plan lists parts A–D with cut lengths 600/590/390/380 (blind, 20 mm) → change kerf → waste changes.
- [ ] Project round-trip: save `.json` → reload → open → same member count.
- [ ] Runs headless in `ci.yml` against `vite preview`; failures upload a trace.

**Verification:**
- [ ] `npm run test:e2e` is green locally and in CI.
- [ ] Deliberately breaking `memberCutLengths` turns CI red.

**Dependencies:** T1
**Files:** `playwright.config.ts`, `e2e/express.spec.ts`, `e2e/advanced.spec.ts`, `e2e/project-io.spec.ts`, `.github/workflows/ci.yml`, `package.json`
**Scope:** M

### Checkpoint A: foundation
- [ ] Unit + E2E green in CI. Version visible in the app. Human review before Phase 1.

---

## Phase 1: Trust and reliability

## Task 4: Error reporting (Sentry)

**Description:** Capture runtime errors in production with readable stacks and release tags, and without personal or project data.

**Acceptance criteria:**
- [ ] The Sentry browser SDK initialises only in production builds, with `sendDefaultPii: false`, `release` set to the app version and a low trace sample rate.
- [ ] `ErrorBoundary.onError` and the global `unhandledrejection` handler report to Sentry. Project payloads and file contents are never attached; `beforeSend` scrubs anything that looks like JSON.
- [ ] Source maps are uploaded in CI with an auth token from a GitHub secret, and are not deployed publicly.

**Verification:**
- [ ] A test error triggered on the preview build appears in Sentry with the original file and line and the release tag.
- [ ] The event payload contains no IP and no project data.

**Dependencies:** T2
**Files:** `src/main.tsx`, `src/core/telemetry.ts` (new), `src/components/ErrorBoundary.tsx`, `vite.config.ts`, `.github/workflows/deploy.yml`
**Scope:** M

## Task 5: Data safety and migrations

**Description:** Users must never silently lose work. Detect storage failures, offer a full backup, and prove that old project files still open.

**Acceptance criteria:**
- [ ] When IndexedDB or localStorage is unavailable or full, a persistent, non-blocking banner explains that autosave is off and suggests saving to a file.
- [ ] Wizard → "Back up all projects" downloads one `.json` bundle of every project with its latest version. "Restore backup" imports it.
- [ ] Fixtures for v1, v2 and current project files sit in `src/core/__fixtures__/`. Tests prove each one loads with the same members, profiles and stock.

**Verification:**
- [ ] Unit tests for migration fixtures pass.
- [ ] Manual: back up → clear site data → restore → Recent projects come back.

**Dependencies:** T3
**Files:** `src/core/versionStore.ts`, `src/core/projectFile.test.ts`, `src/core/__fixtures__/*`, `src/components/WizardPage.tsx`, `src/components/StorageBanner.tsx` (new)
**Scope:** M

## Task 6: In-app dialogs/toasts + "Report a problem"

**Description:** Replace the browser's `alert` and `confirm` with accessible in-app feedback, and give users a way to report problems.

**Acceptance criteria:**
- [ ] No `alert(` or `confirm(` calls remain in `src/`. Errors and confirmations use the shared `Modal` or a new `Toast`.
- [ ] Help includes "Report a problem". It opens a pre-filled GitHub issue or email with the app version and browser, and nothing about the project unless the user attaches the file.

**Verification:**
- [ ] `grep -rn "alert(\|confirm(" src` returns nothing.
- [ ] Manual: an invalid file open shows a toast with recovery text.

**Dependencies:** T4
**Files:** `src/components/Toast.tsx` (new), `WizardPage.tsx`, `Toolbar.tsx`, `ExpressBuilder.tsx`, `HelpModal.tsx`
**Scope:** M

## Task 7: Cut-list golden tests and joint semantics decision

**Description:** Lock the product's core truth against real-world jobs, and resolve the Express/Advanced joint-rule divergence.

**Acceptance criteria:**
- [ ] At least 3 golden fixtures from real fabricated jobs (provided by the user or derived from Express templates): structure in, expected cut list, bars and waste out. Tests compare them exactly.
- [ ] Joint semantics decided (open question 6) and recorded in PROJECT_MEMORY. If unified, Express and Advanced give identical cut lengths for the same geometry and joint.

**Verification:**
- [ ] `npm run test` green; golden tests fail when a joint factor is changed.

**Dependencies:** T3
**Files:** `src/core/golden.test.ts` (new), `src/core/__fixtures__/golden/*`, possibly `src/core/joints.ts`
**Scope:** M

### Checkpoint B: trust
- [ ] A production error shows in Sentry without PII. A backup round-trips. Golden tests pass. Human review.

---

## Phase 2: Public presence

## Task 8a: Brand name and identity

**Description:** The user chose to rebrand before launch. Pick a short, brandable name and apply it everywhere, before the landing page content is written.

**Acceptance criteria:**
- [ ] 5–8 name proposals with domain availability (.com/.app/.io) and trademark quick-check; the user picks one.
- [ ] Name applied to the app title, toolbar brand, wizard, README, `package.json` description, PROJECT_MEMORY and CLAUDE.md; logo/wordmark + favicon set.

**Verification:**
- [ ] `grep -rni "profile builder" src index.html README.md` returns only intentional mentions (e.g. the changelog).

**Dependencies:** None (blocks T8 content and the domain choice)
**Files:** `index.html`, `src/components/Toolbar.tsx`, `src/components/WizardPage.tsx`, `README.md`, `public/favicon.svg`, `PROJECT_MEMORY.md`
**Scope:** S

## Task 8: Landing page + SEO basics

**Description:** A fast, static landing page explains the tool and leads into the app. The app moves to `/app/`.

**Acceptance criteria:**
- [ ] Vite multi-page: `index.html` is the landing page (no three.js; total JS under 30 KB) and `app/index.html` is the app. Old `/#advanced` and `/#express` links redirect to `/app/#…`.
- [ ] Sections: what it does (design → cut list → drawing), real screenshots, how it works in 3 steps, "Start building" CTA, footer with legal links.
- [ ] Title and description, Open Graph and Twitter cards, favicon set, `robots.txt`, `sitemap.xml`, canonical URL.

**Verification:**
- [ ] Lighthouse on the landing page: Performance ≥ 95, SEO ≥ 95, Accessibility ≥ 95.
- [ ] E2E: landing CTA → app loads.

**Dependencies:** T3
**Files:** `index.html`, `app/index.html`, `src/landing/*` (new), `vite.config.ts`, `public/robots.txt`, `public/sitemap.xml`, `public/og.png`
**Scope:** L → split if needed into 8a (multi-page move + redirects) and 8b (landing content + SEO)

## Task 9: Legal pages

**Description:** EU-appropriate privacy policy, terms of use (including "verify cuts before cutting; no liability for material loss"), imprint and about/contact.

**Acceptance criteria:**
- [ ] The privacy page lists every processor (host, Sentry, analytics), the data each receives, retention, and states that no cookies or accounts are used.
- [ ] The terms include an engineering disclaimer: results are planning aids and the user must verify dimensions and structural adequacy.
- [ ] Linked from the landing footer and from the app's Settings and Help.

**Verification:**
- [ ] All pages are reachable and listed in the sitemap.
- [ ] Claims in the privacy policy match a real network-tab capture.

**Dependencies:** T8 (and open question 7 for the imprint)
**Files:** `privacy.html`, `terms.html`, `imprint.html` (static entries), `vite.config.ts`
**Scope:** S

## Task 10: Cookieless analytics

**Description:** Count visits and a handful of anonymous product events to learn what users actually do.

**Acceptance criteria:**
- [ ] Analytics script on the landing page and the app (vendor per open question 5). No cookies, no localStorage identifiers, respects Do-Not-Track.
- [ ] Events, all fixed enums with no user text: `start_express`, `start_advanced`, `template_chosen:<id>`, `drawing_opened`, `csv_exported`, `project_saved`, `error_boundary`.
- [ ] One thin `track(event)` wrapper in `core/telemetry.ts` (shared with T4) that is a no-op in dev.

**Verification:**
- [ ] Events appear in the dashboard from the live site.
- [ ] Network capture shows no cookies are set.

**Dependencies:** T8, T9
**Files:** `src/core/telemetry.ts`, the call sites (wizard, Toolbar, ExpressBuilder), `index.html`, `app/index.html`
**Scope:** M

### Checkpoint C: launchable
- [ ] Landing → app → drawing works on the live site. Legal pages are linked. Events are flowing. Human review / soft launch.

---

## Phase 3: Security hardening

## Task 11: Self-host fonts

**Description:** Remove the Google Fonts CDN (it sends visitor IPs to Google, a GDPR risk) by bundling IBM Plex.

**Acceptance criteria:**
- [ ] IBM Plex Sans and Plex Mono (needed weights only) are served from the app's own origin as woff2, with `font-display: swap`.
- [ ] Zero requests to `fonts.googleapis.com` and `fonts.gstatic.com`.

**Verification:**
- [ ] Network tab shows no Google requests.
- [ ] Visual check: typography unchanged.

**Dependencies:** None
**Files:** `src/styles/theme.css`, `public/fonts/*` or the `@fontsource` packages
**Scope:** S

## Task 12a: Move hosting to Cloudflare Pages

**Description:** The user chose Cloudflare Pages: deploys from `main` with preview URLs per branch/PR, real HTTP headers, and free Cloudflare Web Analytics.

**Acceptance criteria:**
- [ ] The Cloudflare Pages project builds from the repo (`npm run build`, output `dist`, base path `/`), with a preview deploy per PR. CI still gates the merge.
- [ ] The old GitHub Pages URL redirects to (or announces) the new address; `REPO_BASE` in `vite.config.ts` is removed or made conditional; `deploy.yml` is retired.

**Verification:**
- [ ] The production URL serves the app; a PR shows a working preview link.
- [ ] E2E runs against the preview URL.

**Dependencies:** T3
**Files:** `vite.config.ts`, `.github/workflows/deploy.yml`, `public/_headers`, `public/_redirects`, `PROJECT_MEMORY.md`, `CLAUDE.md`
**Scope:** S

## Task 12: Content-Security-Policy and security headers

**Description:** Lock down what the page can load and execute, and isolate the drawing iframe.

**Acceptance criteria:**
- [ ] CSP: `default-src 'self'`, plus only the Sentry and analytics origins; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`. Delivered via `_headers` on Cloudflare Pages, or as a meta tag on GitHub Pages.
- [ ] HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy` are set where the host allows.
- [ ] Drawing iframe uses `sandbox="allow-modals allow-same-origin"` (needed for print). Project-file import is capped at 5 MB with a friendly error.

**Verification:**
- [ ] securityheaders.com grade A (Cloudflare) and no CSP violations in the console across all flows (E2E).
- [ ] Drawing print still works.

**Dependencies:** T11, open question 1
**Files:** `public/_headers` or `index.html`/`app/index.html`, `src/components/DrawingModal.tsx`, `src/core/projectFile.ts`
**Scope:** M

## Task 13: Dependency hygiene

**Description:** Keep the supply chain current and audited.

**Acceptance criteria:**
- [ ] Dependabot enabled for npm and GitHub Actions (weekly, grouped).
- [ ] CI runs `npm audit --audit-level=high` and fails on high or critical.
- [ ] Workflow actions pinned to commit SHAs.

**Verification:**
- [ ] CI is green. A test PR from Dependabot runs the full gate.

**Dependencies:** None
**Files:** `.github/dependabot.yml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
**Scope:** S

### Checkpoint D: hardened
- [ ] Headers grade A. Only expected third-party requests. Audit clean. Human review.

---

## Phase 4: Public-user experience

## Task 14: First-run onboarding with example projects

**Description:** New users see value in under a minute: load a real example and take a short, skippable tour.

**Acceptance criteria:**
- [ ] 3 bundled examples (workbench, shelving rack, Bosch T-slot machine frame) can be opened from the wizard and from the Advanced empty state.
- [ ] Optional 4-step tour (profiles → structure → cut plan → drawing). Shown once, skippable, re-openable from Help.

**Verification:**
- [ ] E2E opens each example and checks its cut plan.
- [ ] Hallway test: 5 first-time users reach a drawing in under 3 minutes.

**Dependencies:** T3
**Files:** `src/examples/*` (new), `WizardPage.tsx`, `Viewport.tsx`, `src/components/Tour.tsx` (new)
**Scope:** M

## Task 15: Phone and tablet layout

**Description:** Users open shared designs on site, so on phones the design and BOM must be readable, even if editing stays desktop-first.

**Acceptance criteria:**
- [ ] Below 768 px: the panels become bottom-sheet tabs (Structure / 3D / Cut plan), with no horizontal scroll and touch targets of at least 44 px.
- [ ] Express sliders are usable by touch, and the Drawing modal is readable and printable on a phone.

**Verification:**
- [ ] E2E at 390×844 and 768×1024 viewports.
- [ ] No detector occlusion or overflow findings at those sizes.

**Dependencies:** T3
**Files:** `src/styles/theme.css`, `src/components/AdvancedBuilder.tsx`, `src/components/express/ExpressBuilder.tsx`, `src/components/MobileTabs.tsx` (new)
**Scope:** M

## Task 16: Performance budget + shared cut-plan cache

**Description:** Keep the app fast as structures grow, and compute the cut plan once per change instead of once per component.

**Acceptance criteria:**
- [ ] `useCutPlan` backed by one memoised selector or cache: one `planStructureCuts` call per state change, not three.
- [ ] Dragging a node on a 200-member structure stays at ≥ 50 fps on a mid-range laptop.
- [ ] CI bundle-size check: landing JS under 30 KB gzip; app entry (excluding the three.js chunk) under 80 KB gzip.

**Verification:**
- [ ] Performance trace recorded before and after.
- [ ] The CI size check fails when the budget is exceeded.

**Dependencies:** T3
**Files:** `src/components/useCutPlan.ts`, `src/store/structureStore.ts`, `.github/workflows/ci.yml`, `package.json`
**Scope:** M

### Checkpoint E: public-ready
- [ ] Hallway test passes. Mobile BOM is readable. Performance budget is enforced. Human review → public launch.

---

## Phase 5: Accounts groundwork (build later)

## Task 17: `ProjectRepository` abstraction

**Description:** Route all project persistence through one interface, so cloud sync can be added later without UI changes or data migration.

**Acceptance criteria:**
- [ ] `ProjectRepository` interface (list, get, save version, delete, rename) with a `LocalProjectRepository` implementation wrapping today's IndexedDB code. Autosave, History and Wizard use only the interface.
- [ ] Every record carries `id` (uuid), `createdAt`, `updatedAt` and `schemaVersion` (sync-ready). No behaviour change for users.

**Verification:**
- [ ] Unit tests for the local repository using an in-memory fake.
- [ ] E2E and autosave behaviour unchanged.

**Dependencies:** T5
**Files:** `src/core/projectRepository.ts` (new), `src/core/versionStore.ts`, `src/store/autosave.ts`, `src/components/HistoryPanel.tsx`, `src/components/WizardPage.tsx`
**Scope:** M

## Task 18: ADR: accounts and cloud sync

**Description:** Decide how accounts will work before any build: backend, auth, data model, sync and conflict rules, GDPR. Then outline the follow-up plan.

**Acceptance criteria:**
- [ ] `docs/adr/0001-accounts-and-cloud-sync.md` compares Supabase (EU region, Postgres + RLS, magic-link auth), Firebase and a custom backend, and makes a decision.
- [ ] It covers the data model, conflict handling (last-write-wins per version vs merge), offline behaviour, account deletion and export (GDPR Articles 17 and 20), and cost at 1k, 10k and 100k users.
- [ ] It ends with an outline of the follow-up `tasks/plan-accounts.md`: sign-in, sync, share links, migration of local projects.

**Verification:**
- [ ] The human reviews and approves the ADR. PROJECT_MEMORY records the decision.

**Dependencies:** T17
**Files:** `docs/adr/0001-accounts-and-cloud-sync.md`, `PROJECT_MEMORY.md`
**Scope:** S

### Checkpoint F: complete
- [ ] All acceptance criteria met. PROJECT_MEMORY is current. Accounts plan ready to start as a separate build.

---
---

# Track B: Product features

Track B starts after **Checkpoint A**. Tasks that depend on joints (T23, T29) wait for **T7**. The Definition of Done above applies to every task. Every feature that touches cut lengths, BOM, cost or hardware also ships `core/` unit tests and a golden fixture.

---

## Phase 6: Profile catalog

## Task 19: Catalog data model + bundled catalog

**Description:** A versioned, framework-free catalog of profile series and their section properties. Weight, cost, hardware and load checks build on it.

**Acceptance criteria:**
- [ ] `core/catalog.ts` types: `CatalogSeries` (system, slot size, hardware family) and `CatalogProfile` (id, name, shape, outline dims, area mm², mass kg/m, Ix/Iy mm⁴, material, E, yield, default €/m, source + date). Catalog JSON in `src/catalog/*.json` is validated by zod.
- [ ] Initial content, in this order: generic 20/30/40/45 T-slot (incl. 40×80 rectangular) → Bosch Rexroth → steel SHS/RHS, angle, flat bar, round tube → item + Misumi. Each entry cites its source datasheet and date (factual values only, with attribution).
- [ ] `ProfileDef.catalogId?` added, persisted and migrated. Profiles without it behave exactly as today.

**Verification:**
- [ ] Tests: every entry passes the schema; mass ≈ area × density within 3%; Ix > 0; ids are unique.
- [ ] Old projects open unchanged (fixture test from T5).

**Dependencies:** Checkpoint A
**Files:** `src/core/catalog.ts`, `src/catalog/*.json`, `src/core/catalog.test.ts`, `src/core/profiles.ts`, `src/core/projectFile.ts`
**Scope:** M

## Task 20: Pick profiles from the catalog in both builders

**Description:** Users choose "Bosch 40×40 L" or "SHS 40×40×3" from a searchable picker. Shape, section and 3D outline follow automatically.

**Acceptance criteria:**
- [ ] A searchable picker (by system, size, shape) in StockPanel (Advanced) and ProfilesPanel (Express). Picking sets name, shape, sectionMm and catalogId. "Custom" remains.
- [ ] Non-square outlines (40×80, RHS 60×40) render with their real proportions. This means extending `sectionOutline` to width × height; today the section is square-only.
- [ ] The cut plan, drawing and labels show the catalog name.

**Verification:**
- [ ] E2E: pick 40×80 → 3D member is visibly rectangular → BOM shows "40×80".
- [ ] Unit tests for rectangular outlines (winding, no self-intersection).

**Dependencies:** T19
**Files:** `src/components/ProfilePicker.tsx` (new), `StockPanel.tsx`, `express/ProfilesPanel.tsx`, `src/core/profileShapes.ts`, `StructureLines.tsx`
**Scope:** M

### Checkpoint G: catalog
- [ ] Catalog profiles work in both builders; old projects are unchanged; human review of catalog data accuracy.

---

## Phase 7: Complete BOM and cost

## Task 21: Weight

**Description:** Show weight per part, per profile and in total. Needed for transport, handling and load.

**Acceptance criteria:**
- [ ] `core/weight.ts`: weight = cut length × mass/m per member, plus hardware unit weights once T23 lands. Profiles without catalog data show "—" with a hint to choose a catalog profile.
- [ ] Shown in the Sidebar stats, the Express BOM stats, CSV and the drawing parts list.

**Verification:**
- [ ] Unit tests; the box-frame golden fixture checks total kg against a hand calculation.

**Dependencies:** T19
**Files:** `src/core/weight.ts`, `src/core/weight.test.ts`, `Sidebar.tsx`, `express/ExpressBOM.tsx`, `src/core/bomExport.ts`
**Scope:** S

## Task 23: Hardware BOM derived from joints

**Description:** Automatically count what else you need to buy (connectors, T-nuts, bolts, end caps) from the joint graph, per profile system.

**Acceptance criteria:**
- [ ] Pure `core/hardware.ts`: (joint type × node topology × series hardware family) → hardware lines (part, qty, per-joint reason). The mapping table is data in the catalog, not code.
- [ ] Rules covered: blind → internal connector + screw per butting end; bracket → angle bracket + 2 T-nuts + 2 bolts per right-angle pair; open member ends → end cap; mitre → corner connector (or none, per series).
- [ ] BOM shows a "Hardware" section with per-line override (qty or exclude). Overrides persist in the project and survive recompute.

**Verification:**
- [ ] Unit + golden tests: a 600×400×400 box with blind joints yields the hand-counted number of connectors and end caps; changing the joint updates the counts.
- [ ] E2E: the hardware section appears and an override persists after reload.

**Dependencies:** T19, T7 (joint semantics)
**Files:** `src/core/hardware.ts`, `src/core/hardware.test.ts`, `src/catalog/hardware.json`, `src/store/structureStore.ts` (overrides), `StockPanel.tsx`, `express/ExpressBOM.tsx`
**Scope:** M

## Task 22: Cost estimate

**Description:** Turn the BOM into money: bars bought (waste included), hardware, and optional cutting cost. Users can enter their own supplier prices.

**Acceptance criteria:**
- [ ] `core/cost.ts`: profile cost = Σ bars bought × bar length × €/m (not cut length); hardware = qty × unit price; cuts = number of cuts × €/cut (optional). Pure and tested.
- [ ] A per-project price table, **blank by default**, with an optional "use estimates" toggle that fills catalog defaults marked as estimates; currency setting.
- [ ] Total cost shown in the summary chip and the BOM, plus cost per profile.

**Verification:**
- [ ] Unit tests with hand-computed totals; changing stock length changes cost via waste.
- [ ] E2E: enter a price → total updates.

**Dependencies:** T21, T23
**Files:** `src/core/cost.ts`, `src/core/cost.test.ts`, `src/store/structureStore.ts`, `src/store/expressStore.ts`, `src/store/settingsStore.ts` (currency), `StockPanel.tsx`, `express/ExpressBOM.tsx`
**Scope:** M

## Task 24: Quote-ready BOM export

**Description:** One export a user can send to a supplier or client: profiles to buy, hardware, weights, prices and totals.

**Acceptance criteria:**
- [ ] CSV v2 sections: Buy list (bars × length per profile), Cut parts, Hardware, Totals. Columns: catalog id, name, qty, unit, unit price, line total, weight.
- [ ] The print sheet (DrawingModal) adds a "Bill of materials & cost" page after the drawing. A project name and an optional client/reference field appear in the header.
- [ ] Opens cleanly in Excel and LibreOffice (UTF-8 BOM, correct separators for the locale).

**Verification:**
- [ ] Golden test on the CSV output for the box-frame fixture.
- [ ] Manual: open in Excel, totals match the app.

**Dependencies:** T22
**Files:** `src/core/bomExport.ts`, `src/core/bomExport.test.ts`, `Toolbar.tsx`, `express/ExpressBuilder.tsx`
**Scope:** M

### Checkpoint H: order-ready BOM
- [ ] For each example project, the BOM lists profiles, hardware, weight and total cost, hand-checked against a supplier list. Human review → candidate for the launch scope.

---

## Phase 8: Shop floor

## Task 25: Per-bar cut sheets

**Description:** A printable sheet per profile for the saw operator: each stock bar, its cuts in saw order, the length to mark, and the offcut.

**Acceptance criteria:**
- [ ] For each bar: bar number, stock length, cuts in sequence with cumulative mark positions (kerf accounted), part labels (A1…), end operations column (empty until T29), offcut length + "keep/scrap" by minimum length.
- [ ] Large-type, black-and-white layout that prints legibly on A4.
- [ ] Opened from the toolbar (Advanced) and the BOM (Express) in the shared DrawingModal.

**Verification:**
- [ ] Unit test: mark positions = Σ previous cuts + kerf × index.
- [ ] Manual print preview check.

**Dependencies:** Checkpoint A
**Files:** `src/core/cutSheet.ts`, `src/core/cutSheet.test.ts`, `Toolbar.tsx`, `express/ExpressBOM.tsx`
**Scope:** M

## Task 26: Part labels with QR codes

**Description:** Printable stickers so every cut piece is identifiable during assembly.

**Acceptance criteria:**
- [ ] Label sheet (A4, common 3×8 sticker grid; Avery-compatible options). Each label shows project, part ID (A1), profile, cut length, end operations and a QR code.
- [ ] The QR code encodes plain text (project · part · length). No URL or tracking.
- [ ] QR generation uses a small, audited dependency or a local implementation (no network).

**Verification:**
- [ ] Scan a printed label with a phone and read the expected text.
- [ ] The labels match the cut sheet.

**Dependencies:** T25
**Files:** `src/core/labels.ts`, `src/core/labels.test.ts`, `package.json`
**Scope:** S

## Task 27: Offcuts back into inventory

**Description:** Usable leftovers become stock for the next job instead of scrap.

**Acceptance criteria:**
- [ ] Setting: minimum reusable offcut length per profile (default 300 mm).
- [ ] After a job, "Add offcuts to inventory" turns every offcut ≥ the minimum into an inventory row (Express inventory mode and Advanced stock). The optimizer then prefers offcuts, which it already does.
- [ ] A global inventory persists across projects (local, per device), ready for future sync via T17.

**Verification:**
- [ ] Unit tests on offcut extraction.
- [ ] E2E: finish job A → add offcuts → job B uses them first.

**Dependencies:** T25, T17
**Files:** `src/core/offcuts.ts`, `src/store/inventoryStore.ts` (new), `StockPanel.tsx`, `express/ProfilesPanel.tsx`
**Scope:** M

### Checkpoint I: shop-ready
- [ ] Pilot: one real job cut from printed cut sheets and labels alone. Human review.

---

## Phase 9: Optimizer and machining

## Task 28: Cost-aware optimizer

**Description:** Better plans: choose among several purchasable bar lengths by cost, and solve small jobs exactly.

**Acceptance criteria:**
- [ ] Buy mode accepts several bar lengths with prices; the objective is minimum cost (then fewest bars, then least waste).
- [ ] Exact solve (branch-and-bound or column generation) for up to ~40 pieces per profile, with a time cap and fallback to the current heuristic. Runs in a Web Worker so the UI never blocks.
- [ ] Result is never worse than the current heuristic on the existing test corpus.

**Verification:**
- [ ] Unit tests: known-optimal instances; a property test that exact ≤ heuristic cost; a time cap respected.

**Dependencies:** T22
**Files:** `src/core/cuttingStock.ts`, `src/core/cuttingStockExact.ts` (new), `src/workers/optimizer.worker.ts` (new), `src/core/cuttingStock.test.ts`
**Scope:** L → split: 28a (multi-length cost objective), 28b (exact solver + worker)

## Task 29: End operations per cut

**Description:** Each member end says what to do to it: saw angle (mitre), tap (e.g. M8 for the connector screw), or drill/counterbore for an access hole. Derived from joints.

**Acceptance criteria:**
- [ ] `core/endOps.ts` derives per-end operations from joint treatments + hardware: mitre angle (exact, from the bisector), tap size per series connector, access hole position.
- [ ] Shown in the inspector, cut sheets (T25) and labels (T26); the drawing parts list shows a summary.

**Verification:**
- [ ] Unit tests: 90° mitre → 45°/45°; 120° corner → 60°; blind joint → through member gets an access hole, butting member gets a tapped end.

**Dependencies:** T7, T23, T25
**Files:** `src/core/endOps.ts`, `src/core/endOps.test.ts`, `src/core/cutSheet.ts`, `Sidebar.tsx`
**Scope:** M

---

## Phase 10: Modeling power

## Task 30: Pattern and mirror

**Description:** Fusion-style rectangular and circular patterns, plus mirror about a plane, for racks, fences and symmetric frames.

**Acceptance criteria:**
- [ ] Rectangular pattern (count + spacing along X/Y/Z, 1–2 directions), circular pattern (count, axis, angle) and mirror (XY/YZ/XZ plane through a point). Applies to the selection, shares coincident nodes, one undo step.
- [ ] Available from the marking menu list and a toolbar "Pattern" menu; respects locks and carries profile assignments.

**Verification:**
- [ ] Unit tests in `core/pattern.ts` (node merging, count, ids).
- [ ] E2E: pattern 3 shelves → cut plan shows 3× the parts.

**Dependencies:** Checkpoint A
**Files:** `src/core/pattern.ts`, `src/core/pattern.test.ts`, `src/store/structureStore.ts`, `ContextMenu.tsx`, `Toolbar.tsx`
**Scope:** M

## Task 31: Member orientation

**Description:** Control how each member's cross-section is rolled, which matters for L, T, rectangular and slot-facing profiles.

**Acceptance criteria:**
- [ ] Per-edge `rollDeg` (0/90/180/270 + free) and "flip" persisted, undoable, editable in the inspector, with a quick rotate (R) on the selection.
- [ ] The 3D render and joint trims use the oriented section (trim uses the through member's extent in the butting direction, not the nominal section).

**Verification:**
- [ ] Unit test: a 40×80 through member trims a butting member by 20 or 40 depending on its roll.
- [ ] E2E: rotate an L-profile → the inspector shows 90°.

**Dependencies:** T20
**Files:** `src/core/types.ts`, `src/store/structureStore.ts`, `src/core/jointVisuals.ts`, `src/core/structureCuts.ts`, `StructureLines.tsx`, `Sidebar.tsx`
**Scope:** M

## Task 32: Panels and infill

**Description:** Sheet panels (aluminium, polycarbonate, MDF, mesh) filling a closed rectangle of members, with area and cost in the BOM.

**Acceptance criteria:**
- [ ] Select a closed 4-member loop → "Add panel": material, thickness, inset or overlay mode. The panel renders in 3D and size is computed from the loop minus slot depth (catalog).
- [ ] BOM "Panels" section: dimensions, quantity, area m², weight, cost (T22). Panel size appears on the cut sheet.

**Verification:**
- [ ] Unit test: loop detection + panel size for inset in a 40-series slot.
- [ ] E2E: add a back panel → BOM shows it.

**Dependencies:** T22, T19
**Files:** `src/core/panels.ts`, `src/core/panels.test.ts`, `src/store/structureStore.ts`, `src/components/PanelMeshes.tsx` (new), `StockPanel.tsx`
**Scope:** M

### Checkpoint J: modeling
- [ ] A 3-shelf rack with mirrored sides, rotated L-profiles and back panels builds in under 10 minutes; BOM and cut plan are correct. Human review.

---

## Phase 11: Engineering and interop

## Task 33: Beam load checks (estimates)

**Description:** Warn when a member will sag or be overstressed under a user-entered load. Estimates only.

**Acceptance criteria:**
- [ ] Per member: load case (uniform kg/m or point kg at centre), support (simply supported or cantilever). Deflection = standard formula with catalog Ix and E; bending stress vs yield with a safety factor.
- [ ] Members are coloured green/amber/red by deflection ratio (default limit L/200). Warnings show in the inspector with the numbers and formula used. A disclaimer is always visible.
- [ ] Disabled for profiles without catalog section data.

**Verification:**
- [ ] Unit tests against textbook examples (5wL⁴/384EI, PL³/48EI, PL³/3EI) within 1%.

**Dependencies:** T19, T9 (terms disclaimer)
**Files:** `src/core/beam.ts`, `src/core/beam.test.ts`, `Sidebar.tsx`, `StructureLines.tsx`
**Scope:** M

## Task 34: DXF export

**Description:** 2D drawing views (front, side, top + isometric) as DXF for CAD and laser/plasma workflows.

**Acceptance criteria:**
- [ ] `core/dxf.ts` writes DXF R12 ASCII (no dependency): member centrelines and outlines per view, dimension layers, part-ID text. Layers per profile.
- [ ] Export from the File menu in both builders.

**Verification:**
- [ ] Unit test: valid section structure + entity count.
- [ ] Manual: opens in LibreCAD or Fusion with correct dimensions.

**Dependencies:** Checkpoint A
**Files:** `src/core/dxf.ts`, `src/core/dxf.test.ts`, `Toolbar.tsx`, `express/ExpressBuilder.tsx`
**Scope:** M

## Task 35: 3D export

**Description:** Export the model for rendering, AR or CAD reference.

**Acceptance criteria:**
- [ ] glTF/GLB export of the rendered scene (real sections, joints, panels) via three.js GLTFExporter, lazy-loaded.
- [ ] STEP: investigate a WASM-based writer (e.g. opencascade.js). Ship only if under ~3 MB lazy-loaded; otherwise record the decision in PROJECT_MEMORY and offer STL.

**Verification:**
- [ ] The GLB opens in an online viewer and Blender with correct scale (mm → m metadata).

**Dependencies:** Checkpoint A
**Files:** `src/components/exporters/gltf.ts` (new), `Toolbar.tsx`
**Scope:** S (glTF) + spike (STEP)

### Checkpoint K: Track B complete
- [ ] All Track B acceptance criteria met. Golden tests cover hardware, cost and cut sheets. PROJECT_MEMORY updated. Human review.
