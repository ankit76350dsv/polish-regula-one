# KSeFFlow — KSeF Integration / Government API Center (developer guide)

This document explains the **Integration** page end to end: what it's for, the UI, every API, how
the KSeF availability state actually works, the operation modes and their legal deadlines, the
connection configuration, permissions, and the files involved. Aimed at a developer new to this area.

UI route: `/company/{tenantId}/integration` (sidebar: "Government API Center")
→ [`IntegrationCenter.jsx`](../frontend/src/components/IntegrationCenter.jsx)

---

## 1. What the page is for

A small operations dashboard for the connection to the **National e-Invoice System (KSeF)**. It
answers three questions and lets an admin act on one of them:

1. **What state is KSeF in?** — `ONLINE`, `OFFLINE_UNAVAILABILITY`, or `EMERGENCY`. This state sets
   the **legal deadline** by which invoices issued offline must reach KSeF.
2. **Which KSeF are we talking to?** — the configured environment (Test/Sandbox vs Production), the
   real base URL, and the invoice schema.
3. **What do the modes mean?** — a short explainer that backs the "Declare …" actions.

> This page only shows **real** data. Earlier it contained a fabricated request/response "terminal",
> a fake latency number, "simulate failure" buttons, and a crypto-algorithm claim — all removed
> because none of it was real. Detailed per-action activity/errors live in the **Audit Center**.

---

## 2. Architecture at a glance

```
Browser (IntegrationCenter.jsx)
   │  ksefFetch()  → KSeFFlow backend (:8081)  /api/v1/ksef-status/**
   ▼
KsefAvailabilityController
   ├── GET  /ksef-status              → current operation mode (read, any signed-in user)
   ├── GET  /ksef-status/connection   → environment + base URL + schema (read)
   └── POST /ksef-status/{emergency|unavailability|online}  → declare a state (KSEF_PLATFORM_ADMIN)
        │
        ▼
KsefAvailabilityService   (the source of truth for the mode)
   ├── in-memory AtomicReference<Status>   ← cache; process-wide (global)
   ├── ksef_availability (Mongo, id "GLOBAL")  ← durable copy; loaded on boot, upserted on change
   ├── @Scheduled monitor()  → probes KSeF reachability, flips ONLINE↔UNAVAILABILITY
   └── currentOfflineMode()  → EMERGENCY ⇒ 7-business-day window, else next-business-day
        │
        ▼
KSeFInvoiceService.submitInvoice()  → if mode ≠ ONLINE, skip online flow → issue OFFLINE

KsefApiProperties  → environment (SANDBOX/PRODUCTION) + base URLs + FA(3) schema
```

---

## 3. Frontend

**Component:** [`IntegrationCenter.jsx`](../frontend/src/components/IntegrationCenter.jsx)
**API client:** [`ksefApi.js`](../frontend/src/api/ksefApi.js)
**Permission helper:** [`lib/permissions.js`](../frontend/src/lib/permissions.js) → `can.manageAvailability(permissions)`

Layout:
1. **KSeF State (Operation Mode)** — the live mode badge + `reason` / `declaredBy` / `since`, a
   **Refresh** button, and (admins only) **Declare Emergency / Declare Unavailability / Restore
   Online** buttons. Declaring prompts for a reason (recorded for audit).
2. **KSeF connection** — environment, endpoint, invoice schema (read-only; server-controlled).
3. **Operation modes** — concise explainer of the three modes and their deadlines (supports the
   Declare buttons).

Frontend API functions (all `ksefFetch`, cookie-auth, tenant resolved server-side):

| Function | Method + path |
|---|---|
| `getKsefStatus()` | `GET /api/v1/ksef-status` |
| `getKsefConnection()` | `GET /api/v1/ksef-status/connection` |
| `declareKsefEmergency(reason)` | `POST /api/v1/ksef-status/emergency` |
| `declareKsefUnavailability(reason)` | `POST /api/v1/ksef-status/unavailability` |
| `declareKsefOnline(reason)` | `POST /api/v1/ksef-status/online` |

Navigation/visibility:
- The page is in the sidebar under "Government API Center"; access is gated by
  `PAGE_ROLES_REQUIRED.integration` in [`App.jsx`](../frontend/src/App.jsx) (Super Admin, Company Admin).
- The Declare buttons render only when `can.manageAvailability(permissions)` is true; everyone else
  sees a read-only note.

---

## 4. Our backend API (`/api/v1/ksef-status`)

Controller: [`KsefAvailabilityController.java`](../backend/src/main/java/com/ksefflow/backend/controllers/KsefAvailabilityController.java)

