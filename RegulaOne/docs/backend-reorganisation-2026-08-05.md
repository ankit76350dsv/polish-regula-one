# RegulaOne backend — reorganisation and DRY pass

**Date:** 2026-08-05
**Scope:** `RegulaOne/backend` only. No other module was touched except two stale
documentation links.
**Guarantee:** **every HTTP endpoint is unchanged** — same URL, method, query and path
parameters, request body, response body and authorisation rule. This is not a claim, it is
enforced by a test (see §7).

---

## 1. Files modified

### 1.1 The new package layout

The backend was a layer-first tree (`controllers/`, `services/`, `dto/`, `repository/`) in
which one feature was spread across four directories. It is now grouped by **domain**, so
everything about one subject sits together:

```
com.regulaone.backend
├── auth/            sign-in, registration, passwords, SSO cookies   (+ auth/dto)
├── user/            accounts, team management, invitations          (+ user/dto)
├── tenant/          the customer organisation                       (+ tenant/dto)
├── billing/         plan catalogue, subscriptions, invoices         (+ billing/dto)
├── dashboard/       the three overview screens                     (+ dto, reader/, support/)
├── notification/    the notification hub and internal messaging     (+ notification/dto)
├── common/          response envelope, error handling, shared web helpers, audit/
├── config/          Spring/AWS/security configuration (renamed from `configs`)
└── models/          persistence entities — DELIBERATELY NOT MOVED, see §8.1
```

### 1.2 Controllers: 13 → 11

| Before | After | Why |
|---|---|---|
| `AdminController` | `user/AdminUserController` | It was a bucket for four unrelated subjects. Org setup/update moved to `tenant/TenantController`, plan list + billing to `billing/SubscriptionController`; what is left is team management, which is what it is now named for. |
| `SuperAdminController` | `user/PlatformUserController` | Same idea from the operator's seat; `/overview` moved to the dashboard controller. |
| `UserController` | `user/TenantUserController` | Named for what it serves: the staff list other module apps read. |
| `PackageController` | `billing/SubscriptionController` | Now also holds the two company-admin billing routes, so billing is described in one place. |
| `CompanyOverviewController`<br>`MyOverviewController`<br>(`SuperAdminController./overview`) | `dashboard/DashboardController` | One feature (an audited read-only snapshot) seen by three audiences, previously spread over three files. |
| `EmailController`<br>`NotificationIngestController` | `notification/InternalMessagingController` | Both are service-token-guarded machine-to-machine endpoints, and each carried its own copy of the token check. |
| `HealthController` | `common/HealthController` | Operational, not domain. |
| `AuthController`, `SSOController`, `NotificationController`, `TenantController` | moved into their domain package | unchanged responsibilities |

### 1.3 Services: the god class is gone

`UserService` was **929 lines** doing four unrelated jobs. Every method kept its exact
behaviour; only its home changed:

| Moved out of `UserService` | New home | What it is |
|---|---|---|
| signup, confirm, resend, login, challenge, refresh, change/forgot/reset password | `auth/AuthService` (new) | credentials |
| invite, update, modules, permissions, status, e-mail preference, delete | `user/UserAdminService` (new) | writes to user accounts |
| `setupOrganisation`, `updateMyOrg` | `tenant/OrganisationService` (new) | the company, self-service |
| `getActivePackages` | `billing/PackageService` | the plan catalogue |

`UserService` is now **~190 lines**: reads and the person's own profile.

`PackageService` (696 lines) was split along the same seam:

| | Owns |
|---|---|
| `billing/PackageService` | the plan CATALOGUE — create/edit/retire/list, tier statistics |
| `billing/SubscriptionService` (new) | what a CUSTOMER is on — renew, change plan, the plan-history ledger, tier-change history, CSV export |

### 1.4 New shared classes (all created to remove duplication)

| Class | Replaces |
|---|---|
| `common/ServiceTokenGuard` | two identical copies of the `X-Service-Token` + constant-time-compare check |
| `common/PageRequests` | two identical copies of the page/size/sort/cap construction |
| `dashboard/support/ModuleAccessPolicy` | five access-decision methods duplicated between the company and personal dashboards |
| `dashboard/support/ModuleReads` | the parallel-read timeout, the attention-list ordering and the open/overdue tally, all duplicated between the same two services |
| `notification/NotificationScopeResolver` | three lines of caller/tenant/module resolution repeated at the top of ten controller methods |
| `auth/SSOService.issueSessionCookies` / `refreshSessionCookies` / `clearSessionCookies` | four-cookie blocks written out four times in `SSOController`, including a magic `30 * 24 * 60 * 60` |
| `user/UserService.currentTenantId` | `getCurrentUser(sub).getTenantId()` spelled out in three controllers |
| `UserAdminService.changeStatus` / `changeEmailNotification` | two pairs of near-identical public overloads (~60 duplicated lines of validation and guard logic) |

### 1.5 Dead code removed

Provably unreferenced by anything (verified by searching the whole source tree):

- `models/TenantPackage.java`, `repository/TenantPackageRepository.java` — the old
  junction-table approach. `PackageService` already documented that it had been replaced by
  the embedded `Tenant.currentPackage`, and nothing called either class.
