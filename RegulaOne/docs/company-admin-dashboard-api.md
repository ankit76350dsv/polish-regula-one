# Company-Admin Compliance Dashboard API

`GET /api/admin/overview` — one snapshot of a company's compliance position across
all six RegulaOne modules, for the screen at `/company/:tenantId/overview`
(role `ROLE_ADMIN`).

Built 2026-08-05. Verified against the live development database (company
`DSV TEAM`, id `6a34ca2d9d71d550dff0c3b6`).

---

## 1. Files Modified

### Backend — `RegulaOne/backend` (new files)

| File | Purpose |
|---|---|
| `dashboard/dto/CompanyOverviewResponse.java` | The whole response shape, with the data-minimisation rules stated in the type itself. |
| `dashboard/reader/ModuleMetricsSupport.java` | Shared read-only query helpers + the calendar-day helpers (see §9). |
| `dashboard/reader/ModuleSnapshot.java` | What one module contributes: `metrics` + `attention`. |
| `dashboard/reader/KsefFlowMetricsReader.java` | KSeF invoices, deadlines, UPO, certificates, 12-month volume. |
| `dashboard/reader/WorkPulseMetricsReader.java` | Working-time compliance (Kodeks pracy limits). |
| `dashboard/reader/SafeWorkMetricsReader.java` | Medical / BHP document validity. |
| `dashboard/reader/SafeVoiceMetricsReader.java` | Whistleblower deadlines — aggregate counts only. |
| `dashboard/reader/WasteSyncMetricsReader.java` | BDO monthly records + the 15 March annual filing. |
| `dashboard/reader/PrivacyPilotMetricsReader.java` | GDPR/RODO registers and deadlines. |
| `dashboard/reader/ActivityFeedReader.java` | Cross-module audit timeline (SafeVoice excluded). |
| `dashboard/CompanyOverviewService.java` | Access gates, parallel module reads, assembly, audit write. |
| `dashboard/DashboardController.java` | The endpoint. |
| `config/DashboardConfig.java` | Six-thread pool for the parallel module reads. |
| `models/AuditLog.java` | RegulaOne's own immutable audit record (new collection). |
| `common/audit/AuditLogRepository.java` | Append + read for that trail. |
| `common/audit/AuditLogService.java` | Append-only audit writer. |

Tests: `dashboard/reader/ModuleMetricsSupportTest.java` (11 unit tests, run
always), `dashboard/reader/ModuleMetricsReaderIT.java` and
`services/CompanyOverviewServiceIT.java` (live-database, opt-in — see §8).

### Frontend — `RegulaOne/frontend`

| File | Change |
|---|---|
| `src/services/dashboardService.js` | **New** — the single API call. |
| `src/slices/companyOverviewSlice.js` | **New** — Redux Toolkit slice (thunk + loading/error/data + selectors). |
| `src/store/reduxStore.js` | Registered the `companyOverview` reducer. |
| `src/lib/dashboardLabels.js` | **New** — Polish + English labels for every metric/attention code, and locale-aware value formatting. |
| `src/pages/Dashboard/Overview.jsx` | `AdminView` rewritten to use the slice. `SuperAdminView` and `UserView` untouched. |

No changes were made to any of the six module applications.

---

## 2. Old Behaviour

`AdminView` in `Overview.jsx` was entirely hard-coded:

- stat cards read `'48'` users, `'6 / 6'` modules, `'1,247'` invoices, `'94.2%'`
  compliance score;
- the "Invoice Volume (KSeF)" chart plotted a fixed six-point array;
- "Compliance Alerts" was a fixed list of four sentences;
- "Recent Module Activity" listed four invented users and actions.

None of it touched the database. There was no company-level dashboard endpoint at
all — the only overview API was `GET /api/superadmin/overview` (platform-wide,
super-admin only).

---

## 3. New Behaviour

One call returns:

- **`company`** — name, NIP, REGON, city, status, created date (from the shared
  `tenants` collection).
- **`plan`** — package name, start/expiry, whole days remaining, expired /
  expiring-soon flags, seat capacity.
- **`headline`** — active and disabled users, seats used/remaining, new users this
  month, modules visible vs paid for, total open compliance actions and how many
  of those are already overdue, plan days remaining.
- **`entitledModules`** — module codes included in the plan.
- **`modules[]`** — one card per module with `status` and a list of `metrics`.
  Each metric is `{ key, value, unit, tone, legalRef }`: a machine key, a plain
  machine value, a unit (`COUNT` / `PERCENT` / `HOURS` / `KG` / `DATE` / `MONEY` /
  `TEXT`), a colour tone (`NEUTRAL` / `GOOD` / `WARN` / `RISK`) and the legal rule
  the figure exists for.