| Endpoint | Permission | Returns / does |
|---|---|---|
| `GET /` | any signed-in user | `Status { mode, manual, reason, declaredBy, since }` |
| `GET /connection` | any signed-in user | `ConnectionInfo { environment, baseUrl, invoiceSchema }` |
| `POST /emergency` | `KSEF_PLATFORM_ADMIN` | declare EMERGENCY (reason required) |
| `POST /unavailability` | `KSEF_PLATFORM_ADMIN` | declare OFFLINE_UNAVAILABILITY (reason required) |
| `POST /online` | `KSEF_PLATFORM_ADMIN` | clear a manual declaration, hand back to the monitor |

> **Why `KSEF_PLATFORM_ADMIN` and not `KSEF_ADMIN`?** The state is **global** — one value
> for every tenant (KSeF emergency/unavailability is a national fact from the Ministry of Finance).
> Letting a per-company `KSEF_ADMIN` flip it would change how *other* tenants issue invoices,
> breaking tenant isolation (CLAUDE.md §9). So declaring is restricted to the **platform operator**
> (`KSEF_PLATFORM_ADMIN`), granted only to the operator's own account and **not** offered in the
> tenant permission picker. KSEF admins are **read-only** here.

The declare endpoints write an immutable audit entry (`KSEF_EMERGENCY_DECLARED`,
`KSEF_UNAVAILABILITY_DECLARED`, `KSEF_ONLINE_DECLARED`) — see §6.

### Which of our endpoints call the government KSeF API

Important: **none of this page's HTTP endpoints call KSeF synchronously.** They only read/write the
local in-memory state and config. The single thing that actually talks to the government here is the
**background monitor** (a scheduled job, not a user request).

| Our endpoint / job | Hits the government KSeF API? | Government endpoint |
|---|---|---|
| `GET /api/v1/ksef-status` | ❌ no | — reads the in-memory mode |
| `GET /api/v1/ksef-status/connection` | ❌ no | — reads local config (`KsefApiProperties`) |
| `POST /ksef-status/emergency` \| `/unavailability` \| `/online` | ❌ no | — sets the global mode (in memory + persisted to Mongo) + writes an audit entry |
| **`KsefAvailabilityService.monitor()`** (`@Scheduled`, ~every 2 min) | ✅ yes | **`GET {activeBaseUrl}/security/public-key-certificates`** |

The monitor's probe is implemented by [`KsefApiClient.isApiReachable()`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KsefApiClient.java):
a **cheap, unauthenticated `GET`** to the KSeF public-key-certificates endpoint. It just checks
reachability — a 2xx (or any non-5xx) means "KSeF is up", a 5xx / connection failure means "down".
It never throws. With the dev sandbox config the full URL is:

```
GET https://api-test.ksef.mf.gov.pl/v2/security/public-key-certificates
```

So the mode you see on the page is maintained by that background probe (and by manual declarations) —
not fetched live when you open the page or click **Refresh** (Refresh just re-reads the in-memory
state). For the KSeF endpoints used by *other* flows (auth/session, invoice send/status, UPO,
certificates), see [`KsefApiClient`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KsefApiClient.java)
and the [certificates guide](./certificates.md).

---

## 5. How the availability state works (important)

Service: [`KsefAvailabilityService.java`](../backend/src/main/java/com/ksefflow/backend/services/KsefAvailabilityService.java)

- The live state is an **in-memory `AtomicReference<Status>`** (a fast cache for reads), and it is
  also **persisted to MongoDB** as a single global document — collection **`ksef_availability`**,
  fixed id **`"GLOBAL"`** ([`KsefAvailabilityState`](../backend/src/main/java/com/ksefflow/backend/models/KsefAvailabilityState.java)
  via [`KsefAvailabilityStateRepository`](../backend/src/main/java/com/ksefflow/backend/repository/KsefAvailabilityStateRepository.java)).
  Consequences a developer must know:
  - It is **process-wide / global** — one value for *all* tenants (KSeF availability is a national
    fact, not per-company). The declaration audit entry is recorded with tenantId `SYSTEM`.
  - On startup, `@PostConstruct loadPersistedState()` **restores the saved state from Mongo**, so a
    declared EMERGENCY survives restarts (it does **not** reset to ONLINE anymore). First-ever boot
    with no saved record initialises to ONLINE and writes it once.
  - Every change (manual declare *and* auto-monitor flip) goes through `apply(...)`, which updates
    the cache **and** upserts the single `"GLOBAL"` document — so all instances read the same value.
    A DB write failure is logged but never breaks the request (the in-memory value is kept).
  - This is the durable, multi-instance-safe design chosen for a real national-emergency switch.
