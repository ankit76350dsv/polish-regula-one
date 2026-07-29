# KSeFFlow — Certificates (developer guide)

This document explains the **Certificates** feature end to end: what it's for, the UI, every API
(ours + the government KSeF API), the database, the role of S3/encryption, the certificate
lifecycle, permissions, configuration, and the files involved. It's aimed at a developer who has
never seen this area before.

UI route: `/company/{tenantId}/certificates` → [`CertificateManager.jsx`](../frontend/src/components/CertificateManager.jsx)

---

## 1. What the page is for

A KSeF certificate is the credential KSeFFlow uses to **authenticate to the National e-Invoice
System (KSeF)** and to **seal invoices issued offline**. The page lets a company:

1. **Upload a certificate** they already own, or
2. **Request a certificate from KSeF** (the government issues a fresh one), and
3. **View / manage** the certificates for their workspace (list, download the public part,
   deactivate).

### Two independent dimensions

People confuse these — they are orthogonal:

| | **Authentication** (purpose) | **Offline signing** (purpose) |
|---|---|---|
| **Upload** (you bring the file) | Uploaded cert used to log in to KSeF | Uploaded cert used to seal offline invoices |
| **Request from KSeF** (KSeF issues it) | KSeF mints a login certificate | KSeF mints an offline-signing certificate |

- **Upload vs Request** = *how you obtain* the certificate.
- **Authentication vs Offline** = *what the certificate is for* (its `purpose`).

Relationship: to **request** a certificate from KSeF you must **already be authenticated** to KSeF
(the enrollment opens a KSeF session first). So in practice an **uploaded** qualified seal often
bootstraps the first credential, after which you can **request** KSeF-native certificates.
(From 2027 the KSeF-native *Authentication* certificate becomes the primary login method.)

---

## 2. Architecture at a glance

```
Browser (CertificateManager.jsx)
   │  ksefFetch()  → KSeFFlow backend (:8081)  /api/v1/certificates/**
   ▼
KSeFCertificateController
   ├── upload / list / {id}/public / {id}/deactivate → CertificateService
   └── enroll                                         → KsefCertificateEnrollmentService
                                                          │  (calls the government KSeF 2.0 API)
                                                          ▼
                                                        KSeF (Ministry of Finance)

CertificateService ──► MongoDB  (collection: ksef_certificates)  ... METADATA ONLY
                   └─► AWS S3    (encrypted .pfx/.pem bytes)      ... the actual key material
```

Two storage tiers, on purpose:
- **MongoDB** holds only *metadata* (who/what/validity/status) — never key material.
- **AWS S3** holds the *encrypted* certificate file (the part with the private key).

---

## 3. Frontend

**Component:** [`CertificateManager.jsx`](../frontend/src/components/CertificateManager.jsx)
**API client:** [`ksefApi.js`](../frontend/src/api/ksefApi.js)
**Permission helper:** [`lib/permissions.js`](../frontend/src/lib/permissions.js) → `can.manageCertificates(permissions)`

UI structure (deliberately plain, banking/government-portal style):
1. **Upload Certificate** card — file (PFX/PEM) + password (required for PFX) → `uploadCertificate`.
2. **Request Certificate from KSeF** card — name + type (Authentication / Offline signing) → `enrollCertificate`.
3. **Active Certificates** table — columns: Name, Status, Subject, Type, Expiry date, Days left,
   Last used, Actions (Download, Deactivate).

Frontend API functions (all in `ksefApi.js`, all go to the KSeFFlow backend via `ksefFetch`,
cookie-authenticated, tenant resolved server-side):

| Function | Method + path | Notes |
|---|---|---|
| `uploadCertificate(_t, file, password?)` | `POST /api/v1/certificates/upload` (multipart) | password required for PFX |
| `enrollCertificate(nip, purpose, name)` | `POST /api/v1/certificates/enroll?nip=&purpose=&name=` | purpose = `AUTHENTICATION` / `OFFLINE` |
| `listCertificates(_t)` | `GET /api/v1/certificates` | returns metadata only |
| `getCertificatePublicPem(certId)` | `GET /api/v1/certificates/{id}/public` | returns PEM text of the **public** cert |
| `deactivateCertificate(_t, certId)` | `PATCH /api/v1/certificates/{id}/deactivate` | |

