# PrivacyPilot — Production Readiness, Security & Compliance Audit

**Scope:** PrivacyPilot module only — `PrivacyPilot/backend` (Spring Boot) and
`PrivacyPilot/frontend` (React/Vite). RegulaOne is inspected only where PrivacyPilot
depends on it (session cookie flags, `/api/auth/me`).
**Date:** 2026-07-29
**Method:** direct code inspection with `file:line` evidence; `npm audit` executed
locally; compliance conclusions verified against official EU/Polish government sources
only (European Commission, UODO, Sejm ELI/ISAP, biznes.gov.pl). Anything that could not
be confirmed from the code or an official source is marked **Unable to verify** — it is
never assumed compliant.

> **Supersedes the 2026-07-29 earlier draft of this file.** That draft was cut short by
> an API spend limit and contained two conclusions this pass **corrects**:
> (a) it stated "no Content-Security-Policy" — a CSP *is* built and injected
> (`frontend/vite.config.js:28-73`); (b) it framed the npm advisories as a runtime
> `react-router` CSRF exposure — 5 of the 7 come from the `shadcn` CLI, which is never
> imported by app code and never reaches the browser bundle (§4.4). This pass also adds
> findings the earlier draft missed entirely (H1, H2, H3, M1, M5).

---

## 1. Executive Summary

PrivacyPilot's **domain layer is genuinely well built**. Tenant isolation is enforced on
every repository query from the server-resolved session, RBAC is applied on all 47
endpoints, the audit trail is append-only at the database layer, legal clocks (72 h,
1 month + 2 months) are computed server-side, and the DPIA verdict rule matches UODO's
published "two criteria" test. Ten of eleven feature domains run on the real backend.

It is **not production-ready**, for three distinct classes of reason:

1. ~~**Authorization is incomplete in a way the frontend hides.**~~ **✅ FIXED 2026-07-29
   — see §17.** The backend did not check whether the account was enabled, whether the
   subscription was live, or whether the tenant licensed the module; those checks existed
   only in the browser, so a disabled user kept full API access until their token expired.
   The rules are now enforced server-side in `security/PrivacyPilotAccessPolicy.java`,
   called from `RegulaOneAuthClient.resolve()` before any controller runs, and covered by
   15 hermetic tests.
2. ~~**Accountability has a hole where it matters most.**~~ **✅ FIXED 2026-07-29 — see
   §17.** `AuditAction.EXPORT` was defined and never written: every export — the full
   Art. 30 register CSV, the audit trail itself, notices, breach reports — happened
   entirely in the browser and left no server-side record, so bulk extraction of the
   register was invisible to the audit trail that exists to prove accountability
   (GDPR Art. 5(2)). All eight export paths now record an immutable EXPORT entry via
   `POST /api/privacypilot/exports` before any file, print view or clipboard copy is
   produced, and abandon the export if that record cannot be written.
3. **The operational layer does not exist yet.** No production profile, no container, no
   CI/CD, no health/metrics, no rate limiting, no TLS configuration, no field-level
   encryption, no runnable test suite, no retention or erasure job. Additionally
   **nothing in `backend/src/main/resources/` is version-controlled** (both properties
   files are gitignored), so a clean clone cannot be configured or built reproducibly.

The good news: almost every gap is **additive**. None of them requires rewriting the
working domain code.

---

## 2. Overall Production Readiness Score

### **61 / 100 — ❌ Not Production Ready**

*(54 at first assessment; +3 for H1 and +4 for H2, both fixed 2026-07-29 — see §17.)*

| Layer | Score | Basis |
|---|---:|---|
| Domain code & architecture | 80% | Clean layering, tenant scoping and audit verified end-to-end |
| Feature completeness | 85% | 10/11 domains real; AI assistant mock; no erasure/export paths |
| Authentication & authorization | 80% | Auth + RBAC solid; **entitlement gate now enforced server-side (H1 fixed)**; residual: 30 s cache window, frontend/backend matrix drift (M6) |
| Security hardening | 40% | No rate limiting, no field encryption, no TLS config, weak DTO limits |
| Compliance (GDPR/Polish mapping) | 75% | Feature-to-article mapping is accurate; **export accountability now recorded (H2 fixed)**; retention/erasure gaps remain |
| Database & performance | 45% | No pagination, no compound indexes, no transactions, full-collection reads |
| Ops / infra / deploy | 15% | No prod profile, Docker, CI/CD, observability; config not in git |
| Testing | 20% | Still far from the 80% target, but **25 hermetic tests** now exist (access policy + export accountability, §17); the original context-load test still needs the live Atlas cluster |

---

## 3. Feature Completion Report

Transport evidence: `frontend/src/services/*` — an import of `./client` means the real
backend; `./api` + `mockData.js` means the browser mock.

| Feature (legal basis) | Backend endpoint | Frontend transport | Status |
|---|---|---|---|
| ROPA / processing activities (Art. 30) | `/api/privacypilot/activities` | real | ✅ |
| DPIA (Art. 35) | `/api/privacypilot/dpias` | real | ✅ |
| Privacy notices (Art. 13/14) | `/api/privacypilot/notices` | real | ✅ ¹ |
| Vendors / processors (Art. 28) | `/api/privacypilot/vendors` | real | ✅ |
| International transfers (Ch. V) | `/api/privacypilot/transfers` | real | ✅ |
| Breaches (Art. 33/34) | `/api/privacypilot/breaches` | real | ✅ ² |
| DSAR (Art. 15–22) | `/api/privacypilot/dsars` | real | ✅ |
| Settings (DPO + AI; company read-only) | `/api/privacypilot/settings` | real | ✅ |
| Dashboard | `/api/privacypilot/dashboard` | real | ✅ |
| Audit trail (Art. 5(2)) | `/api/privacypilot/audit` | real | ⚠️ read-only, exports unlogged (H2) |
| Users / RBAC | delegated to RegulaOne | real | ✅ ³ |
| **AI assistant** | **none** | **mock (`aiService.js` → `api.js` → `mockData.js`)** | ⚠️ **mock only** |

¹ Notice *text* is compiled in the browser (`lib/noticeBuilder.js`); the server owns the
version number, the covered-activity links and the completeness gate
(`NoticeService.java:87-124`).
² Notifications are **recorded**, not transmitted — correct by design; UODO has no
filing API (§10.3).
³ User mutations go straight to RegulaOne's admin API (`services/userService.js:37-55`),
so `AuditAction.INVITE` / `ROLE_CHANGE` / `ACTIVATE` / `DEACTIVATE` are never written to
PrivacyPilot's own trail.

**Placeholder / unfinished-work scan.** No `TODO`, `FIXME` or `HACK` markers in
`backend/src/main/java`. Zero `console.*` or `debugger` in the frontend. One dev-only
wizard prefill, correctly gated to `import.meta.env.DEV`
(`pages/Ropa/ActivityWizardPage.jsx:184`) and therefore stripped from production builds.
**The AI assistant is the only mock implementation left** — but see M5: it is not inert.

---

## 4. Security Assessment

### 4.1 Verified strengths

