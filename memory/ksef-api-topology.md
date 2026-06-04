---
name: ksef-api-topology
description: How KSeF invoice/cert APIs are wired across modules, ports, and the two frontends
metadata:
  type: project
---

⚠️ **VERIFICATION REQUIREMENT:** Before implementing any KSeF-related feature or making any changes to KSeFFlow, always verify the relevant spec, endpoint, field, or business rule against the **official Polish Ministry of Finance / KSeF documentation** at [https://www.podatki.gov.pl/ksef](https://www.podatki.gov.pl/ksef) and the KSeF API reference at [https://ksef.mf.gov.pl](https://ksef.mf.gov.pl). Do not rely solely on this memory file — requirements and API contracts can change. Confirm first, then implement.

Each module runs a **standalone backend on its own port** — there is **no API gateway/proxy** (verified: no spring-cloud-gateway, no proxy controller, start.sh just launches each). Ports: RegulaOne 8080, KSeFFlow 8081, SafeVoice 8082, WasteSync 8083, SafeWork 8084, WorkPulse 8085, PrivacyPilot 8086 (frontends 3000–3006).

KSeF **invoices + certificates + audit logs are served by the KSeFFlow backend (8081)** under `/api/v1/*`, NOT by RegulaOne (8080). Create-draft is `POST /api/v1/invoices/draft`; list returns a Spring Data `Page` (read `.content`); submit needs `?nip=` query param + returns `SubmitInvoiceResponse` (not the entity).

**Auth (implemented June 2026):** KSeFFlow does NOT validate the Cognito JWT itself and does NOT duplicate the users/tenants collections. Instead it resolves the caller by forwarding the `idToken` cookie to RegulaOne's `GET /api/auth/me` (RegulaOne is the single auth authority). Pieces in `com.ksefflow.backend.security`: `RegulaOneAuthClient` (RestClient → /me, configured by `regulaone.api.base-url`, default `http://localhost:8080`), `AuthenticatedUser` record, and `AuthenticatedUserArgumentResolver` (registered via `config/AuthWebMvcConfig`). Controllers take an `AuthenticatedUser` param instead of `X-Tenant-Id`/`X-User-*` headers — declaring it is the auth gate (401 if no session, 403 if no tenant). The frontend's `X-Tenant-Id` headers are now ignored (harmless); the cookie travels via `credentials:'include'`. SecurityConfig still leaves `/api/v1/**` permitAll — the resolver enforces auth.

**Two separate frontends touch KSeF:** `KSeFFlow/frontend` (src/api/ksefApi.js) and `RegulaOne/frontend` (src/services/ksefService.js). They drifted: ksefApi.js's invoice funcs were pointed at 8080 `/api/ksef/*` (a route that doesn't exist anywhere → 500s) and used an old request/response DTO shape. Fixed June 2026 to hit 8081 `/api/v1/invoices` with the right DTO + `X-Tenant-Id`. Backend enums deserialize by **exact Java name** (`VAT_23`, `SPLIT_PAYMENT`, `PLN`) — frontend must map display values before sending.

Still-dead/broken in ksefApi.js: `getStats` and `downloadInvoiceXml` reference `/api/ksef/stats` and `/xml` endpoints that **do not exist on the KSeFInvoiceController** — they have no callers currently.