> The leading `tenantId` arguments are legacy/ignored — the backend derives the tenant from the
> authenticated session (`AuthenticatedUser`), never from the client.

UI gating:
- **Upload / Request / Deactivate** are shown only to admins (`can.manageCertificates`, i.e.
  `KSEF_ADMIN`). Non-admins see a read-only notice.
- **Download (public cert)** is available to anyone who can view the list.

---

## 4. Our backend API (`/api/v1/certificates`)

Controller: [`KSeFCertificateController.java`](../backend/src/main/java/com/ksefflow/backend/controllers/KSeFCertificateController.java)

| Endpoint | Permission (`AuthenticatedUser.requireAnyPermission`) | Calls KSeF? | Service method |
|---|---|---|---|
| `POST /upload` | `KSEF_ADMIN` | ❌ no | `CertificateService.storeCertificate` / `storePemCertificate` |
| `POST /enroll` | `KSEF_ADMIN` | ✅ yes | `KsefCertificateEnrollmentService.enrollAndStore` |
| `GET /` (list) | `KSEF_ADMIN`, `KSEF_AUDITOR` | ❌ no | `CertificateService.listCertificates` |
| `GET /{id}/public` | `KSEF_ADMIN`, `KSEF_AUDITOR` | ❌ no | `CertificateService.exportPublicCertificatePem` |
| `PATCH /{id}/deactivate` | `KSEF_ADMIN` | ❌ no | `CertificateService.deactivateCertificate` |

Validation & safety in the controller:
- Max upload size 1 MB; only `.pfx/.p12/.pem/.crt` accepted; filename sanitised (no path traversal).
- `GET /{id}/public` returns `application/x-pem-file` with a download header — **public certificate
  only**, never the private key, password, or full PFX.

Responses use the safe DTO [`CertificateResponse`](../backend/src/main/java/com/ksefflow/backend/dto/certificate/CertificateResponse.java),
which by contract **never** exposes `encryptedStoragePath`, `vaultPasswordReference`, raw bytes, or
key material.

---

## 5. The government KSeF API (only the **enroll** flow)

Only **Request from KSeF** talks to the Ministry of Finance. Flow in
[`KsefCertificateEnrollmentService.enrollAndStore`](../backend/src/main/java/com/ksefflow/backend/services/certificate/KsefCertificateEnrollmentService.java):

1. **Open a KSeF session** → `KSeFAuthService.openSession(tenantId, nip)` (gets an access token;
   itself authenticates to KSeF using an existing credential).
2. `GET /certificates/enrollments/data` — the identity the certificate must carry.
3. Generate a fresh key pair + CSR locally → [`KsefCsrGenerator`](../backend/src/main/java/com/ksefflow/backend/services/certificate/KsefCsrGenerator.java).
4. `POST /certificates/enrollments` — submit the CSR (`certificateType` = `Authentication` / `Offline`).
5. `GET /certificates/enrollments/{referenceNumber}` — **poll** until issued
   (status `100` = processing, `200` = done; ~15 tries × 2 s).
6. `POST /certificates/retrieve` — download the issued (public) certificate.
7. Package **our private key + the issued certificate** into a PKCS#12, store it encrypted
   (`CertificateService.storeEnrolledCertificate`).

The HTTP plumbing for these is in [`KsefApiClient`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KsefApiClient.java);
request/response DTOs live in [`dto/ksefapi/`](../backend/src/main/java/com/ksefflow/backend/dto/ksefapi/)
(`CertificateEnrollmentDataResponse`, `EnrollCertificateRequest/Response`,
`CertificateEnrollmentStatusResponse`, `RetrieveCertificatesRequest/Response`).

The enrollment is **synchronous** (we wait for KSeF in steps 5–6) specifically so the private key
never has to be persisted in the clear while waiting — it's held in memory and only stored encrypted.

> Verify exact KSeF 2.0 endpoint paths/versions against the official docs before go-live:
> https://ksef.podatki.gov.pl (Ministerstwo Finansów).

---

## 6. Database — MongoDB `ksef_certificates`

Model: [`KsefCertificate.java`](../backend/src/main/java/com/ksefflow/backend/models/KsefCertificate.java)
Repository: [`KsefCertificateRepository.java`](../backend/src/main/java/com/ksefflow/backend/repository/KsefCertificateRepository.java)