| Control | Evidence |
|---|---|
| **Multi-tenant isolation** | Every finder is tenant-scoped (`repository/*.java` — `findByTenantId…`, `findByIdAndTenantIdAndDeletedFalse`). `tenantId` always comes from the resolved session (`AuthenticatedUser.tenantId()`), never from a client body, header or path. The only unscoped finder is `TenantRepository.findById`, called with the caller's *own* tenant id (`TenantSettingsService.java:108`). |
| **Authentication** | httpOnly `idToken` cookie forwarded to RegulaOne `GET /api/auth/me`; JWT signature verified upstream at the auth authority. Explicit connect/read timeouts so a hung RegulaOne cannot pin threads (`RegulaOneAuthClient.java:51-54`). No auth token is ever readable from JS. |
| **Cookie flags (previously "unable to verify")** | `RegulaOne/backend/.../SSOService.java:47-52` — `httpOnly(true)`, `secure(configurable)`, `sameSite` from config; default `Lax` (`SSOConfig.java:50`). `SameSite=Lax` blocks cross-site POST/XHR, which is the main CSRF mitigation here. |
| **Authorization** | All 10 controllers declare `AuthenticatedUser caller` on **every** mapping (the implicit auth gate) **and** call `caller.requireAnyPermission(...)`, which throws 403 (`AuthenticatedUser.java:77-83`). Verified method-by-method across all 47 endpoints. |
| **Server-owned state** | Clients cannot forge lifecycle state: activity status is sanitised (`ProcessingActivityService.java:231-234`), DPIA `APPROVED` reachable only by signing, breach/DSAR notification timestamps are server-stamped, DPIA verdict recomputed server-side. |
| **Separation of duties** | DPIA needs two distinct sign-off lines and a signer may only sign their own line (`DpiaService.java:153-189`). |
| **Immutable audit trail** | Enforced at the DB layer, not by convention: `AuditEntryImmutableListener` blocks update *and* delete for the whole collection (`listener/AuditEntryImmutableListener.java:38-57`); `AuditService` only ever `insert()`s. |
| **Error handling** | Every exception funnels through `GlobalExceptionHandler`; unexpected ones log server-side and return a generic message (`GlobalExceptionHandler.java:67-72`). No stack traces leak. Only two log statements exist in the whole backend and neither logs PII. |
| **Injection** | Spring Data derived queries only — no string-concatenated Mongo queries, no `$where`, no aggregation built from user input. NoSQL-injection risk low. |
| **SSRF** | The single outbound target is a config-fixed base URL (`RegulaOneAuthClient.java:46`); no user-influenced URL is ever fetched. |
| **XXE / RCE / path traversal / file upload** | No XML parsing, no deserialisation of untrusted formats, no filesystem paths from user input, and **no upload endpoint at all** (`grep MultipartFile` → 0). These attack classes are absent by construction. |
| **CORS** | Explicit config-driven allow-list, not a wildcard, with `allowCredentials(true)` — correct for the cookie model (`WebConfig.java:36-43`). |
| **CSP** | Built and injected at build time with a sensible policy — `script-src 'self'`, `object-src 'none'`, `connect-src` limited to the two API origins, self-hosted fonts (no CDN, which also helps EEA residency) (`vite.config.js:28-73`). See M4 for its delivery limitation. |
| **DevTools** | `spring-boot-devtools` is `optional` + `runtime` scope, so it is excluded from the production jar (`pom.xml:69-74`). |
| **Secrets** | No secret is committed. `git ls-files backend/src/main/resources/` is empty; `.env` is gitignored; the Postman collection contains no tokens or connection strings. |

### 4.2 Findings — High

**H1 · Account status and module entitlement are enforced only in the browser.**
**✅ FIXED 2026-07-29 — see §17 for the change report.**
*As found:* the frontend refused entry when the account was disabled, the plan expired, or
the tenant did not license the module (`frontend/src/lib/sso.js:105-115`), but the backend
parsed `tenantStatus` and **never read it**, and never received or checked `enabled`,
`planExpired` or `moduleIds` — a full-text grep across `backend/src/main/java` returned
only field declarations. RegulaOne's `/api/auth/me` does not gate either: it returns the
profile for any valid token (`RegulaOne/.../AuthController.java:58-63` →
`UserService.java:151-155`).
*Failure scenario:* an admin disables a user or the subscription lapses; that user's
existing token stays valid, and `curl` against `/api/privacypilot/activities` with the
cookie keeps returning the whole register until the token expires. The UI lock was
cosmetic.
*Resolution:* the five rules now run server-side in
`security/PrivacyPilotAccessPolicy.java`, invoked from `RegulaOneAuthClient.resolve()`
(`:97-104`) before any controller executes. The `/me` projection was widened to carry
`enabled`, `planExpired` and `moduleIds`, with `enabled` boxed so a missing flag **fails
closed**. Company suspension (`tenantStatus`) is enforced too, blocking only an explicitly
non-`ACTIVE` status so older tenant records are not locked out. The frontend rule and its
access modal were extended to match, keeping the two copies in step.
*Residual:* the 30-second identity cache still bounds how fast a revocation takes effect
(L3, unchanged and documented). **The same gap remains in the sibling modules** — neither
SafeVoice's nor KSeFFlow's `RegulaOneAuthClient` enforces these fields; fixing them is
outside this module's scope but should be tracked.

**H2 · Exports are never audited (GDPR Art. 5(2) accountability).**
**✅ FIXED 2026-07-29 — see §17 for the change report.**
*As found:* `AuditAction.EXPORT` existed (`models/enums/audit/AuditAction.java:21`) and was
written **zero** times anywhere in the backend. Every export path was client-side: the full
Art. 30 register CSV, the audit-trail export, notice downloads/print, and the breach
report in Markdown/Word/print/clipboard.
*Failure scenario:* an auditor or admin downloads the complete register and the entire
audit trail; the audit trail — the very artefact that is supposed to demonstrate
accountability — showed nothing happened.
*Resolution:* new `POST /api/privacypilot/exports` (`controller/ExportController.java`,
`service/ExportService.java`) writes one immutable `EXPORT` entry per export, recording the
target, format, record count and the on-screen filters, with the actor/company/IP taken
from the session. All **eight** export paths call it first and abandon the export if the
record cannot be written — "no evidence, no copy". Single-document exports must name a
record, which is verified to belong to the caller's tenant (404 otherwise), so the trail
can never contain a line about another company's data. Clipboard copy of the UODO report is
recorded too, because pasting into the biznes.gov.pl form is how that document actually
leaves. 10 hermetic tests.
*Residual (documented, by design):* this records the export **event**; it does not generate
the bytes server-side. Someone already authorised to read the data could still call the
ordinary read APIs and assemble their own copy with no entry. Closing that fully means
server-side rendering of every export, which needs the bilingual register labels that today
exist only in the frontend (`lib/gdpr.js`) — tracked as follow-up, not a regression.

**H3 · The audit-trail query loads the whole tenant collection into memory and sorts it
without an index.**
`AuditQueryService.list()` fetches every entry for the tenant
(`AuditQueryService.java:66`), then filters by action/date/text and applies the 1000-row
cap **in memory** (`:70-80`). The only index is `tenantId` (`BaseDocument.java:36-37`) —
there is no `(tenantId, createdAt)` compound index, so MongoDB performs a blocking
in-memory sort.
*Failure scenario:* the trail is retained for 10 years and grows monotonically (entries
can never be deleted, by design). Past MongoDB's 32 MB in-memory sort limit the endpoint
starts returning server errors, and well before that a single request pulls hundreds of
MB into the JVM. It is also a cheap DoS: repeat `GET /audit` with no filters.
*Fix:* push filters and the limit into the query (`Pageable` + `Criteria`), and add
compound indexes `(tenantId, createdAt)`, `(tenantId, entityType, createdAt)`,
`(tenantId, entityId, createdAt)`.

**H4 · No rate limiting or brute-force protection anywhere.**
No bucket4j / resilience4j / Spring Security rate limiter in `pom.xml` or `src`; no
gateway config in the repo. Combined with H3 and M2 (no payload size limits) this leaves
the API trivially floodable. Contravenes CLAUDE.md §6; OWASP API4:2023.
*Fix:* per-identity and per-IP limits at the edge, stricter on writes and on
`/audit`, `/dashboard`.

**H5 · No field-level encryption, no KMS, no per-tenant keys.**
`grep -r "Cipher\|KMS\|Vault\|@Encrypted" backend/src/main/java` → nothing but enum
labels. Data-subject PII is stored in clear: DSAR requester name and e-mail
(`models/document/Dsar.java:50,55`), free-text `notes` (`:72`) which may contain
special-category data, DPO contact (`models/embedded/DpoDetails.java:25-31`), breach
descriptions. The only protection is MongoDB Atlas storage-level encryption. This
contradicts CLAUDE.md §2 (AES-256-GCM, per-tenant keys, KMS/Vault) and weakens the
Art. 32(1)(a) posture the app's own ROPA form invites customers to claim
(`lib/gdpr.js` TOMS lists "Encryption at rest (AES-256)").
*Fix:* MongoDB Client-Side Field Level Encryption, or app-layer AES-GCM with per-tenant
data keys from KMS, on the PII fields listed above.

**H6 · No true erasure, and the immutable audit trail permanently freezes data-subject
PII.**
Deletion is soft everywhere (`BaseDocument.java:48-52`); there is no hard-delete or
crypto-shred path in any service. Worse, the audit diff copies the data subject's own
identifiers into the append-only collection: `snapshot()` records `requesterName` and
`notes` (`DsarService.java:225-237`), and `create()` records `requester`
(`DsarService.java:80`). `AuditEntryImmutableListener` then makes those rows
permanently unmodifiable.
*Failure scenario:* a person exercises Art. 17. The DSAR record can be hidden, but their
name and any free-text notes about them remain in a collection the application is
architecturally incapable of altering — with no documented legal basis for that specific
retention.
*Fix:* (a) stop writing subject identifiers into audit values — reference the DSAR id and
a non-identifying label; (b) add a documented erasure path (crypto-shred the encrypted
PII fields from H5, keeping the audit skeleton); (c) document the Art. 17(3)(b)/(e)
retention basis for what remains.

