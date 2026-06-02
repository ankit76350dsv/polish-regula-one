---
name: ksef-api-topology
description: How KSeF invoice/cert APIs are wired across modules, ports, and the two frontends
metadata:
  type: project
---

Each module runs a **standalone backend on its own port** — there is **no API gateway/proxy** (verified: no spring-cloud-gateway, no proxy controller, start.sh just launches each). Ports: RegulaOne 8080, KSeFFlow 8081, SafeVoice 8082, WasteSync 8083, SafeWork 8084, WorkPulse 8085, PrivacyPilot 8086 (frontends 3000–3006).

KSeF **invoices + certificates + audit logs are served by the KSeFFlow backend (8081)** under `/api/v1/*`, NOT by RegulaOne (8080). The invoice controller reads tenant from the **`X-Tenant-Id` header** (JWT-claim extraction is a later phase), so every invoice/cert call must send it. Create-draft is `POST /api/v1/invoices/draft`; list returns a Spring Data `Page` (read `.content`); submit needs `?nip=` query param + returns `SubmitInvoiceResponse` (not the entity).

**Two separate frontends touch KSeF:** `KSeFFlow/frontend` (src/api/ksefApi.js) and `RegulaOne/frontend` (src/services/ksefService.js). They drifted: ksefApi.js's invoice funcs were pointed at 8080 `/api/ksef/*` (a route that doesn't exist anywhere → 500s) and used an old request/response DTO shape. Fixed June 2026 to hit 8081 `/api/v1/invoices` with the right DTO + `X-Tenant-Id`. Backend enums deserialize by **exact Java name** (`VAT_23`, `SPLIT_PAYMENT`, `PLN`) — frontend must map display values before sending.

Still-dead/broken in ksefApi.js: `getStats` and `downloadInvoiceXml` reference `/api/ksef/stats` and `/xml` endpoints that **do not exist on the KSeFInvoiceController** — they have no callers currently.