- **`attention[]`** — the cross-module to-do list: grouped `{ module, type, count,
  tone, legalRef, to }`, ordered RISK before WARN, then by size. Counts only, with
  a deep link into the module.
- **`invoiceVolume[]`** — KSeF invoice count per month for 12 months, zero-filled.
- **`recentActivity[]`** — newest audit lines merged across modules.
- **`generatedAt`** — provenance stamp for the screen and any export.

Card `status` values: `OK`, `NOT_IN_PLAN`, `NO_ACCESS`, `RESTRICTED`,
`UNAVAILABLE` — so the screen can distinguish "your company has not bought this"
from "you personally were not granted it" from "the data could not be read".

### What each module reports

| Module | Figures |
|---|---|
| **KSEFFLOW** | invoices total / this month / draft / pending / accepted / rejected / queued offline; **invoices past their KSeF submission deadline**; accepted invoices with no stored UPO; acceptance rate; gross invoiced this year per currency; certificates in use, expiring (30 d), expired, next expiry, whether KSeF authentication is possible at all. |
| **WORKPULSE** | clocked in / on break / finished today; shifts with no clock-out (30 d); overtime and absence approvals pending; hours worked and overtime (30 d); **missing and short breaks, daily-rest and weekly-rest breaches**; night and Sunday/holiday shifts; protected-employee flags; location-warning clock-ins; employees over the 48 h average and over 150 overtime hours; monitoring acknowledgements. |
| **SAFEWORK** | active employee profiles; fully compliant count and share; **employees blocked from working**; medical and BHP documents expired; required documents never uploaded; documents expiring within 30 days. |
| **SAFEVOICE** | open reports; **receipt not confirmed within 7 days**; **feedback past 3 months**; feedback due within 14 days; reports with no handler; unread reporter messages; share inside the legal deadline; sealed audit entries. Nothing else — see §5. |
| **WASTESYNC** | reporting entities; entities with no BDO number; monthly records this year; waste recorded this year; **finished months with no data**; last year's report — filing deadline, filed, generated-but-not-filed, **not filed**; threshold breaches. |
| **PRIVACYPILOT** | activities on record; activities past review; **DPIAs required but not started**; DPIAs in progress; prior consultations outstanding; open breaches; **inside vs past the 72 h UODO window**; people still to be notified; DSARs open / due within 7 days / **overdue**; processors with no DPA; transfers with no impact assessment; privacy notices issued. |

Bold items are legal deadlines that are already missed or actively running out;
those are the ones that reach the `attention` list with tone `RISK`.

---

## 4. Reason for Replacing the Old Code

This screen is what a company administrator uses to judge whether the business is
compliant. Invented figures are worse than none: a green "94.2% compliance score"
concealed, in this very database, 30 KSeF invoices past their submission deadline,
a personal-data breach past its 72-hour UODO deadline, 4 processing activities
running without their required DPIA, and 2 processors used with no data-processing
agreement. Every one of those is a real exposure that the mock dashboard hid.

Two design choices follow from that:

1. **No invented score.** There is no "compliance score" field. The dashboard
   reports how many specific legal obligations are open and how many are overdue —
   which is what an inspector actually asks about, and which cannot be quietly
   averaged away.
2. **The server owns every clock.** The 72-hour breach window, the 7-day
   acknowledgement, the one-month DSAR deadline, the 30-day certificate warning
   and the 15 March BDO date are all computed on the server, once. The browser
   formats; it never calculates. That is why this screen and each module's own
   dashboard cannot drift apart.

### Why the modules are read directly from MongoDB

All seven services share one MongoDB database, each owning its own collections.
The dashboard reads those collections directly rather than calling six HTTP APIs:

- the compliance overview keeps working when a module process is down — one dead
  service cannot blank the whole page;
- no new service-to-service tokens, and no code changes in six other applications;
- counting inside the database moves far less data than fetching lists — which is
  also the privacy-preserving option.

This follows a pattern already in the platform: `SafeWorkEmployeeStubRepository`
writes a SafeWork collection from RegulaOne, and SafeVoice and PrivacyPilot both
read the shared `tenants` collection. Every reader in `repository/modules` is
**read-only** and **always tenant-filtered**.

---

## 5. Security Impact

