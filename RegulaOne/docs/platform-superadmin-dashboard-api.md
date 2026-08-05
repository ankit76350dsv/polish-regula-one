# Platform (SuperAdmin) Dashboard API

`GET /api/superadmin/overview` — the platform operator's commercial position across
every customer company, for the screen at `/company/:tenantId/overview` when the
viewer is `ROLE_SUPER_ADMIN`.

This endpoint already existed. It was **rewritten**, not created. What follows is why.

The third of three dashboards, each strictly narrower than the one above:

| | This dashboard | [Company admin](./company-admin-dashboard-api.md) | [Personal](./personal-workspace-dashboard-api.md) |
|---|---|---|---|
| Question | "How is the **business** doing?" | "Is my **company** compliant?" | "Am **I** in order?" |
| Scope | All customers, commercial only | One company's figures | One person's records |
| Role | `ROLE_SUPER_ADMIN` | `ROLE_ADMIN` | Any signed-in member |

Rewritten 2026-08-05. Verified against the live development database.

---

## 1. Files Modified

### Backend — `RegulaOne/backend`

| File | Change |
|---|---|
| `dto/Platform/PlatformOverviewResponse.java` | **Rewritten** — records instead of a Lombok bean, matching the other two dashboards. New blocks: `Tenants`, `Seats`, `Money`, `CurrencySeries`, `Plans`, `ModuleAdoption`, `WatchItem`. `complianceScore` removed. |
| `services/PlatformService.java` | **Rewritten** — currency-aware money, database-side user counting, a real adoption denominator, machine month keys, the watchlist, and the audit write. |
| `controllers/SuperAdminController.java` | `/overview` now takes the verified JWT and the request so the read can be audited. Other endpoints untouched. |

Tests: `services/PlatformServiceTest.java` (**new**, 10 unit tests, always run) and
`services/PlatformServiceIT.java` (**new**, 9 live-database tests, opt-in — see §7).

### Frontend — `RegulaOne/frontend`

| File | Change |
|---|---|
| `src/slices/platformOverviewSlice.js` | **New** — Redux Toolkit slice, so the last dashboard stops bypassing Redux. |
| `src/services/dashboardService.js` | Added `getPlatformOverview()`, next to the other two dashboard calls. |
| `src/services/tenantService.js` | `getPlatformOverview` removed (commented with the reason); this file is for *managing* tenants. |
| `src/store/reduxStore.js` | Registered the `platformOverview` reducer. |
| `src/lib/dashboardLabels.js` | Platform screen labels (PL + EN), `WATCHLIST_REASON_LABELS`, and `formatMoney` / `formatMoneyShort` / `formatMonth`. |
| `src/pages/Dashboard/Overview.jsx` | `SuperAdminView` rewritten. The mock activity table and `fmtRevenue` removed. `AdminView` and `UserView` untouched. |
| `src/hooks/useAuth.js` | `useLogout` also clears the platform slice. |

No changes to any of the six module applications.

---

## 2. Old Behaviour → 3. New Behaviour

The endpoint returned real data, so this was not a mock-removal job like the other two
screens. It was a **correctness** job. Nine defects, each with what replaced it:

### B1 — Currencies were added together

`AppPackage.currency` (ISO 4217) exists and was **ignored**. Every plan price was
summed into one `BigDecimal`, so a platform with PLN and EUR packages produced a
number that is not an amount in any currency. The frontend then printed a hardcoded
`€` in front of it.

**Now:** amounts are returned as a list, one entry per currency
(`monthlyRecurring`, `billingsByMonth`), and are **never converted** — this service
holds no exchange rate, and inventing one turns a billing figure into an estimate.
The browser formats with `Intl.NumberFormat` using the currency the server sent, so a
Polish operator sees `1 234,50 zł` and an English one `€1,234.50` from the same
response. Packages saved before the currency field existed default to **PLN**, applied
in one place, because a złoty price is the overwhelmingly likely case for this market.

### B2 — "Compliance Score" measured whether customers had paid

The old response carried `complianceScore`, e.g. `"99.8%"`, computed as *active
tenants holding an unexpired plan ÷ all tenants*. The screen displayed it as
**"Compliance Score"** with the note **"Target: 100%"**.

That figure has nothing to do with compliance. It measures billing. An operator
reading "Compliance Score 99.8%" would reasonably conclude the customers' KSeF
filings, GDPR registers and BHP records were in order — when the figure cannot see any
of those and, per §5, must not. This is the exact thing the project's AI rules forbid
("never generate fake compliance logic"), and on a compliance product it is the most
dangerous class of wrong number: reassuring, precise-looking, and quotable in a
customer conversation.

**Now:** gone, replaced by the `Plans` block — four honest counts: paid up, lapsed,
expiring within 30 days, and no plan at all. The screen labels them "Subscriptions"
and states in the card that this is billing, not compliance. A test asserts no
compliance-sounding field can return to the response.

### B3 — Module adoption forced the leading module to 100%

The DTO said `usagePct` was "% of active tenants whose package includes this module".
The code divided each module's **user** count by the count of the **most popular
module** — so the leading bar always read 100%, and no bar meant anything on its own.