Stored **metadata** (not exhaustive): `id`, `tenantId`, `fileName`, `type` (`PFX`/`PEM` — see
[`KsefCertificateType`](../backend/src/main/java/com/ksefflow/backend/models/utils/KsefCertificateType.java)),
`purpose` ([`KsefCertificatePurpose`](../backend/src/main/java/com/ksefflow/backend/models/utils/KsefCertificatePurpose.java): `AUTHENTICATION`/`OFFLINE`),
`issuedTo`, `issuer`, `validFrom`, `validTo`, `active`,
`verificationStatus` ([`KsefCertificateVerificationStatus`](../backend/src/main/java/com/ksefflow/backend/models/utils/KsefCertificateVerificationStatus.java)),
`certificateSerialNumber`, `authSuccessCount`, `authFailureCount`, `lastAuthTime`,
`encryptedStoragePath` (the `s3://…` locator), `vaultPasswordReference` (encrypted password; `null`
for PEM), timestamps.

**Never in MongoDB:** the private key, raw certificate bytes, or the plaintext password.

Key repository queries:
- `findByTenantIdOrderByCreatedAtDesc` — the list/table.
- `findByTenantIdAndActiveTrue` — the one active signing/auth cert.
- `findByTenantIdAndPurposeAndActiveTrue` — the active cert of a given purpose (Auth vs Offline).
- `findByVerificationStatus` / `findByTenantIdAndVerificationStatus`, `countByTenantId`.

---

## 7. Role of S3 + encryption

Storage util: [`CertificateStorageUtils.java`](../backend/src/main/java/com/ksefflow/backend/services/certificate/CertificateStorageUtils.java)
Crypto util: [`CertificateCryptoUtils.java`](../backend/src/main/java/com/ksefflow/backend/services/certificate/CertificateCryptoUtils.java)

- The actual certificate file (PFX/PEM bytes) is **AES‑256‑GCM encrypted**, then **uploaded to AWS
  S3** (server-side encryption also enabled). The encrypted object key/locator is what we persist in
  `KsefCertificate.encryptedStoragePath`.
- S3 layout: `s3://{bucket}/{keyPrefix}/{tenantId}/{fileName}.enc` — **tenant-scoped** keys.
- The PFX **password** is encrypted separately (`CertificateCryptoUtils.encryptPassword`) and stored
  as `vaultPasswordReference` (a "vault" reference, not the password itself).
- On use (signing/auth/export), `readPfxDecrypted` pulls the object from S3 and decrypts it **only in
  memory**; the private key is extracted transiently and never cached in a field or written to disk.

> ⚠️ **Note on environments:** despite some older Javadoc that says "disk in dev, S3 in prod", the
> current `CertificateStorageUtils` uses **S3 in all environments**. So even local dev needs valid S3
> settings (or a compatible S3 endpoint such as MinIO/LocalStack) for upload/enroll to work.

Why two tiers: keeping key material out of the application database (and only ever in encrypted S3)
limits blast radius and supports data-minimization/least-exposure goals.

---

## 8. Certificate lifecycle & "replacement" rules

- A new certificate is saved with `active = true`.
- **Upload** (`storeCertificate`): deactivates the tenant's current active certificate — only **one
  active certificate per tenant** on the upload path.
- **Request from KSeF** (`storeEnrolledCertificate`): deactivates only the previous active cert **of
  the same purpose**. A tenant may hold **one active `AUTHENTICATION` + one active `OFFLINE`** at the
  same time — they don't replace each other.
- **Deactivate** sets `active = false`. This is **local only** — it stops KSeFFlow using it; it does
  **not** revoke the certificate at KSeF. Nothing is hard-deleted (history is kept; the row shows as
  `Revoked` in the table).
- Offline sealing strictly requires an active `OFFLINE`-purpose KSeF certificate; the code fails
  loudly (no fallback to the auth cert) to avoid producing a non-compliant seal.

Status shown in the table is derived: `Expired` (past `validTo`) → `Revoked` (`!active`) →
`Pending verification` (`verificationStatus == PENDING`) → `Active`.

---

## 9. Permissions model