**Tenant isolation.** The company is resolved from the verified session token
(`jwt.getSubject()` → user → `user.tenant.id`). There is deliberately **no
`{tenantId}` path variable** — a company id in the URL invites tampering. The
`/company/:tenantId/overview` id in the browser address bar is display-only and is
ignored by the server. Every module query starts from that server-derived company
id; SafeWork, whose records carry no `tenantId`, is scoped by first resolving the
company's own user ids.

**Least privilege — three gates, narrowest wins.**

1. Company: from the session, never the request.
2. Plan: a module outside the subscription is reported `NOT_IN_PLAN` and **is not
   queried**.
3. The person: a module not in the admin's own `moduleIds` is reported `NO_ACCESS`
   and **is not queried**. This is the same rule the sidebar uses, so the dashboard
   can never show more than the menu allows.

**SafeVoice has a fourth gate.** It additionally requires a `SAFEVOICE_*`
permission code. Without one the card is `RESTRICTED` and no whistleblower query
runs at all. Being a company administrator is not sufficient.

**Route protection.** `/api/admin/**` is already limited to `ROLE_ADMIN` in
`SecurityConfig`; the controller repeats the rule with `@PreAuthorize` so it
survives a future URL change. Verified: unauthenticated and bad-token requests
both return `401`.

**Read-only.** The endpoint changes no business data. Its only write is one
append-only audit entry.

**No secrets touched.** Certificate metadata only — the certificate files and
their vault password references are never read.

---

## 6. Compliance Impact

### Data minimisation (GDPR Art. 5(1)(c))

The response contains **no personal data**. Every module figure is a count, a
total or a date. Specifically excluded, on purpose:

- **SafeWork** — no names, no PESEL, no dates of birth, no medical details. A
  named person's health status is special-category data (Art. 9); the dashboard is
  told only how many people are in each state.
- **WorkPulse** — absences are **one** number ("awaiting a decision"). There is no
  breakdown by absence type, because "sick leave" is health data. No GPS
  coordinates and no pregnancy / young-worker flags are read.
- **PrivacyPilot** — no DSAR requester names or e-mails, no breach descriptions.
- **KSeFFlow** — no buyer names or invoice contents.
- **Activity feed** — the audit records' `oldValue` / `newValue` payloads are never
  copied; those can hold medical expiry dates, absence reasons or case details. The
  feed carries only who / what / which record type / when / success.

### Whistleblower confidentiality (Directive (EU) 2019/1937 Art. 16; ustawa z 14.06.2024 o ochronie sygnalistów, Dz.U. 2024 poz. 928)

Confidentiality is limited to authorised case handlers. Therefore:

- SafeVoice figures require a SafeVoice staff permission (above);
- only whole-company counts and deadline arithmetic are returned — never report
  text, attachments, case references, reporters or investigators;
- **no breakdown by category, severity, department or disclosure mode.** In a small
  company "1 open harassment case in Finance" identifies a person as surely as a
  name does, so those breakdowns are absent from the API, not merely hidden in the
  UI. `ModuleMetricsReaderIT` fails the build if such a metric key is ever added.
- `safevoice_audit_logs` is excluded from the shared activity feed entirely —
  it records who handled which report. `ModuleMetricsReaderIT` asserts this even
  when SafeVoice is explicitly requested.

### Accountability (GDPR Art. 5(2)) and security of processing (Art. 32)

RegulaOne had no audit trail of its own — a gap, since it is where accounts, roles
and cross-module oversight live. The new `regulaone_audit_logs` collection is
append-only (`AuditLogService` exposes nothing but append) and records each
dashboard read with actor, role, IP, user agent, timestamp **and the list of
modules actually returned** — so the trail shows the *scope* of what the person saw,
not merely that a page was opened. Retention: 10 years, per the platform policy.

### Legal traceability

Every figure carries a `legalRef`, so no number on the screen is unexplained:

