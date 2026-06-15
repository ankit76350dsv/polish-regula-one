# KSeFFlow — KSeF 2.0 Compliance Gap Analysis & Production Readiness Checklist

> **Prepared:** 2026-06-11
> **Scope:** Module 1 — KSeFFlow (KSeF E-Invoice System), RegulaOne SuperApp
> **Method:** Existing codebase inventory cross-checked against **official Polish Government sources only** (Ministerstwo Finansów / Krajowa Administracja Skarbowa, ksef.podatki.gov.pl, gov.pl, official KSeF 2.0 API specification). No third-party blogs or assumptions were used.

---

## 0. CRITICAL CONTEXT — THE OBLIGATION IS ALREADY LIVE

As of today (**2026-06-11**), mandatory KSeF is **in force**:

| Date | Who | Status today |
|---|---|---|
| **1 Feb 2026** | Taxpayers whose 2024 sales (incl. VAT) exceeded **200 mln zł** | **LIVE — obligation active** |
| **1 Apr 2026** | **All other** taxpayers | **LIVE — obligation active** |
| Until **31 Dec 2026** | Micro-taxpayers (≤10 000 zł gross monthly invoicing) — temporary exemption | Exempt for now |
| **1 Jan 2027** | Micro-taxpayers join; **authentication tokens phased out — only KSeF certificates remain** | Future |

**Implication:** This is not a "future compliance" exercise. Any RegulaOne tenant that is a Polish VAT payer is legally obligated **right now**. 2026 is a **grace year** — the Ministry has confirmed *no penalties are imposed for KSeF-related errors during 2026* ("w tym czasie nie są nakładane kary za błędy") — but the obligation to issue, send **and receive** structured invoices through KSeF exists today. The grace window is the runway to close every ❌ below.

