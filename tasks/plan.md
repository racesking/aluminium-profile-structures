# Implementation Plan: Production readiness

## Overview

Take Profile Builder from a working prototype to a **public, free, trustworthy web tool** for fabricators, makers and engineers. That means:
- a landing page in front of the app
- visible errors and privacy-respecting usage numbers
- hardened security and data safety
- a repeatable release workflow
- foundations that let **accounts and cloud sync** be added later without migrations

The cut list and BOM must stay correct above everything else. A wrong cut list costs users real aluminium.

Decisions this plan is built on (user, 2026-11-13):
- **Audience:** public, free tool. Focus on onboarding, trust, SEO, a privacy page and reliability. **Landing page before the app.**
- **Accounts:** planned now, built later. Phase 5 lays the groundwork; the accounts build itself is a separate future plan.
- **Telemetry:** error reporting plus cookieless analytics. No PII, no cookie banner.

## Current state (baseline)

- Vite + React 19 + three.js SPA, 100% client-side, hosted on GitHub Pages under hash routes.
- CI (typecheck → lint → test → build) gates deploys. 120 unit tests cover `core/` only.
- There are no end-to-end tests, no error reporting, no analytics, no CSP, no legal pages, no versioning or changelog, and no landing page.
- Google Fonts is loaded from Google's CDN. That transfers visitor IP addresses to Google, a known GDPR issue in the EU.
- Data lives in localStorage and IndexedDB on one device, with `.json` export.

## Architecture decisions

1. **Keep a static host, but move to Cloudflare Pages.** *(Open question 1; until confirmed, tasks assume GitHub Pages works.)*
   - GitHub Pages can't set HTTP headers. That rules out real CSP and HSTS, and it has no PR preview deploys.
   - Cloudflare Pages is also free and static, and adds `_headers`, preview URLs and free cookieless Web Analytics.