| Area | Reference used |
|---|---|
| KSeF mandate / rejections | Ustawa o VAT art. 106na–106nf |
| KSeF offline upload deadline | Ustawa o VAT art. 106nf–106nh |
| Invoice / UPO retention | Ustawa o VAT art. 112 |
| Break | Kodeks pracy art. 134 |
| Daily rest (11 h) | Kodeks pracy art. 132 §1 |
| Weekly rest (35 h) | Kodeks pracy art. 133 §1 |
| 48 h average week | Kodeks pracy art. 131 §1 |
| 150 h yearly overtime | Kodeks pracy art. 151 §3 |
| Night work | Kodeks pracy art. 151(7)–151(8) |
| Sunday / holiday work | Kodeks pracy art. 151(9)–151(10) |
| Protected employees | Kodeks pracy art. 178, art. 203 |
| Workplace monitoring | Kodeks pracy art. 22(2) |
| Working-time records | Kodeks pracy art. 149 |
| Medical examinations | Kodeks pracy art. 229 §4 |
| BHP training | Kodeks pracy art. 237(3) |
| Whistleblower — 7 days | Dyrektywa (UE) 2019/1937 art. 9(1)(b) |
| Whistleblower — 3 months | Dyrektywa (UE) 2019/1937 art. 9(1)(f) |
| Waste register / BDO | Ustawa o odpadach art. 66–67 |
| Annual BDO report (15 March) | Ustawa o odpadach art. 76 ust. 1 |
| ROPA | RODO art. 30 |
| DPIA / prior consultation | RODO art. 35, art. 36 |
| Breach — UODO 72 h / subjects | RODO art. 33, art. 34 |
| DSAR | RODO art. 12 ust. 3, art. 15–22 |
| Processor contract | RODO art. 28 |
| Transfers outside the EEA | RODO rozdział V, art. 46 |

**These references were written from the module code's own existing citations and
should be confirmed against the current text on the official portals
(sejm.gov.pl / isap.sejm.gov.pl, podatki.gov.pl for KSeF, bdo.mos.gov.pl for BDO,
uodo.gov.pl for RODO) before the labels are shown to customers.** They are
displayed to users, so a stale article number is a compliance-communication defect
even when the number itself is right.

### Polish language (CLAUDE.md §11)

The API returns machine codes, never sentences. `src/lib/dashboardLabels.js`
carries a Polish and an English label for **every** metric key, attention type,
module and screen string, and formats numbers, money and dates with the user's
locale (`1 240,50` for `pl-PL`, `1,240.50` for `en-GB`) from the same response.
The active language comes from `localStorage['regulaone.language']`, falling back
to the browser setting.

---

## 7. Behaviour Under Failure

The six modules are read in parallel on a six-thread pool
(`DashboardConfig#dashboardExecutor`), each with a 12-second ceiling, and each
wrapped so a failure becomes an `UNAVAILABLE` card instead of a failed page. A
company must still be able to see its KSeF deadlines when the waste collections
are unreachable. An `UNAVAILABLE` card shows a message rather than zeroes, because
zeroes would read as "nothing to worry about".

On the frontend a failed **refresh** keeps the previous snapshot on screen with a
stale-data warning, rather than blanking the figures an admin is reading.

An audit-write failure is logged loudly but does not fail the read (documented in
`AuditLogService` — a data-changing call site reusing that service should treat a
failed audit write as a failed action instead).

---

## 8. Testing Performed

**Unit — always run** (`./mvnw test`): 17 tests pass, 11 of them new
(`ModuleMetricsSupportTest`), covering the calendar-day query helpers, the
half-open expiry window, ISO-day round-tripping in both storage forms, numeric
coercion across `int` / `double` / `Decimal128`, and percentage edge cases.

**Live-database, opt-in.** Both suffixed `IT`, so surefire ignores them by default;
they also require `-Dregulaone.it=true`, and they read the connection string from
`application-dev.properties` so no credential is ever typed on a command line.

```bash
./mvnw test -Dtest=ModuleMetricsReaderIT  -Dregulaone.it=true
./mvnw test -Dtest=CompanyOverviewServiceIT -Dregulaone.it=true \
            -Dregulaone.it.adminEmail=<admin@example.com>
```

`ModuleMetricsReaderIT` (7 tests) runs all six readers plus the activity feed and
asserts well-formed output (known units and tones, no negative counts, no
zero-count attention items), a 12-bucket zero-filled chart, the SafeVoice
metric-key guard, and that SafeVoice never appears in the shared feed.

`CompanyOverviewServiceIT` (2 tests) asserts the response is for the caller's own
company, that there is exactly one card per module in a stable order, that each
card's status matches the plan / grant / SafeVoice-permission rules, that the
attention list is ordered worst-first, that the headline totals agree with the
attention list, and that the read is recorded in the audit trail with its module
scope.

**Results against the live development database** (company `DSV TEAM`, 2026-08-05):