**Sources:**
- [MF — Obowiązkowy KSeF odroczony do 1 lutego 2026 r.](https://www.gov.pl/web/finanse/obowiazkowy-ksef-odroczony-do-1-lutego-2026-r)
- [ksef.podatki.gov.pl — Podstawy prawne oraz kluczowe terminy](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/podstawy-prawne-oraz-kluczowe-terminy/)
- [MF — Co warto wiedzieć przed startem II etapu wdrożenia KSeF](https://www.gov.pl/web/finanse/co-warto-wiedziec-przed-startem-ii-etapu-wdrozenia-krajowego-systemu-e-faktur)
- [ksef.podatki.gov.pl — Etapy wdrożenia KSeF](https://ksef.podatki.gov.pl/etapy-wdrozenia-ksef/)

---

## ⏱️ Remediation status (updated 2026-06-11)

The critical gaps below have since been implemented in the backend (all compiling; unit tests for the new modules still to be written):

| # | Gap | Status | Key new/changed code |
|---|---|---|---|
| C1 | Receiving purchase invoices | ✅ implemented | `KsefReceivedInvoiceService/Controller`, `/invoices/query/metadata` + `/invoices/ksef/{nr}` client calls |
| C2 | Permissions (uprawnienia) | ✅ implemented (core: grant/query/revoke person perms) | `KsefPermissionsService/Controller`, `/permissions/*` client calls |
| C3 | KSeF certificate enrollment | ✅ implemented | `KsefCertificateEnrollmentService`, `KsefCsrGenerator` (BouncyCastle), `/certificates/enroll` |
| C4 | Offline/retry scheduler | ✅ implemented | `KsefRetryQueueService`, `KSeFInvoiceService.resubmitOffline`, `@EnableScheduling` |
| C5 | Correction invoices (KOR) | ✅ implemented | `FA3XmlBuilder` KOR block, `KSeFInvoiceService.createCorrection`, `POST /{id}/correct` |
| C6 | Committed secrets | ⛔ **NOT done — owner action** | purge git history + rotate Atlas creds + real encryption key |
| C7 | Failure-mode (awaria) detection | ✅ implemented | `KsefAvailabilityService/Controller`, pipeline mode wiring |
| C8 | FA(3) XSD validation | ✅ implemented | enabled in prod + warm-up gate in `Fa3ValidationGate` |

**Still outstanding:** unit/integration tests for the new modules; C6 (secrets — your action); Phase-2 items (batch sessions, email/push reminders, attachments, reports). See roadmap below.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Already implemented in codebase |
| ⚠️ | Partially implemented |
| ❌ | Missing |
| 🔥 | **Critical before production** (blocks legal use) |

| Requirement class | Meaning |
|---|---|
| **LEGAL** | Required by Polish statute/regulation — non-compliance = legal/tax risk |
| **TECH** | Technically required for the KSeF 2.0 API to work at all |
| **REC** | Recommended best practice (security, ops, usability) |

---

# 1. MANDATORY KSeF COMPLIANCE REQUIREMENTS

### 1.1 Legal basis (verified)
| Act | Dz.U. reference | Role |
|---|---|---|
| Ustawa 11.03.2004 o VAT (art. 106na–106nh) | consolidated | Core e-invoice / KSeF obligations, special modes |
| Ustawa 16.06.2023 | Dz.U. 2023 poz. 1598 | Mandatory KSeF framework |
| Ustawa 9.05.2024 | Dz.U. 2024 poz. 852 | First-stage postponement |
| Ustawa 5.08.2025 | Dz.U. 2025 poz. 1203 | Second-stage simplifications (current rules) |
| Rozporządzenia MF | Dz.U. 2025 poz. 1815, 1742, 1740; poz. 2481 (amended) | Implementing technical rules, certificates, modes |

*Source:* [Podstawy prawne oraz kluczowe terminy](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/podstawy-prawne-oraz-kluczowe-terminy/)

### 1.2 Compliance requirement matrix

| # | Requirement | Class | Status | Notes / Source |
|---|---|---|---|---|
| 1.1 | **FA(3)** logical structure for all e-invoices | LEGAL+TECH | ⚠️ | XML built to FA(3) namespace `http://crd.gov.pl/wzor/2023/06/29/12648/`, but **XSD validation disabled by default** and **attachments not supported**. [FA(3) publication](https://www.gov.pl/web/finanse/publikacja-dokumentacji-api-ksef-20-oraz-struktury-logicznej-fa3) |
| 1.2 | Submit invoices to KSeF 2.0 API and obtain **KSeF number** | LEGAL+TECH | ✅ | Online session send + poll for `ksefId` implemented |
| 1.3 | **Receive purchase invoices** (faktury otrzymane) via KSeF | LEGAL+TECH | ❌🔥 | Mandatory for **all entities** from 1 Feb 2026, even non-issuers. *"buyer acceptance is not required — the invoice is considered received when the system assigns it a number."* Code only **sends**. [Krok po kroku — jak odebrać fakturę](https://ksef.podatki.gov.pl/krok-po-kroku-jak-odebrac-fakture-w-ksef/) |
| 1.4 | **UPO** retrieval & 10-year retention | LEGAL+TECH | ✅ | `KsefUpoReceipt`, AES-256-GCM encrypted, SHA-256 hash, soft-delete only |
| 1.5 | **Offline modes**: offline24, offline-niedostępność, tryb awaryjny | LEGAL | ⚠️ | Model + QR present; **deadline-enforcing retry scheduler not implemented**; failure-mode detection (MF BIP) missing |
| 1.6 | **QR KOD I (OFFLINE)** on every invoice shared outside KSeF | LEGAL+TECH | ✅ | `KsefQrService.generateInvoiceCode` — encodes interface URL, issue date, seller NIP, invoice marker, SHA-256(256-bit) of XML. [Kody weryfikujące QR](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/kody-weryfikujace-qr/) |
| 1.7 | **QR KOD II (CERTYFIKAT)** on offline invoices, signed with **KSeF certificate type 2** | LEGAL+TECH | ⚠️ | QR generation present, but signing must use a **KSeF Type-2 certificate obtained via the KSeF API** — see 1.9 |
| 1.8 | **Authentication** to KSeF 2.0 | TECH | ⚠️ | Certificate XAdES-BES + token store present. Token auth is **valid only until 1 Jan 2027**; must migrate to KSeF certificate. Trusted Profile / qualified signature / qualified seal not offered for human onboarding |
| 1.9 | **KSeF Certificates** (request + download via API) | LEGAL+TECH | ❌🔥 | Code stores an **uploaded** PFX. KSeF 2.0 issues its **own** certificates (Type 1 auth, Type 2 offline) via API/app since Feb 2026, valid ≤ 2 years. Request/download endpoints **not implemented**. [Certyfikaty KSeF](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/certyfikaty-ksef/) |
| 1.10 | **Permissions model (uprawnienia)** management | LEGAL+TECH | ❌🔥 | KSeF requires granting/managing permissions (issue, receive, view, manage, self-invoicing, VAT RR, Peppol/PEF) to persons & entities. Code relies only on RegulaOne SSO roles — **no KSeF-side permission management**. [Aplikacja Podatnika KSeF 2.0](https://ksef.podatki.gov.pl/aplikacja-podatnika-ksef-20/) |
| 1.11 | **Batch session (sesja wsadowa)** for bulk submission | TECH | ❌ | Code implements only **interactive/online** session. Batch needed for volume |
| 1.12 | **Correction invoice** (faktura korygująca) workflow | LEGAL | ❌🔥 | No correction lifecycle in code |
| 1.13 | **Self-invoicing & VAT RR** invoice support | LEGAL | ❌ | VAT RR voluntary from 1 Apr 2026; self-invoicing is a distinct permission/flow |
| 1.14 | **Invoices with attachments** (faktury z załącznikami) | LEGAL | ❌ | Permitted from 1 Feb 2026; requires prior intent declaration in **e-US** (from 1 Jan 2026). Not supported |
| 1.15 | **10-year retention** of invoices, UPO, audit | LEGAL | ✅ | Soft delete + retention enforced (VAT Act art. 112) |
| 1.16 | **Audit trail** (immutable) | LEGAL | ✅ | `KsefAuditLog` append-only, tenant-scoped, 10-yr |
| 1.17 | **Test vs Production** environment switching | TECH | ✅ | `api-test.ksef.mf.gov.pl/v2` ↔ `api.ksef.mf.gov.pl/v2` via profile |

---

# 2. CORE FUNCTIONAL FEATURES

### ✅ Implemented
- Invoice draft creation, FA(3) XML generation (DOM build + serialize + SHA-256 hash)
- Online-session submission pipeline → poll → KSeF number → UPO storage → mark SENT
- Offline parking + dual QR generation + legal-deadline computation
- Certificate upload/encrypt/store (S3, AES-256-GCM), X.509 metadata extraction
- KSeF 2.0 XAdES authentication (challenge → sign → redeem → refresh)
- Multi-tenant isolation; immutable audit logs; in-app notifications model

### ⚠️ Partially implemented
- **Offline lifecycle**: invoices park, but nothing automatically **flushes them to KSeF** before the legal deadline (next business day / 7 business days)
- **Certificate model**: handles *uploaded* qualified certs, not KSeF-issued certificates
- **XSD validation**: present but **off by default** (`ksef.validation.xsd.enabled=false`)
- **Notifications**: in-app only; no email/push despite reminders being legally meaningful (deadlines)

### ❌ Completely missing
- **Receiving/querying purchase invoices** (bidirectional KSeF) — *legal gap*
- **Permissions (uprawnienia) management** — *legal/tech gap*
- **Batch session** processing
- **Correction / cancellation** invoice workflows
- **Attachments**, **VAT RR**, **self-invoicing**
- **Retry queue scheduler**, **certificate-expiry cron**, **failure-mode (awaria) detection**
- **Reports & dashboards**
- **Subscription / package / tenant admin** for the KSeF module

---

# 3. USER MANAGEMENT & SECURITY

| Item | Class | Status | Notes |
|---|---|---|---|
| Authentication (SSO via RegulaOne idToken) | REC | ✅ | Stateless; cookie validated server-to-server |
| RBAC roles | LEGAL | ⚠️ | App roles exist, but **not mapped to KSeF permission types** (see 1.10) |
| Tenant isolation | LEGAL | ✅ | `tenantId` on every query/document |
| Audit logging (user, IP, UA, old/new, ts) | LEGAL | ✅ | Immutable, 10-yr |
| Encryption at rest (AES-256-GCM) for certs, passwords, UPO, session tokens | LEGAL | ✅ | KMS/Vault references for passwords |
| TLS 1.3 / HSTS / secure cookies (in transit) | LEGAL | ⚠️ | KSeF calls over HTTPS; **verify TLS 1.3-only + HSTS at edge** |
| **Secrets hygiene** | LEGAL | ❌🔥 | `application-dev.properties` contains a **live MongoDB Atlas URI with credentials** and an all-zero encryption key. Must be **purged from git history**, rotated, and moved to env/secret manager. Violates CLAUDE.md §17 "never commit secrets" |
| Data residency (EEA) | LEGAL | ⚠️ | S3 `eu-central-1` (Frankfurt) ✅; **confirm MongoDB Atlas cluster region is EEA** |
| Right-to-erasure vs 10-yr retention reconciliation | LEGAL | ⚠️ | Document the legal-retention override of GDPR erasure for invoice data |

---

# 4. INVOICE LIFECYCLE MANAGEMENT

| Stage | Status | Gap / Risk |
|---|---|---|
| Creation (draft) | ✅ | — |
| Validation (pre-flight field checks) | ⚠️ | Add **XSD validation against final FA(3)** before submit (enable + pre-build grammar) |
| Submission to KSeF (online) | ✅ | — |
| Status tracking | ✅ | Polls per-invoice status until `ksefId` |
| **Correction (korygująca)** | ❌🔥 | No flow — legally required to correct issued invoices |
| **Cancellation / rejection handling** | ⚠️ | Rejected-by-KSeF path exists via error capture; no structured user remediation flow |
| **Resubmission / retry** | ⚠️🔥 | `RETRYING`/`OFFLINE_MODE` states exist but **no scheduler** drives them — deadline breaches likely |
| **Bulk processing (batch session)** | ❌ | Volume tenants cannot batch-submit |

---

# 5. KSeF INTEGRATION REQUIREMENTS

| Item | Class | Status | Notes |
|---|---|---|---|
| Auth: KSeF certificate (XAdES-BES) | TECH | ✅ | Correct mechanism |
| Auth: token (interim) | TECH | ⚠️ | **Sunset 1 Jan 2027** — plan migration |
| Auth: Trusted Profile / qualified sig / seal (human onboarding to obtain KSeF cert) | TECH | ❌ | Needed to *bootstrap* a tenant's first KSeF certificate |
| API base URLs test/prod | TECH | ✅ | v2 endpoints |
| Session: online/interactive | TECH | ✅ | — |
| Session: **batch (wsadowa)** | TECH | ❌ | Missing |
| Session encryption (AES-256-GCM, MF public-key wrap) | TECH | ✅ | — |
| XML schema validation pre-send | TECH | ⚠️ | Disabled by default |
| **Receive/query endpoints** (faktury otrzymane) | TECH | ❌🔥 | Missing |
| **Permissions endpoints** | TECH | ❌🔥 | Missing |
| **Certificate request/download endpoints** | TECH | ❌🔥 | Missing |
| Error handling | REC | ✅ | Typed exceptions, API log |
| Retry / exponential backoff | REC | ⚠️ | Logic referenced; **no scheduler** |
| **Failure-mode (awaria) detection** via MF BIP / interface flag | LEGAL | ❌ | Required to lawfully enter `tryb awaryjny` and apply the 7-business-day deadline. [Tryb awaryjny](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-awaryjny/) |
| Monitoring of KSeF availability (health ping) | REC | ⚠️ | `lastPingMs` field exists; no job |

**Verified deadlines** ([Tryb offline24](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-offline24/), [Tryby szczególne](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryby-szczegolne-wystawiania-faktur/)):
- **offline24** → send to KSeF **no later than the next business day** after issue.
- **tryb awaryjny** → send **within 7 business days** from the end of the announced failure.

---

# 6. NOTIFICATIONS & COMMUNICATION

| Item | Status | Notes |
|---|---|---|
| In-app notifications | ✅ | Model + targeting |
| Submission success / failure alerts | ⚠️ | In-app only |
| **Offline-deadline reminders** | ❌🔥 | Legally meaningful (deadline breach = compliance failure) — needs email/push |
| Certificate-expiry reminders (cert ≤ 2 yr) | ❌ | No cron |
| **System/awaria alerts** (KSeF down) | ❌ | Tie to failure-mode detection |
| Email transport | ❌ | No SMTP/EmailService (note: RegulaOne send-email API exists — reuse it) |

---

# 7. REPORTS & DASHBOARDS

All ❌ (none implemented in KSeFFlow):
- Compliance report (issued vs received vs UPO-confirmed)
- Submission report / status report (by period, by status)
- **Audit report export** (LEGAL — must be exportable, 10-yr) — *audit data exists, export UI/endpoint missing*
- User-activity report
- Financial dashboard (VAT totals, by rate)
- Operational dashboard (queue depth, offline backlog, failures, KSeF latency)

---

# 8. ADMINISTRATION FEATURES

| Item | Status | Notes |
|---|---|---|
| Tenant management | ⚠️ | Inherited from RegulaOne; no KSeF-specific tenant config UI |
| Company settings (NIP, environment, default cert) | ⚠️ | Config via properties, not per-tenant admin |
| **KSeF permission administration** | ❌🔥 | See 1.10 |
| Configuration management | ⚠️ | Profile-based |
| Subscription / package management | ❌ | Not present in module |
| System admin tools (queue, cert, session inspection) | ❌ | — |

---

# 9. PRODUCTION READINESS CHECKLIST

| Item | Class | Status | Action |
|---|---|---|---|
| **Purge committed secrets + rotate** | LEGAL | ❌🔥 | Remove Atlas creds + zero-key from git history; rotate DB password; use secret manager |
| Real encryption key in all envs | LEGAL | ❌🔥 | Replace all-zero dev key; enforce 32-byte key presence at boot |
| TLS 1.3-only, HSTS, secure cookies | LEGAL | ⚠️ | Verify at gateway |
| Data residency (Mongo + S3 in EEA) | LEGAL | ⚠️ | Confirm Atlas region |
| Centralized logging / metrics / tracing (Prometheus, Grafana, OTel) | REC | ❌ | CLAUDE.md §15 |
| Backups + PITR + restore test (10-yr) | LEGAL | ❌ | CLAUDE.md §8/§16 |
| Disaster recovery / multi-region | REC | ❌ | — |
| Scalability (batch, queue workers) | REC | ⚠️ | Tied to batch/retry |
| Rate limiting / WAF / CSRF on public endpoints | LEGAL | ⚠️ | Verify per CLAUDE.md §6 |
| **XSD validation enabled with pre-built grammar** | TECH | ⚠️ | Avoid 233s cold-start; warm at boot |
| 80%+ backend test coverage | REC | ⚠️ | Core covered; new modules need tests |
| DevSecOps scans (SAST, Trivy, OWASP DC, secret scan) | REC | ❌ | CLAUDE.md §14 |
| Antivirus/MIME scan on uploads (certs, attachments) | LEGAL | ⚠️ | Size/MIME checked; AV scan not evident |

---

# 10. ADVANCED & FUTURE FEATURES (all ❌ — optional)
- AI invoice-data validation (NIP/VAT/amount anomaly detection pre-submit)
- AI compliance checking against FA(3) rules
- Automated workflow orchestration (offline backlog auto-flush, smart retry)
- Intelligent KSeF error analysis (map API error codes → user guidance)
- Advanced analytics (VAT trends, supplier risk, duplicate detection)

---

# 11. CONSOLIDATED GAP ANALYSIS

### 🔥 Critical before production (legal blockers)
| # | Gap | Class | Risk if missing |
|---|---|---|---|
| C1 | **Receive purchase invoices** (faktury otrzymane) | LEGAL | Tenants cannot lawfully operate as buyers; missing input-VAT documentation |
| C2 | **KSeF permissions (uprawnienia) management** | LEGAL | Cannot authorize users/accounting offices; auth bootstrap fails |
| C3 | **KSeF certificate request/download via API** | LEGAL | Cannot sign KOD II / authenticate after token sunset (Jan 2027) |
| C4 | **Retry/offline scheduler enforcing legal deadlines** | LEGAL | Deadline breach (next-day / 7-day) = compliance violation |
| C5 | **Correction invoice (korygująca) workflow** | LEGAL | Cannot lawfully correct invoices |
| C6 | **Purge committed secrets + real keys** | LEGAL/SEC | Data breach, GDPR/RODO exposure |
| C7 | **Failure-mode (awaria) detection** | LEGAL | Wrong mode → wrong deadline → violation |
| C8 | **XSD validation against final FA(3) before send** | TECH | Rejected submissions, silent data errors |

### ⚠️ High priority
Batch session; email/push deadline & expiry reminders; audit export endpoint; per-tenant KSeF config admin; attachments support; TLS/residency verification; XSD warm-up.

### Recommended
Reports/dashboards; observability stack; DR/backups; DevSecOps scans; AV scanning; AI features.

---

# 12. DEVELOPMENT ROADMAP

### Phase 1 — Critical before launch (legal compliance) 🔥
1. **Security remediation** — purge secrets from git history, rotate Atlas credentials, enforce real 32-byte encryption keys, confirm EEA residency for MongoDB. *(C6)*
2. **Receiving purchase invoices** — implement query/download endpoints (`faktury otrzymane`), storage, dedupe, 10-yr retention. *(C1)*
3. **KSeF certificate lifecycle via API** — request, download, store Type 1 (auth) + Type 2 (offline/QR signing); migrate KOD II signing to Type 2. *(C3)*
4. **Permissions (uprawnienia) management** — grant/revoke/list permissions, map RegulaOne roles → KSeF permission types, accounting-office & self-invoicing support. *(C2)*
5. **Retry/offline scheduler** — cron worker that flushes offline/queued invoices before the next-business-day / 7-business-day deadline, with backoff and audit. *(C4)*
6. **Failure-mode detection** — consume MF BIP / interface availability flag to lawfully enter `tryb awaryjny`/`offline-niedostępność`. *(C7)*
7. **Correction invoice workflow** — faktura korygująca creation, linkage, submission. *(C5)*
8. **Enable XSD validation** with boot-time grammar warm-up. *(C8)*

### Phase 2 — High priority (operational efficiency)
- Batch session (sesja wsadowa) for bulk submit.
- Email + push notifications (reuse RegulaOne send-email API) for deadlines, failures, certificate expiry.
- Certificate-expiry & session-health cron jobs.
- Audit-log export endpoint (CSV/XML), 10-yr-ready.
- Per-tenant KSeF configuration admin (NIP, environment, default certificate, permissions).
- Attachments (faktury z załącznikami) incl. e-US intent declaration handling.

### Phase 3 — Medium priority (usability & maintenance)
- Reports: compliance, submission, status, user-activity.
- Dashboards: financial (VAT by rate) + operational (queue, backlog, latency).
- Observability: Prometheus / Grafana / OpenTelemetry; uptime + alerting.
- Backups, PITR, DR test; DevSecOps scanning pipeline; AV/MIME scan on uploads.
- VAT RR & self-invoicing flows.

### Phase 4 — Future enhancements (optional)
- AI invoice validation & compliance checking; intelligent error analysis; advanced analytics; automated backlog orchestration.

---

# 13. OFFICIAL SOURCES (verified)

| Topic | Official link |
|---|---|
| Legal basis & key dates | https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/podstawy-prawne-oraz-kluczowe-terminy/ |
| Postponement to 1 Feb 2026 | https://www.gov.pl/web/finanse/obowiazkowy-ksef-odroczony-do-1-lutego-2026-r |
| Stage II — what to know | https://www.gov.pl/web/finanse/co-warto-wiedziec-przed-startem-ii-etapu-wdrozenia-krajowego-systemu-e-faktur |
| Implementation stages | https://ksef.podatki.gov.pl/etapy-wdrozenia-ksef/ |
| API 2.0 & FA(3) publication | https://www.gov.pl/web/finanse/publikacja-dokumentacji-api-ksef-20-oraz-struktury-logicznej-fa3 |
| KSeF certificates | https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/certyfikaty-ksef/ |
| Special issuing modes | https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryby-szczegolne-wystawiania-faktur/ |
| offline24 | https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-offline24/ |
| Emergency mode (awaryjny) | https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-awaryjny/ |
| QR verification codes | https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/kody-weryfikujace-qr/ |
| Receiving an invoice (step-by-step) | https://ksef.podatki.gov.pl/krok-po-kroku-jak-odebrac-fakture-w-ksef/ |
| Taxpayer App / permissions | https://ksef.podatki.gov.pl/aplikacja-podatnika-ksef-20/ |
| API interface specification | https://ksef-demo.mf.gov.pl/document/InterfaceSpecification/1.4/EN |
| KSeF 2.0 Manual Pt. I (auth, permissions) | https://ksef.podatki.gov.pl/media/jzrevse3/podrecznik-ksef-20-cz-i-rozpoczecie-korzystania-z-ksef-20260209.pdf |
| KSeF 2.0 Manual Pt. II (issuing & receiving) | https://ksef.podatki.gov.pl/media/3zidazbw/podrecznik-ksef-2-0-cz-ii-wystawianie-i-otrzymywane-faktur-w-ksef.pdf |
| Test API docs | https://api-test.ksef.mf.gov.pl/ |

> **Documentation duty (CLAUDE.md §24):** record the official source above against each feature in its PR/spec before implementation. The FA(3) XSD and API spec must be re-checked against the Central Repository of Electronic Document Templates (CRD/ePUAP) at build time, as MF revises them periodically.