- `Status` record: `mode` ([`KsefServiceMode`](../backend/src/main/java/com/ksefflow/backend/models/utils/KsefServiceMode.java):
  `ONLINE` / `OFFLINE_UNAVAILABILITY` / `EMERGENCY`), `manual` (true when set by a human),
  `reason`, `declaredBy`, `since`.
- **Automatic monitor** (`@Scheduled monitor()`): periodically probes KSeF reachability via
  `KsefApiClient` and flips `ONLINE ↔ OFFLINE_UNAVAILABILITY` automatically — **unless** a manual
  declaration is in effect (`manual = true`), which overrides the monitor until **Restore Online**
  is called. (`ksef.availability.*` toggles the monitor.)
- `currentOfflineMode()` maps the state to the offline window the invoice pipeline records when it
  parks an invoice: `EMERGENCY` → 7-business-day window; anything else not-online → next business day.

### What the mode actually does to invoice submission (the important consequence)

The declared mode is **not just a label** — it controls how every invoice is issued. The submission
flow [`KSeFInvoiceService.submitInvoice(...)`](../backend/src/main/java/com/ksefflow/backend/services/KSeFInvoiceService.java)
checks the state **before** attempting the live KSeF call:

- **ONLINE** → the invoice is sent through the normal real-time online flow (`executeKsefSubmission`).
- **EMERGENCY / OFFLINE_UNAVAILABILITY** → the online flow is **skipped entirely**. The invoice is
  routed straight to **offline issuance** (`handleOfflineMode`): FA(3) XML is still generated and
  validated, a **QR code** is sealed with the offline certificate, the legal deadline from
  `currentOfflineMode()` is stamped on the `KsefInvoice`, and it is queued for the background retry
  queue to transmit to KSeF later (next business day / 7 business days).

This is the government-required behavior — see the dedicated change note in
[`COMPLIANCE_GAP_ANALYSIS.md`](../COMPLIANCE_GAP_ANALYSIS.md) and the official sources:
[Tryby szczególne wystawiania faktur](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryby-szczegolne-wystawiania-faktur/)
and [Tryb offline – niedostępność KSeF](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/tryb-offline-niedostepnosc-ksef/).

So an admin clicking **Declare Emergency / Declare Unavailability** on this page immediately changes
how the whole tenant's invoices are issued — that's why declaring is admin-only and audited. (The
retry queue's job — pushing parked offline invoices into KSeF once reachable — is deliberately **not**
gated by the mode; sending before the deadline is allowed.)

---

## 6. Operation modes & legal deadlines

| Mode | Meaning | Offline submission deadline | Set by |
|---|---|---|---|
| **Online** | KSeF available; invoices sent in real time | n/a | monitor (auto) |
| **Unavailability** | KSeF temporarily down (e.g. maintenance) | **next business day** | monitor (auto) or platform operator |
| **Emergency** (*tryb awaryjny*) | Official Ministry of Finance outage announcement | **7 business days** | platform operator only (on the MF announcement) |