- `dto/Package/TenantPackageResponse.java`, `dto/Package/TenantPackagesResponse.java` — DTOs
  for that removed approach.
- `dto/Tenant/TeamManagementStatsRes.java` — a stale duplicate of
  `TeamManagementStatsResponse`.
- Large commented-out blocks: the previous `getTierChanges` implementation, `validateDates`,
  `syncTenantModules`, and the author's own `// ! remove this` notes in
  `CognitoJwtConverter`. Short one-line "OLD: X moved to Y" design notes were **kept** —
  they explain decisions rather than hide dead code.

### 1.6 Documentation kept in step

- `RegulaOne/docs/{company-admin,personal-workspace,platform-superadmin}-dashboard-api.md` —
  the "where the code lives" tables now point at the real paths.
- `KSeFFlow/docs/integration.md` — its link to `UserService.updateUserPermissions` now points
  at `UserAdminService`.

---

## 2. Old behaviour

Working, but hard to change safely:

- One 929-line `UserService` was a dependency of almost everything, so authentication,
  billing, team management and organisation setup all changed the same file.
- Four subjects shared one `AdminController`, and one subject (the overview screens) was
  spread across three controllers.
- The same rule existed in two or more places: the internal-token check, the page-size cap,
  the dashboard access gates, the session-cookie set, the user-status guards.
- A controller (`NotificationController`) queried `UserRepository` directly, skipping the
  service layer.
- Finding a feature meant knowing which of four layer directories to open.

## 3. New behaviour

**None. That is the point.** The runtime behaviour of all 66 endpoints is identical:
same paths, methods, parameters, validation, exception mapping, response envelope, status
codes, message strings and `@PreAuthorize` rules. What changed is where the code lives and
how many times each rule is written down.

## 4. Reason for removing / changing the old code

- **The god class.** A class that changes for four different reasons violates single
  responsibility and makes every change a merge risk. Splitting it along the seams that
  already existed in the comments (`// --- Public Auth ---`, `// --- Admin ---`) cost nothing
  behaviourally.
- **Duplicated rules.** A security rule written twice is a security rule that will eventually
  disagree with itself. The token check, the seat/page caps and the dashboard access gates
  are now single implementations.
- **Layer-first packages.** They optimise for "show me all the DTOs", which nobody asks, over
  "show me everything about billing", which everybody asks.
- **Repository access from a controller.** Explicitly forbidden by `CLAUDE.md` §22, and it
  bypassed the service layer where the tenant-isolation rule belongs.
- **Dead code.** Five unreferenced classes and ~120 lines of commented-out implementations
  were teaching future readers about a design that no longer exists.

## 5. Security impact

**Neutral-to-positive. No authorisation rule was weakened.** Verified per endpoint by the
contract test, which records the effective `@PreAuthorize` expression for all 66 routes.

Improvements:

- The internal service-token check exists **once** (`ServiceTokenGuard`), still fail-closed
  when unconfigured (503) and still constant-time.
- The dashboard access gates (plan → person → SafeVoice case-handler authorisation) exist
  **once**, so the company and personal screens cannot drift apart on who may see
  whistleblower data.
- `NotificationController` no longer reaches into the database; the caller/tenant/module
  scoping is enforced by one resolver every method must call.
- The page-size cap is enforced in one place, so a new list endpoint cannot forget it.
- The protected-permission rule (`KSEF_PLATFORM_ADMIN` cannot be self-granted by a company
  admin) is unchanged and now sits with the other user-write guards, documented as one of
  four named rules.

Deliberately preserved rather than "improved":

- `GET /api/superadmin/tenants` still has **no** method-level `@PreAuthorize`; it is protected
  by SecurityConfig's `/api/superadmin/**` rule. Adding the annotation would have been
  harmless but would have changed the recorded contract, so it is left as-is with a comment
  explaining where its protection comes from. Listed in §9 as a follow-up.
- The asymmetry between the delete and suspend last-admin checks (deletion also checks when
  the user has no organisation) is kept exactly, with a comment.

## 6. Compliance impact

**Neutral.** No change to audit logging, data residency, retention, encryption or tenant
isolation.

- All three audited dashboard reads still write the same append-only entry with the same
  action codes (`COMPANY_OVERVIEW_VIEWED`, `MY_OVERVIEW_VIEWED`,
  `PLATFORM_OVERVIEW_VIEWED`) and the same "what was actually shown" detail list
  (GDPR Art. 5(2)).
- `AuditLogService` moved to `common/audit/` because audit writing is cross-cutting by
  nature; it is still append-only, still fail-open with a loud log, still the only caller of
  its repository.
- Data minimisation in the module readers is untouched — counts, totals and dates only.
- One small hardening: the default starter-plan id in organisation setup was a hardcoded
  string literal; it is now `${regulaone.default-package-id:...}` with the same value as its
  default (`CLAUDE.md` §22 "always use environment variables"). Behaviour with no property
  set is identical.

## 7. Testing performed