**Now:** `ModuleAdoption` returns `tenantsEntitled`, `tenantsPct` (share of *active
customers* — a stated, fixed denominator) and `usersGranted`. Two figures, because
"the plan includes it" and "people were actually given it" are different facts and the
gap between them is the interesting one.

### B4 — The revenue chart and the revenue card were different quantities

`revenueByMonth` walks `packageHistory`, summing entries whose `planStarted` falls in
each month. **This is deliberate and correct** — `PackageService` maintains
`packageHistory` as a billing ledger with one entry per paid period, and its own
comment says the platform report counts one entry per period. So the series is
*billings by start month*.

The defect was the presentation. The card beside it (`monthlyRevenue`) summed *all
currently-active plan prices* — a recurring figure. Two different quantities, both
labelled revenue, guaranteed to disagree. Worse, `revenueTrend` was computed from the
**billings** series and displayed as the trend on the **recurring** card.

**Now:** the two are named for what they are and kept apart — `monthlyRecurring`
(live, unlapsed plans) and `billingsByMonth` (what was billed). Each currency's trend
is computed within that currency, from its own series. The chart's subtitle explains
that an annual plan is billed once, in the month it starts, so the difference is not
read as a bug.

### B5 — Trends were labelled as the wrong thing

`growthStr(newLastMonth, newThisMonth)` measures the change in the **signup rate**,
and the screen printed it next to the **total** "Active Tenants" card — where "+12%"
reads as "the customer base grew 12%".

**Now:** the field is `newTrend` on a `newThisMonth` figure, and the screen puts it on
its own "new this month" card, captioned "signups vs last month".

### B6 — Every user document on the platform was loaded to produce four integers

`userRepository.findAll()` pulled every user — names, e-mails, permission lists — into
memory so Java streams could count them, then looped over all of them six more times
for module usage.

**Now:** four `countDocuments` calls and one `$unwind`/`$group` aggregation. The
personal data never leaves MongoDB, and the work no longer grows with the user base.
`tenantRepository.findAll()` **stays on purpose**: the plan, price, currency, seat
limit, dates and billing ledger are all embedded in the tenant document, and tenants
are bounded by how many customers the business has. That asymmetry is documented on
the class.

### B7 — The one cross-customer read was not audited

Both other dashboards write an audit entry when opened. The dashboard that reaches
across **every** customer wrote nothing.

**Now:** `PLATFORM_OVERVIEW_VIEWED` is appended, with `tenantId` deliberately null —
that is what marks it as a platform-wide access rather than one customer's. Details
record the scope actually returned. Written in the service, where the other two do it,
so the controller does not reach for a repository.

### B8 — Month names were formatted in English on the server

`getDisplayName(TextStyle.SHORT, Locale.ENGLISH)` pinned the chart's X axis to
English on a Polish-first product.

**Now:** the server sends `"YYYY-MM"` and `formatMonth` produces `sie 2026` or
`Aug 2026` in the browser — the same convention the company dashboard already uses.

### B9 — The frontend bypassed Redux and had no error state

`SuperAdminView` used `useQuery(tenantService.getPlatformOverview)`, which put the
response outside Redux (project rule §26 mandates RTK for all API integration; the
other two dashboards comply) and **never read `error`** — so a failed call rendered
`—` in every card and the platform looked *empty* rather than *unreachable*.

**Now:** the `platformOverview` slice, with a first-load spinner, a real failure
screen with a retry button, and a stale-data warning when a refresh fails over
figures already on screen.

### Also removed: the invented activity table

`recentTenantActivity` was four hardcoded rows naming invented companies with invented
outcomes — including `"Nordic Services PL — GDPR DPIA Detection — FAILURE"`.

It was **not** replaced with a real activity feed, for three reasons: RegulaOne's own
audit trail currently records only dashboard views, so a truthful feed would say
almost nothing; even with more entries, watching which customer administrators are
logged in is closer to watching the customer than to running the platform; and it
would cross the boundary in §5.

**Now:** a server-built **watchlist** — which customers need a call and why, from plan
dates, account status and seat counts only. Sorted worst-first, capped at 25 with the
truncation logged rather than silent, and each row links to that customer.

---

## 4. Reason for Removing the Old Code

Summarised: nothing was deleted for style. Each change fixes a figure that was
either arithmetically meaningless (mixed currencies, a denominator that forced 100%),
mislabelled in a way that changes what a reader concludes (billing called compliance,
signup rate called growth, billings called recurring revenue), or a rule violation
(no audit on cross-customer access, English pinned server-side, Redux bypassed).

The `revenueByMonth` computation was **kept**, because reading `PackageService` showed
it was an intentional billings ledger — only its naming and framing were wrong. That
is the one place where the first-glance diagnosis was wrong and checking changed the
fix.

## 5. Security Impact

Unchanged authorisation: still `@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN'))` at
the class level, plus the `/api/superadmin/**` rule in `SecurityConfig`. No id is
taken from the URL.

**Improved audit position.** The cross-customer read now leaves a trace (B7). A
customer asking "who at DSV looked at our account?" can be answered from the trail.

