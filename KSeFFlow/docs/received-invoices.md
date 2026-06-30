# Received invoices (Faktury otrzymane) — explained in simple words

UI route: `/company/{tenantId}/received` (menu: "Faktury otrzymane" / "Received invoices")

This guide explains the Received invoices page: **why it exists, how you use it, where the data is
saved, and which API endpoints it calls — both our app's endpoints and the government KSeF
endpoints.** A short "For developers" section at the end has the exact tables.

---

## 1. The big idea (read this first)

KSeF works **both ways** 🔄:

- **Sending** — the invoices *your* company issues go up to KSeF (that's the "Create invoice" part).
- **Receiving** — the invoices *other companies* issue **to you** (your purchase invoices) also land
  in KSeF, with your company named as the buyer.

**This page is the "receiving" side.** It **pulls down the purchase invoices** that other companies
issued to you, so you can see them and open the full document.

Think of the government office (KSeF) again 🏛️: every invoice made out to your company is dropped
into your company's mailbox there. This page is the button that **empties that mailbox into your app.**

---

## 2. Why we need this page

From **1 February 2026** the law requires every company to be able to **receive** its invoices
through KSeF. There is **no "accept" step** — an invoice counts as received the moment KSeF gives it
a number, whether you look at it or not. So your company must have a way to pull these in, view them,
and keep them. This page is that way.

---

## 3. Who can use it
- **Download from KSeF** (pull new invoices) → **Case Manager** or **Admin** (the people who handle
  invoicing). Read-only roles cannot trigger a download.
- **Just viewing** the list and opening an invoice's XML → Admin, Case Manager, Compliance Officer,
  Auditor. (A plain Employee has no invoice access.)

---

## 4. How you use it (step by step)
1. Open the page — it shows the invoices already saved (fast, no government call).
2. Click **"Download from KSeF"** — the app asks the government for any new purchase invoices in the
   last ~30 days and saves the new ones. It tells you how many were fetched and added.
3. The table lists each invoice: KSeF number, invoice number, seller, date, gross amount, whether it
   has an attachment.
4. Click **"Show XML"** on a row to open the full original invoice. The first time, it is downloaded
   from the government; after that it's kept safely so it opens instantly. You can also save it to
   your computer.

---

## 5. Where is the information saved?

This page is **different** from certificates (which use S3). Here, **everything is in our own
database**:

1. **KSeFFlow MongoDB — invoice metadata.** When you download, the summary of each invoice (numbers,
   seller, amounts, dates) is saved in the **`ksef_received_invoices`** collection. The list you see
   is read from here, so it loads fast and works offline.
2. **KSeFFlow MongoDB — the full XML, encrypted.** The first time you open an invoice's XML, the app
   downloads it from the government and stores it **encrypted** (AES-256) **inside the same database
   record** (not in S3). Next time, it just decrypts the saved copy — no government call needed.
3. **Audit log** — every download is recorded (`RECEIVED_INVOICES_SYNCED`,
   `RECEIVED_INVOICE_DOWNLOADED`).
4. **Certificate** — to talk to the government, the app opens a signed session using your company's
   certificate (the same one used everywhere else).

> So: the **government (KSeF) is the original source**, but unlike the list on the Permissions page,
> received invoices **are copied into our database** (metadata always, full XML once opened) — because
> the law expects you to keep your received invoices.

---

## 6. The certificate dependency (same as the other pages)
"Download from KSeF" and "Show XML" both open a signed KSeF session first. If your company's
**certificate is invalid** (the `21115 "Nieprawidłowy certyfikat"` error), the download fails and no
invoices come in — exactly like on the Permissions page. Fixing the certificate fixes this too (see
the [certificates guide](./certificates.md)).

---

## 7. For developers (the technical map)

**Frontend:** [`ReceivedInvoices.jsx`](../frontend/src/components/ReceivedInvoices.jsx) ·
API calls in [`ksefApi.js`](../frontend/src/api/ksefApi.js)
(`syncReceivedInvoices`, `listReceivedInvoices`, `getReceivedInvoiceXml`) ·
UI gating in [`permissions.js`](../frontend/src/lib/permissions.js)
(`can.issueInvoices` for the Download button).

**Our backend API** ([`KsefReceivedInvoiceController`](../backend/src/main/java/com/ksefflow/backend/controllers/KsefReceivedInvoiceController.java),
base `/api/v1/received-invoices`):

| Our endpoint (KSeFFlow `:8081`) | Who | What it does |
|---|---|---|
| `POST /api/v1/received-invoices/sync?nip=&from=&to=` | `KSEF_ADMIN`, `KSEF_CASE_MANAGER` | Pull purchase invoices from KSeF for a date window (default last 30 days), save new ones. Returns `{fetched, created, skipped}`. |
| `GET /api/v1/received-invoices?page=&size=` | admin / case manager / compliance / auditor | Paged list of saved invoices (metadata only), newest first. Read from MongoDB — no KSeF call. |
| `GET /api/v1/received-invoices/{ksefNumber}/xml?nip=` | admin / case manager / compliance / auditor | Full FA(3) XML. Downloaded from KSeF on first request, then served from encrypted storage. |

**Our endpoint → government KSeF endpoint** (each one first opens a signed session — see the auth
note). `{ksefBaseUrl}` is the active KSeF base URL — sandbox `https://api-test.ksef.mf.gov.pl/v2`,
production `https://api.ksef.mf.gov.pl/v2` (from [`KsefApiProperties`](../backend/src/main/java/com/ksefflow/backend/config/KsefApiProperties.java)):

| Our endpoint | Government KSeF endpoint it calls | Notes |
|---|---|---|
| `POST /api/v1/received-invoices/sync` | `POST {ksefBaseUrl}/invoices/query/metadata?pageOffset=&pageSize=` | Body uses `subjectType: "Subject2"` (= we are the **buyer**). Paged; KSeF limits each query to a 3-month window. |
| `GET /api/v1/received-invoices/{ksefNumber}/xml` | `GET {ksefBaseUrl}/invoices/ksef/{ksefNumber}` | Returns the raw FA(3) XML the seller submitted. Only called the **first** time an invoice's XML is opened. |
| `GET /api/v1/received-invoices` (list) | *(none)* | Reads MongoDB only — does **not** call KSeF. |

**Auth step (runs before every KSeF call above).** The backend opens a certificate-signed session
([`KsefApiClient`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KsefApiClient.java)):

| Step | Government KSeF endpoint |
|---|---|
| 1. Ask for a login challenge | `POST {ksefBaseUrl}/auth/challenge` |
| 2. Submit the **XAdES-signed** challenge (uses the certificate) | `POST {ksefBaseUrl}/auth/xades-signature` |
| 3. Wait for the auth result | `GET {ksefBaseUrl}/auth/{referenceNumber}` |
| 4. Redeem the access token | `POST {ksefBaseUrl}/auth/token/redeem` |

> The **`21115` "invalid certificate"** error happens at step 2 — the session never opens, so a
> download or XML fetch cannot run.

**Databases / storage:**
- **KSeFFlow MongoDB** — collection **`ksef_received_invoices`** ([`KsefReceivedInvoice`](../backend/src/main/java/com/ksefflow/backend/models/KsefReceivedInvoice.java)
  via [`KsefReceivedInvoiceRepository`](../backend/src/main/java/com/ksefflow/backend/repository/KsefReceivedInvoiceRepository.java)):
  holds the metadata **and** the full XML stored **encrypted** (`xmlContentEncrypted`, AES via
  [`CertificateCryptoUtils`](../backend/src/main/java/com/ksefflow/backend/services/certificate/CertificateCryptoUtils.java))
  plus a `xmlHash`. Dedupe is by `tenantId + ksefNumber`; soft-delete supported.
- **No S3** for this page — the received XML lives encrypted inside the Mongo document (different from
  certificates, which use S3).
- **Audit log** (`KsefAuditLog`): `RECEIVED_INVOICES_SYNCED`, `RECEIVED_INVOICE_DOWNLOADED`.

**Backend flow:** [`KsefReceivedInvoiceService`](../backend/src/main/java/com/ksefflow/backend/services/KsefReceivedInvoiceService.java)
→ `authService.openSession(...)` → `ksefApiClient.queryInvoiceMetadata(...)` (sync) /
`ksefApiClient.getInvoiceByKsefNumber(...)` (xml) → save to Mongo.

**Official references (Ministry of Finance):** KSeF 2.0 manual Part II — *Wystawianie i otrzymywanie
faktur* ([ksef.podatki.gov.pl](https://ksef.podatki.gov.pl/)).

---

## 8. One-paragraph summary
The Received invoices page **pulls the purchase invoices other companies issued to your company** out
of the government system (KSeF) and into your app — a capability the law requires from 1 Feb 2026.
**Admins / Case Managers** click "Download from KSeF" (`POST /received-invoices/sync` →
`POST {ksefBaseUrl}/invoices/query/metadata` as buyer "Subject2"); the **metadata** is saved in
MongoDB (`ksef_received_invoices`), and the **full XML** is fetched once
(`GET {ksefBaseUrl}/invoices/ksef/{ksefNumber}`) and kept **encrypted in the database**. There is **no
S3** here. Everything still depends on a valid **certificate** — the `21115` error blocks it until
that's fixed.