**A new contract test was written FIRST, before any code moved:**
`src/test/java/com/regulaone/backend/ApiSurfaceTest.java` boots the Spring context, walks
every `RequestMappingHandlerMapping` entry belonging to this application, and compares the
result against a golden file, `src/test/resources/api-surface.txt` (66 endpoints). Per
endpoint it pins:

- HTTP method(s) and URL pattern(s)
- required query-parameter conditions
- the effective `@PreAuthorize` expression (method, else controller, else "none")
- the handler's full parameter list with annotations — so a dropped `@PathVariable`, a
  renamed `@RequestParam`, a changed `@CookieValue` name or a swapped request-body type all
  fail the build
- the response type

It deliberately does **not** pin the controller class, which is exactly what this refactor
was allowed to change.

| Check | Result |
|---|---|
| `./mvnw test` — 39 tests | **all pass** (38 pre-existing + the new contract test) |
| `ApiSurfaceTest` — all 66 endpoints vs the pre-refactor golden file | **byte-identical** |
| `BackendApplicationTests` — full Spring context loads (every bean wires) | pass |
| `PlatformServiceTest` (10), `ModuleMetricsSupportTest` (11), `PersonalMetricsSupportTest` (11), `SafeWorkEmployee*` (3), `PasswordRecoveryServiceTest` (2) | pass |
| `mvnw compile` / `test-compile` | clean |

Not run (unchanged, and both need a live database — they are opt-in by design):
`CompanyOverviewServiceIT`, `MyOverviewServiceIT`, `PlatformServiceIT`,
`ModuleMetricsReaderIT`. Run them with
`./mvnw test -Dtest=…IT -Dregulaone.it=true` before deploying.

Regenerate the golden file only when an API change is intended:
`./mvnw test -Dtest=ApiSurfaceTest -Dapi.surface.write=target/api-surface.txt`, then copy it
over `src/test/resources/api-surface.txt` **in the same commit**, so the change is visible in
review.

## 8. Potential risks and side effects

### 8.1 Why `models/` was NOT moved (the one deliberate exception)

Spring Data MongoDB writes a `_class` field into every document containing the entity's
**fully-qualified class name**. Moving `models.User`, `models.Tenant`, `models.AppPackage`
etc. into their domain packages would change the value written into newly-saved documents,
leaving the collections with a mix of two type hints — and those collections are also read by
other RegulaOne services. The brief says database behaviour must not change, so the entities
stay at `com.regulaone.backend.models`. They read as the shared domain model, which is a
defensible home for them; moving them later would need a data migration or a `@TypeAlias`
decision, not just a refactor.

### 8.2 Real risks

| Risk | Assessment |
|---|---|
| A moved endpoint silently changes | Covered by `ApiSurfaceTest` at the level of path, method, parameters, response type and authorisation. |
| Spring cannot wire the new beans | Covered — `BackendApplicationTests` loads the whole context; new services and components are constructor-injected. |
| Response **body content** changed | Not covered by the contract test (it pins types, not JSON). Mitigated by DTO classes and their `from(...)` mappers being untouched, and by every moved method keeping its body statement-for-statement. **A smoke test of the main screens before release is still worth doing.** |
| Merge conflicts with in-flight branches | High, and unavoidable: 116 files moved. Reviewers should use `git log --follow` / `git diff -M` — every move was made with `git mv`, so rename detection works. |
| An IDE or script referencing old fully-qualified names | Searched the whole repository for the old package names; the only hits were the two documentation links, now updated. |
| `_class` on the two deleted entity types | `TenantPackage` had its own unused collection; nothing reads or writes it. Deleting the class means its `@CompoundIndex` is no longer auto-created on a collection nobody uses. |

## 9. Noted, not changed (recommended follow-ups)

Found while reading; each is out of scope for a behaviour-preserving refactor and is left for
a deliberate decision:

1. **`CognitoJwtConverter` logs identity data at INFO on every single request** — the subject,
   the resolved authority and the whole `JwtAuthenticationToken` (whose principal is the
   person's e-mail). `CLAUDE.md` §17 says never log sensitive PII. The fix is a one-line move
   to `debug`, but log output is observable behaviour for operations, so it is flagged rather
   than changed silently.
2. **`GET /api/superadmin/tenants` has no method-level `@PreAuthorize`** (see §5). Worth adding
   for defence in depth, together with a golden-file update.
3. **`TenantService.getTenantById` and `SSOService.decodeState` have no callers.** Both are
   plausible parts of a public service contract (`decodeState` is the pair of the
   `encodeState` the SSO flow does use), so neither was deleted. Worth a decision.
4. **`getTeamManagementStats(tenantId)` calls `Integer.parseInt(usersCapacity)`** on a free-text
   field, so a plan whose capacity reads "Unlimited" would throw. Other code paths already
   parse this defensively (`PlatformService.seatLimitOf`, `CompanyOverviewService.parseCapacity`);
   this one does not. Pre-existing, and fixing it would change behaviour.
5. **`AppResponse.error(...)` shapes are built by hand inside `SSOController`** for the 401
   session-expired cases. Consistent with the envelope, but the global exception handler could
   own them.
