# Personal "My Workspace" Dashboard API

`GET /api/me/overview` — one snapshot of what the **signed-in person** has to do
across all six RegulaOne modules, for the screen at `/company/:tenantId/overview`
when the viewer is not a company administrator (role `ROLE_USER`, and any other
signed-in role that opens it).

Companion of [`GET /api/admin/overview`](./company-admin-dashboard-api.md):

| | Admin dashboard | This dashboard |
|---|---|---|
| Question | "Is my **company** compliant?" | "Am **I** in order?" |
| Scope | Whole-company counts | Only the caller's own records |
| Role | `ROLE_ADMIN` only | Any signed-in member of a company |
| Endpoint | `/api/admin/overview` | `/api/me/overview` |

Built 2026-08-05. Backend verified against the live development database
(company `DSV TEAM`, id `6a34ca2d9d71d550dff0c3b6`).

---

## 1. Files Modified

### Backend — `RegulaOne/backend` (new files)

| File | Purpose |
|---|---|
| `dto/Dashboard/MyOverviewResponse.java` | The response shape. Reuses `Metric` / `ModuleCard` / `AttentionItem` / `ActivityEntry` from `CompanyOverviewResponse` so both screens format with the same browser code. Adds `Me`, `Headline`, `MyDocument`, `Rights`. |
| `repository/modules/personal/PersonalMetricsSupport.java` | Shared helpers for the personal readers: the `mine(...)` / `mineByObjectId(...)` owner criteria, document-status and days-until calculations. Extends the admin dashboard's `ModuleMetricsSupport`, so no query helper is duplicated. |
| `repository/modules/personal/PersonalSnapshot.java` | What one module contributes: `metrics` + `attention` + `documents`. |
| `repository/modules/personal/MyWorkPulseReader.java` | The person's own shifts, breaks, rest periods, overtime, absences. |
| `repository/modules/personal/MySafeWorkReader.java` | The person's own medical certificate and BHP training — validity dates only. |
| `repository/modules/personal/MyKsefFlowReader.java` | Only invoices this person created. |
| `repository/modules/personal/MyWasteSyncReader.java` | Only waste records this person entered. |
| `repository/modules/personal/MyPrivacyPilotReader.java` | Only GDPR records this person created or handles. |
| `repository/modules/personal/MySafeVoiceReader.java` | Only reports assigned to this person, and only for an authorised case handler. |
| `repository/modules/personal/MyRightsReader.java` | Whether privacy notices exist and who the DPO is — no register content. |
| `services/MyOverviewService.java` | The four access gates, parallel module reads, assembly, audit write. |
| `controllers/MyOverviewController.java` | The endpoint. |

Modified: `configs/SecurityConfig.java` (an explicit `"/api/me/**" → authenticated`
rule — behaviour unchanged, intent made visible), and
`repository/modules/ActivityFeedReader.java` (new `readForActor(...)` that filters
the existing cross-module audit feed to one person; the company-wide `read(...)`
is untouched).

Tests: `repository/modules/personal/PersonalMetricsSupportTest.java` (11 unit
tests, always run) and `services/MyOverviewServiceIT.java` (3 live-database tests,
opt-in — see §7).

### Frontend — `RegulaOne/frontend`

| File | Change |
|---|---|
| `src/slices/myOverviewSlice.js` | **New** — Redux Toolkit slice: `fetchMyOverview` thunk, `status` / `data` / `error` / `loadedAt`, `clearMyOverview`, selectors. |
| `src/services/dashboardService.js` | Added `getMyOverview()`. |
| `src/store/reduxStore.js` | Registered the `myOverview` reducer. |
| `src/lib/dashboardLabels.js` | Added Polish + English labels for every `my.*` metric and `MY_*` to-do code, plus `STATUS_VALUE_LABELS`, `DOCUMENT_TYPE_LABELS`, and `TEXT` / boolean value formatting. |
| `src/pages/Dashboard/Overview.jsx` | `UserView` rewritten against the slice. `AdminView` and `SuperAdminView` untouched. |
| `src/hooks/useAuth.js` | `useLogout` now clears both dashboard slices before the session ends. |

No changes were made to any of the six module applications.

---

## 2. Old Behaviour

`UserView` in `Overview.jsx` was entirely hard-coded:

