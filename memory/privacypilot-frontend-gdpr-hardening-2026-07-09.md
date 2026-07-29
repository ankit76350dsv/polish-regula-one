# PrivacyPilot/frontend — GDPR hardening pass (2026-07-09)

Follow-up to `privacypilot-frontend-validation.md`. The new `PrivacyPilot/frontend`
(React 19 + Vite 6, Redux Toolkit, react-router v7, Tailwind v4 + @base-ui/react,
self-hosted @fontsource fonts, hand-rolled PL/EN i18n, mock `services/api.js`) was
audited for completeness and correctness by three parallel review agents (ROPA+DPIA;
Notices+Breaches+DSAR; cross-cutting RBAC/audit/i18n/a11y/theme).

## Verdict of the audit
The app is **genuinely production-shaped**, not a prototype: one RBAC matrix
(`lib/permissions.js`) enforced in routes + buttons + services; immutable audit trail
with old/new diffs through `apiMutate`; all six Module-6 features present; perfect PL/EN
i18n parity; no `asChild` (uses @base-ui `render`); live-data dashboard/settings/users.
Findings were specific **compliance-correctness** gaps, all fixed below. Build + boot
verified after changes; i18n parity and all `t()` keys confirmed.

## Fixes applied this session

### ROPA / DPIA
- **DPIA Art. 35(3) mandatory triggers** (`lib/dpiaCriteria.js`): `evaluateDpia` now
  returns `required` (with an Art. 35(3) rationale) whenever the matched criteria include
  automated decisions, systematic monitoring, or large-scale special/biometric data —
  regardless of the count. Previously a single mandatory case could show only
  "recommended". New helper `isArt353Mandatory()`.
- **Approval order (Art. 35(1))** (`pages/Ropa/ActivityDetailPage.jsx`): an activity
  screened "DPIA required" can no longer be approved until its linked DPIA is `approved`.
  Approve button disabled + inline warning + guarded handler (key `dpia.approvalBlocked`).
- **Processor CSV export (Art. 30(2))** (`pages/Ropa/RegisterPage.jsx`): the processor tab
  now exports its own column set — controllers served (30(2)(a)), categories of processing,
  transfers, Art. 32 measures — instead of reusing controller headers and dropping 30(2)(a).
- **All 9 Art. 9 special categories** (`lib/gdpr.js`): added racial/ethnic, political,
  religious, sex-life, sexual-orientation (were missing). `SPECIAL_CATEGORY_IDS` is now the
  single source of truth for special detection in the wizard, `completeness.js`, and
  `dpiaCriteria.js` (no more duplicated hardcoded lists).
- **Children auto-suggest** (`lib/dpiaCriteria.js`): `suggestCriteria` now flags
  `vulnerable_subjects` from the `children` data *category* (Art. 8), fixing a dead branch
  that checked a non-existent `children` subject.

### Notices
- **Art. 14(1)(d) categories of data** (`lib/gdpr.js`, `lib/noticeBuilder.js`): Art. 14
  notices now require and emit the categories of personal data.
- **Art. 13(2)(e) provision requirement** gated to Art. 13 audiences only (was required for
  everyone, wrongly blocking/emitting for Art. 14).
- **DPO name guard**: a blank DPO name no longer prints "undefined — <email>".

### Breaches
- **Art. 34 subject notification tracked** (`services/breachService.js` +
  `breachesSlice.js` + `BreachDetailPage.jsx`): new `markSubjectsNotified` action, timestamp,
  audit entry, and a UI card — mirroring the UODO path.
- **Close guard**: a breach only closes when all remediation is done AND (if required) UODO
  notified AND subjects notified; reopens if an obligation becomes outstanding.
- **Art. 33(3)(a) capture** on the create form: data categories (chips) + approximate records
  count; add-remediation input so in-app breaches can actually be closed.

### DSAR
- **Completable in-app** (`DsarDetailPage.jsx`): `allTasksDone` no longer requires ≥1 task;
  added an add-collection-task input so app-created requests can be completed.
- **Refusal path** (`services/dsarService.js` + slice + detail page): `refuse(reason)` with a
  mandatory documented ground (Art. 12(5)-(6) / statutory retention), `refused` status +
  badge, reason displayed. Refused requests treated as closed (no deadline chip).
- **Settable receipt date** (`DsarPage.jsx`): the Art. 12(3) one-month clock can be based on
  the true receipt date, not always "now".

### Cross-cutting
- **Production CSP** (`vite.config.js`): a `cspMetaPlugin` injects a Content-Security-Policy
  `<meta>` **only at build time** (not dev, to preserve HMR). Same-origin default/script/
  connect, self-hosted fonts, `frame-ancestors 'none'`. Should also be an HTTP header at the edge.
- **i18n**: replaced English-only literals shown to Polish users — Users page "Action"/"(you)"/
  "E-mail exists", Vendors "Region", the language-toggle aria-label — with `t()` keys
  (`common.action/you/region/switchLanguage/emailExists/add`).

## Known remaining work (backend-shaped, out of frontend scope)
- `services/api.js` is a localStorage mock — real Spring Boot API needed, with **read-path
  authorization** (`apiGet` is currently ungated), AES-256 at rest, EEA residency, 10-yr
  immutable retention.
- App is **dark-only**; `next-themes` is a declared-but-unused dependency (no light theme /
  toggle — dark mode is the only one CLAUDE.md §11 mandates).
- CSP should also be sent as an HTTP response header in production, not only the `<meta>`.
