# SafeVoice Frontend — EU/Poland Compliance Audit & Backlog

**Date:** 2026-06-26 · **Scope:** `SafeVoice/frontend` · **Type:** read-only review (no code changed)
**Full report (artifact):** https://claude.ai/code/artifact/82fbce6d-cade-4b73-8de3-47c18c9d752c

> **UPDATE 2026-06-26 — frontend rebuilt (mock-data phase).** The whole frontend was rebuilt on mock data so backend work is now pure API integration. Added: i18n (PL default + EN, `src/i18n`), dark mode (`uiSlice` + `.dark` remap in index.css), a swappable mock layer (`src/mock/db.js` + `mockApi.js`) behind `VITE_USE_MOCK`, service layer (`src/services/*Service.js`), feature slices (reports/messages/users/audit/settings/ui/consent), UI primitives (toasts, ConfirmDialog, state views, pagination, accessible FormField). Working public flow (validated report form with consent + oral/meeting channel → server-issued code/PIN → tracking + secure thread), compliance pages (privacy/terms/cookies/accessibility/how-it-works/external RPO/GDPR data request), cookie banner, and all staff pages functional (dashboard, register w/ filter+pagination, case details w/ confirm-gated updates + messaging, inbox, audit, users invite/remove, settings). App split into public vs staff "worlds"; `authSlice` has a mock-auth mode so the staff area is reachable with no SSO backend. Frontend-level fixes for audit blockers C-2 (code/PIN now generated, not hard-coded), C-4 (Polish i18n live), privacy notice present, oral/meeting channel present. Still backend/infra: real CSP/headers, real RBAC enforcement, real CSRF, server-side PIN hashing, EEA hosting. `npm run build` green; dev server boots clean. Invalid Tailwind shades fixed.

---

## Critical framing — it's a static prototype

SafeVoice/frontend is currently a **static UI prototype**, not a working product. The navbar literally says *"Page-only rebuild — No auth or APIs"* and nearly every page is labelled *"UI only / static"*. Report submission, tracking, secure messaging, and evidence upload are **non-functional** — forms use fixed `defaultValue`s with no submit/validation.

The **only** genuinely wired subsystem is the **RegulaOne SSO auth layer**: `slices/authSlice.js`, `services/api.js`, `services/authService.js`, `components/auth/AuthGate.jsx`, `utils/access.js`. Everything else renders hardcoded sample data from `pages/staticData.js`.

