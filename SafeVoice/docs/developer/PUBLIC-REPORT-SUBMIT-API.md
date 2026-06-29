# Public Report Submit API — Change Report

**Date:** 2026-06-29
**Module:** SafeVoice (Whistleblower)
**Scope:** Align the backend public reporter flow (submit, track, messages) with the
already-built frontend, which uses a single **64-character access key** as the only
credential (no tracking code, no PIN).

---

## 1. Files Modified / Added

**Added**
- `dto/CaseTrackingResponse.java` — `{ report, messages }` returned by `/track`.
- `dto/CaseMessageRequest.java` — `{ sender, text }` body for posting a message.
- `exception/CaseNotFoundException.java` — single "not found" answer for a bad key.
- `exception/GlobalExceptionHandler.java` — turns errors into the JSON shape the web
  app already reads: `{ success, message, errorCode, status }`.

**Modified**
- `controller/PublicCaseController.java` — base path now `/api/safevoice/reports`;
  endpoints match the frontend (`POST /`, `POST /track`, `GET|POST /{id}/messages`);
  `X-Tenant-ID` header removed (anonymous reporters have none).
- `service/CaseReportService.java` — `submit(request)` now issues an access key,
  stores only its SHA-256 hash, derives the case id `SV-XXXXXXXXXX` from that hash;
  `retrieve(...)` replaced by `retrieveByAccessKey(...)`; added `getByCaseRef(...)`.
- `dto/CaseSubmissionRequest.java` — fields now mirror the form
  (`tenantId, category, incidentDate, area, facts, channel, requestMeeting, attachments`).
- `dto/CaseSubmissionResponse.java` — now `{ accessKey, isHrOnly }`.
- `dto/CaseRetrievalRequest.java` — now `{ accessKey }`.
- `model/document/CaseReport.java` — added `keyHash` (SHA-256 of the access key).
- `model/enums/.../ReportCategory.java` — added `fromLabel(...)` (form sends the label).
- `service/CaseMessageService.java` — recognises "Anonymous Whistleblower" as the reporter.
- `config/SecurityConfig.java` — `permitAll` for the public `/api/safevoice/reports*` paths.

## 2. Old Behavior
- Endpoint `POST /api/v1/public/cases/submit`, required an `X-Tenant-ID` header.
- Credential model = 12-char tracking code + 8-digit **bcrypt PIN**.
- Submit returned a rich DTO (tracking code, plaintext PIN, SLAs).
- Frontend (which only knows the access-key model) could not talk to it.

## 3. New Behavior
- `POST /api/safevoice/reports` with the form's JSON; returns `{ accessKey, isHrOnly }`.
- One 64-char access key = identifier **and** password. Server stores only `sha256(key)`.
- Case id is `SV-` + first 10 hex of the key hash (non-secret reference for staff).
- HR grievance (`Individual HR Grievance`) → routed to HR, **no key**, id `HR-XXXXX`.
- `POST /api/safevoice/reports/track` `{ accessKey }` → `{ report, messages }`.
- Lookups are by key hash (globally unique), so no tenant context is needed.

## 4. Reason for the Change
The frontend was rebuilt around a single access key (commit `afe4be5`). The backend
still used tracking code + PIN, so the two could never connect. The frontend is the
agreed contract, so the backend was aligned to it.

## 5. Security Impact
- Key is generated with `SecureRandom` (256 bits) and **never stored** — only its
  SHA-256 hash is. Even our own data cannot reveal a reporter's key (anonymity).
- One uniform "not found" response prevents probing which keys exist.
- No reporter-identifying data is logged; audit entries are still written on submit
  and on access.
- **Known limitation:** the message endpoints (`/{caseId}/messages`) resolve the case
  by its reference alone and do **not** re-check the access key, because the current
  web app does not send the key on those calls. The reference is only known to someone
  who held the key, but it is not itself secret. **Recommended follow-up:** have the
  frontend send the access key on message calls and verify it server-side.

## 6. Compliance Impact
- Preserves EU/Polish Whistleblower Act flow: anonymous intake, 7-day acknowledgement
  and 90-day feedback SLAs, oral-channel + meeting-request handling, HR-grievance
  routing kept out of the anonymous channel.
- Retention/lawful-basis/controller/processor fields populated on intake.

## 7. Testing Performed
- `./mvnw compile` → success (exit 0).
- Contract reconciled by hand against the frontend service/slice/page code.
- **Not yet run:** end-to-end test against a live Mongo + the frontend with
  `VITE_USE_MOCK_DATA="false"`. Recommended before release, plus unit tests for
  `submit`, `retrieveByAccessKey`, and `ReportCategory.fromLabel`.

## 7a. Follow-up change — Tenant validation on submit (2026-06-29)
- `tenantId` is now **required** on submit and is validated against the **shared
  `tenants` collection** (the same one RegulaOne manages — single source of truth). The
  `Tenant` document is a minimal read-model (`id`, `name`, `status`) mapped to that
  collection. A report whose tenant is missing or whose `status` is not `ACTIVE` is
  rejected with `404 TENANT_NOT_FOUND`.
- The tenant `_id` is a Mongo ObjectId hex string (e.g. `6a34ca2d9d71d550dff0c3b6`);
  `tenantId` in the request body is that hex string.
- **Added:** `model/document/Tenant.java`, `repository/TenantRepository.java`,
  `exception/TenantNotFoundException.java` + handler in `GlobalExceptionHandler`.
- **Connection fix (root cause of earlier 404s):** the Mongo URI used the non-existent
  key `spring.mongodb.uri`, so Spring Boot ignored it and connected to a local MongoDB.
  Corrected to `spring.data.mongodb.uri` so SafeVoice uses the shared Atlas `RegulaOne`
  database where the `tenants` collection lives. **Requires a backend restart.**
- **Behavioural note:** `tenantId` is now mandatory, so the frontend's standalone
  (`tenantId: null`) submissions must always send a real, active tenant id.

## 8. Potential Risks / Side Effects
- `GlobalExceptionHandler` is application-wide: it now standardises `404 NOT_FOUND`,
  `400 VALIDATION`, and `400 INVALID_REQUEST` responses for every controller. This is
  the documented platform envelope, but other controllers' error bodies will change.
- The case `id` is now an `SV-`/`HR-` string instead of a UUID for new public reports.
- Legacy `trackingCode` / `hashedPin` fields remain on the model (unused by this flow)
  for backward compatibility with any existing data.
