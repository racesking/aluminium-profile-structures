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
- [ ] `PROJECT_MEMORY.md` exists at the repo root and covers decisions, current state, roadmap pointer, known issues and a change log.
- [ ] `CLAUDE.md` (top) and `AGENTS.md` (read by Codex, Cursor, Copilot and others) both require updating it with every change.

**Verification:**
- [ ] A fresh session that reads only `AGENTS.md` can name the current phase, the next task and the 3 key product decisions.

**Dependencies:** None
**Files:** `PROJECT_MEMORY.md`, `AGENTS.md`, `CLAUDE.md`
**Scope:** S

## Task 2: Release workflow: versioning, changelog, version in the app

**Description:** Give every deploy an identity, so users can report it, errors can be grouped by release, and changes are traceable.

**Acceptance criteria:**
- [ ] `package.json` version follows semver (start at `0.9.0`). `CHANGELOG.md` uses the Keep-a-Changelog format.
- [ ] The build injects the version and short git SHA. They are shown in Settings ("Version 0.9.0 (abc1234)").
- [ ] Workflow documented in PROJECT_MEMORY: feature branch → PR → CI green → merge → tag `vX.Y.Z` → deploy.

**Verification:**
- [ ] Build succeeds; Settings shows the version on the live preview.

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
