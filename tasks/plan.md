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

## Open questions (need your input)

1. **Hosting:** move to Cloudflare Pages? It gives headers, PR previews and free analytics. Recommended: yes.
2. **Domain:** keep `racesking.github.io/...` or buy a domain (e.g. `profilebuilder.app`)? This affects SEO, branding and the email in legal pages.
3. **Product name/brand:** keep "Profile Builder — Aluminium Structures"?
4. **Languages:** English only at launch, or English + Romanian?
5. **Analytics vendor:** Cloudflare Web Analytics (free, needs Cloudflare) or Plausible (about €9/mo, EU-hosted)?
6. **Joint semantics (T7):** should both builders use one set of rules? Recommended: Advanced's through-member rules everywhere, so the 3D view always matches the cut list.
7. **Legal entity on the imprint:** you personally, or Skyline Engineering?