- four stat cards read `'3'` pending tasks, `'12'` invoices, `'OK'` compliance
  status, `'08:00–16:00'` shift, `'Clocked in'`;
- "My Tasks" was a fixed list of five sentences (`'Submit June waste report by
  30.06'`, `'Sign updated GDPR consent form'`, …);
- "My Compliance Documents" listed four invented documents with invented expiry
  dates, three of them marked `VALID`.

Nothing on the screen touched the database.

## 3. New Behaviour

One request, `GET /api/me/overview`, fills the whole screen:

- a **blocked-from-work banner** above everything else when SafeWork has blocked
  the person's clock-in;
- headline tiles — shift status today, hours and overtime this month, "may I work
  today?", open and overdue actions, modules available;
- **what I have to do** — the person's own obligations, worst first, each carrying
  the legal rule behind it and linking to the module that fixes it;
- **my compliance documents** — real expiry dates and days remaining;
- **my rights** — privacy notices, DPO contact, whistleblowing channel (§6);
- one card per module with the person's own figures, or the reason it has none
  (`NOT_IN_PLAN` / `NO_ACCESS` / `RESTRICTED` / `UNAVAILABLE`);
- **what has been recorded under my name** — the person's own audit lines.

A tile whose module the person cannot see is **left out**, never shown as `0`.

## 4. Reason for Removing the Old Code

The admin mocks were removed because invented figures hide real missed deadlines.
Here the consequence is sharper: this is the screen an employee looks at to decide
whether they may start work.

A hardcoded `Medical Certificate — VALID` tells somebody they are cleared to work
when their certificate may in fact have lapsed. Under Kodeks pracy art. 229 §4 the
employer may not admit them to work without a current occupational medical
examination, and art. 237³ says the same for BHP training. SafeWork already blocks
clock-in for exactly this — so the dashboard was contradicting the enforcement that
sits behind it. A reassuring green row in that situation is worse than no row.

The five fake tasks had the same defect in the other direction: real obligations
(an overdue absence request, a rejected KSeF invoice, an unacknowledged monitoring
notice) were invisible because the list never looked at anything.

## 5. Security Impact

Improved. Four gates are applied, narrowest answer wins:

1. **Company** — taken from the verified session token's `sub`, never from the URL.
   There is deliberately **no `{userId}` or `{tenantId}` path variable**: an id in
   the address bar invites someone to change it. The `/company/:tenantId/` segment
   the browser shows is display-only and the server ignores it.
2. **Plan** — a module the company does not pay for is reported `NOT_IN_PLAN` and
   is never queried.
3. **The person** — a module they were not granted is `NO_ACCESS` and never
   queried; the same rule the sidebar uses, so the dashboard can never show more
   than the menu allows.
4. **The person again, inside every query** — each reader also filters on the
   caller's own user id. This is the gate the company dashboard does not need, and
   it is what makes an employee with WorkPulse access see their own shifts rather
   than the team's.

SafeVoice has a **fifth** gate: the card also requires a `SAFEVOICE_*` permission,
because handling whistleblower reports is a separate authority from having the
module in the menu (Directive (EU) 2019/1937 Art. 16; ustawa o ochronie
sygnalistów). Without one the card is `RESTRICTED` and no whistleblower query runs.

The endpoint is open to every signed-in role, which is correct — it returns only
the caller's own records, and a company administrator is also an employee with
their own certificate and their own shifts.

Read-only. The single write it performs is an append-only audit entry.

Frontend: `useLogout` now clears both dashboard slices. `ssoLogout()` redirects the
browser, which discards the store anyway, but the redirect is not guaranteed (a
blocked navigation, or a session dropped by the token-refresh cycle without a
redirect). One person's own certificate dates must not be left in memory for
whoever signs in next on a shared machine.

## 6. Compliance Impact

**Data minimisation (GDPR Art. 5(1)(c)).** An employee never sees a colleague's
figure or a company total. Whole-company oversight is a manager's job and stays on
`/api/admin/overview`.

**Special-category data (GDPR Art. 9).** The medical block carries the validity
date, a status word and the `required` flag — no findings, no diagnosis, no doctor,
no PESEL, no date of birth, no document path. Only those fields are `include`d in
the query, so nothing more leaves the database. The screen says this out loud, so
nobody fears their medical results are on a dashboard.

