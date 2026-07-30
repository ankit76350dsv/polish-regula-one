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
2b. ~~**The audit trail was on a timer to break.**~~ **✅ FIXED 2026-07-29 — see §17.** The
   audit query loaded every entry a tenant had ever written and sorted it in Java, on a
   collection that only grows and is kept for ten years; the dashboard did the same to show
   six rows. Both now push filters, ordering and a row limit into MongoDB. It also emerged
   that **no index had ever been created** — `spring.data.mongodb.auto-index-creation`
   defaults to off, so every `@Indexed`/`@CompoundIndex` annotation in this module was
   inert. Indexes are now created explicitly at start-up.

3. **The operational layer is still thin, though no longer absent.** *Fixed since the first
   pass (§17):* rate limiting, a fail-fast production profile, and configuration that is
   actually in version control — previously **nothing** under
   `backend/src/main/resources/` was tracked, so a clean clone could not be configured at
   all. *Still missing:* no container, no CI/CD, no health checks or metrics, no field-level
   encryption, no TLS configuration, no retention or erasure job, and a test suite that
   covers a fraction of the product.

The good news: almost every gap is **additive**. None of them requires rewriting the
working domain code.

---

## 2. Overall Production Readiness Score

### **73 / 100 — ❌ Not Production Ready**