2. **Make the landing page a separate, pre-rendered HTML entry.**
   - Use Vite multi-page: `index.html` becomes the landing page, `app/index.html` becomes the app.
   - The landing page ships no three.js and no React-heavy code, so it loads instantly and indexes well (hash routes don't).
3. **Error reporting with Sentry (browser SDK).**
   - `sendDefaultPii: false`.
   - Release tagged with the app version; source maps uploaded in CI and not served publicly.
   - Project files are never attached to error reports.
4. **Analytics: cookieless, aggregate-only**, either Cloudflare Web Analytics or Plausible.
   - Custom events carry no free text or user data. Examples: `template_chosen:shelving`, `drawing_exported`, `csv_exported`.
5. **Self-host fonts.** This removes the Google Fonts transfer and lets the CSP block third-party style sources.
6. **Put project storage behind a `ProjectRepository` interface.**
   - Today's IndexedDB and localStorage become one implementation.
   - A future cloud implementation (Supabase recommended; ADR in Task 18) plugs in without touching UI code.
7. **Semantic versioning, a CHANGELOG and git tags.** The version is shown in the app and attached to errors.
8. **`PROJECT_MEMORY.md` is the single source of truth for decisions and state, across models and tools.**
   - `CLAUDE.md` and `AGENTS.md` require updating it with every change.

## Dependency graph

```
PROJECT_MEMORY + workflow (T1–T2)
   └── E2E smoke tests (T3) ── guards everything below
        ├── Versioning (T2) ──► Error reporting (T4) ──► Report-a-problem UX (T6)
        ├── Data safety (T5) ──► ProjectRepository (T17) ──► Accounts ADR (T18) ──► [future: accounts plan]
        ├── Cut-list golden tests (T7)
        ├── Landing page (T8) ──► Legal pages (T9) ──► Analytics (T10)
        ├── Self-hosted fonts (T11) ──► CSP + headers (T12)
        └── Onboarding (T14), Mobile (T15), Performance budget (T16)
Dependency hygiene (T13) is independent.
```

## Task list (details and acceptance criteria in `tasks/todo.md`)

### Phase 0: Foundation and workflow
- [ ] T1: Persistent project memory + update rule *(done in this planning session; verify)*
- [ ] T2: Release workflow: semver, CHANGELOG, version in app, PR-based flow
- [ ] T3: End-to-end smoke tests in CI (Playwright)

### Checkpoint A: foundation
- [ ] CI runs unit + E2E; a deliberately broken cut plan fails CI. Human review.

### Phase 1: Trust and reliability (highest risk first)
- [ ] T4: Error reporting (Sentry, no PII, releases, source maps)
- [ ] T5: Data safety: storage-failure warnings, back up all projects, project-file migration fixtures
- [ ] T6: Replace alert/confirm with in-app dialogs and toasts + "Report a problem"
- [ ] T7: Cut-list golden tests from real jobs + decide on joint semantics

### Checkpoint B: trust
- [ ] An error thrown in production shows up in Sentry with a readable stack and no PII. A backup round-trips. Golden tests pass.

### Phase 2: Public presence
- [ ] T8: Landing page (separate static entry) + SEO basics
- [ ] T9: Privacy policy, terms, imprint, about/contact
- [ ] T10: Cookieless analytics + a minimal event set

### Checkpoint C: launchable
- [ ] Landing → app → drawing works on the live site. Lighthouse SEO ≥ 95. Legal pages linked. Events visible in the dashboard.

### Phase 3: Security hardening
- [ ] T11: Self-host fonts (remove the Google Fonts CDN)
- [ ] T12: CSP + security headers, sandboxed drawing iframe, import limits
- [ ] T13: Dependency hygiene: Dependabot, `npm audit` gate, pinned actions

### Checkpoint D: hardened
- [ ] securityheaders.com grade A (or the meta-CSP equivalent). Zero third-party requests except Sentry and analytics. Audit is clean.

### Phase 4: Public-user experience
- [ ] T14: First-run onboarding: example projects + short guided tour
- [ ] T15: Phone and tablet: a usable layout for viewing designs and BOMs
- [ ] T16: Performance budget in CI + a shared cut-plan cache

### Checkpoint E: public-ready
- [ ] A first-time user goes from landing to a printed drawing in under 3 minutes (5-person hallway test). Mobile BOM is readable.

### Phase 5: Accounts groundwork (build later)
- [ ] T17: `ProjectRepository` abstraction over local storage
- [ ] T18: ADR: accounts and cloud sync (backend, data model, GDPR), plus the follow-up plan outline

### Checkpoint F: complete
- [ ] All acceptance criteria met. PROJECT_MEMORY up to date. Accounts plan ready for a separate build.

---

# Track B: Product features (technical scope)

Track A (Phases 0–5) makes the app production-grade. Track B makes it **the tool a fabricator reaches for**. The promise is "design → a BOM and cut list I can order from and cut from." Today the app covers profiles and cut lengths. Real jobs also need:
- what the profiles **are**: a catalog with weight, price and properties
- **everything else to buy**: connectors, T-nuts, end caps, panels
- **what it costs**
- **instructions for the saw**: cut sheets, end angles, labels
- confidence that it **holds**: basic load checks

## Track B architecture decisions

9. **The profile catalog is the foundation.**
   - A versioned, bundled JSON catalog of series. Generic 20/30/40/45 T-slot, Bosch Rexroth, item, Misumi; plus steel and aluminium RHS/SHS, angle, flat and round tube.
   - Each entry carries section properties: area, mass kg/m, Ix and Iy, slot size, default €/m.
   - `ProfileDef` gains an optional `catalogId`; custom profiles keep working.
   - Weight, cost, hardware and load checks all read from it, which is why it comes first.
10. **Hardware is derived, not drawn.**
    - Connectors come from the joint graph: `computeJointTreatments` already knows every joint and its through member. A pure `core/hardware.ts` maps (joint type × node topology × catalog series) to parts. Examples: a blind joint becomes an internal connector + screw; a bracket joint becomes an angle bracket + 2 T-nuts + 2 bolts; open ends get end caps.
    - Users can override counts per line. Overrides are stored, never lost on recompute.
11. **Cost is a pure function of BOM × price table.**
    - Profiles are priced per metre of bar **bought**, not cut, so the optimizer's waste is costed.
    - Hardware is per unit; there is an optional cost per cut. Prices are user-editable per project, with catalog defaults.
12. **Shop-floor outputs are generated from the cut plan.**
    - Per-bar cut sheets in saw order, with end operations per cut (mitre angle, tap thread, counterbore, connector hole from the joint), part-ID labels with QR codes, and an offcut list.
    - Offcuts above a minimum length can go back into inventory.
13. **Structural checks are estimates, clearly labelled.**
    - Simple beam formulas (simply supported or cantilever; point or uniform load) using catalog Ix and E. Deflection and stress are compared to limits (L/200 default), giving warnings, not certification.
    - Disclaimer in the UI and the terms (T9).
14. **CAD interop is export-first.**
    - DXF (2D drawing views) and glTF/STEP-lite (3D) are generated from the same geometry the 3D view uses. Import (DXF lines → members) comes later.
15. **Modeling features extend the Advanced store's existing patterns.**
    - Pattern, mirror, orientation and panels all go through `pushHistory` + node/edge ops, so undo, locks and the cut plan keep working with no special cases.

## Track B ordering

Track B starts after **Checkpoint A** (Track A Phase 0): every feature lands with E2E coverage. Joint-dependent features (T23 hardware, T29 end operations) wait for **T7** (joint semantics).

**Recommended for public launch (Checkpoint E):** Phases 6–7 (catalog, complete BOM, cost). Then the product is clearly more than a cut calculator. Phases 8–11 follow launch.

```
Checkpoint A ─► T19 catalog model ─► T20 catalog UI ─┬─► T21 weight ─► T22 cost/quote
                                                      ├─► T23 hardware (needs T7) ─► T22
                                                      └─► T33 load checks (needs Ix)
T22 ─► T24 quote export
Cut plan ─► T25 cut sheets ─► T26 labels/QR ─► T27 offcuts→inventory
T28 optimizer (independent, core-only)
T29 end operations (needs T7, T25)
T30 pattern/mirror · T31 member orientation · T32 panels/infill (needs T22 for pricing)
T34 DXF export · T35 3D export
```

## Track B task list (details in `tasks/todo.md`)

### Phase 6: Profile catalog (foundation)
- [ ] T19: Catalog data model + bundled catalog (core, tested)
- [ ] T20: Pick profiles from the catalog in both builders

### Checkpoint G: catalog
- [ ] A catalog profile in Advanced and Express shows its true section; old projects open unchanged.

### Phase 7: Complete BOM and cost
- [ ] T21: Weight per part, per profile and in total
- [ ] T23: Hardware BOM derived from joints (connectors, T-nuts, bolts, end caps)
- [ ] T22: Cost estimate: profiles bought, hardware, cuts
- [ ] T24: Quote-ready BOM export (CSV + printed sheet with prices and weights)

### Checkpoint H: order-ready BOM
- [ ] For the box-frame example, the BOM lists profiles, hardware, weight and total cost. Hand-checked against a supplier price list.

### Phase 8: Shop floor
- [ ] T25: Per-bar cut sheets for the saw operator
- [ ] T26: Part labels with QR codes
- [ ] T27: Offcuts back into inventory + minimum reusable length

### Checkpoint I: shop-ready
- [ ] A user can cut a real job from the printed cut sheets and labels alone (pilot with one fabricator).

### Phase 9: Optimizer and machining
- [ ] T28: Cost-aware optimizer: mixed bar lengths, exact solve for small jobs
- [ ] T29: End operations per cut: mitre angle, tapping, connector holes

### Phase 10: Modeling power
- [ ] T30: Rectangular/circular pattern + mirror
- [ ] T31: Member orientation: roll angle and face alignment for T/L/Bosch
- [ ] T32: Panels and infill (sheet, mesh, polycarbonate) with area in the BOM

### Checkpoint J: modeling
- [ ] A 3-shelf rack with mirrored sides, rotated L-profiles and back panels builds in under 10 minutes; BOM and cut plan are correct.

### Phase 11: Engineering and interop
- [ ] T33: Beam load checks (deflection and stress warnings)
- [ ] T34: DXF export of drawing views
- [ ] T35: 3D export (glTF; STEP if feasible)

### Checkpoint K: Track B complete
- [ ] All Track B acceptance criteria met. Golden tests cover hardware, cost and cut sheets. PROJECT_MEMORY updated.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A cut-list regression ships unnoticed. UI isn't unit-tested, so a wrong cut list costs users real material. | High | T3 E2E plus T7 golden tests on real jobs; CI must stay red until fixed. |
| GDPR exposure: Google Fonts, analytics, error payloads | High | T11 self-hosted fonts; cookieless analytics; Sentry with PII off and no project data; T9 privacy page lists every processor. |
| GitHub Pages limits: no headers, no previews, hash routes that don't index | Medium | Cloudflare Pages migration (open question 1). Meanwhile, meta-CSP and a static landing page. |
| Accounts scope creep pulls a backend into this plan | Medium | Phase 5 is groundwork + ADR only; the accounts build is a separate plan. |
| Joint semantics differ between Express and Advanced (same names, different rules) and confuse users | Medium | T7 makes the decision and adds tests; until then the hints say exactly what each builder does. |
| Losing local data: cleared browser storage, a new device | Medium | T5 backup-all export + reminder; later, cloud sync. |
| Context or model changes lose project knowledge | Medium | PROJECT_MEMORY.md + AGENTS.md rule (T1). |
| Wrong catalog data: section properties, weights or prices. Users order or check loads from it. | High | Each catalog entry cites its source datasheet and date. Unit tests check internal consistency (mass ≈ area × density). Prices are shown as editable estimates. |
| Load checks read as certification | High | Estimate-only wording, a visible disclaimer, conservative defaults, simple formulas documented in Help; no "safe" green ticks. Terms (T9) cover it. |
| Hardware mapping is wrong for a manufacturer's system | Medium | The mapping is data (per series) not code; per-line overrides; start with generic + 1 manufacturer and expand from user feedback. |
| Manufacturer trademarks or datasheets copied into the catalog | Medium | Store only factual dimensions/properties with attribution; no logos or copied drawings. Confirm per manufacturer (open question 10). |
| Feature work dilutes production readiness | Medium | Track B starts after Checkpoint A; only Phases 6–7 are launch-scoped. |

## Decisions on open questions (answered 2026-11-13)

1. **Hosting:** move to **Cloudflare Pages** (headers, previews, analytics). This adds task T12a: migrate hosting before T12.
2. **Domain:** decide later. Build on the current address and switch before launch (Checkpoint E).
3. **Name:** **rebrand before launch**. This adds task T8a: propose names, pick one, update the landing page, title, OG and README. It blocks T8 content.
4. **Languages:** English only at launch. Strings stay simple to extract later.
5. **Analytics:** **Cloudflare Web Analytics** (free, cookieless).
6. **Joint rules:** **unify on Advanced's rules** in both builders (T7). Express "Square butt" will start shortening members.
7. **Legal entity:** **Razvan Cretu, personally**.
8. **Catalogs:** all four in scope: generic T-slot 20/30/40/45, Bosch Rexroth, steel tube/angle/flat bar, item + Misumi. Delivered in that order inside T19, generic first.
9. **Prices:** blank by default + an optional "use estimates" toggle with clearly marked defaults.
10. **Manufacturer data:** yes, factual datasheet values with attribution. No logos or copied drawings.
11. **Load checks:** yes, as labelled estimates behind a disclaimer (T33).
12. **Launch scope:** Track A + Track B Phases 6–7 (catalog, hardware BOM, weight, cost).