**Accountability (GDPR Art. 5(2)).** Every load appends `MY_OVERVIEW_VIEWED` to
RegulaOne's immutable audit trail, recording *which modules were returned* — what
the person was shown, not merely that they opened a page.

**Transparency (GDPR Art. 13–14).** The `rights` block puts the privacy notices and
the DPO's contact details on the screen every employee opens, which is the plainest
way to satisfy Art. 13(1)(b). It is gated on the **company's plan, not the person's
module grants** — being told how your data is used is the person's own right, not a
feature an administrator must first tick.

**Whistleblower Protection Act** (ustawa z 14.06.2024, Dz.U. 2024 poz. 928,
implementing Directive (EU) 2019/1937). The same block states whether an internal
reporting channel exists and links to it. The act requires the internal procedure
to be communicated to the people who may use it — a channel nobody knows about does
not meet that duty. Note this is only "a channel exists": no case data, and the
figures still require the SafeVoice permission.

**Kodeks pracy.** Every figure carries its `legalRef`, so a missing break reads as
an art. 134 issue rather than an app warning. Covered: art. 229 §4 (medical),
art. 237³ (BHP), art. 132–133 (daily and weekly rest), art. 134 (break),
art. 151 §3 (150-hour yearly overtime limit), art. 131 (48-hour average week).

**Polish first.** Every metric, to-do item, status word and screen label has a
Polish form. The API sends only machine codes and machine values; wording and
locale formatting live in `dashboardLabels.js`, so `"126.5"` renders as `126,5 h`
for a Polish user from the very same response.

## 7. Testing Performed

| Test | Result |
|---|---|
| `PersonalMetricsSupportTest` (11 unit tests) | Pass |
| `MyOverviewServiceIT` (3 live-database tests, run with the opt-in flag) | Pass |
| Full `./mvnw test` suite | Pass — 28 tests, 0 failures (the opt-in ITs are excluded from the default run) |
| `npx vite build` | Pass — 3150 modules, no errors |
| Label coverage: every `my.*` metric key and every `MY_*` to-do code the backend can emit has a Polish + English label; every `text(...)` key the screen uses is defined | Pass — 0 missing |

The integration test is opt-in, because it reads the live development database and
— correctly — appends one audit entry, exactly as a real page load would:

```bash
./mvnw test -Dtest=MyOverviewServiceIT -Dregulaone.it=true
# optionally pin it to one person:
./mvnw test -Dtest=MyOverviewServiceIT -Dregulaone.it=true \
            -Dregulaone.it.userEmail=someone@example.com
```

Without `-Dregulaone.it.userEmail` it picks any member of a company that has
modules. What it guards is that the workspace stays *mine*: the response is built
for the caller's own id and company, out-of-plan and ungranted modules return no
figures, SafeVoice without a permission is `RESTRICTED`, **every metric key starts
with `my.`** (a company-wide figure pasted into a personal reader fails the build
here), the activity feed contains only this person's lines, and the read reaches
the audit trail with its module scope.

**Not yet done:** the screen has not been opened in a browser against a `DSV TEAM`
member, so the rendering is verified by the build and the label-coverage check
rather than visually.

## 8. Potential Risks or Side Effects

- **Two dashboards on one route.** `/company/:tenantId/overview` renders
  `AdminView` for `ROLE_ADMIN` and `UserView` otherwise, as it did before. A
  company administrator therefore does **not** see their own certificate expiry on
  that screen — they see the company view. Their personal figures are available at
  the same endpoint, but nothing links them there yet. Worth a follow-up.
- **Audit volume.** Every load of the personal dashboard appends one audit entry,
  and this screen is opened far more often than the admin one. The trail is
  append-only with a 10-year retention duty, so growth on `audit_logs` should be
  watched; the existing indexes cover the read paths.
- **`UNAVAILABLE` is honest, not silent.** A module that times out (12 s ceiling,
  shared pool) shows "figures could not be read" rather than zeroes. This is
  deliberate — but it means a slow module is visible to every employee, not just to
  an administrator.
- **Both dashboards share one thread pool** (`DashboardConfig`, six threads). Many
  employees loading their workspace at shift start compete with an administrator's
  company read. If that shows up under load, the pool size is the dial.
- **SafeWork profile absence is common.** A person whose HR record was never
  created gets `NO_PROFILE` and a "ask HR to set it up" item rather than an error.
  Expected, but it will be the most frequent to-do item on a new tenant.