Because of this, most controls are **Not Implemented** (can't confirm legality) rather than pass/fail.

**Tally:** 37 findings — 6 compliant, 14 partial, 9 non-compliant, 8 not implemented. Severity: 4 Critical, 9 High, 13 Medium, 11 Low.

---

## The 4 blockers (Critical — must fix before any EU launch)

| ID | Issue | Where |
|----|-------|-------|
| C-1 | No privacy notice / controller + DPO identity shown to reporters (GDPR Art. 13; Dir. Art. 7/9) | no such route in `App.jsx` |
| C-2 | Hardcoded tracking code `SV-W4R9-M2Q7` + PIN `482913` — PIN is the sole channel credential; must be server-generated, high-entropy | `pages/public/ReportSuccessPage.jsx`, `TrackCasePage.jsx` |
| C-3 | No working reporting channel → can't meet 7-day acknowledgement / 3-month feedback (Dir. Art. 9) | submit button inert in `PublicReportPortal.jsx` |
| C-4 | No Polish UI — `i18next` installed, 7 components call `useTranslation()`, but **never initialised** (no `initReactI18next`, no resources); `<html lang="pl">` + English content | `main.jsx`, `index.html`, `components/ui/*` |

---

## High issues

- **A-2 CSRF** — cookie auth + `credentials:'include'`, no CSRF token/header sent; verify backend `SameSite` + origin/CSRF checks. *(backend)*
- **A-3 RBAC display-only** — `rolePermissions` (staticData) enforced nowhere; `access.js` only gates module/plan; `mapRole()` collapses all non-admins to "Case Handler", and UI role names (Compliance Officer/Investigator/HR Manager/Auditor) don't match the gate's output. *(backend)*
- **A-4 Idle timeout fake** — `ComplianceSettingsPage` advertises "15-min idle / 8-hour max" but the only timer (`App.jsx`) is a 55-min keep-alive refresh; no idle logout exists.
- **W-1 No oral/physical-meeting channel** — Dir. Art. 9(2) requires written and/or oral reporting + meeting on request; only a web form exists.
- **X-2 Contrast/tiny-text** — pervasive `text-slate-400` (~2.6:1, fails), `text-slate-500` (~4.0:1, fails AA), and 9–11px text. WCAG 1.4.3.
- **S-2 No CSP/security headers** — no CSP meta, no `_headers`/`vercel.json`; CLAUDE.md mandates CSP+HSTS. Also no `frame-ancestors` (clickjacking, S-3). *(infra)*

## Medium issues
W-2 external-authority (RPO) info absent · W-4 7d/3m deadlines static · W-5 no pre-submit notice acknowledgement · G-2 retention values static (~3yr model is correct direction) · G-3 no data-subject-rights surface · G-4 non-EEA (AU Pty Ltd) controller → check GDPR Art. 27 representative + EEA hosting *(legal)* · X-3 `lang="pl"` vs English · X-4 reflow/zoom unverified · S-3 no clickjacking protection · U-1 no dark mode (CLAUDE.md mandate) · U-2 dev/mock copy visible to users.

## Low issues
A-6 `returnPath` not validated internal · G-5 cookie notice not written (banner NOT required — strictly-necessary cookies only) · S-4 error normaliser may echo raw backend text · X-5 no a11y statement + `animate-ping` ignores reduced motion · U-3 pre-filled real-looking form defaults · U-4 invalid Tailwind shades (`bg-slate-550`, `text-slate-705`, `text-violet-755`, `border-slate-350` etc. → silent no-ops) · U-5 no 404 / per-route `<title>`.

---

## What's genuinely good (maintain)
- **A-1** httpOnly cookie token, never in JS/localStorage/Redux (XSS-safe).
- **A-5** Anonymous report page mounts with no session/nav/SSO at all.
- **W-3** HR/individual-labour-grievance separation (no PIN), matches Dir. material scope + CLAUDE.md.
- **G-1** Zero telemetry/trackers/external scripts; no `dangerouslySetInnerHTML`; sessionStorage only holds SSO loop counter.
- **S-1** All `target="_blank"` use `rel="noopener noreferrer"`; `.env*` + `dist/` gitignored.
- **X-1** Good a11y baseline: skip link, `aria-hidden` icons, labels, `aria-current`, focus rings, `<th scope>`; `AppModal` has focus trap + Esc + reduced-motion (but unused/not imported).
- **U-6** Responsive structure (sm/md/lg/xl + mobile nav + scrollable tables).

---

## Deployment readiness — go/no-go

**Blockers (must fix):** C-1 privacy notice · C-2 server-generated PIN · C-3 real channel w/ 7d+3m · C-4 Polish UI · W-1 oral/meeting channel · A-3 real RBAC · S-2/S-3/A-2 CSP+headers+CSRF · U-2 remove mock copy.

**Should-fix before GA:** X-2 contrast · A-4 real timeouts · W-2 RPO info · G-2/G-3 retention+rights · G-4 EEA/Art.27 (legal) · X-4/X-5 reflow+a11y statement · G-5/W-5 cookie/terms/acknowledgement · U-1/U-3/U-5.

---

## Official sources
- [Directive (EU) 2019/1937](https://eur-lex.europa.eu/eli/dir/2019/1937/oj/eng) — 7-day ack (Art. 9(1)(b)), 3-month feedback (Art. 9(1)(f)), oral+meeting (Art. 9(2)).
- [Polish Whistleblower Act 14.06.2024, in force 25.09.2024](https://bip.brpo.gov.pl/en/content/act-protection-whistleblowers) · [gov.pl](https://www.gov.pl/web/family/whistleblower-protection) — RPO = external authority; ≥50 staff threshold (Art. 23); confidentiality (Art. 27).
- [GDPR (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) — Art. 13 notice, 5(1)(c) minimisation, 5(1)(e) storage limitation, 27 representative, 32 security.
- [EAA Directive (EU) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng) (applicable 28.06.2025) + EN 301 549 / [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/).
- [ePrivacy Directive 2002/58 Art. 5(3)](https://eur-lex.europa.eu/eli/dir/2002/58/oj/eng) — strictly-necessary cookies need no consent.

> Engineering guidance, not formal legal advice — have counsel confirm Polish-Act/GDPR positions before launch.