**Less personal data in flight.** The user-counting rewrite (B6) means user documents
no longer leave the database to be counted in application memory.

**Frontend:** the platform snapshot names customer companies and what they pay, so
`useLogout` now clears it along with the other two slices.

## 6. Compliance Impact

**The processor boundary — the rule that shapes the whole response.** Under GDPR each
customer company is the **controller** of the personal data inside its modules;
RegulaOne is only the **processor** (Art. 4(7)–(8), Art. 28). A processor may process
that data only on the controller's instructions, and running a cross-customer
statistics screen for the platform's own commercial interest is not one of those
instructions.

So the response is restricted to commercial and operational facts — customer count,
account status, seat counts, plan prices and dates, which modules a plan includes.
It reads **none** of the six modules' collections: no invoice contents, no employee
names, no medical or BHP records, no whistleblower reports, no waste figures, no GDPR
register entries, and no per-customer compliance verdict. This is stated at the top of
the DTO, on the service class, and on the screen itself, so the *absence* of customer
compliance data reads as a rule rather than a missing feature.

**No invented compliance figure** (B2) — the specific rule against fake compliance
logic, and the reason it matters most on this screen of all three.

**Accountability (Art. 5(2))** — the read is audited (B7).

**Polish first** — every label has a Polish form, month names and money are formatted
in the reader's locale, and PLN is the default currency (B1, B8).

## 7. Testing Performed

| Test | Result |
|---|---|
| `PlatformServiceTest` (10 unit tests) | Pass |
| `PlatformServiceIT` (9 live-database tests, opt-in flag) | Pass |
| Full `./mvnw test` suite | Pass — 38 tests, 0 failures (opt-in ITs excluded from the default run) |
| `npx vite build` | Pass — 3151 modules, no errors |
| Field alignment: every top-level and nested field the screen reads exists on the DTO | Pass — 0 mismatches |
| Label coverage: every `text(...)` key and every watchlist reason the backend can emit has a PL + EN label | Pass — 0 missing |

```bash
./mvnw test -Dtest=PlatformServiceIT -Dregulaone.it=true
```

**What the IT is really guarding.** The rewrite moved user counting from Java into
MongoDB, and *a date filter that does not match the stored type does not fail — it
silently returns zero*. This project already has that trap for `LocalDate` fields
(stored as ISO text, so a date-vs-text comparison matches nothing). So the IT
recomputes every database-side count in Java over the same documents and asserts they
agree. It also asserts: no currency appears twice or blank, every chart month parses
as `YYYY-MM`, module shares never exceed 100% or claim more customers than exist, the
plan buckets account for every customer exactly once, `expiringSoon` is a subset of
the valid ones, the status counts add up, the watchlist carries only known commercial
reasons and is sorted RISK-first, seat utilisation is null rather than 0 when no plan
states a limit, and no compliance-sounding field is back on the response.

**Not yet done:** the screen has not been opened in a browser as a super admin, so
rendering is verified by the build, the field-alignment check and the label-coverage
check rather than visually.

## 8. Potential Risks or Side Effects

- **Breaking response change.** The DTO is reshaped, not extended — `activeTenants`,
  `totalUsers`, `monthlyRevenue`, `complianceScore`, `revenueByMonth` and `moduleUsage`
  are gone. This is safe here because the only consumer is `SuperAdminView`, updated in
  the same change (verified by grep). If any external client is ever pointed at this
  endpoint it will need the new shape, and at that point the endpoint should be
  versioned rather than reshaped again.
- **Keeping a lying field would have been worse than removing it**, which is why
  `complianceScore` was not retained as deprecated.
- **`tenantRepository.findAll()` remains.** Bounded by customer count, and needed for
  the embedded plan and ledger data. If the customer base ever reaches thousands, the
  revenue and watchlist passes are the first things to move into an aggregation.
- **`SEATS_EXCEEDED` costs one count per tenant that declares a seat limit.** Bounded
  by customer count and skipped entirely for tenants without a limit, but it is the
  one part of the watchlist that scales with customers rather than being free.
- **The watchlist is capped at 25.** The truncation is logged, not silent — but an
  operator with more than 25 problem accounts sees only the worst 25.
- **`expiringSoon` is intentionally double-counted** inside `activeWithValidPlan`: the
  plan still works today *and* still needs a renewal call. The IT asserts this
  relationship so it cannot be "fixed" into a wrong sum later.

## 9. Known Follow-Ups (not done here)

1. **RegulaOne's own audit trail records only dashboard views.** Plan changes, tenant
   status changes and permission grants — all performed through `SuperAdminController`
   — write nothing. That is a real accountability gap and the prerequisite for a
   truthful platform activity feed. It touches `PackageService`, `TenantController` and
   `UserService`, so it was left out of a dashboard change rather than expanded into
   silently.
2. **A company admin cannot reach their own personal workspace** (carried over from the
   personal dashboard work): `/company/:tenantId/overview` renders the company view for
   `ROLE_ADMIN`, so their own certificate expiry is not reachable from that route.