Legal basis (per the service Javadoc / `COMPLIANCE_GAP_ANALYSIS.md` C7): Polish VAT Act
**art. 106nf** (emergency) / **art. 106nh** (unavailability). The chosen mode flows into each parked
invoice's `ksefSubmissionDeadline`, which the offline retry queue then races against
(see [`offline` retry docs / KsefRetryQueueService`](../backend/src/main/java/com/ksefflow/backend/services/retry/KsefRetryQueueService.java)).

Why declaring is platform-operator only: it changes a **legal deadline for every tenant** and must be
based on the official MF announcement — not something a single tenant should toggle for everyone else.

---

## 7. Connection configuration

Properties: [`KsefApiProperties.java`](../backend/src/main/java/com/ksefflow/backend/config/KsefApiProperties.java)
(prefix `ksef.api`). The `GET /connection` endpoint surfaces these read-only:

- `environment` ([`KsefEnvironment`](../backend/src/main/java/com/ksefflow/backend/models/utils/KsefEnvironment.java): `SANDBOX` / `PRODUCTION`) — driven by the active Spring profile.
- `getActiveBaseUrl()` → `sandbox-url` or `production-url` depending on environment.
- Invoice schema from `form-code` (e.g. `FA (3) 1-0E`).

Dev values (`application-dev.properties`):
```
ksef.api.environment=SANDBOX
ksef.api.sandbox-url=https://api-test.ksef.mf.gov.pl/v2
ksef.api.production-url=https://api.ksef.mf.gov.pl/v2
ksef.api.form-code.system-code=FA (3)
ksef.api.form-code.schema-version=1-0E
ksef.api.form-code.value=FA
```
The environment is **server-set, not user-selectable** — this is deliberate so sandbox invoices can
never be sent to the live system.

---

## 8. Permissions

Codes from RegulaOne, checked via [`AuthenticatedUser.requireAnyPermission(...)`](../backend/src/main/java/com/ksefflow/backend/security/AuthenticatedUser.java):
- **Read** (`GET /ksef-status`, `GET /ksef-status/connection`): any signed-in KSeF user.
- **Declare** (`POST /emergency|unavailability|online`): **`KSEF_PLATFORM_ADMIN`** (platform operator).

`KSEF_PLATFORM_ADMIN` is a platform-level code (see [`KsefPermission`](../backend/src/main/java/com/ksefflow/backend/security/KsefPermission.java)),
distinct from the tenant-scoped `KSEF_ADMIN`. It is granted from RegulaOne's **Platform Users**
page (super-admin only) → a user's **Permissions** editor — the `KSEF_PLATFORM_ADMIN` option is
shown **only to a `ROLE_SUPER_ADMIN`** and the save goes through `/api/superadmin/users/{id}/permissions`.
A **Company Admin cannot see or grant it**: the option is hidden in their view, and the backend
([`UserService.updateUserPermissions`](../../RegulaOne/backend/src/main/java/com/regulaone/backend/services/UserService.java))
treats it as a *protected* code — a non-super-admin can neither add nor remove it (the existing value
is preserved). This prevents cross-tenant privilege escalation.

(Page-level sidebar visibility is additionally gated by `PAGE_ROLES_REQUIRED.integration` =
Super Admin / Company Admin on the frontend — those roles can still *view* the page, but only a
`KSEF_PLATFORM_ADMIN` sees the Declare buttons; everyone else is read-only.)

---

## 9. What this page intentionally does NOT show

For developers who remember the old version — these were **removed because they were fake**:
- A "KSeF-REST Gateway Interactive Terminal" with invented session tokens, KSeF-IDs, and hashes.
- A fabricated **latency** value and a mock **Gateway Health Indicator**.
- "Simulate Network Failures" / "Set Online" / "Loopback Connectivity Test" buttons (they flipped a
  local mock flag, not the real backend).
- A user-selectable SANDBOX/PRODUCTION endpoint switch (environment is server config) with wrong URLs.
- A "SHA-256 with RSA 4096" crypto claim.

Real per-action activity and KSeF error detail belong in the **Audit Center**
(`GET /api/v1/audit-logs`), not here.

---

## 10. File map

Backend (`backend/src/main/java/com/ksefflow/backend/`):
- `controllers/KsefAvailabilityController.java` — the `/api/v1/ksef-status` endpoints.
- `services/KsefAvailabilityService.java` — the state cache, monitor, persistence, offline-mode mapping.
- `models/KsefAvailabilityState.java` — the persisted single global state document (`ksef_availability`).
- `repository/KsefAvailabilityStateRepository.java` — Mongo repository for that one document.
- `config/KsefApiProperties.java` — environment + base URLs + schema.
- `models/utils/KsefServiceMode.java`, `KsefEnvironment.java`, `KsefOfflineMode.java`.
- `security/KsefPermission.java` — defines `KSEF_PLATFORM_ADMIN` (declare authority).
- `services/ksefauth/KsefApiClient.java` — used by the monitor to probe KSeF.

Frontend (`frontend/src/`):
- `components/IntegrationCenter.jsx` — the page.
- `api/ksefApi.js` — `getKsefStatus`, `getKsefConnection`, `declareKsef*`.
- `lib/permissions.js` — `can.manageAvailability` (now requires `KSEF_PLATFORM_ADMIN`).

---

## 11. Quick recap

- The page shows the **real** KSeF operation mode, the **real** connection config, and an explainer.
- The mode is **global** (one value for all tenants), cached in memory and **persisted to Mongo**
  (`ksef_availability`, id `"GLOBAL"`) so it **survives restarts** and is shared across instances;
  it is auto-monitored and manually overridable.
- Declaring a mode is **platform-operator only** (`KSEF_PLATFORM_ADMIN`, not a tenant role), audited,
  and changes the **legal offline deadline** (Unavailability → next business day; Emergency → 7 days)
  — and routes new invoices to offline issuance (see §5).
- Environment is **server-configured** (`SANDBOX`/`PRODUCTION`); test invoices can't reach production.
- Detailed activity/errors are in the **Audit Center**, not on this page.