```
company=DSV TEAM (ACTIVE)  plan=Basic  daysLeft=14
users=4 active  modules=6/6
open=77  overdue=66  attention=8  activity=12  chart=12
  ! KSEFFLOW     KSEF_INVOICES_FAILED                 x30  RISK
  ! KSEFFLOW     KSEF_SUBMISSION_DEADLINE_BREACHED    x30  RISK
  ! PRIVACYPILOT PRIVACY_DPIA_REQUIRED                x4   RISK
  ! PRIVACYPILOT PRIVACY_BREACH_SUBJECTS_PENDING      x1   RISK
  ! PRIVACYPILOT PRIVACY_BREACH_UODO_OVERDUE          x1   RISK
  ! SAFEVOICE    SAFEVOICE_CASE_UNASSIGNED            x5   WARN
  ! PRIVACYPILOT PRIVACY_TRANSFER_TIA_MISSING         x4   WARN
  ! PRIVACYPILOT PRIVACY_VENDOR_DPA_MISSING           x2   WARN

audit entry: COMPANY_OVERVIEW_VIEWED by ankit@dsvcorp.com.au
  scope=[KSEFFLOW, WORKPULSE, SAFEWORK, SAFEVOICE, WASTESYNC, PRIVACYPILOT]
```

**Endpoint security:** started on a spare port and probed —
`GET /api/admin/overview` returns `401` with no cookie and `401` with a bad token.

**Frontend:** `vite build` succeeds (3149 modules). The screen itself has **not**
been exercised in a browser — that needs a signed-in `ROLE_ADMIN` session.

---

## 9. Potential Risks and Side Effects

### Fixed during development — the trap worth knowing about

`ksef_certificates.validTo` is a Java `LocalDate`, and Spring Data writes those to
MongoDB as the **text** `"2027-04-30"`, not as a date. MongoDB compares different
types by type order, so `validTo < <a date>` matched **nothing** — the first
implementation would have reported every expired KSeF certificate as healthy. The
`dayBefore` / `dayOnOrAfter` / `dayBetween` helpers now match either storage form
(ISO text sorts in the same order as dates, so the text comparison is exact, not
an approximation), and `ModuleMetricsSupportTest` pins the behaviour. **Any new
metric that filters on a calendar-day field must use those helpers.**

Also fixed: `ksef_certificates.purpose` is only written for certificates obtained
through KSeF enrollment, so manually uploaded certificates have none. Treating a
missing purpose as "not an authentication certificate" raised a false "cannot file
to KSeF" alarm; a missing purpose is now accepted.

### Open items

1. **Audit immutability is enforced in code, not in the database.**
   `AuditLogService` only appends and nothing else calls the repository, but
   `MongoRepository` still inherits `save`/`delete`. A write-restricted MongoDB
   role or an insert-only view should back this at the infrastructure level.
2. **`regulaone_audit_logs` currently records only this one action.** Extending
   RegulaOne's other admin actions (invite, disable, permission change, plan
   change) onto the same service is follow-up work; until then the trail is
   deliberately narrow rather than complete.
3. **Audit write volume.** Every dashboard load appends an entry. The frontend
   loads once per visit and only refetches on the explicit Refresh button, so this
   is bounded — but an auto-refresh added later would multiply it.
4. **Query cost.** Roughly 45 count/aggregate queries per load, parallelised
   across six threads. All are index-backed on `tenantId` except the SafeWork join
   (`userId $in [company user ids]`, indexed on `userId`) and the WasteSync
   missing-month grouping. Fine at current data sizes; if a tenant grows to
   millions of rows, the per-module counts are the place to add caching.
5. **`spring.mongodb.uri` is a non-standard property key.** Spring Boot's
   documented key is `spring.data.mongodb.uri` (KSeFFlow's `application-prod`
   already uses the correct one, and SafeVoice's dev file carries a comment saying
   the old key is ignored). The running RegulaOne app was observed connecting to
   Atlas correctly, so it works today — but this is fragile across Spring versions
   and worth normalising. **Not changed here**: it is outside this task and would
   affect every module's configuration.
6. **⚠ Data residency.** The development Atlas cluster this was verified against
   reports region `AP_SOUTH_1` (Mumbai). CLAUDE.md §3 requires all production data
   to stay inside the EEA (AWS Frankfurt / Ireland / Azure EU). This is a
   pre-existing infrastructure issue, not introduced here, but it is a genuine
   GDPR/RODO transfer problem for any real personal data and should be addressed
   before production.
7. **Legal references need official confirmation** before they are shown to
   customers — see §6.
8. **Node module collection name coupling.** The activity feed hard-codes
   `auditlogs` for SafeWork, which is Mongoose's *derived* default (its model does
   not name a collection). If SafeWork ever declares an explicit collection name,
   that entry in `ActivityFeedReader.SOURCES` must be updated. The reader degrades
   to skipping the module rather than failing, so the symptom would be a quietly
   shorter feed.
