# RegulaOne — Centralized Notification Architecture

**Status:** Design proposal (pre-implementation)
**Author:** Architecture
**Scope:** Platform-wide (RegulaOne hub + KSeFFlow + future modules: WorkPulse, SafeWork, SafeVoice, WasteSync, PrivacyPilot) — delivered to **web** and a **single mobile app** that hosts all modules.
**Compliance basis:** GDPR/RODO (EU 2016/679), eIDAS, EU Whistleblower Directive 2019/1937 (Polish implementing act), KSeF legal retention. See §13 — all country-specific items must be re-verified against official government sources before implementation.

> **A note on this document.** It is a design, grounded in the current codebase, to be reviewed before any code is written (per requirement #10). Section 14 lists exactly what already exists and how we reuse it instead of duplicating it.

---

## 1. Guiding decisions (and why)

| Decision | Choice | Why (grounded in current code) |
|---|---|---|
| Where does the notification core live? | **RegulaOne backend = the Notification Hub** | RegulaOne is the single source of truth for `users`, `tenants`, `roles`, `permissions`; it is the **only** place that owns the email channel (AWS SES) and can resolve "which users in this tenant hold permission X". KSeFFlow has no user DB — it only calls `/api/auth/me`. Routing-by-permission therefore *must* run in RegulaOne. |
| How do modules raise notifications? | **Publish a `NotificationEvent` to the Hub** via an internal service-to-service API | KSeFFlow already calls RegulaOne server-to-server (`RegulaOneAuthClient` + `RestClient`). We reuse that path. Modules never compute recipients or send email themselves → no duplicated logic. |
| Async processing / "queue" | **Transactional Outbox in MongoDB + scheduled worker** (pluggable to SQS/Kafka later) | There is no Kafka/SQS/RabbitMQ/Redis in the stack. An outbox collection drained by an `@Scheduled` worker gives at-least-once delivery, retries, and ordering **with zero new infra**, and hides behind a `NotificationDispatcher` interface so SQS/Kafka can be swapped in without touching callers. |
| Real-time delivery | **Server-Sent Events (SSE)** with polling fallback | SSE needs no new dependency (Spring MVC `SseEmitter`), works with the existing httpOnly-cookie auth, and is one-directional (server→client) which is exactly the notification use case. WebSocket would add a starter and bidirectional complexity we don't need. Multi-instance fan-out via MongoDB **change streams** (Atlas-native) or Redis pub/sub later. |
| In-app store | **One `notifications` collection in the Hub** | Supersedes the KSeFFlow-only `ksef_notifications` (which is broadcast-only and cannot target by permission). KSeFFlow's bell reads the Hub via the RegulaOne API it already talks to. |
| **Mobile push** | **PUSH = another channel behind the same dispatcher**; device tokens registered against the Hub; provider abstracted behind a `PushProvider` interface | The mobile app is "one app with modules" authenticating against RegulaOne — same identity, same tenant, same permissions. So push needs **no new core**: a device registry + a `PushChannel`. Provider (FCM/APNs vs **AWS SNS Mobile Push**) is pluggable — see §16. Recommended default: **AWS SNS Mobile Push**, to keep orchestration inside the existing AWS `eu-central-1` footprint (consistent with SES) — though final hop to APNs/FCM is inherent to mobile push (mitigated by data-minimized payloads, §9). |
| Templating | **DB-stored templates + Thymeleaf for HTML email**, per-locale (PL/EN) | No template engine exists today; SES sends raw strings. Thymeleaf is the lightest Spring-native add for safe HTML rendering; subjects/bodies are DB-stored and versioned for audit. |

**One-line summary:** *Modules emit events → the RegulaOne Hub resolves recipients by permission, applies preferences, renders locale templates, and fans out to in-app + email + **mobile push** (and future channels) through a retrying outbox, pushing live updates over SSE (web) and push (mobile) — all tenant-scoped, audited, and GDPR-minimized.*

---

## 2. Backend architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MODULE BACKENDS (event sources)                        │
│                                                                                │
│   KSeFFlow                WorkPulse           SafeVoice         PrivacyPilot    │
│   - invoice failed        - shift anomaly     - new report      - DPIA flag     │
│   - KSeF down             - overtime          - approval        - erasure req   │
│   - cert issue                                                                  │
│        │  publishes NotificationEvent (HTTPS, service-to-service auth)          │
└────────┼───────────────────────────────────────────────────────────────────────┘
         │  POST /api/internal/notifications/events
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  REGULAONE  —  NOTIFICATION HUB (source of truth)              │
│                                                                                │
│  ┌────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐ │
│  │ NotificationEvent  │──▶│ RecipientResolver     │──▶│ PreferenceService   │ │
│  │ IngestController   │   │ (tenant + permission  │   │ (per-user channel    │ │
│  │ (validate, dedupe) │   │  → List<User>)        │   │  opt-in/out)         │ │
│  └────────────────────┘   └───────────────────────┘   └─────────┬──────────┘ │
│                                                                  │            │
│                                                                  ▼            │
│  ┌────────────────────┐   ┌───────────────────────┐   ┌────────────────────┐ │
│  │ TemplateService    │◀──│ NotificationService   │──▶│  Outbox (Mongo)     │ │
│  │ (locale, version,  │   │ - persist in-app      │   │  status=PENDING     │ │
│  │  data-minimized)   │   │ - enqueue per channel │   │                     │ │
│  └────────────────────┘   └───────────┬───────────┘   └─────────┬──────────┘ │
│           in-app write ◀───────────────┘                         │            │
│                │                                                 ▼            │
│                │                          ┌───────────────────────────────┐  │
│                │                          │ @Scheduled OutboxWorker       │  │
│                │                          │  (drain, retry w/ backoff,    │  │
│                │                          │   dead-letter)                │  │
│                │                          └───────┬───────────┬───────────┘  │
│                ▼                          ▼          ▼          ▼            │
│        ┌──────────────┐        ┌──────────────┐ ┌──────────┐ ┌────────────┐  │
│        │ SSE Registry │        │ EmailChannel │ │PushChannel│ │ (future)   │  │
│        │ push to web  │        │ (AWS SES)    │ │(SNS/FCM/  │ │ SMS/Teams/ │  │
│        └──────┬───────┘        └──────────────┘ │ APNs)    │ │ Slack/Hook │  │
│               │                                 └────┬─────┘ └────────────┘  │
│               │                          ┌───────────┴─────────┐            │
│               │                          │ notification_devices │            │
│               │                          │ (per-user tokens)    │            │
│   ┌───────────┴──────────────┐   ┌───────┴──────────────────────────────┐   │
│   │ Notification REST + SSE  │   │ DeliveryAudit (immutable, 10y)        │   │
│   │ + device register API    │   │ + reuse existing audit logging        │   │
│   └───────────┬──────────────┘   └──────────────────────────────────────┘   │
└───────────────┼────────────────────────────────────────────────────────────┘
                │  cookie/JWT-authenticated (idToken)
                ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌───────────────────────────┐
   │ RegulaOne web    │   │ KSeFFlow web     │   │ Mobile app (all modules)  │
   │ bell + Center    │   │ bell reads Hub   │   │ registers device token;   │
   │ + prefs (SSE)    │   │ via :8080 (SSE)  │   │ receives PUSH; deep-links  │
   └──────────────────┘   └──────────────────┘   └───────────▲───────────────┘
                                                             │ APNs / FCM
                                            (push provider final hop, §9/§13)
```

**Layering (matches existing Controller → Service → Domain → Repository convention):**
`IngestController / NotificationController` → `NotificationService` (+ `RecipientResolver`, `PreferenceService`, `TemplateService`) → channel `Dispatcher`s → `Repository` → MongoDB.

---

## 3. Event flow diagram

```
(1) Business event occurs in a module
     e.g. KSeFInvoiceService marks invoice FAILED (action INVOICE_RETRY_FAILED)
            │
            ▼
(2) Module calls NotificationPublisher.publish(event)
     event = { eventType, tenantId, severity, sourceModule, subjectRef,
               audiencePermissions[], templateKey, variables{}, sensitivity,
               dedupeKey, occurredAt }
            │  HTTPS POST /api/internal/notifications/events  (service token)
            ▼
(3) Hub IngestController validates + idempotency check (dedupeKey)
            │
            ▼
(4) RecipientResolver: users in tenantId WHERE permission ∈ audiencePermissions
     AND enabled=true   (UserRepository.findByTenant_Id → filter)
            │
            ▼
(5) For each recipient → PreferenceService decides channels
     (in-app always on for security-critical; email subject to opt-in where lawful)
            │
            ▼
(6) NotificationService:
     - writes ONE in-app `notifications` doc per recipient (status UNREAD)
     - writes Outbox messages per (recipient, channel) status PENDING
     - pushes SSE event to any connected recipient sessions
            │
            ▼
(7) @Scheduled OutboxWorker drains PENDING:
     - render template (locale, data-minimized) → send via channel
     - success → status SENT, write DeliveryAudit
     - failure → retry with exponential backoff; after N → DEAD_LETTER + alert
            │
            ▼
(8) Recipient sees toast/badge instantly (SSE) and the item in the bell/center.
     Marks read → status READ, readAt set, SSE unread-count update.
```

**Idempotency:** `dedupeKey` (e.g. `INVOICE_RETRY_FAILED:<invoiceId>`) prevents duplicate notifications when a module retries the publish call. Unique index on `(tenantId, dedupeKey)` in the ingest log.

---

## 4. Data model (MongoDB collections)

All collections live in the **RegulaOne** database and carry `tenantId` (indexed) for isolation. Field conventions follow the existing models (`id`, `tenantId`, `createdAt`, soft-delete where retained).

### 4.1 `notifications` — in-app notification (one per recipient)
```
{
  _id,
  tenantId            (indexed, required),
  recipientUserId     (indexed, required),     // resolved, never broadcast-by-null for sensitive types
  eventType           (e.g. INVOICE_SUBMISSION_FAILED),
  sourceModule        (KSEFFLOW | WORKPULSE | SAFEVOICE | ...),
  severity            (INFO | SUCCESS | WARNING | ERROR | CRITICAL),
  title               (localized, data-minimized — no sensitive PII),
  body                (localized, data-minimized),
  category            (INVOICE | CERTIFICATE | COMPLIANCE | WORKFLOW | SECURITY | SYSTEM),
  relatedEntityType,  relatedEntityId,         // deep link; NOT the sensitive payload
  status              (UNREAD | READ | ARCHIVED),   // + soft delete
  readAt,
  sensitivity         (NORMAL | CONFIDENTIAL | RESTRICTED),  // drives email rendering
  locale              (pl | en),
  createdAt,  expiresAt (TTL for auto-archival),
  softDeleted, deletedAt
}
Indexes: {tenantId,recipientUserId,status,createdAt:-1}; TTL on expiresAt (active-life only, see §11)
```

### 4.2 `notification_outbox` — async delivery queue (transactional outbox)
```
{
  _id, tenantId, notificationId, recipientUserId,
  channel             (IN_APP | EMAIL | PUSH | SMS | TEAMS | SLACK | WEBHOOK),
  status              (PENDING | PROCESSING | SENT | FAILED | DEAD_LETTER),
  attempts, maxAttempts, nextAttemptAt, lastError,
  payloadRef          (templateKey + variables; sensitive vars stored encrypted),
  createdAt, sentAt
}
Indexes: {status, nextAttemptAt}  (worker scan); {tenantId, notificationId}
```

### 4.3 `notification_templates` — versioned, localized templates
```
{
  _id, templateKey (e.g. invoice.failed), locale (pl|en),
  channel (EMAIL | IN_APP | SMS | ...),
  version (int), active (bool),
  subject  (generic, data-minimized — see §9),
  bodyText, bodyHtml (Thymeleaf), variablesSchema (declared placeholders),
  tenantId (nullable → global default; non-null → tenant override),
  createdAt, createdBy
}
Indexes: {templateKey, locale, channel, tenantId, active}
```

### 4.4 `notification_preferences` — per-user channel opt-in/out
```
{
  _id, tenantId, userId (indexed unique),
  channelDefaults     { EMAIL: true, IN_APP: true, SMS: false, ... },
  perCategory         { COMPLIANCE: {EMAIL:true,IN_APP:true},
                        INVOICE:    {EMAIL:false,IN_APP:true}, ... },
  quietHours          { enabled, fromHour, toHour, timezone },   // not applied to CRITICAL/security
  digest              { enabled, frequency: IMMEDIATE|HOURLY|DAILY },
  updatedAt
}
Rule: security/legal-critical categories cannot be disabled (see §6, §9).
```

### 4.5 `notification_delivery_audit` — immutable delivery record (10-year)
```
{
  _id, tenantId, notificationId, recipientUserId (or pseudonymized id),
  channel, outcome (SENT | FAILED | SUPPRESSED_BY_PREFERENCE | BLOCKED_NO_PERMISSION),
  providerMessageId, errorCode, occurredAt
}
Append-only. Never updated/deleted within retention window. Reuses the existing
immutable-audit discipline (KsefAuditLog pattern). No notification *content* stored here.
```

### 4.6 `notification_ingest_log` — idempotency + source audit
```
{ _id, tenantId, dedupeKey (unique w/ tenantId), eventType, sourceModule, occurredAt, processedAt }
```

### 4.7 `notification_devices` — mobile push device registry
```
{
  _id, tenantId (indexed), userId (indexed, required),
  platform            (IOS | ANDROID),
  pushToken           (FCM registration token OR APNs device token; rotates),
  providerEndpointArn (when using AWS SNS — the per-device SNS endpoint ARN),
  appVersion, deviceModel, locale,
  enabled             (bool),
  lastSeenAt, createdAt, updatedAt,
  revokedAt           // set on logout / token invalidation / account deletion
}
Indexes: {userId, enabled}; unique {pushToken}
Notes:
  - pushToken + device metadata are PERSONAL DATA → tenant-scoped, deleted on logout
    & account erasure (§12, §13); never logged in clear.
  - One user may have several active devices (phone + tablet); push fans out to all
    enabled, non-revoked tokens for that user.
  - Stale-token cleanup: APNs/FCM "unregistered" responses mark the device revoked.
```

> **Why per-recipient in-app rows (4.1) instead of one broadcast row?** Permission-scoped delivery and per-user read-state/erasure require a row per recipient. The current `ksef_notifications` broadcast-by-`userId=null` model cannot enforce "only KSEF_AUDITORs see this" or honor one user's right-to-erasure — so it is replaced.

---

## 5. API design

### 5.1 Internal (module → Hub) — service-to-service
```
POST /api/internal/notifications/events
  Auth: service token (X-Service-Token) or mTLS; NOT a user cookie.
  Body: NotificationEvent (see §3 step 2). Returns 202 Accepted {ingestId}.
  Idempotent on (tenantId, dedupeKey).
```

### 5.2 User-facing (cookie-authenticated, AppResponse envelope) — served by RegulaOne
```
GET    /api/notifications?status=&category=&from=&to=&page=&size=   list (tenant+user scoped)
GET    /api/notifications/unread-count                              badge number
GET    /api/notifications/{id}                                      detail (deep link)
PATCH  /api/notifications/{id}/read                                 mark read
PATCH  /api/notifications/read-all                                  mark all read
PATCH  /api/notifications/{id}/archive                              archive
DELETE /api/notifications/{id}                                      soft delete (user)
GET    /api/notifications/stream                                    SSE (text/event-stream)

GET    /api/notifications/preferences                              read own prefs
PUT    /api/notifications/preferences                              update own prefs

# Mobile push device registration (cookie/JWT-authenticated; used by the mobile app)
POST   /api/notifications/devices        { platform, pushToken, appVersion, ... }   register/upsert this device
DELETE /api/notifications/devices/{token}                          unregister (on logout)
GET    /api/notifications/devices                                  list own registered devices

# Admin (ROLE_ADMIN / tenant admin)
GET    /api/admin/notifications/templates                          list templates
POST   /api/admin/notifications/templates                          create/version a template
GET    /api/admin/notifications/delivery-audit?...                 delivery audit (compliance)
```

All user queries are **forced** to `tenantId` + `recipientUserId = caller` server-side (never trust client). Reuses the existing `AppResponse<T>` envelope and cookie/JWT auth.

---

## 6. Permission & routing model

A declarative **routing table** maps each event type to the permissions that may receive it. Recipients = `users in tenant WHERE (any required permission) AND enabled`. `KSEF_TENANT_ADMIN` (and RegulaOne admin) implicitly included where appropriate — consistent with the backend's `requireAnyPermission` model.

| Event type | Source | Audience (permissions/roles) | Default channels | Sensitivity |
|---|---|---|---|---|
| `INVOICE_SUBMISSION_FAILED` | KSeFFlow `INVOICE_OFFLINE_MODE` | `KSEF_CASE_MANAGER`, `KSEF_TENANT_ADMIN` | in-app + email | NORMAL |
| `INVOICE_REJECTED` / `INVOICE_VALIDATION_ERROR` | KSeFFlow submission/XML errors | `KSEF_CASE_MANAGER`, `KSEF_TENANT_ADMIN` | in-app + email | NORMAL |
| `INVOICE_RETRY_FAILED` (deadline/maxed) | `KsefRetryQueueService` | `KSEF_CASE_MANAGER`, `KSEF_TENANT_ADMIN`, `KSEF_COMPLIANCE_OFFICER` | in-app + email | NORMAL |
| `KSEF_COMMUNICATION_FAILURE` / `KSEF_EMERGENCY_DECLARED` | `KsefAvailabilityService` | all KSeF roles in tenant | in-app + email | NORMAL |
| `CERTIFICATE_ISSUE` (expiring/auth fail) | `CertificateService`, `KSEF_SESSION_FAILED` | `KSEF_TENANT_ADMIN` | in-app + email | NORMAL |
| `PIPELINE_EXECUTION_FAILURE` / `INTEGRATION_ERROR` | any module | `*_TENANT_ADMIN`, ops role | in-app + email | NORMAL |
| `WORKFLOW_APPROVAL_PENDING` | workflow engine | the **assigned approver** only | in-app + email | CONFIDENTIAL |
| `WORKFLOW_APPROVAL_REJECTED` | workflow engine | the requester + approver | in-app + email | CONFIDENTIAL |
| `TASK_ASSIGNED` | any module | the **assignee** only | in-app + email | NORMAL |
| `REPORT_SUBMITTED` (e.g. BDO/WasteSync) | module | `COMPLIANCE_OFFICER`, tenant admin | in-app + email | NORMAL |
| `COMPLIANCE_DEADLINE_APPROACHING` | scheduler | role responsible for that obligation | in-app + email | NORMAL |
| `DOCUMENT_UPLOAD_FAILED` | any module | the uploading user | in-app | NORMAL |
| `AUTH_SECURITY_EVENT` (new device, MFA) | RegulaOne auth | the affected user only | in-app + email | RESTRICTED |
| `WHISTLEBLOWER_REPORT_RECEIVED` | **SafeVoice** | only the **assigned reviewer(s)** for the case | in-app only by default; email = generic alert with **no content** | **RESTRICTED** |

**SafeVoice / whistleblower special handling (critical):** never broadcast; recipients restricted to the explicitly assigned reviewer(s); **no report content, category, reporter info, or PIN in any email subject/body/preview — and likewise none in any push notification.** Push for `RESTRICTED` items is **content-free by default**: the lock-screen banner shows only a neutral *"A SafeVoice case requires your attention"* (no title detail, no body), and the real content is fetched only after biometric/passcode-gated in-app authentication. Email behaves identically (*"Sign in to view."*). Honors the existing labour-dispute rule (no encryption/PIN, notify HR) at the *event* level without leaking identity. This is a hard requirement from the EU Whistleblower Directive 2019/1937 + Polish implementing act. (Tenants may also choose to **suppress push entirely** for RESTRICTED categories.)

---

## 7. Notification status lifecycle

```
In-app notification:     UNREAD ──read──▶ READ ──user──▶ ARCHIVED ──TTL/erasure──▶ (soft) DELETED
Outbox (per channel):    PENDING ──worker──▶ PROCESSING ──ok──▶ SENT
                                                   └─fail─▶ FAILED ──backoff──▶ PROCESSING (retry n)
                                                                         └─maxed─▶ DEAD_LETTER (+ ops alert)
Delivery audit:          append-only SENT | FAILED | SUPPRESSED_BY_PREFERENCE | BLOCKED_NO_PERMISSION
```

Retry: exponential backoff, mirroring the existing KSeF retry config style (`base-backoff-seconds`, `max-backoff-seconds`, `max-attempts`). Dead-letter raises a `SYSTEM` notification to platform ops.

---

## 8. In-app notification strategy

- One `notifications` row per recipient; bell badge = `unread-count`; center = paginated, filterable (category, status, date, search).
- **Live update via SSE**; if SSE drops, client falls back to polling `unread-count` every 30–60 s (reusing the existing interval pattern already in both frontends).
- KSeFFlow's bell stops using mock `INITIAL_NOTIFICATIONS` and instead calls the Hub through the RegulaOne client (`apiFetch` → `:8080`) it already has. RegulaOne's placeholder bell becomes live.
- Deep links: `relatedEntityType/Id` route the user to the invoice/cert/case — but access is re-checked on that page (notification is a pointer, not a content store).

## 9. Email template & data-minimization strategy

- Templates are **DB-stored, versioned, per-locale (PL/EN)**, rendered with Thymeleaf for HTML; plain-text alternative always included. Reuses the existing SES `EmailService` (extended to accept a rendered subject/body).
- **Data minimization (GDPR Art. 5(1)(c)) is enforced in the template layer:**
  - Subjects and previews are **generic** and contain **no personal data, financial figures, or case content**. e.g. *"RegulaOne: an invoice needs your attention"* — not the buyer name, amount, or NIP.
  - `RESTRICTED` sensitivity (whistleblower, security) → email contains **only** a neutral "sign in to view" call-to-action; all detail stays behind authenticated in-app access.
  - Email carries a deep link, never the payload.
- Localization driven by the recipient's locale (default PL for the Polish market), falling back to EN.
- Every template version is retained for audit (which wording was sent when).

## 10. Real-time (web) & mobile push delivery strategy

### 10.1 Web — Server-Sent Events
- **SSE endpoint** `GET /api/notifications/stream` (cookie-auth). Server keeps an in-memory `Map<userId, List<SseEmitter>>`; on a new notification for that user, push `event: notification` and `event: unread-count`.
- **Multi-instance scaling:** when RegulaOne runs >1 instance, a user's SSE connection may be on a different node than the writer. Fan-out options (pick at deploy time, behind one interface): **MongoDB change streams** on `notifications` (Atlas-native, no new infra) → each node watches and pushes to its local emitters; or **Redis pub/sub** if/when Redis is introduced.
- Heartbeat/keep-alive comment every ~25 s; client auto-reconnects with `Last-Event-ID`.
- Fallback: polling `unread-count`. Security-critical notifications never rely solely on real-time — they are always persisted in-app + email.

### 10.2 Mobile — push notifications (single app, all modules)
- The mobile app authenticates against RegulaOne (same SSO/identity as web) and, after login, **registers its device** via `POST /api/notifications/devices` (`platform`, `pushToken`, app version). On logout it calls `DELETE /api/notifications/devices/{token}`.
- `PushChannel` is a normal outbox channel. When a notification targets a user, the dispatcher looks up that user's **enabled, non-revoked** devices and sends one push per device through the configured `PushProvider`.
- **Provider — DECIDED: AWS SNS Mobile Push** (behind a `PushProvider` interface so it stays swappable). Orchestration + device endpoints live in AWS `eu-central-1` (consistent with SES/S3); SNS forwards to APNs (iOS) / FCM (Android).
  - Backend creates one **SNS Platform Application** per platform (APNs + FCM); on device registration the Hub calls `CreatePlatformEndpoint` and stores the returned **endpointArn** on the `notification_devices` row; sending = `Publish` to that endpoint ARN.
  - **Flutter device side:** use `firebase_messaging` to obtain the **FCM token on both Android and iOS** (FCM relays to APNs on iOS), or the raw APNs token if going APNs-direct; on login the app `POST /api/notifications/devices` with `{platform, pushToken}`; handle token refresh (`onTokenRefresh`) by re-registering; request OS notification permission before registering. Tapping a push uses the payload `deepLink` to route to the correct module screen in the single app.
  - Alternatives (not chosen, but interface-compatible): direct FCM+APNs, or Expo/OneSignal.
- **Foreground vs background:** when the app is foregrounded it may also hold an SSE/long-poll connection for instant in-list updates; when backgrounded/closed, the OS push wakes it. Both ultimately reconcile against the same Hub state (the in-app row is the source of truth; push is a wake-up + pointer).
- **Payload is a pointer, not the content** (data minimization, §9): push carries `{ notificationId, category, deepLink (relatedEntityType/Id), unreadCount }` and a generic localized title — **never** sensitive PII/financial/whistleblower content. Tapping deep-links into the right module screen in the single app, which then fetches the full notification over the authenticated API.
- **Badge sync:** push includes `unreadCount` so the app icon badge stays correct even when the app was closed.
- Delivery outcomes (incl. APNs/FCM "unregistered" → mark device revoked) recorded in `notification_delivery_audit`.

## 11. Multi-tenant strategy

- `tenantId` on every collection, indexed; **every** query is tenant-scoped server-side (resolved from the verified session, never from client input) — identical to the existing isolation rule.
- Templates and preferences support **tenant override** (non-null `tenantId`) over a **global default** (null `tenantId`).
- SSE emitters keyed by `userId`; recipient resolution is tenant-bounded, so cross-tenant leakage is structurally impossible.
- Routing table can be globally defined with optional per-tenant overrides.

## 12. Retention & archival strategy

| Data | Active retention | Then | Basis |
|---|---|---|---|
| In-app `notifications` | e.g. 12–24 months (TTL `expiresAt`) | auto-archive/delete | GDPR storage limitation Art. 5(1)(e) — minimize |
| `notification_outbox` | until SENT + short grace (e.g. 30 d) | purge | operational only |
| `notification_delivery_audit` | **10 years** | archive (cold storage) then delete | aligns with platform legal-audit retention (CLAUDE.md) |
| `notification_templates` | retained while referenced + audit history | version-archive | accountability Art. 5(2) |
| `notification_devices` (push tokens) | while device active | **deleted on logout, token invalidation, stale (`unregistered`), or account erasure**; auto-expire after N days of inactivity | data minimization; tokens are personal data |
| Whistleblower-related delivery audit | per Directive 2019/1937 + Polish act | **verify exact period from official source** | §13 |

- **Right to erasure (Art. 17):** on user account deletion, in-app notifications **and all registered push devices/tokens** for that user are erased; delivery-audit rows are **pseudonymized** (replace `recipientUserId` with a tokenized id) rather than deleted where a legal-retention obligation overrides erasure (Art. 17(3)(b)).
- **Right of access/rectification (Art. 15/16):** preferences and a user's own notifications are exportable via the user-facing API.

---

## 13. Compliance & GDPR design (Privacy by Design / by Default)

- **Lawful basis:** transactional/security notifications rest on legitimate interest / legal obligation (compliance deadlines, KSeF) and are not user-disableable; non-essential email is opt-in where consent is required.
- **Data minimization & confidentiality:** enforced in templates (§9) — no sensitive content in subjects, previews, or any unauthorized channel.
- **Access control:** permission-based recipient resolution (§6); a notification is only created for users entitled to know.
- **Security:** TLS 1.3 in transit; sensitive outbox template variables encrypted at rest (reuse the platform AES-256-GCM/KMS approach); httpOnly cookie auth for SSE/REST; no secrets in logs.
- **Auditability:** append-only `notification_delivery_audit` + reuse of existing immutable audit logging; templates versioned.
- **Data residency:** all storage in the existing EEA MongoDB/SES (`eu-central-1`) footprint — no new region. **Mobile push caveat:** the final delivery hop necessarily traverses Apple APNs / Google FCM (operated outside the EEA). This is inherent to all mobile push and is mitigated by (a) **content-free, data-minimized payloads** (no PII/financial/whistleblower content ever leaves in a push — only a pointer), and (b) keeping orchestration + device-endpoint storage inside AWS `eu-central-1` when using AWS SNS Mobile Push. Document this transfer in the RoPA and confirm the relevant transfer mechanism for FCM/APNs.
- **Push tokens are personal data:** stored tenant-scoped, never logged in clear, deleted on logout/erasure (§12). The mobile app must obtain OS notification permission (opt-in by default on iOS) before registering a token.
- **EU-wide / Poland-first:** language defaults PL with EN fallback; routing/retention are config-driven so other member states need only template + retention overrides, not redesign.
- **⚠ Verification gate (requirement #11):** before implementation, re-verify against **official sources** — KSeF retention & messaging rules (Ministerstwo Finansów / KSeF docs), Polish whistleblower implementing act (UODO / sejm.gov.pl), and GDPR specifics (edpb.europa.eu). This document encodes the well-established GDPR articles; country-specific retention periods are marked for confirmation, not assumed.

---

## 14. Integration with existing code (no duplication — requirement #10)

| Existing asset | How we reuse it | What changes |
|---|---|---|
| RegulaOne `EmailService` (AWS SES) | Becomes the `EmailChannel` behind the dispatcher | Extend to accept a rendered subject/html/text + recipient; keep `/api/email/send` for ad-hoc use |
| RegulaOne `UserRepository` (`findByTenant_Id`, etc.) | Powers `RecipientResolver` | Add `findByTenant_IdAndEnabledTrue`; filter by `permissions` in memory or via query |
| RegulaOne `User.permissions`, `KsefPermission` codes | The permission model for routing (§6) | none — reused as-is |
| `AppResponse<T>` envelope, cookie/JWT auth | All user-facing notification APIs | none |
| KSeFFlow `KsefNotificationService.notifyTenant(...)` | Re-pointed to publish a `NotificationEvent` to the Hub | Replaces direct `ksef_notifications` writes; old collection deprecated/migrated |
| KSeFFlow audit action codes (`INVOICE_RETRY_FAILED`, `KSEF_EMERGENCY_DECLARED`, `CERTIFICATE_*`, …) | Mapped 1:1 to `NotificationEvent` types (§6) | Publish alongside the existing `writeAuditLog(...)` call sites |
| KSeFFlow `RegulaOneAuthClient` / `RestClient` | The transport for module→Hub event publish | Add a `NotificationPublisher` using the same client + a service credential |
| KSeFFlow `@EnableScheduling` + retry-config style | Pattern for the Hub's `OutboxWorker` backoff config | RegulaOne adds `@EnableScheduling` + `@EnableAsync` |
| Frontend bells (KSeFFlow wired to mock; RegulaOne placeholder) | Become live, reading the Hub | Replace mock `INITIAL_NOTIFICATIONS`; wire RegulaOne bell |
| Frontend `apiFetch`/`api` clients, polling pattern | SSE + REST calls + polling fallback | Add a notifications service + Notification Center + Preferences pages |
| RegulaOne SSO identity (shared across modules) | The **mobile app** authenticates the same way → same `userId`/`tenantId`/`permissions` for push routing | Mobile registers its device token post-login; no separate identity |
| Existing AWS account/region (`eu-central-1`, used by SES + KSeF S3) | Host **AWS SNS Mobile Push** here if that provider is chosen | Add SNS platform applications (APNs/FCM) + IAM |

---

## 15. Phased implementation plan

1. **Phase 1 — Hub core (in-app, synchronous):** collections `notifications`, `notification_preferences`; `NotificationService` + `RecipientResolver` + routing table; user-facing REST (list/unread/read/prefs); RegulaOne bell + Notification Center wired live (polling). *No new infra.*
2. **Phase 2 — Event ingest + KSeFFlow integration:** internal ingest API + `NotificationPublisher` in KSeFFlow; map the first events (`INVOICE_*`, `KSEF_*`, `CERTIFICATE_*`); KSeFFlow bell reads the Hub; deprecate `ksef_notifications`.
3. **Phase 3 — Email channel + outbox + templates:** `notification_outbox` + `@Scheduled OutboxWorker` (retry/backoff/dead-letter); `notification_templates` (PL/EN) + Thymeleaf; reuse `EmailService`; full data-minimized subjects.
4. **Phase 4 — Real-time SSE** + multi-instance fan-out (change streams); preferences UI; delivery audit + retention/TTL jobs; RtbF/pseudonymization.
5. **Phase 5 — Mobile push:** `notification_devices` registry + device register/unregister APIs; `PushChannel` + `PushProvider` (AWS SNS Mobile Push or FCM/APNs); content-free payloads + deep links; badge/unread sync; stale-token cleanup. Mobile app integrates the register-on-login / unregister-on-logout flow and deep-link routing into the relevant module screen.
6. **Phase 6 — Further channels** (SMS/Teams/Slack/webhook) as new `Dispatcher` implementations; optional SQS/Kafka swap behind the publisher interface.

---

## 16. Open decisions to confirm before build

1. **Service-to-service auth** for the internal ingest API: shared service token (simple) vs mTLS (stronger). Recommended: signed service token now, mTLS-ready.
2. **Real-time fan-out** at multi-instance: MongoDB change streams (no new infra, recommended) vs introduce Redis.
3. **Email opt-out scope:** which categories are legally non-disableable (compliance, security, KSeF legal deadlines) vs user-controllable (success/info).
4. **In-app active retention** period (12 vs 24 months) and whistleblower-specific retention — pending official-source verification (§13).
5. Whether to **migrate** existing `ksef_notifications` rows into the Hub or start fresh.
6. ~~Mobile framework & push provider~~ — **DECIDED: Flutter app + AWS SNS Mobile Push** (SNS in `eu-central-1` → APNs/FCM; Flutter uses `firebase_messaging` for the token). See §10.2. Remaining sub-task: provision SNS Platform Applications (APNs cert/key + FCM server key) at Phase 5.
7. **RESTRICTED push policy:** content-free push (default) vs fully suppress push for whistleblower/security categories (tenant-configurable).
```