**H7 · No production configuration, and the configuration that exists is not in git.**
`spring.profiles.active` defaults to `dev` (`application.properties:4`) and there is **no
`application-prod.properties`**. Both `application.properties` and
`application-dev.properties` are gitignored (`backend/.gitignore:38-39`) and
`git ls-files backend/src/main/resources/` returns **nothing** — so a clean clone has no
port, no profile, no CORS list and no Mongo URI, and cannot be built or deployed
reproducibly. `application-dev.properties:2` holds a live Atlas connection string with an
embedded password in plaintext on disk. No Dockerfile, no compose file, no
`.github/workflows` anywhere in the repository. No Actuator / Micrometer / OpenTelemetry
— so no health, readiness, metrics or tracing (CLAUDE.md §12, §14, §15).
*Fix:* commit an `application.properties` and `application-prod.properties` that contain
only `${ENV_VAR}` placeholders; keep secrets exclusively in the deployment secret store;
add a multi-stage non-root Dockerfile, a pipeline with SAST + Trivy + OWASP
Dependency-Check, and Actuator health/readiness plus metrics.

**H8 · There is effectively no test suite, and the one test cannot run.**
`backend/src/test` contains a single `contextLoads()` test. The stored surefire report
shows it **errored**: `Failed looking up TXT record for host mongodbcluster.…mongodb.net`
(`target/surefire-reports/com.privacypilot.backend.BackendApplicationTests.txt`). It boots
the full context and therefore requires the production Atlas cluster and network egress
— it can never pass in a sealed CI runner. CLAUDE.md §18 requires 80% backend coverage.
*Fix:* make the sole smoke test hermetic (Testcontainers Mongo or `@DataMongoTest` with
a stubbed `RegulaOneAuthClient`), then add the tests that actually protect this product:
tenant-isolation (caller A cannot read B's ids), the RBAC matrix per endpoint, DSAR
deadline maths, the 72 h clock, DPIA verdict thresholds, and the notice completeness gate.

**H9 · Nothing in the current configuration uses HTTPS.**
No `server.ssl.*`, no reverse-proxy or ingress config in the repo.
`sso.cookie.secure` defaults to **false** (`RegulaOne/.../application.properties:48`), so
if `SSO_COOKIE_SECURE` is not set in production the session cookie is transmitted over
plaintext HTTP. The checked-in `frontend/.env` pins every origin to `http://192.168.20.38`
— and because the production CSP is generated from those values
(`vite.config.js:31-45`), a build made from this file emits a CSP that *whitelists*
plaintext HTTP origins. TLS 1.3/HSTS (CLAUDE.md §2) is not evidenced anywhere.
*Fix:* terminate TLS 1.3 at the edge with HSTS; force `SSO_COOKIE_SECURE=true` and
`SameSite` explicitly in prod; supply production `VITE_*` values as `https://` origins.

### 4.3 Findings — Medium

**M1 · Stored DOM-XSS via the notice title in the print window.**
**✅ FIXED 2026-07-29** as a side-effect of the H2 work (§17): `printContent` now escapes
both title and body with an `escapeHtml` helper, matching the sibling implementation, and
also guards against a blocked pop-up. *(The missing `@Size` on `NoticeGenerateRequest.title`
remains — see M2.)* The original finding is kept below for the record.

`printContent()` interpolates `title` into `document.write` **unescaped**
(`pages/Notices/NoticesPage.jsx:36-45`) while the body *is* escaped — and the sibling
implementation gets it right (`pages/Breaches/BreachDetailPage.jsx:56-62` escapes both).
The value is client-supplied and stored: `NoticeGenerateRequest.title` has **no**
`@Size` and no sanitisation (`dto/notice/NoticeGenerateRequest.java:38`), and is persisted
verbatim (`NoticeService.java:110`).
*Failure scenario:* a user with `PRIVACYPILOT_ADMIN` or `PRIVACYPILOT_COMPLIANCE_OFFICER`
generates a notice titled `</title><script>…</script>`; any colleague who clicks Print
opens an `about:blank` window that inherits the app's origin and executes it with the
session cookie. Mitigating factor: per the CSP spec `about:blank` inherits the creator's
policy, and `script-src 'self'` would block inline execution — so exploitability depends
on browser CSP-inheritance behaviour and on the CSP being present at all (it is absent in
dev builds, M4).
*Fix:* escape `title` with the existing `escapeHtml` helper; add `@Size` to the DTO.

**M2 · DTO validation is thin; one DTO has none at all.**
Across all 17 request DTOs there is exactly **one** `@Size` (`grep -c @Size dto/` → 1) and
no `@Email`. `DsarRequest.requesterEmail` is a free string
(`dto/dsar/DsarRequest.java:34`). `SettingsRequest` carries **zero** constraints and
reuses the persistence model `DpoDetails` directly as its DTO
(`dto/settings/SettingsRequest.java:20-24`) — a leaky abstraction that also means any
field added to the model becomes client-writable. No JSON body size limit is configured
either (Tomcat's form-post limit does not apply to `application/json`).
*Fix:* `@Size` on every string, `@Email` on both e-mail fields, a dedicated
`DpoDetailsRequest`, and `server.max-http-request-header-size` + an explicit body cap at
the edge.

**M3 · No pagination on any list endpoint.**
`activities`, `dpias`, `breaches`, `dsars`, `vendors`, `transfers`, `notices` all return
the tenant's entire collection (e.g. `ProcessingActivityService.java:54-56`); no finder
accepts `Pageable` (`grep Pageable` → 0). `DashboardService` compounds this by loading
five full collections plus the whole audit trail per request
(`DashboardService.java:76-80,158`).
*Fix:* `Pageable` on every list endpoint; move dashboard counts to Mongo aggregation.

**M4 · CSP is delivered only as a `<meta>` tag, at build time.**
Two consequences: per the CSP specification `frame-ancestors` is **ignored** in a `<meta>`
delivery, so the intended clickjacking defence (`vite.config.js:56`) does not take effect;
and the plugin is `apply: 'build'` (`:70`), so dev builds have no policy at all. No
security headers are sent by the backend either (no `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, HSTS).
*Fix:* send the CSP and the header set as HTTP response headers at the edge, keeping the
meta tag as belt-and-braces.

**M5 · The mock AI assistant is not inert in a production build.**
`aiService.js` calls `apiMutate` from the mock transport (`services/aiService.js:15,24`),
which lazily seeds a **fake Polish tenant** ("ABC Logistics Poland Sp. z o.o." and
associated fake DSARs/breaches) into the user's `localStorage`
(`services/api.js:23-50`; `services/mockData.js:15-18`), and writes the `AI_DRAFT` audit
entries into that browser-local store instead of the real trail.
*Failure scenario:* a user clicks any AI button in production; mock compliance records
appear in their browser storage and the AI usage is recorded nowhere auditable — while the
file's own header claims EU AI Act Art. 50 transparency and Art. 5(2) accountability.
*Fix:* build the server-side AI proxy with a real `AI_DRAFT` audit write, or hide the
feature behind a flag that is off in production and stop shipping `mockData.js`.

**M6 · Frontend and backend RBAC matrices have drifted.**
The frontend grants the DPO `MANAGE_DPIA` (`lib/permissions.js:79`) and therefore renders
the DPIA editor (`pages/Dpia/DpiaDetailPage.jsx:120`), but the backend's DPIA
`CAN_EDIT` is `{ADMIN, COMPLIANCE_OFFICER}` (`DpiaController.java:58-61`) — a DPO who
edits and saves gets a 403. In the other direction the backend lets `AUDITOR` read the
DSAR, vendor, transfer, breach and notice APIs that the sidebar hides
(`lib/permissions.js:82-84` vs the `CAN_VIEW` arrays in each controller), so "least
privilege" is defined differently on the two sides.
*Fix:* make one matrix authoritative (backend) and derive the frontend's from it, or add a
contract test asserting the two agree per endpoint.

**M7 · No CSRF token, and the shared cookie domain widens the blast radius.**
There is no CSRF token or required custom header on writes (`WebConfig.java` registers
none). `SameSite=Lax` blocks the classic cross-site POST, which is the main reason this is
Medium and not High. But production sets `sso.cookie.domain=".regulaone.eu"`
(`RegulaOne/.../SSOConfig.java:36-37`), so every sibling module app is **same-site** —
an XSS or compromise in any other RegulaOne module can drive authenticated PrivacyPilot
writes with the shared cookie.
*Fix:* require a custom header (e.g. `X-Requested-With`) or a double-submit token on all
state-changing requests; pin `SameSite=Strict` where the SSO flow allows.

**M8 · No transactions.**
`grep -r Transactional backend/src/main/java` → **0**. Multi-document operations are not
atomic: creating a DPIA and linking it back onto the activity, and saving an activity
while stamping the referenced transfers (`ProcessingActivityService.java:175-195`).
A mid-operation failure leaves a dangling link.
*Fix:* `@Transactional` around the multi-document services (Atlas replica sets support it).

**M9 · No retention or deletion schedule.**
Soft-delete keeps every record indefinitely and there is no scheduled job anywhere
(`grep @Scheduled` → 0). "Keep for 10 years" is asserted in comments
(`BaseDocument.java:50-52`) but nothing enforces either the keep or the eventual purge.
This is the storage-limitation gap in §10.
*Fix:* a retention job per record type with the legal basis and period recorded, plus a
documented purge after the period ends.

**M10 · Spring Boot is one patch release behind.**
`pom.xml:8` pins **4.0.6**; current is **4.0.7** (10 June 2026). The two CVEs fixed in
4.0.7 — CVE-2026-40992 (mail auto-config SSL hostname verification) and CVE-2026-41001
(predictable Artemis temp dir) — **do not apply here**: neither
`spring-boot-starter-mail` nor Artemis is on the dependency list. Upgrade anyway to stay
on the supported patch line. **Unable to verify** the transitive dependency set against a
CVE database — OWASP Dependency-Check was not run (no network egress in this run).

**M11 · Super-admins with no tenant are undefined behaviour rather than an explicit
refusal.** `RegulaOneAuthClient.java:79-82` deliberately allows `ROLE_SUPER_ADMIN`
through with a null `tenantId`. Reads then query `tenantId = null` (matching any
orphaned record), and writes fail late with a 400 from
`AuditService.java:65-67` ("Tenant id is required").
*Fix:* refuse tenant-scoped endpoints for a tenant-less caller with an explicit 400/403,
or require an explicit `X-Acting-Tenant` that is validated and audited.

### 4.4 Findings — Low

| # | Finding | Evidence |
|---|---|---|
| L1 | **`shadcn` CLI is a runtime dependency.** It is in `dependencies`, not `devDependencies` (`package.json`), and is the sole source of 5 of the 7 npm advisories (`@modelcontextprotocol/sdk`, `@hono/node-server`, `fast-uri`, `brace-expansion`, `postcss` — confirmed via `npm ls`). It is **never imported** by app code (`grep "from 'shadcn'"` → 0), so none of it reaches the browser bundle; the exposure is build-machine only. | `npm audit`, `npm ls` |
| L2 | **`react-router` advisory GHSA-qwww-vcr4-c8h2 is present but not exploitable.** Installed 7.18.1 falls in the vulnerable range, but the advisory is scoped to **RSC mode**; this app is a plain SPA using `BrowserRouter` (`src/App.jsx:2,71`). No forward fix exists yet — npm's only suggested remedy is a downgrade to 7.11.0. Track it. | `npm audit`, `App.jsx:71` |
| L3 | **30-second identity cache** honours a revoked RegulaOne session for up to 30 s. Documented and bounded; acceptable, but state it in the security model. | `RegulaOneAuthClient.java:49` |
| L4 | **The auth gate is opt-in.** There is no Spring Security filter chain; auth happens because each method declares `AuthenticatedUser`. Every endpoint is covered *today* (verified), but a future endpoint that omits the parameter would be public. | all controllers |
| L5 | **No API versioning** (`/api/privacypilot/...`, no `/v1`) and **no OpenAPI** served by the app. The Postman collection is complete (47 requests, matching the 47 mappings, no secrets) but is not machine-contract documentation. | `postman/PrivacyPilot/…` |
| L6 | **Dead soft-delete logic on the audit collection.** Audit finders filter `…AndDeletedFalse…` on a collection whose entries can never be soft-deleted (the listener blocks the update). Harmless but misleading. | `AuditEntryRepository.java:28-39` vs `AuditEntryImmutableListener.java:38-49` |
| L7 | **Mock seed data ships in the production bundle** (`mockData.js`, 7.3 kB of fake Polish tenant records) because `aiService.js` still imports the mock transport. | `services/mockData.js` |
| L8 | **`allowedHeaders("*")`** in CORS is broader than needed. | `WebConfig.java:40` |

### 4.5 OWASP Top 10 (2021) view

| | Assessment |
|---|---|
| A01 Broken Access Control | ⚠️ Tenant isolation and RBAC verified strong — but **H1** (entitlement not server-enforced) and **M6** (matrix drift) are genuine access-control defects |
| A02 Cryptographic Failures | ❌ **H5** (no field encryption/KMS), **H9** (no TLS configured, `secure=false` default) |
| A03 Injection | ✅ Low — derived queries only, no XML, no eval; ⚠️ **M1** DOM-XSS sink |
| A04 Insecure Design | ⚠️ ~~H2~~ (fixed), **H6** (no erasure path) |
| A05 Security Misconfiguration | ❌ **H4** (no rate limiting), **H7** (no prod profile, config not in git), **M4** (headers) |
| A06 Vulnerable Components | ⚠️ **M10** (one patch behind), **L1/L2** (advisories present, exposure build-time only). Backend CVE scan **unable to verify** |
| A07 Auth Failures | ⚠️ Delegated and sound; **H1** and **L3** are the residual gaps |
| A08 Integrity Failures | ✅ Audit immutability enforced at DB layer; server owns lifecycle state |
| A09 Logging & Monitoring | ⚠️ Domain audit trail is strong and exports are now logged (H2 fixed), but **H7** (no metrics/alerting) means nothing is *monitored* |
| A10 SSRF | ✅ Not applicable — config-fixed single outbound target |

**OWASP ASVS L2:** fails at minimum on V2 (rate limiting), V6 (data-at-rest encryption),
V9 (TLS configuration), V14 (build/CI hardening, security headers). **Unable to verify**
V1/V13 items requiring a running deployment.

---

## 5. Architecture Review

**Layering is clean and consistent.** Controller → service → repository, with no
controller touching a repository directly and all business logic in services. `AuditContext`
is built once per request from the verified session and threaded to the audit writer
(`AuditContext.forCaller`), which is a genuinely good pattern. `BaseDocument` standardises
id, indexed `tenantId`, `@CreatedDate`/`@LastModifiedDate`, `@CreatedBy`/`@LastModifiedBy`
and soft-delete so a new entity cannot forget them. Cycles are avoided deliberately —
services depend on sibling *repositories*, never sibling services
(`ProcessingActivityService.java:41-48`). Redux Toolkit is used as the project mandates:
`store/slices/*` per domain, `services/*` for transport, no API data in component state.

**Technical debt.** Folder `models/` declares package `model` (consistent, harmless).
`DpoDetails`/`AiPreferences` double as persistence models *and* request DTOs (M2). The
notice text is compiled in the browser while the server owns its metadata — defensible,
but it means the legally operative document is produced by client code. `AuditQueryService`
does database work in Java (H3). No pagination (M3), no transactions (M8), no versioning
(L5).

---

## 6. Performance Review

| Aspect | Finding |
|---|---|
| Query shape | Every read is `tenantId`-indexed, but **all** list reads are full-collection with an unindexed sort — see H3, M3. |
| Dashboard | Six collection scans plus in-Java aggregation per request (`DashboardService.java:76-80,158`). Fine for a small tenant; the audit scan is the part that will break first. |
| Indexes | Only single-field `tenantId`. No compound index anywhere → MongoDB blocking sorts. |
| Payloads | Unbounded — no `@Size`, no body cap (M2), no pagination, `limit` capped only *after* the full read. |
| Caching | Only the 30 s identity cache, itself bounded to 10 000 entries with a best-effort sweep (`RegulaOneAuthClient.java:43,88-90`). |
| Concurrency, memory, CPU, response times, scalability under load | **Unable to verify** — no load test, no profiling, no metrics endpoint exists to measure against (CLAUDE.md §18 requires load testing). |

---

## 7. Database Review

- **Engine/schema.** MongoDB (shared Atlas cluster, database `RegulaOne`), one collection
  per aggregate (`privacypilot_*`). Relationships by id (`activity.vendorIds`,
  `activity.transferIds`, `dpia.activityId`), with referential integrity enforced in
  services on both sides: links are validated against the caller's own tenant before any
  save (`ProcessingActivityService.java:175-195`) and deletes are blocked while
  referenced (`existsByTenantIdAndVendorIdsAndDeletedFalse`).
- **Keys.** Mongo `ObjectId` hex strings, not UUIDs. CLAUDE.md §13 says UUID primary keys;
  this is a documented deviation, not a defect, but note it.
- **Constraints.** No unique indexes — e.g. nothing prevents two notices claiming the same
  `(tenantId, audience, version)`; the version is computed read-then-write
  (`NoticeService.java:214`) so a concurrent double-generate can collide.
- **Integrity / transactions.** No `@Transactional` (M8).
- **Encryption at rest.** Storage-level only (H5).
- **Retention / erasure.** Soft-delete forever, no schedule, no erasure path (M9, H6).
- **Migrations.** None — no Mongock/Liquibase, no versioning or backfill strategy. The
  `mockData.js` migration shim (`services/api.js:29-33`) is the only migration logic in the
  product, and it is in the browser mock.
- **Backup / DR / region.** **Unable to verify.** Nothing in the repository evidences the
  Atlas cluster's region, backup schedule, PITR setting, or any restore test
  (CLAUDE.md §8 requires DR testing). See §10.4 — this is also the EEA-residency question.

---

## 8. API Review

47 endpoints across 10 controllers, all under `/api/privacypilot/`.

| Criterion | Status |
|---|---|
| Authentication | ✅ every endpoint (implicit via `AuthenticatedUser` parameter) |
| Authorization | ✅ every endpoint (`requireAnyPermission`); ⚠️ drift vs frontend (M6); ❌ no entitlement check (H1) |
| Input validation | ⚠️ `@Valid` on every body, but constraints are thin and `SettingsRequest` has none (M2) |
| REST semantics | ✅ correct verbs; state transitions as explicit `POST /{id}/{action}` sub-resources (`/approve`, `/sign`, `/extend`, `/complete`, `/refuse`, `/notify-uodo`, `/notify-subjects`) — good design for auditability |
| Status codes | ✅ 200/201/400/401/403/404/409/422/500 mapped centrally; 409 used correctly for illegal state transitions; 422 + `CHECKLIST_INCOMPLETE` for the notice gate |
| Error envelope | ✅ consistent `AppResponse{success,message,data,errorCode,status}`, no leakage |
| Idempotency | ⚠️ `notify-uodo` / `notify-subjects` overwrite the timestamp on repeat calls (`BreachService.java:113-125`) — a second click rewrites the recorded notification moment |
| Versioning | ❌ none (L5) |
| Rate limiting | ❌ none (H4) |
| Pagination | ❌ none (M3) |
| Documentation | ⚠️ Postman collection complete and current (50 requests, incl. the new Exports folder); no OpenAPI served (L5) |

---

## 9. Infrastructure & Deployment Review

| Area | Status | Evidence |
|---|---|---|
| Env config | ⚠️ Env-var driven with dev defaults | `application.properties` uses `${VAR:default}` |
| Config in version control | ❌ **Nothing** under `src/main/resources` is tracked | `git ls-files` empty; `.gitignore:38-39` |
| Secrets committed | ✅ None | verified across backend props, `.env`, Postman |
| Secret management | ⚠️ No vault/KMS; live Atlas password sits plaintext in a local file | `application-dev.properties:2` |
| Production profile | ❌ Missing | no `application-prod.properties`; default profile `dev` |
| Docker / orchestration | ❌ None | no Dockerfile or compose anywhere |
| CI/CD | ❌ None | no `.github/workflows`, GitLab CI or Jenkinsfile in the repo |
| Health / metrics / tracing | ❌ None | no Actuator, Micrometer, Prometheus or OpenTelemetry |
| TLS / reverse proxy / HSTS | ❌ Not configured; `secure=false` default | H9 |
| Logging | ⚠️ Default Slf4j, no prod logback config, no aggregation; ✅ no PII in the two log statements | `GlobalExceptionHandler.java:69` |
| Backup / DR | ⚠️ **Unable to verify** | §7 |
| Launcher | Dev only — `start.sh:238-241` starts PP on 9004/3006 locally | |

---

## 10. Compliance Review (EU & Poland)

**Instruments.** GDPR — Regulation (EU) 2016/679 (CELEX 32016R0679). Polish
implementing act — *Ustawa z dnia 10 maja 2018 r. o ochronie danych osobowych*,
Dz.U. 2018 poz. 1000, confirmed **IN_FORCE** with a consolidated text via the official
Sejm ELI API (`api.sejm.gov.pl/eli/acts/DU/2018/1000`, retrieved 2026-07-29).
Supervisory authority — UODO.

> **KSeF / Ministry of Finance e-invoicing is out of scope for this module** — that is the
> separate KSeFFlow module. No KSeF or tax obligation attaches to PrivacyPilot.

### 10.1 Verified against official sources ✅

**DPIA threshold rule — verified correct.** UODO's official guidance states that the list
of processing types requiring a DPIA is annexed to the President of UODO's Communication
of 17 June 2019, published in Monitor Polski on 8 July 2019, and that "as a general rule,
processing meeting **at least two** of the listed criteria will require conducting a
DPIA", while a single criterion may still warrant one. The app implements exactly this:
≥2 criteria → `REQUIRED`, exactly 1 → `RECOMMENDED`, 0 → `NOT_INDICATED`
(`ProcessingActivityService.java:236-245`).
*Source:* [UODO — Kiedy trzeba przeprowadzić ocenę skutków](https://uodo.gov.pl/pl/598/3617);
[M.P. 2019 poz. 666](https://monitorpolski.gov.pl/MP/2019/666).

**The 12 DPIA criteria — verified complete and correctly cited.** `DpiaCriterion` encodes
all twelve categories, each carrying its own `M.P. 2019 poz. 666, pkt N` reference
(`models/enums/dpia/DpiaCriterion.java:18-41`), and they correspond one-for-one to the
twelve UODO categories (evaluation/scoring, automated decisions, systematic monitoring,
special categories, biometrics, genetics, large scale, matching/combining, vulnerable
subjects, innovative technology, blocking rights, location data).
*Source:* [UODO](https://uodo.gov.pl/pl/598/3617).

**Polish DPO notification, 14 days — verified exactly.** Art. 10(1) of the Act requires the
entity that has designated a DPO to notify the President of the Office **within 14 days of
the designation**, giving the DPO's name, surname and e-mail or phone; Art. 10(6) requires
the notification to be made **electronically and signed with a qualified electronic
signature or a trusted (ePUAP) signature**. The app's Settings tracker states precisely
this (`i18n/pl.js:387`, `i18n/en.js:387`) and stores `appointedAt` + `uodoNotifiedAt`
(`models/embedded/DpoDetails.java:34-37`). Art. 11 additionally requires publishing the
DPO's details on the website — tracked as `publishedOnWebsite` (`:40`).
*Source:* official consolidated text of Dz.U. 2018 poz. 1000 via
[Sejm ELI API](https://api.sejm.gov.pl/eli/acts/DU/2018/1000) (Art. 10–11).
*Gap (Low):* Art. 10(4) also requires notifying **changes and dismissal** within 14 days;
the model tracks only the initial designation.

**Breach: 72 hours and the filing channel — verified.** UODO states the controller
notifies the supervisory authority "without undue delay – where possible no later than
72 hours after discovering the breach", and the official Polish government business portal
specifies that the notification is submitted **electronically via the biznes.gov.pl
e-service**, signed with a qualified electronic signature or trusted profile, with
initial / complete / supplementary submission types allowed when the 72 hours would
otherwise be missed. The app computes the 72 h window server-side
(`DashboardService.java:52`) and states the Art. 33(1) rule verbatim in both languages
(`pages/Breaches/BreachDetailPage.jsx:201-202`).
*Sources:* [UODO — Zgłaszanie naruszeń](https://uodo.gov.pl/pl/525/2584);
[biznes.gov.pl — Zgłoś naruszenie ochrony danych osobowych](https://www.biznes.gov.pl/pl/portal/ou889).
*Gap (Low):* the UI directs users to "uodo.gov.pl" (`BreachDetailPage.jsx:202,292,342`);
the operative channel is the biznes.gov.pl e-service. Point users at the exact channel and
mention the qualified-signature requirement.

**Chapter V adequacy list — verified accurate, one omission.** Checked against the
European Commission's adequacy-decisions page: the app's `ADEQUACY_COUNTRIES`
(`lib/gdpr.js:104-108`) correctly lists Andorra, Argentina, Brazil, Canada (commercial
organisations only), Faroe Islands, Guernsey, Israel, Isle of Man, Japan, Jersey, New
Zealand, Republic of Korea, Switzerland, United Kingdom, USA (EU-US Data Privacy Framework
participants only) and Uruguay — including the recent Brazil decision and the renewed UK
decision. **Missing: the European Patent Organisation.** The transfer mechanisms and their
article references (Art. 45 / 46(2)(c) SCC 2021/914 / 47 BCR / 49 derogation) are correct
(`lib/gdpr.js:96-101`).
*Source:* [European Commission — Adequacy decisions](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en).

### 10.2 GDPR requirement mapping

Article numbering and subject matter are cited to the official instrument
(Regulation (EU) 2016/679, CELEX 32016R0679). **Unable to verify verbatim article wording
in this run** — EUR-Lex returned HTTP 202 (anti-automation interstitial) with an empty body
on every attempted retrieval, so no operative text is quoted below. Re-verify the wording
against the live EUR-Lex text before sign-off.

| Requirement | Article | In app? | Evidence / gap |
|---|---|---|---|
| Records of processing activities | Art. 30 | ✅ | Controller + processor register, all Art. 30(1)/(2) fields, CSV export |
| Data protection impact assessment | Art. 35 | ✅ | DPIA module; verdict rule verified (§10.1); approval blocked while a required DPIA is unsigned |
| Prior consultation | Art. 36 | ✅ flag | Surfaced on the dashboard attention list |
| Breach notification to authority | Art. 33 | ⚠️ partial | 72 h clock server-side; app **records**, does not transmit (correct — §10.3) |
| Communication to data subjects | Art. 34 | ⚠️ partial | Recorded, not transmitted |
| Information to be provided | Art. 13/14 | ✅ | Versioned notice generator with a server-side register-completeness gate |
| Data subject rights + deadline | Art. 12(3), 15–22 | ✅ | Server-side deadline maths: 1 month, +2 months on a reasoned extension, extend-once guard (`DsarService.java:74,116-139`) |
| Refusal of a request | Art. 12(5) | ✅ | Mandatory reason, server-stamped (`DsarService.java:157-176`) |
| Identity confirmation | Art. 12(6) | ✅ | Never auto-verified; a new DSAR always starts unverified (`DsarService.java:71`) |
| Processor obligations / DPA | Art. 28 | ✅ | Vendor register + DPA-status guard |
| Transfers outside the EEA | Ch. V (44–49) | ✅ | Transfer register, mechanisms + adequacy list verified (§10.1) |
| Accountability | Art. 5(2) | ✅ | Immutable trail with actor/IP/UA/old/new, **and every export/print/copy now recorded (H2 fixed, §17)** |
| Security of processing | Art. 32 | ❌ **gap** | No field-level encryption (H5), no TLS configured (H9), no rate limiting (H4) |
| Storage limitation | Art. 5(1)(e) | ❌ **gap** | Soft-delete keeps everything forever; no retention schedule (M9) |
| Right to erasure | Art. 17 | ❌ **gap** | No erasure path, and subject PII is frozen in the immutable trail (H6) |
| Data minimisation | Art. 5(1)(c) | ⚠️ | Subject names and free-text notes copied into audit values (H6) |
| Privacy by design / by default | Art. 25 | ✅ largely | Tenant isolation, least-privilege RBAC, server-owned lifecycle, AI special-category exclusion toggle |
| Data residency / transfer safeguards | Ch. V | ⚠️ **Unable to verify** | Atlas region not evidenced; §10.4 |

### 10.3 Note on "records, does not file"

Neither UODO's breach channel nor the Art. 10 DPO notification has a machine API — both
require an electronic submission signed with a qualified electronic signature or trusted
profile (verified, §10.1). PrivacyPilot's design decision to **prepare and track** rather
than transmit is therefore correct. It must, however, be stated explicitly to users so no
one believes a recorded notification has been filed. Today the breach screen implies this
(“Copy it into the form…”) but the Settings DPO tracker does not.

### 10.4 Data residency — the open question

The app markets data residency (`i18n` "lokalizacja danych") and the CSP deliberately
avoids CDNs to keep assets in-region, but the actual hosting region is **not evidenced
anywhere in the repository**: the connection string
(`application-dev.properties:2`) carries no region, and no infrastructure-as-code exists.
This is the single most consequential **Unable to verify** item, because if the Atlas
cluster or its backups sit outside the EEA, Chapter V applies to the platform itself. Also
unverified: the Art. 28 data processing agreement with MongoDB Inc. as sub-processor.

---

## 11. Production Readiness Checklist

| Item | Status |
|---|---|
| No debug code | ✅ 0 `console.*`/`debugger`; dev prefill gated to `import.meta.env.DEV` |
| No hardcoded credentials | ✅ none committed anywhere (backend props, `.env`, Postman all clean) |
| No development endpoints exposed | ✅ no dev-only routes; DevTools excluded from the jar |
| No mock data remaining | ❌ AI assistant mock, and it seeds fake tenant data into browser storage (M5) |
| Production configuration enabled | ❌ no `application-prod.properties`; default profile is `dev`; config not in git (H7) |
| Secrets stored securely | ⚠️ not committed, but no vault/KMS; live Atlas password plaintext on disk |
| Dependencies current | ⚠️ Spring Boot one patch behind (M10); 7 npm advisories, all build-time or non-applicable (L1/L2) |
| No known critical vulnerabilities | ⚠️ no *critical* advisory applies to shipped code; but H1/H2/H5 are self-inflicted equivalents |
| Monitoring & logging production-ready | ❌ no health, metrics, tracing or alerting |
| Backup & recovery in place | ⚠️ **Unable to verify** |
| Automated tests | ❌ one test, and it cannot run without the production database (H8) |
| Can safely operate in production | ❌ |

---

## 12–15. Consolidated Issue List

**High — must fix before go-live**

| # | Issue | Fix |
|---|---|---|
| ~~H1~~ | ~~Account status / plan / module entitlement enforced only in the browser~~ | **✅ FIXED** — `PrivacyPilotAccessPolicy` enforced in `RegulaOneAuthClient.resolve()`; 15 tests (§17) |
| ~~H2~~ | ~~`AuditAction.EXPORT` never written; all exports client-side~~ | **✅ FIXED** — `POST /api/privacypilot/exports` recorded before all 8 export paths; 10 tests (§17) |
| H3 | Audit query loads and sorts the whole tenant collection in memory, unindexed | Push filters/limit into Mongo; add `(tenantId, createdAt)` compound indexes |
| H4 | No rate limiting or brute-force protection | Edge + app limits, stricter on writes and `/audit` |
| H5 | No field-level encryption / KMS / per-tenant keys for PII | Mongo CSFLE or app-layer AES-GCM via KMS |
| H6 | No erasure path; subject PII frozen in the immutable audit trail | Stop auditing subject identifiers; add crypto-shred erasure; document the retention basis |
| H7 | No production profile, no Docker, no CI/CD, no observability; config not in git | Commit placeholder-only prod config; Dockerfile; pipeline with SAST/Trivy/Dependency-Check; Actuator |
| H8 | No usable test suite (sole test needs the production Atlas cluster) | Hermetic tests: tenant isolation, RBAC matrix, deadline maths, 72 h clock, DPIA thresholds |
| H9 | No HTTPS anywhere in configuration; `cookie.secure` defaults false; CSP built from `http://` origins | TLS 1.3 + HSTS at the edge; force `secure`; `https://` `VITE_*` values |

**Medium**

~~M1 stored DOM-XSS in the notice print title~~ (**✅ fixed**, §17) · M2 thin DTO validation, `SettingsRequest`
unvalidated, no body cap · M3 no pagination · M4 CSP meta-only (`frame-ancestors`
ineffective), no security headers · M5 mock AI seeds fake data into browser storage and
logs nowhere auditable · M6 frontend/backend RBAC drift (DPO gets a DPIA editor the API
refuses) · M7 no CSRF token + shared cookie domain widens blast radius · M8 no
transactions · M9 no retention/deletion schedule · M10 Spring Boot 4.0.6 → 4.0.7 ·
M11 tenant-less super-admin is undefined behaviour.

**Low**

L1 `shadcn` CLI in `dependencies` (source of 5 advisories, not shipped) · L2
`react-router` advisory present but RSC-only, not exploitable in this SPA · L3 30 s
identity cache revocation window · L4 opt-in auth gate, no global filter · L5 no API
versioning, no OpenAPI · L6 dead soft-delete filter on the immutable audit collection ·
L7 mock seed data in the bundle · L8 `allowedHeaders("*")` · plus the two compliance
Lows: Art. 10(4) change/dismissal notification untracked, and the breach UI points at
uodo.gov.pl rather than the biznes.gov.pl e-service · and the missing European Patent
Organisation adequacy entry.

**Unable to verify** — Atlas cluster region (EEA residency), Atlas backup/PITR
configuration and any restore test, DR test, TLS termination and HSTS in the real
deployment, backend transitive-dependency CVE scan (OWASP Dependency-Check), penetration
test, load/response-time testing, the actual production environment-variable injection,
the Art. 28 DPA with MongoDB Inc., and the verbatim GDPR article wording (EUR-Lex returned
an empty anti-automation response throughout this run).

---

## 16. Official References Used

- **GDPR** — Regulation (EU) 2016/679, CELEX 32016R0679, OJ L 119. Cited by article
  number to the official instrument; **live full-text retrieval failed** (EUR-Lex returned
  HTTP 202 with an empty body on every attempt), so no wording is quoted.
- **European Commission** — [Adequacy decisions](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en) (retrieved 2026-07-29; used to verify `ADEQUACY_COUNTRIES`).
- **UODO** — [Kiedy trzeba przeprowadzić ocenę skutków dla ochrony danych?](https://uodo.gov.pl/pl/598/3617) (DPIA obligation and the two-criteria rule).
- **UODO** — [Zgłaszanie naruszeń](https://uodo.gov.pl/pl/525/2584) (72-hour rule).
- **Monitor Polski / ISAP** — Komunikat Prezesa UODO z 17 czerwca 2019 r.,
  [M.P. 2019 poz. 666](https://monitorpolski.gov.pl/MP/2019/666) ·
  [ISAP record](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WMP20190000666)
  (the mandatory-DPIA list; 12 categories).
- **Sejm ELI (official legislative API)** — [Ustawa z dnia 10 maja 2018 r. o ochronie danych osobowych, Dz.U. 2018 poz. 1000](https://api.sejm.gov.pl/eli/acts/DU/2018/1000), status `IN_FORCE`, consolidated text (Art. 10 — 14-day DPO notification, electronic + qualified/trusted signature; Art. 11 — publication of DPO details).
- **biznes.gov.pl (official government business portal)** — [Zgłoś naruszenie ochrony danych osobowych](https://www.biznes.gov.pl/pl/portal/ou889) (electronic-only breach filing channel and signature requirement).
- **Spring** — [Spring Boot 4.0.7 release announcement](https://spring.io/blog/2026/06/10/spring-boot-4-0-7-available-now/) and [Spring Security Advisories](https://spring.io/security/) (used only for the dependency-currency finding, not for any compliance conclusion).

No blogs, tutorials, Q&A sites or unofficial summaries were used for any legal conclusion.

---

## Final Verdict

# ❌ Not Production Ready

The domain layer is the strongest part of this codebase — tenant isolation, RBAC, the
append-only audit trail, server-owned legal clocks and the DPIA threshold rule all hold up
under inspection, and the DPIA, DPO-notification, breach-deadline and adequacy-list logic
were **verified correct against official UODO, Sejm and European Commission sources**.

Deployment is nevertheless blocked by nine High findings. Three are substantive
authorization and accountability defects in the application itself — entitlement enforced
only in the browser (**H1**), exports invisible to the audit trail (**H2**), and no
erasure path with subject PII permanently frozen in an immutable collection (**H6**).
One will break in production as data accumulates (**H3**). The remainder are the missing
operational floor: encryption at rest, TLS, rate limiting, a production profile, a
container, a pipeline, observability, and a test suite that can actually run.

Resolve **H3–H9** (H1 and H2 are now fixed — §17), and settle the **EEA data-residency and
backup/DR questions** — which cannot be answered from this repository at all — before any
regulated EU/Poland production deployment.

---

## 17. Remediation Log

### 2026-07-29 — H2 fixed: every export is recorded in the audit trail

**1. Files modified**

| File | Change |
|---|---|
| `backend/.../models/enums/export/ExportTarget.java` | **new** — what was copied (register controller/processor, audit trail, notice, breach report); maps to an `AuditEntityType` and says whether a record id is required |
| `backend/.../models/enums/export/ExportFormat.java` | **new** — how it left: `csv`, `json`, `markdown`, `word`, `print`, `clipboard` |
| `backend/.../models/enums/audit/AuditEntityType.java` | added `REGISTER` and `AUDIT_TRAIL` for whole-list exports (additive; existing stored codes unaffected) |
| `backend/.../dto/export/ExportRequest.java` | **new** — validated payload (`target`, `format`, `entityId` ≤64, `itemCount` 0–1 000 000, `filterSummary` ≤500) |
| `backend/.../service/ExportService.java` | **new** — verifies single-document ownership, then writes the `EXPORT` audit entry |
| `backend/.../controller/ExportController.java` | **new** — `POST /api/privacypilot/exports`, 201, gated to the four roles that hold `EXPORT_DATA` |
| `backend/src/test/.../service/ExportServiceTest.java` | **new** — 10 hermetic tests (JUnit + Mockito) |
| `frontend/src/services/exportService.js` | **new** — transport |
| `frontend/src/store/slices/exportsSlice.js`, `store/index.js` | **new** slice (CLAUDE.md §26) with `saveStatus`/`error`/`lastReceipt`; registered as `exports` |
| `frontend/src/pages/Ropa/RegisterPage.jsx` | CSV export records first (target by tab, row count, live filters) |
| `frontend/src/pages/Audit/AuditTrailPage.jsx` | trail export records first; `ENTITY_TYPES` filter gains `register`, `audit_trail`; **export switched from JSON to CSV** |
| `frontend/src/lib/auditCsv.js` | **new** — the audit-trail CSV document format, alongside `breachReport.js` / `noticeBuilder.js` |
| `frontend/src/pages/Notices/NoticesPage.jsx` | one `exportNotice(format)` handler for download + print; **also escapes the print title (fixes M1)** |
| `frontend/src/pages/Breaches/BreachDetailPage.jsx` | all four routes (copy, Markdown, Word, print) record first |
| `frontend/src/i18n/en.js`, `pl.js` | `export.failed` (parity kept: 351 keys each) |
| `postman/PrivacyPilot/PrivacyPilot.postman_collection.json` | new "Exports (Art. 5(2) accountability)" folder, 5 requests (collection now 50) |

**2. Old behaviour**

`AuditAction.EXPORT` was declared in the enum and written zero times. All eight export
routes ran entirely in the browser: the Art. 30 controller/processor register CSV, the audit
trail JSON, the notice `.md` download and print view, and the breach report as Markdown,
Word, print and clipboard. The server never learned that any of it happened, so the audit
trail showed nothing when the entire register left the building.

**3. New behaviour**

Each route calls `POST /api/privacypilot/exports` **before** producing anything and only
proceeds if the call succeeds; on failure the user gets a toast and no file. One immutable
`EXPORT` audit line is written per export, carrying the target, the format, the record count
and the on-screen filters, with actor / role / company / IP / user-agent taken from the
verified session. Single-document exports must name a record, and that record is looked up
in the caller's own tenant — a missing or foreign id is a 404 and **no** audit line is
written, so the trail can never assert something that did not happen. Exporting the audit
trail is itself recorded in the audit trail, and that line is append-only like every other.

**3b. Audit-trail export format changed from JSON to CSV**

The trail exported a raw JSON dump, which is the wrong artefact for its audience: this file
is handed to an auditor, a lawyer or a UODO inspector, who opens it in Excel or LibreOffice.
It is now a CSV with one column per audit field, carrying a provenance header block (what the
file is, who exported it, when, which filters, how many records, and **the id of the EXPORT
audit entry that records this very download** — so the evidence names the entry proving who
took it). Nothing is lost in the change: the before/after diffs are the only nested part of
an entry and they travel as compact JSON text inside their own cells, verified to round-trip
back to the identical objects. The file is CRLF-terminated and downloaded with a UTF-8 BOM so
Excel renders Polish characters (ą, ę, ł, ż) correctly rather than mojibake — the same
convention the ROPA register export already uses. `ExportFormat.JSON` remains a valid API
value; the UI simply no longer uses it.

**4. Why the old code was changed**

Beyond the JSON→CSV switch above, nothing was removed. The client-side file builders for the
register, notices and breach report are untouched — deliberately: they render
the register and the notices in Polish and English from label tables that exist only in the
frontend, and re-implementing them server-side would have risked regressing a legal document
in the product's primary language. The one behavioural change to existing code is that an
export can now fail; that is the point of the control. The unescaped print title was fixed
in passing because the change touched the same function.

**5. Security impact**

Closes H2. Bulk extraction of personal data is now attributable. `EXPORT` lines inherit the
existing database-level immutability (`AuditEntryImmutableListener`), so they cannot be
edited or deleted afterwards. The endpoint cannot be used to probe another tenant's ids
(404 on any id outside the caller's tenant), and an Employee — who can read none of this
data — cannot record an export at all. **Honest limit:** this records the export *event*, it
does not generate the bytes. Anyone already authorised to read the data can still call the
ordinary read APIs and assemble a copy with no entry written. It is an accountability
record, not a data-loss-prevention control, and the report says so in §4.2.

**6. Compliance impact**

Directly supports GDPR Art. 5(2) accountability: the controller can now demonstrate who took
a copy of the register, which slice, how large, in what format and when — the question an
auditor or UODO inspection actually asks. It also strengthens the Art. 30 record's
evidential value and gives Art. 33(3) breach handling a trace of when the UODO report left
the app (including the clipboard route, which is how it reaches the biznes.gov.pl form).
No processing purpose, lawful basis, retention period or data category changed, so no ROPA
or notice update is needed. Note that the EXPORT lines themselves contain no personal data
beyond the actor's own name/role, which the trail already stored.

**7. Testing performed**

`./mvnw -o -Dtest='ExportServiceTest,PrivacyPilotAccessPolicyTest' test` → **25 tests, 0
failures, 0 errors**. The 10 new tests assert: register export records target/format/count/
filters; audit-trail export is recorded; whole-list exports never touch the record
repositories and claim no id; an export line never carries a "before" state; blank
count/filters are omitted; a notice export records the readable version label
(`employees v3`); a clipboard copy of a breach report is recorded; a single-document export
with no id is a 400 **with nothing written**; and a foreign notice or breach id is a 404
**with nothing written** (tenant isolation). Frontend `npm run build` succeeds; i18n parity
verified (351 = 351); Postman collection re-parsed and valid (50 requests). The pre-existing
`BackendApplicationTests.contextLoads` still errors for the unrelated reason in H8 (it needs
the live Atlas cluster).

The audit CSV was executed directly against realistic data (Polish diacritics, an embedded
`"` in an entity label, a null `oldValue`, a nested `newValue`) and the output parsed back
with a strict CSV reader: 12 cells in every row, quotes correctly doubled and recovered,
diacritics intact, and both diff cells `JSON.parse`-ing back to the identical objects — i.e.
the format is lossless.

**8. Potential risks / side effects**

- *A new failure mode:* exports now depend on a successful API call. If the backend is
  unreachable the user cannot export — intended ("no evidence, no copy"), but it is a
  behaviour change worth mentioning in release notes.
- *Audit volume grows.* Print and clipboard actions are recorded, so a user who prints
  repeatedly generates several entries. This compounds **H3** (the audit query already loads
  the whole collection into memory) — H3 should be fixed before heavy use.
- *`itemCount` and `filterSummary` are client-stated.* They describe the copy, not the
  authorisation, and cannot grant access; the trustworthy fields (who/when/which tenant/
  which record) are all server-derived. A client could understate the count; it cannot hide
  that an export happened.
- *Two new `AuditEntityType` values* (`register`, `audit_trail`) will appear in the
  audit-trail filter. Older stored entries are unaffected.
- *The audit export filename and format changed* (`.json` → `.csv`). Anything downstream that
  consumed the old JSON dump — a script, a saved import mapping — needs updating. Nothing in
  this repository reads it.

---

### 2026-07-29 — H1 fixed: entitlement and account status enforced server-side

**1. Files modified**

| File | Change |
|---|---|
| `backend/.../security/PrivacyPilotAccessPolicy.java` | **new** — the single place that decides "may this person use PrivacyPilot at all?" |
| `backend/.../security/RegulaOneAuthClient.java` | calls the policy in `resolve()`; `MeData` widened with `enabled`, `planExpired`, `moduleIds` (boxed Booleans so a missing flag is detectable); docs updated |
| `backend/src/test/.../security/PrivacyPilotAccessPolicyTest.java` | **new** — 15 hermetic tests (no Spring, no Mongo, no network) |
| `frontend/src/lib/sso.js` | `evaluatePrivacyPilotAccess` also checks `tenantStatus`, so the browser rule matches the server rule |
| `frontend/src/components/auth/PrivacyPilotAccessModal.jsx` | new `organisation` state with a `Building2` icon |
| `frontend/src/i18n/en.js`, `frontend/src/i18n/pl.js` | `access.organisationTitle` / `access.organisationBody` (parity kept: 350 keys each) |

**2. Old behaviour**

The backend authenticated the caller and checked their per-action PrivacyPilot permission,
but never asked whether the caller was *allowed in the product at all*. `enabled`,
`planExpired` and `moduleIds` were not even requested from `/api/auth/me`, and
`tenantStatus` was carried but never read. Those four rules lived only in
`frontend/src/lib/sso.js`. A user whose account had been disabled, whose organisation had
been suspended, whose subscription had lapsed, or whose organisation never licensed the
module could bypass the locked UI entirely and call the API with their existing cookie —
reading and writing the whole GDPR register until the token expired.

**3. New behaviour**

`RegulaOneAuthClient.resolve()` now runs `PrivacyPilotAccessPolicy.requireAccess(...)`
immediately after the identity is resolved and before any controller body executes, in the
same order the browser uses: account enabled → super-admin short-circuit → organisation
active → plan not expired → module licensed → holds a PrivacyPilot permission. Each
refusal is a 403 with a readable reason and a `log.warn` carrying the user id and a
machine-readable reason code (`account_disabled`, `tenant_suspended`, `plan_expired`,
`module_not_licensed`, `no_permission`) for security monitoring. Only callers that pass are
cached, so a cache hit is always an already-allowed session.

**4. Why the old code was changed**

Nothing was deleted — the change is purely additive; the existing tenant-presence check and
all per-endpoint `requireAnyPermission` calls are untouched. The old arrangement was not a
missing feature but a misplaced control: an authorization rule enforced only in code the
user controls is not enforced at all, and CLAUDE.md §6/§22 explicitly forbid trusting
frontend validation.

**5. Security impact**

Closes the audit's H1 (a privilege-persistence / broken-access-control defect, OWASP
A01:2021). Deactivation, suspension, plan expiry and licence removal now take effect on the
API, not just in the UI. Step 6 doubles as defence-in-depth against L4: a future endpoint
that forgets its own permission check is still closed to anyone holding no PrivacyPilot
permission. Denials are now observable in logs, which they were not before. Only the user
id is logged — no name, e-mail or other personal data.

**6. Compliance impact**

Supports GDPR Art. 32(1)(b) and 32(4) — access to personal data is restricted to persons
currently authorised, not merely to persons whose browser agrees they are. It also
strengthens Art. 5(1)(f) (integrity and confidentiality) and makes the least-privilege
claim in the ROPA's technical-measures list defensible under audit. No processing purpose,
lawful basis, retention period or data category changed, so no ROPA or notice update is
required.

**7. Testing performed**

`./mvnw -o -Dtest=PrivacyPilotAccessPolicyTest test` → **15 tests, 0 failures, 0 errors**
(`target/surefire-reports/TEST-…PrivacyPilotAccessPolicyTest.xml`), covering: entitled user
allowed; a lesser permission (auditor) allowed; disabled account refused; **missing
`enabled` flag refused (fail-closed)**; disabled super-admin refused; suspended and
inactive organisations refused; absent organisation status *not* blocked; expired plan
refused; missing plan flag treated as not expired; unlicensed module and missing module
list refused; no PrivacyPilot permission and other-apps-only permissions refused;
super-admin bypass of the organisation/plan/module/permission checks. Every refusal is
asserted to be HTTP 403. Frontend `npm run build` succeeds; i18n key parity verified
(350 = 350).

**8. Potential risks / side effects**

- *Lockout risk is low by construction:* the three primary rules were already enforced in
  the browser, so any user who can use the app today already satisfies them.
- *The one genuinely new restriction is `tenantStatus`,* which the frontend did not check.
  It is deliberately narrow — only an explicitly non-`ACTIVE` status blocks; null or blank
  is allowed through — so a legacy tenant record without the field is unaffected. A tenant
  explicitly marked `SUSPENDED` that is still using PrivacyPilot today **will** now be
  refused, which is the intended meaning of suspension. Confirm no active customer sits in
  that state before deploying.
- *Revocation is not instant:* the 30-second identity cache still applies (L3).
- *Two copies of one rule* now exist (server + browser) and could drift. The server copy is
  authoritative; both files cross-reference each other, and the contract test suggested in
  M6 would cover this as well.
- **Not fixed here:** SafeVoice and KSeFFlow have the identical gap in their own
  `RegulaOneAuthClient`. Out of scope for this module, but it should be tracked as a
  platform-wide item.
