---
name: ksef-offline-compliance
description: KSeF offline-mode compliance design (two QR codes, deadlines, retention) and its known gaps
metadata:
  type: project
---

KSeF offline invoicing was reworked for Polish MF compliance (June 2026). Design decisions:

- **Legal record = the FA(3) XML in KSeF, not the PDF.** The server no longer generates/stores a PDF. `OfflinePdfService` is deprecated/unwired; the PDF is rendered **client-side** from invoice data + the two QR payloads.
- **Two mandatory QR codes** on offline invoices, both generated **server-side** by `services/OfflineQrService`: CODE I "OFFLINE" (FA(3) XML hash + verify URL) and CODE II "CERTYFIKAT" (a certificate seal over invoice identity — needs the cert private key, so it cannot be done in the browser). CODE II legally requires a **KSeF Type 2 Certificate**.
- **New `KsefInvoice` fields:** `offlineMode` ([[ksef-api-topology]] enum `KsefOfflineMode`: OFFLINE24 / OFFLINE_UNAVAILABILITY / EMERGENCY), `offlineIssuedAt` (set once, never overwritten), `ksefSubmissionDeadline`, `qrCodeOffline`, `qrCodeCertificate`. Legacy `offlineQrCode` kept (deprecated) as a CODE I mirror.
- **Retention, not deletion:** when an offline invoice later succeeds, offline fields are RETAINED (append ksefId/UPO) — never deleted. The user originally proposed deleting offline data on success; that was rejected as a compliance/audit violation.
- **Deadlines** computed by `computeSubmissionDeadline`: next business day (offline24 / unavailability), 7 business days (emergency). Weekends skipped.

**Frontend integration (KSeFFlow/frontend, June 2026):** `mapBackendInvoice` now maps the new fields. `lib/offlineInvoice.js` + `components/OfflineComplianceCard.jsx` render BOTH QR codes **locally** via the `qrcode` lib (no external QR service — GDPR) and produce the offline PDF **client-side** via the browser's native print/Save-as-PDF (no server PDF). The card (mode + deadline + 2 QR + download) is shown per offline invoice in `OfflineQueue.jsx`. The client only renders server-issued QR payloads — it never recomputes the CODE II seal.

**KNOWN GAPS — must close before production (do NOT treat as compliant yet):**
0. `OfflineQueue.jsx`'s "flush queue" still **fabricates KsefIds client-side** (`processOfflineItem` in App.jsx) — a demo simulation, NOT a real KSeF submission. It must be rewired to call the backend `submitInvoice` per offline invoice (real retry) once the backend retry scheduler exists. Fabricating KsefIds is fake-compliance logic.
1. `OfflineQrService` is explicitly marked NOT production-certified — the QR URL format and CODE II canonical payload/seal encoding must be validated against the official **MF KSeF 2.0 technical spec**; CODE II must use a real Type 2 Certificate.
2. **No retry scheduler exists** (`@Scheduled`/`@EnableScheduling` not present anywhere). OFFLINE_MODE invoices are parked with a `ksefSubmissionDeadline` but nothing re-submits them or escalates on breach. This is the biggest functional gap.
3. `computeSubmissionDeadline` skips weekends only — **no Polish public-holiday calendar**.