Permission codes come from RegulaOne and are checked on the KSeFFlow side via
[`AuthenticatedUser.requireAnyPermission(...)`](../backend/src/main/java/com/ksefflow/backend/security/AuthenticatedUser.java)
(see [`KsefPermission`](../backend/src/main/java/com/ksefflow/backend/security/KsefPermission.java)).

- **Manage** (upload, request, deactivate): `KSEF_ADMIN`.
- **Read** (list, download public cert): `KSEF_ADMIN` or `KSEF_AUDITOR`.

(Tenant isolation: every query is scoped to the caller's `tenantId`, resolved from the verified
session — never trusted from the client.)

---

## 10. Configuration

`application-dev.properties` (override via env in prod):

```
ksef.cert.s3.bucket=${KSEF_S3_BUCKET:ksef-certificate}
ksef.cert.s3.region=${KSEF_S3_REGION:eu-central-1}        # EEA region (GDPR/RODO data residency)
ksef.cert.s3.key-prefix=${KSEF_S3_KEY_PREFIX:ksef-certificates}
ksef.cert.s3.access-key=${KSEF_S3_ACCESS_KEY:}
ksef.cert.s3.secret-key=${KSEF_S3_SECRET_KEY:}
ksef.cert.encryption-key=${KSEF_CERT_ENCRYPTION_KEY:0000…0000}   # 64 hex chars = AES-256 key
```

Bound by [`CertificateStorageProperties`](../backend/src/main/java/com/ksefflow/backend/config/CertificateStorageProperties.java).

**Before production / go-live:**
- Set a real **`KSEF_CERT_ENCRYPTION_KEY`** (the dev default is an all-zeros placeholder — insecure).
- Set the **S3 bucket + credentials** (and keep the region in the EEA).
- These are secrets — supply via environment / secrets manager, never commit real values.

---

## 11. Local development notes / gotchas

- **S3 is required even locally.** Provide real S3 creds or point at MinIO/LocalStack via the
  `ksef.cert.s3.*` settings. Without it, upload/enroll fail at the storage step.
- **Enroll needs KSeF connectivity + an existing session credential.** You can't request a KSeF
  certificate without first authenticating to KSeF (which needs a valid uploaded credential and the
  KSeF sandbox/API reachable). For pure UI work, **upload** is the simpler path to exercise.
- **PEM uploads** have no private key → `vaultPasswordReference` is `null`; they can authenticate-
  verify but cannot sign.
- The dev encryption key being all-zeros means anything encrypted in dev is effectively unprotected —
  fine for local, never for shared/staging/prod.

---

## 12. File map

Backend (`backend/src/main/java/com/ksefflow/backend/`):
- `controllers/KSeFCertificateController.java` — REST endpoints.
- `services/certificate/CertificateService.java` — store/list/deactivate/export, key/cert extraction.
- `services/certificate/KsefCertificateEnrollmentService.java` — the KSeF request (enroll) flow.
- `services/certificate/KsefCsrGenerator.java` — key pair + CSR generation.
- `services/certificate/CertificateStorageUtils.java` — encrypted S3 read/write.
- `services/certificate/CertificateCryptoUtils.java` — AES-256-GCM + password vault.
- `services/ksefauth/KsefApiClient.java`, `KSeFAuthService.java` — KSeF API transport + session.
- `models/KsefCertificate.java`, `models/utils/KsefCertificate{Type,Purpose,VerificationStatus}.java`.
- `repository/KsefCertificateRepository.java`.
- `dto/certificate/CertificateResponse.java`, `dto/ksefapi/*` (KSeF request/response DTOs).
- `config/CertificateStorageProperties.java`.

Frontend (`frontend/src/`):
- `components/CertificateManager.jsx` — the page.
- `api/ksefApi.js` — the certificate API functions.
- `lib/permissions.js` — `can.manageCertificates`.

---

## 13. Quick recap

- **Upload** = register a certificate you already own; **no government call**.
- **Request from KSeF** = the government issues a new certificate (Authentication or Offline);
  **calls the KSeF 2.0 certificate API**.
- **MongoDB** stores metadata; **S3** stores the AES-256-GCM-encrypted file; the **private key never
  leaves the server** and is never returned by any API.
- You can **download the public certificate** (PEM) but not the private key.
- Auth/Offline certificates coexist; deactivation is local and reversible by adding a new one.