*(54 at first assessment; +3 H1, +4 H2, +5 H3 — 2026-07-29; +4 H4 and +3 for H7's config half — 2026-07-30. See §17.)*

| Layer | Score | Basis |
|---|---:|---|
| Domain code & architecture | 80% | Clean layering, tenant scoping and audit verified end-to-end |
| Feature completeness | 85% | 10/11 domains real; AI assistant mock; no erasure/export paths |
| Authentication & authorization | 80% | Auth + RBAC solid; **entitlement gate now enforced server-side (H1 fixed)**; residual: 30 s cache window, frontend/backend matrix drift (M6) |
| Security hardening | 60% | **Rate limiting added (H4)**; still no field encryption (H5), no TLS config (H9), weak write-side DTO limits (M2) |
| Compliance (GDPR/Polish mapping) | 75% | Feature-to-article mapping is accurate; **export accountability now recorded (H2 fixed)**; retention/erasure gaps remain |
| Database & performance | 65% | **Audit queries and indexes fixed (H3)**; remaining: no pagination on the other list endpoints, no transactions, no migrations |
| Ops / infra / deploy | 40% | **Config now in git + fail-fast production profile (H7 half)**; still no Docker, CI/CD or observability |
| Testing | 40% | Still far from the 80% target, but **67 hermetic tests** now exist (access policy, export accountability, audit query + paging, index shapes, rate limiting — §17); the original context-load test still needs the live Atlas cluster |

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
**✅ FIXED 2026-07-29 — see §17 for the change report.**
*As found:* `AuditQueryService.list()` fetched every entry for the tenant, then filtered by
action/date/text and applied the 1000-row cap **in memory**. `DashboardService` did the same
to render six rows. The only declared index was `tenantId` — no `(tenantId, createdAt)`
compound index, so MongoDB had to perform a blocking in-memory sort.
*Failure scenario:* the trail is retained for 10 years and grows monotonically (entries can
never be deleted, by design). Past MongoDB's 32 MB in-memory sort limit the endpoint starts
returning server errors, and well before that a single request pulls hundreds of MB into the
JVM. It was also a cheap DoS: repeat `GET /audit` with no filters.
*Worse than first reported:* **no index existed at all.** Spring Data's
`spring.data.mongodb.auto-index-creation` defaults to off and is set nowhere in this module
(verified against the Boot 4.0.6 configuration metadata and both properties files), so the
`@Indexed` on `BaseDocument.tenantId` and the `@CompoundIndex` on `AuditEntry` had **never
produced an index**. Every list query in the module was a full collection scan.
*Resolution:* filters, newest-first ordering and the row limit are now all built into one
MongoDB query (`repository/AuditEntryRepositoryImpl.java`), so the database walks an index
and stops at the cap; memory is bounded by the limit, not by the size of the trail. Three
purpose-shaped compound indexes are declared on `AuditEntry` and **actually created** at
start-up by `config/MongoIndexConfig.java`. The dashboard now asks for only the rows it
shows. Unbounded multi-row finders were removed from the repository interface so the mistake
cannot recur, and a non-positive limit is refused outright. 19 hermetic tests.
*Unable to verify:* whether indexes already exist in the Atlas cluster (created by hand or
by another module) — no database access from this environment. `MongoIndexConfig` is
idempotent, so it is safe either way.

**H4 · No rate limiting or brute-force protection anywhere.**
**✅ FIXED 2026-07-30 — see §17.**
*As found:* no bucket4j / resilience4j / Spring Security rate limiter in `pom.xml` or `src`,
and no gateway config in the repo. Combined with H3 and M2 (no payload size limits) this left
the API trivially floodable. Contravenes CLAUDE.md §6; OWASP API4:2023.
*Failure scenario:* every request that reaches a controller triggers a call to RegulaOne's
`/api/auth/me`, so flooding this service also floods the platform's login service; and
repeated guessing against any endpoint was completely unthrottled.
*Resolution:* `security/RateLimitFilter.java` — a token-bucket filter on every `/api/**`
request, with separate allowances for reads (60 burst, 120/min) and writes (20 burst,
30/min), all configurable. Keyed on the session (an irreversible fingerprint of the cookie,
never the cookie itself) or the client address when there is none. Refusals return 429 with
`Retry-After` in the standard `AppResponse` envelope. 12 hermetic tests.
*Residual — read before scaling out:* the counters are **per-instance, in memory**. With one
instance that is exact; behind a load balancer each instance keeps its own counters, so the
effective limit becomes (instances x configured limit) — weaker, never broken. For a cluster,
enforce at the ingress or move the buckets to shared Redis. Documented in the class.

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
**⚠️ PARTIALLY FIXED 2026-07-30 — config-in-git and the production profile are done (§17);
Docker, CI/CD and observability remain OPEN.**
`spring.profiles.active` defaults to `dev` (`application.properties:4`) and there is **no
`application-prod.properties`**. Both `application.properties` and
`application-dev.properties` are gitignored (`backend/.gitignore:38-39`) and
`git ls-files backend/src/main/resources/` returns **nothing** — so a clean clone has no
port, no profile, no CORS list and no Mongo URI, and cannot be built or deployed
reproducibly. `application-dev.properties:2` holds a live Atlas connection string with an
embedded password in plaintext on disk. No Dockerfile, no compose file, no
`.github/workflows` anywhere in the repository. No Actuator / Micrometer / OpenTelemetry
— so no health, readiness, metrics or tracing (CLAUDE.md §12, §14, §15).
*Resolution (config half):* `application.properties` is now **tracked** — it holds only
`${ENV_VAR:local-default}` placeholders and no secret, so a clean clone is configurable and
runnable. New tracked `application-prod.properties` requires `MONGODB_URI`,
`REGULAONE_API_BASE_URL` and `PRIVACYPILOT_CORS_ORIGINS` **with no fallback**, so a
deployment that forgets one refuses to start rather than silently pointing at localhost; it
also switches off error detail leakage, caps request bodies and sets non-debug logging. New
tracked `application-dev.properties.example` documents what to copy locally.
`application-dev.properties` (the only file with a real password) stays gitignored, and
`.gitignore` now explains which files are tracked and why.
*Still OPEN:* no Dockerfile, no CI/CD pipeline (SAST + Trivy + OWASP Dependency-Check), no
Actuator health/readiness or metrics. `application-prod.properties` lists these explicitly as
prerequisites that live outside it, so the gap is documented rather than forgotten.

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

**M3 · No pagination on the remaining list endpoints.** (Audit trail now paged — §17.)
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

**M12 · Audit-trail search only covers the newest 1000 entries. (NEW — found while fixing
H3; pre-existing, not introduced by it.)**
**✅ FIXED 2026-07-30 — see §17.** The endpoint is now paged (`page`/`size`), the screen sends
its filters to the server and renders a pager, so a search runs across the whole trail.

`auditService.list()` accepts `entityType`, `q`, `action`, `from`, `to` and `limit`
(`services/auditService.js:21-32`), but the slice calls it with **no arguments**
(`store/slices/auditSlice.js:6`), and `AuditTrailPage` filters the fetched array in the
browser (`pages/Audit/AuditTrailPage.jsx` — `filtered`). Since the server caps any unfiltered
read at `MAX_LIMIT = 1000`, the screen only ever searches within the newest 1000 entries.
*Failure scenario:* an auditor searches for an actor's name to investigate an incident from
last year, the screen shows "no entries", and they conclude nothing happened — when the
entries exist but sit outside the window. For a legal-evidence trail, a silently incomplete
search is worse than a slow one. The H3 fix makes this cheap to close because the server can
now answer the real question: pass the on-screen filters into `fetchAudit` (debouncing the
text box) so the search runs across the whole trail, and show the user when the cap is hit.
*Not changed here:* wiring the UI to the server-side filters is a behaviour change to the
screen, outside the scope of the H3 query fix.

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
| A05 Security Misconfiguration | ⚠️ ~~H4~~ and ~~H7 config/prod profile~~ fixed; remaining: **H7** (no Docker/CI/observability), **M4** (headers) |
| A06 Vulnerable Components | ⚠️ **M10** (one patch behind), **L1/L2** (advisories present, exposure build-time only). Backend CVE scan **unable to verify** |
| A07 Auth Failures | ⚠️ Delegated and sound; **H1** and **L3** are the residual gaps |
| A08 Integrity Failures | ✅ Audit immutability enforced at DB layer; server owns lifecycle state |
| A09 Logging & Monitoring | ⚠️ Domain audit trail is strong and exports are now logged (H2 fixed), but **H7** (no metrics/alerting) means nothing is *monitored* |
| A10 SSRF | ✅ Not applicable — config-fixed single outbound target |

**OWASP ASVS L2:** V2 (rate limiting) now addressed. Still fails at minimum on V6
(data-at-rest encryption), V9 (TLS configuration) and V14 (build/CI hardening, security
headers). **Unable to verify** V1/V13 items requiring a running deployment.

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
| Query shape | **Audit reads fixed (H3):** filters, sort and limit are pushed into MongoDB and backed by compound indexes that are now actually created. The other list endpoints are still unpaginated full-collection reads (M3), and until H3 no index existed at all, so they were full scans. |
| Dashboard | Five collection reads plus in-Java aggregation per request. The audit scan — previously the part that would break first — now asks for only the 6 rows it displays (H3). |
| Indexes | **Fixed for the audit trail (H3):** three compound indexes, each ending on `createdAt` so the newest-first sort is index-backed, created at start-up by `MongoIndexConfig`. Other collections still rely on the single-field `tenantId` index — which, note, only began to exist once index creation was wired up. |
| Payloads | Still unbounded on writes — no `@Size`, no body cap (M2). Reads: the audit trail is now paged and capped before the query runs; the other list endpoints remain unpaginated (M3). |
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
- **Indexes.** Audit trail: three compound indexes, each listing its equality fields then
  ending on `createdAt` descending so the newest-first sort is index-backed, created at
  start-up by `MongoIndexConfig` (H3 fixed, §17). Other collections: the inherited
  single-field `tenantId` index only. **Note:** before the H3 fix *no index was created at
  all* — Spring Data's `spring.data.mongodb.auto-index-creation` defaults to off and is set
  nowhere here, so every `@Indexed`/`@CompoundIndex` annotation in the module was pure
  documentation and every list query was a full collection scan. Adding
  `(tenantId, deleted, updatedAt)` to the other collections is the natural follow-up.
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
| Rate limiting | ✅ token-bucket per session/address, stricter on writes, 429 + `Retry-After` (§17) |
| Pagination | ⚠️ **audit trail paginated** (`page`/`size`, default 25, max 1000 — §17); the other list endpoints still return whole collections (M3) |
| Documentation | ⚠️ Postman collection complete and current (50 requests, incl. the new Exports folder); no OpenAPI served (L5) |

---

## 9. Infrastructure & Deployment Review

| Area | Status | Evidence |
|---|---|---|
| Env config | ✅ Env-var driven, **tracked in git**, placeholders only | `application.properties`, `application-prod.properties`, `application-dev.properties.example` (§17) |
| Config in version control | ✅ **Fixed** — base, prod and dev-template tracked; only the credential-bearing dev file ignored | `git check-ignore` verified per file (§17) |
| Secrets committed | ✅ None | verified across backend props, `.env`, Postman |
| Secret management | ⚠️ No vault/KMS; live Atlas password sits plaintext in a local file | `application-dev.properties:2` |
| Production profile | ✅ **Added** — required env vars have no fallback, so a mis-deployed service refuses to start | `application-prod.properties` (§17) |
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
| Security of processing | Art. 32 | ⚠️ Partial | Rate limiting now in place (H4 fixed); **still** no field-level encryption (H5) and no TLS configured (H9) |
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
| Production configuration enabled | ✅ `application-prod.properties` tracked; required env vars fail fast; base config in git (§17) |
| Secrets stored securely | ⚠️ not committed, required vars now documented and fail-fast; still no vault/KMS, and the local dev password sits plaintext on disk |
| Dependencies current | ⚠️ Spring Boot one patch behind (M10); 7 npm advisories, all build-time or non-applicable (L1/L2) |
| No known critical vulnerabilities | ⚠️ no *critical* advisory applies to shipped code; H1/H2 fixed, but **H5** (no encryption at rest) and **H6** (no erasure) remain self-inflicted equivalents |
| Monitoring & logging production-ready | ❌ no health, metrics, tracing or alerting; logging levels are at least pinned away from DEBUG in prod (§17) |
| Backup & recovery in place | ⚠️ **Unable to verify** |
| Automated tests | ⚠️ 67 hermetic tests on the fixed areas (§17), but coverage of the product as a whole is still far below the 80% target, and the original context-load test still needs the live database (H8) |
| Can safely operate in production | ❌ |

---

## 12–15. Consolidated Issue List

**High — must fix before go-live**

| # | Issue | Fix |
|---|---|---|
| ~~H1~~ | ~~Account status / plan / module entitlement enforced only in the browser~~ | **✅ FIXED** — `PrivacyPilotAccessPolicy` enforced in `RegulaOneAuthClient.resolve()`; 15 tests (§17) |
| ~~H2~~ | ~~`AuditAction.EXPORT` never written; all exports client-side~~ | **✅ FIXED** — `POST /api/privacypilot/exports` recorded before all 8 export paths; 10 tests (§17) |
| ~~H3~~ | ~~Audit query loads and sorts the whole tenant collection in memory, unindexed~~ | **✅ FIXED** — query pushed into Mongo + compound indexes actually created at start-up; 19 tests (§17) |
| ~~H4~~ | ~~No rate limiting or brute-force protection~~ | **✅ FIXED** — token-bucket filter on all `/api/**`, reads/writes separate, 429 + `Retry-After`; 12 tests (§17) |
| H5 | No field-level encryption / KMS / per-tenant keys for PII | Mongo CSFLE or app-layer AES-GCM via KMS |
| H6 | No erasure path; subject PII frozen in the immutable audit trail | Stop auditing subject identifiers; add crypto-shred erasure; document the retention basis |
| H7 | ~~config not in git, no production profile~~ **✅ fixed (§17)**; Docker, CI/CD and observability **still open** | Add a multi-stage non-root Dockerfile, a pipeline with SAST/Trivy/Dependency-Check, and Actuator health + metrics |
| H8 | No usable test suite (sole test needs the production Atlas cluster) | Hermetic tests: tenant isolation, RBAC matrix, deadline maths, 72 h clock, DPIA thresholds |
| H9 | No HTTPS anywhere in configuration; `cookie.secure` defaults false; CSP built from `http://` origins | TLS 1.3 + HSTS at the edge; force `secure`; `https://` `VITE_*` values |

**Medium**

~~M1 stored DOM-XSS in the notice print title~~ (**✅ fixed**, §17) · M2 thin DTO validation, `SettingsRequest`
unvalidated, no body cap · M3 no pagination · M4 CSP meta-only (`frame-ancestors`
ineffective), no security headers · M5 mock AI seeds fake data into browser storage and
logs nowhere auditable · M6 frontend/backend RBAC drift (DPO gets a DPIA editor the API
refuses) · M7 no CSRF token + shared cookie domain widens blast radius · M8 no
transactions · M9 no retention/deletion schedule · M10 Spring Boot 4.0.6 → 4.0.7 ·
M11 tenant-less super-admin is undefined behaviour · **~~M12 audit-trail search only covers
the newest 1000 entries~~ (**✅ fixed** — endpoint paginated and the UI now filters server-side, §17).

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

Deployment was blocked by nine High findings; **three are now fixed** (§17): entitlement is
enforced server-side (**H1**), every export is recorded in the audit trail (**H2**), and the
audit query no longer loads a ten-year collection into memory — with the indexes it needs
now actually created (**H3**).

**Four and a half remain.** The most consequential is **H6**: there is still no erasure path,
and data subjects' names sit permanently in an immutable audit collection, which is a live GDPR
Art. 17 problem rather than an operational one. The rest are the missing operational floor —
field-level encryption (**H5**), TLS (**H9**), the unfinished part of **H7** (no container, no
CI/CD pipeline, no health checks or metrics), and a test suite that meaningfully covers the
product (**H8**, now at 67 hermetic tests rather than none).

Resolve **H5, H6, H8, H9** and the rest of **H7** (H1–H4 are now fixed, H7 half — §17), and settle the **EEA data-residency and
backup/DR questions** — which cannot be answered from this repository at all — before any
regulated EU/Poland production deployment.

---

## 17. Remediation Log

### 2026-07-30 — H4 fixed (rate limiting) and H7 half fixed (config in git + prod profile)

**1. Files modified**

| File | Change |
|---|---|
| `backend/src/main/resources/application.properties` | **now tracked in git** — rewritten as placeholders-only base config (no secret), plus the auth-client timeouts and rate-limit settings that were previously undocumented |
| `backend/src/main/resources/application-prod.properties` | **new, tracked** — production profile; required variables have **no fallback**, so a mis-deployed service refuses to start |
| `backend/src/main/resources/application-dev.properties.example` | **new, tracked** — template a developer copies to create their gitignored local file |
| `backend/.gitignore` | ignores only the two files that hold real credentials, and says which files are tracked and why |
| `backend/.../security/RateLimitFilter.java` | **new** — token-bucket flood protection on every `/api/**` request |
| `backend/src/test/.../security/RateLimitFilterTest.java` | **new** — 12 hermetic tests |
| `frontend/src/services/client.js` | recognises 429, announces it once via a window event, carries `retryAfter` on the error |
| `frontend/src/App.jsx` | shows the "slow down" notice once, centrally |
| `frontend/src/i18n/en.js`, `pl.js` | 2 new keys (parity 359 = 359) |

**2. Old behaviour**

*Config:* `.gitignore` excluded **both** `application.properties` and
`application-dev.properties`, and `git ls-files src/main/resources/` returned nothing. A clean
clone therefore had no port, no active profile, no CORS list and no database URI — it could
not be started or deployed without someone privately sharing their own copy. There was no
production profile at all; `spring.profiles.active` defaulted to `dev`, so a production
deployment silently ran dev configuration and depended entirely on undocumented environment
variables.

*Rate limiting:* none. No limiter dependency, no filter, no gateway config.

**3. New behaviour — configuration**

Three tracked files, none containing a secret:

- **`application.properties`** — base config with `${ENV_VAR:local-default}` throughout, so a
  clean clone runs against a local MongoDB with no extra steps. It now also carries the
  RegulaOne timeout/cache settings and the rate-limit settings, which previously existed only
  as hard-coded annotation defaults.
- **`application-prod.properties`** — activated with `SPRING_PROFILES_ACTIVE=prod`. The three
  values that must never be guessed — `MONGODB_URI`, `REGULAONE_API_BASE_URL`,
  `PRIVACYPILOT_CORS_ORIGINS` — are declared **without a fallback**, so Spring refuses to
  start if the deployment omits one. It also disables error-detail leakage, caps request
  bodies at 256 KB, sets `forward-headers-strategy` (needed for correct client addresses
  behind a proxy, which the rate limiter relies on), and pins logging away from DEBUG because
  request payloads here contain personal data.
- **`application-dev.properties.example`** — the template, with a comment for every value.

`application-dev.properties`, the only file holding a real password, stays gitignored.

**4. New behaviour — rate limiting**

`RateLimitFilter` gives each caller a token bucket: requests spend tokens, tokens trickle back
at a fixed rate, and an empty bucket means 429 until it refills. Because a bucket starts full,
normal use — including a screen that legitimately fires six requests at once — never notices.

- **Reads and writes have separate buckets** (default 60 burst / 120 per minute for reads,
  20 / 30 for writes), so a heavy reader can never consume the allowance protecting the
  database from writes. All four write verbs count.
- **A caller is a session, not just an address:** the key is an irreversible SHA-256
  fingerprint of the `idToken` cookie when present, else the client address. The cookie itself
  is never stored or logged.
- It runs **before** the auth resolver, so a flood is stopped before it turns into a call to
  RegulaOne's `/api/auth/me` — this protects the platform's login service too.
- CORS pre-flight (`OPTIONS`) is exempt: refusing it would surface as a confusing CORS error
  instead of an honest 429 on the real request.
- The bucket map is bounded (50 000 callers) and sweeps idle entries, so the limiter cannot
  become a memory leak of its own. Eviction is safe by construction — a dropped bucket starts
  full, which can only ever be more generous.
- 429 responses use the same `AppResponse` envelope as every other error plus `Retry-After`,
  so the frontend needed no per-page handling. `client.js` recognises 429 once, centrally, and
  `App.jsx` shows one "slow down" notice (repeats within 5 s are swallowed — a burst of
  blocked calls is one problem, not ten toasts).

**5. Why the old code was changed**

No behaviour was removed. Un-ignoring `application.properties` was safe to do *because* it was
rewritten first to hold nothing but placeholders — the file's previous contents were already
secret-free, but the rewrite makes that a property of the file rather than a coincidence.
Un-ignoring is also not retroactive: the file was never committed, so no credential has ever
been in history. The rate limiter is purely additive.

A note on the implementation choice: bucket4j and resilience4j are the usual libraries, and
neither is available in this environment's Maven cache (no network access), so adding one could
not be verified to build. A hand-rolled token bucket avoids an unverifiable dependency, is ~60
lines of logic, and allows the session-aware keying a generic library would not give for free.
The trade-off is that it is per-instance rather than distributed, which is stated in the class
and in §4.2.

**6. Security & compliance impact**

Closes H4 and the OWASP API4:2023 ("Unrestricted Resource Consumption") gap; combined with the
H3 fix, the two endpoints that could previously be used to exhaust the server are now both
bounded and throttled. Brute-force attempts against any endpoint are now throttled per session
and per address. Supports GDPR Art. 32(1)(b) — resilience of processing systems.

On the configuration side: production can no longer be brought up pointing at a development
database or with a permissive CORS list, because those cases now fail at start-up instead of
booting quietly. `server.error.include-*=never` adds a second layer behind the global exception
handler against internal detail leaking to clients.

**7. Testing performed**

`./mvnw -o test` on the hermetic suites → **67 tests, 0 failures, 0 errors** (12 rate limit +
7 audit service + 18 audit repository + 5 index + 10 export + 15 access policy). The rate-limit
tests assert: traffic within the allowance passes; 429 once exhausted; the refusal carries
`Retry-After` and the standard envelope with `errorCode: RATE_LIMITED`; reads cannot starve
writes and writes are stricter; all four write verbs count; two addresses and two sessions are
counted separately; `OPTIONS` and non-API paths are exempt; the limiter can be switched off;
and a blocked caller recovers once tokens refill.

Configuration was verified by `git check-ignore` on each file (base/prod/example tracked,
dev ignored) and a credential grep over the three tracked files. Frontend `npm run build`
succeeds; i18n parity 359 = 359.

**8. Potential risks / side effects**

- **Not verified against a running app.** No database access here, so the app was never
  started: the prod profile's fail-fast behaviour and the filter's real HTTP path are reasoned
  and unit-tested, not executed. **Before deploying, start once with `SPRING_PROFILES_ACTIVE=prod`
  and a deliberately missing `MONGODB_URI` to confirm it refuses to boot**, and once with all
  three set to confirm it does.
- *The default limits may be too tight for some real usage.* They were chosen against the
  heaviest screen in the app (a page loading four slices at once), but a bulk import or an
  unusually chatty client could trip them. Every number is a property, so raising them needs no
  code change — and `RATE_LIMIT_ENABLED=false` is an escape hatch.
- **Per-instance counters.** Running more than one instance multiplies the effective limit.
  Move to ingress-level or Redis-backed limiting before scaling horizontally.
- *`getRemoteAddr()` must be correct.* The prod profile sets
  `server.forward-headers-strategy=framework` so Spring reads the proxy headers; if the app is
  deployed behind a proxy that does **not** set `X-Forwarded-For`, every unauthenticated caller
  will share one bucket. Authenticated callers are unaffected (they key on the session).
- *Existing developers must act:* anyone with a local `application.properties` should re-pull —
  the tracked version now supplies the base values, and a stale local copy of the old file will
  simply be overwritten by git. Their `application-dev.properties` is untouched.

---

### 2026-07-30 — Audit trail paginated (closes M12, completes H3)

**1. Files modified**

| File | Change |
|---|---|
| `backend/.../dto/PageResponse.java` | **new** — reusable `{items, page, size, totalElements, totalPages, hasNext, hasPrevious}` envelope |
| `backend/.../repository/AuditEntryRepositoryCustom.java` | `search(...)` now takes a `Pageable` and returns `Page<AuditEntry>` |
| `backend/.../repository/AuditEntryRepositoryImpl.java` | filter-building extracted so the page query and the count query cannot diverge; skip/limit/sort pushed down; `PageableExecutionUtils` skips the count when it is not needed |
| `backend/.../service/audit/AuditQueryService.java` | `page`/`size` normalised and capped; returns `PageResponse` |
| `backend/.../controller/AuditController.java` | `page`/`size` query params replace `limit`; returns a page object |
| `frontend/src/services/auditService.js` | documented paged contract |
| `frontend/src/store/slices/auditSlice.js` | takes `{page, size, q, entityType}`, stores page counters; new `fetchAuditForExport` thunk |
| `frontend/src/pages/Audit/AuditTrailPage.jsx` | server-side filtering with a 300 ms debounce, match count, Previous/Next pager, export fetches the full filtered set |
| `frontend/src/i18n/en.js`, `pl.js` | 6 new keys (parity 357 = 357) |
| `postman/PrivacyPilot/…` | both audit requests rewritten with `page`/`size` and documented |
| `backend/src/test/.../service/AuditQueryServiceTest.java` | **new** — 7 tests on page/size normalisation |
| `backend/src/test/.../repository/AuditEntryRepositoryImplTest.java` | +4 paging tests |

**2. Old behaviour**

The endpoint took a single `limit` (default and maximum 1000) and returned a bare JSON array.
The screen fetched **one** unfiltered batch and then filtered it in the browser, so the
sidebar's search and record-type filter only ever looked at the newest 1000 entries, with no
indication that anything had been left out, and there was no way to reach older entries at all.

**3. New behaviour**

`GET /api/privacypilot/audit?page=0&size=25` returns one page plus the counters a pager needs.
`size` defaults to 25 and is trimmed to 1000; a negative page becomes the first page. The
screen sends its filters to the server (300 ms debounce on the text box, so typing is not one
request per keystroke), resets to page 1 whenever a filter changes, shows how many entries
match **across the whole trail**, and offers Previous/Next driven by the server's
`hasPrevious`/`hasNext` — so it can never offer a page that does not exist.

Export deliberately does **not** export the visible page: it re-queries with the same filters
at the 1000-row ceiling, so the file still holds the whole filtered result as before. When more
rows match than the ceiling allows, the user is told exactly how many were included and how
many matched, rather than silently receiving a truncated file.

**4. Why the old code was changed**

`limit` was removed rather than kept as an alias for `size`: two ways to express the same
bound invites the mistake that they disagree, and the module has no external API consumers
(both callers — the frontend and the Postman collection — are in this repository and were
updated in the same change). The client-side filtering was removed because it was the actual
defect: filtering a capped batch produces confidently wrong answers, which for a legal
evidence trail is worse than being slow.

**Breaking change, stated plainly:** the response body changed from a bare array to a page
object. There is no API versioning in this module yet (L5) and it is not deployed, so this is
a change to an unreleased contract — but any client outside this repository would break.

**5. Security & compliance impact**

Completes the H3 hardening: `size` is capped in the service *and* the repository refuses an
unpaged request, so there are now two independent barriers against a request that tries to read
the whole trail. The count query reuses the page query's filters by construction, so a total can
never be computed over a wider set than the caller is allowed to see — tenant scoping is the
first criterion of both. For GDPR Art. 5(2), the material gain is correctness: an auditor
searching the trail now searches all of it, so "no entries found" means what it says.

**6. Testing performed**

`./mvnw -o test` on the hermetic suites → **55 tests, 0 failures, 0 errors** (7 service + 18
repository + 5 index + 10 export + 15 access policy). The new tests cover: default page size;
a requested size honoured; an oversized `size` trimmed to the ceiling; zero/negative size
falling back to the default; a negative page clamped to the first; counters mapped through to
the response; an empty trail returning an empty page rather than an error; a later page issuing
`skip` in the database rather than reading the earlier pages; a full page triggering the count;
a short first page **skipping** the count query entirely; and the count query carrying the same
filters with no skip/limit. Frontend `npm run build` succeeds, i18n parity 357 = 357, Postman
collection re-parsed and valid (50 requests).

**7. Potential risks / side effects**

- **Not verified against a running app** — still no database access in this environment, so the
  paging was proven by capturing the queries, not by executing them. Worth a manual pass over
  the screen (type in the search box, change the dropdown, page forward and back, export) on
  first deploy.
- *Deep paging uses `skip`*, which MongoDB implements by walking the index to the offset. Fine
  for the pages a human clicks through; if someone jumps to page 4000 it degrades. The
  index-backed sort keeps it bounded, and the fix if it ever matters is keyset paging
  ("everything older than this timestamp") rather than offsets.
- *Two round trips on a full page* (rows + count). Deliberate, and skipped whenever the answer
  is already known.
- *The export ceiling is still 1000 rows.* Unchanged from before, but it is now surfaced to the
  user instead of being invisible. A true full-trail export would need streaming — worth doing
  before an auditor asks for ten years in one file.

---

### 2026-07-29 — H3 fixed: the audit query runs in the database, and the indexes now exist

**1. Files modified**

| File | Change |
|---|---|
| `backend/.../repository/AuditEntryRepositoryCustom.java` | **new** — declares `search(...)` and `findRecent(...)`, both requiring a row limit |
| `backend/.../repository/AuditEntryRepositoryImpl.java` | **new** — builds ONE Mongo query: all filters + newest-first sort + limit |
| `backend/.../repository/AuditEntryRepository.java` | extends the custom fragment; the three **unbounded** multi-row finders removed |
| `backend/.../models/document/AuditEntry.java` | three purpose-shaped compound indexes declared; note on the now-redundant single-field `entityId` index |
| `backend/.../config/MongoIndexConfig.java` | **new** — creates the declared indexes at start-up, idempotently, with logging |
| `backend/.../service/audit/AuditQueryService.java` | delegates to the repository; in-memory filter/sort/limit code removed |
| `backend/.../service/DashboardService.java` | asks for the 6 recent rows instead of the whole trail |
| `backend/src/test/.../repository/AuditEntryRepositoryImplTest.java` | **new** — 14 tests capturing the generated query |
| `backend/src/test/.../model/document/AuditEntryIndexesTest.java` | **new** — 5 tests pinning the index shapes |

**2. Old behaviour**

`AuditQueryService.list()` called `findByTenantIdAnd…OrderByCreatedAtDesc(tenantId)` — every
audit line the company had ever written — then applied the action, date-range and free-text
filters with Java streams and only then trimmed to 1000 rows. `DashboardService` called the
same unbounded finder on every dashboard load to display six lines. Because the trail is
append-only and kept for ten years, both grew without limit.

**3. The index discovery**

While fixing this it became clear that **no index existed at all**. Spring Data MongoDB has
not created indexes from annotations by default for several versions;
`spring.data.mongodb.auto-index-creation` (confirmed as the property name and default in the
Boot 4.0.6 configuration metadata) is set in neither `application.properties` nor
`application-dev.properties`. So `@Indexed` on `BaseDocument.tenantId` and the pre-existing
`@CompoundIndex` on `AuditEntry` were pure documentation — every list query in the module was
a full collection scan, and the audit sort had nothing to walk.

**4. New behaviour**

The database now receives the whole question at once. `AuditEntryRepositoryImpl.search()`
builds a single `Query` with the tenant, the soft-delete guard, the record type or record id,
the action, the `createdAt` range and the free-text `$or`, plus `Sort by createdAt DESC` and
`.limit(cap)`. MongoDB walks a matching index in order and stops once it has enough rows, so
memory is bounded by the limit rather than by the size of the trail. Three compound indexes
support the three query shapes the screen produces — each listing its equality fields first
and ending on `createdAt` descending, which is what makes the sort index-backed:

```
{tenantId: 1, deleted: 1, createdAt: -1}                    → default screen, action + date filters
{tenantId: 1, deleted: 1, entityType: 1, createdAt: -1}     → filtered to one kind of record
{tenantId: 1, deleted: 1, entityId: 1, createdAt: -1}        → one record's full history
```

`MongoIndexConfig` creates them on `ApplicationReadyEvent` using the same `IndexResolver` the
framework uses, so the annotations remain the single declaration. It runs after start-up (a
slow build cannot delay readiness), `createIndex` is a no-op when the index already exists,
and a failure is logged at ERROR without killing the app — a missing index makes queries
slow, whereas refusing to start takes the service down entirely.

**5. Why the old code was changed / removed**

The three unbounded finders were **deleted, not deprecated**: leaving them in place would let
the next developer reintroduce exactly this outage, and every question they answered is
answered by `search()` with a cap. The in-memory filter helpers in `AuditQueryService` went
with them — *what* matches is unchanged (actor name, record label, action name,
case-insensitive), only *where* the matching happens. Both `search()` and `findRecent()`
throw on a non-positive limit rather than treating it as "unlimited", so the failure mode is
a loud error in development instead of a silent full scan in production.

One deliberate hardening: the free-text term is wrapped in `Pattern.quote(...)` before it
becomes a MongoDB regex. Passing raw user input as a regex would have been both a correctness
bug (`.` matching any character) and a cheap CPU-exhaustion vector.

**6. Security & compliance impact**

Removes the trivial denial-of-service (`GET /audit` with no filters, repeatedly) and the
certain future outage of the endpoint that GDPR Art. 5(2) accountability depends on — an
audit trail that cannot be read is not usable evidence. Regex quoting closes a
pattern-injection/CPU-exhaustion path on an authenticated endpoint. Tenant scoping is
unchanged and still the first criterion of every query; a test pins it. No data, retention
period or lawful basis changed.

**7. Testing performed**

`./mvnw -o test` on the hermetic suites → **44 tests, 0 failures, 0 errors** (14 query +
5 index + 10 export + 15 access policy). The query tests capture the `Query` object handed to
`MongoTemplate` and assert: the tenant and soft-delete guard are always present; the limit
and the `createdAt: -1` sort are in the query, not applied afterwards; entity id, entity type
and action filters are pushed down; an entity id takes precedence over an entity type; open
and closed date ranges map to `$gte`/`$lte`; free text produces a three-column `$or`; the
search term is `\Q…\E`-quoted and case-insensitive (asserted with the input `.*(`); blank text
adds no condition; `findRecent` is limited and sorted; and both methods refuse a non-positive
limit. The index tests resolve the annotations through the framework's own `IndexResolver`
and pin all four compound shapes plus the total index count.

**8. Potential risks / side effects**

- **Not verified at runtime.** This environment has no DNS or database access, so the app was
  never started. The Spring Data fragment follows the required naming convention
  (`AuditEntryRepositoryImpl` beside `AuditEntryRepository`, constructor-injected
  `MongoTemplate`) and everything compiles, but *bean wiring and real index creation are
  unverified* — **start the app once and confirm the `[MongoIndexConfig] index ready on
  AuditEntry` lines appear** before trusting this in production.
- *First start-up after deploy will build indexes* on the existing audit collection. On a
  replica set this happens in the background and traffic keeps flowing, but on a large
  collection expect elevated I/O for the duration.
- *Index write cost:* the audit collection is the most write-heavy in the module and now
  maintains five indexes per insert. If insert throughput ever becomes the constraint, the
  redundant single-field `{entityId: 1}` index is the one to drop — noted in the model.
- *Free-text search is a non-anchored regex*, so it cannot use an index for the match itself.
  It is bounded by the index-ordered walk plus the row limit, which is what keeps it safe.
  If it ever becomes slow, a MongoDB text index on `actorName`/`entityLabel` is the next step.
- *API contract unchanged* — same query parameters, same response shape, so no frontend or
  Postman change was needed.
- **A limitation this fix exposed but did not change:** the audit screen never sends its
  filters to the API, so search covers only the newest 1000 entries. Recorded as **M12**.

---

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
