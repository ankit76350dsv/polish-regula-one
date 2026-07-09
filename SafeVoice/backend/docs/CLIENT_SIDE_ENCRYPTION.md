# SafeVoice — Client-Side Encryption (AWS KMS Envelope Encryption)

**Status:** Backend implemented. Frontend integration pending.
**Model chosen:** Backend-mediated envelope encryption (browser encrypts/decrypts; AWS credentials never reach the browser).

---

## 1. Why this design (and why NOT the demo's design)

The `aws-kms-encryption` learning demo locked data in the browser but kept the **AWS access key + secret in the browser** (`VITE_AWS_ACCESS_KEY_ID`, `VITE_AWS_SECRET_ACCESS_KEY`). For a real SaaS that is unsafe: anyone can open browser dev-tools, steal those credentials, decrypt every tenant's data, and run up the KMS bill.

SafeVoice keeps the **good part** (data is encrypted/decrypted on the user's device, so the server and database never see plaintext) and removes the **dangerous part** (AWS credentials in the browser). The browser now asks *our backend* for a one-time data key instead of holding AWS credentials. AWS credentials live only on the server (IAM role / env), and the KMS master key never leaves AWS.

## 2. What is protected

| Data | How it is stored |
|---|---|
| Normal report narrative | `CaseReport.encryptedContent` (AES-256-GCM, browser-locked) |
| Normal thread messages | `CaseMessage.encryptedText` (AES-256-GCM, browser-locked) |
| HR grievances (`LABOUR_DISPUTE`) | Plain `description` / `text` — kept unencrypted **by policy** (CLAUDE.md Module 4) |
| System notices (7-day acknowledgement) | Plain `text` — fixed, non-confidential boilerplate |
| Evidence files | Already encrypted at rest in S3 (SSE-AES256) — unchanged |

## 3. The flow

### Encrypt (submit a report / send a message)
1. Browser → `POST /api/safevoice/crypto/data-key` `{ tenantId }`
   → backend calls KMS **GenerateDataKey** → returns `{ plaintextKey, wrappedKey, kmsKeyId, algorithm }`.
2. Browser locks the text with `plaintextKey` (WebCrypto **AES-256-GCM**), producing `ciphertext` + `iv`.
3. Browser **discards** `plaintextKey`.
4. Browser sends `{ ciphertext, iv, wrappedKey }` to the report/message endpoint.
5. Backend stores those three parts. It never saw the plaintext or kept the plain key.

### Decrypt (read a case)
- **Reporter:** `POST /api/safevoice/crypto/case-keys` `{ accessKey }` → backend resolves the case that key owns, unwraps **only that case's** stored wrapped keys via KMS **Decrypt**, returns `{ contentKey, messageKeys }`. Browser unlocks locally.
- **Staff:** `GET /api/v1/internal/crypto/case-keys/{caseId}` (session-authenticated, tenant-scoped) → same response shape.

We **never** unwrap an attacker-supplied blob — only the wrapped key already stored on a case the caller proved access to.

## 4. Endpoints added

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/safevoice/crypto/data-key` | public (rate-limited) | one-time key to lock a report/message |
| POST | `/api/safevoice/crypto/case-keys` | public + access key | reporter reads own case |
| POST | `/api/v1/internal/crypto/data-key` | staff (reply roles) | one-time key to lock a staff reply |
| GET | `/api/v1/internal/crypto/case-keys/{caseId}` | staff (view roles) | staff reads a case |

Message endpoints (`POST /reports/{id}/messages` and the internal equivalent) now accept extra
multipart fields: `ciphertext`, `iv`, `wrappedKey`, `algorithm` (sent instead of plain `text`).

## 5. Security properties

- **AWS credentials never in the browser.** Only the server talks to KMS (default AWS credential chain — IAM role / env, never hardcoded).
- **Database breach alone is useless.** The DB holds only ciphertext + wrapped keys. Unwrapping needs KMS permission, which a DB dump does not grant.
- **Tenant isolation via KMS encryption context** `{ tenantId, purpose=safevoice-report }`. KMS refuses to unwrap a key unless the same context is presented, so Company A's wrapped key can never be unwrapped as Company B — even if one master key is shared.
- **Plain data keys are ephemeral:** used once, never stored, never logged.
- **No detail leaks:** KMS failures surface as a neutral `503 CRYPTO_UNAVAILABLE` (`CryptoOperationException`), never the AWS error.
- **Rate limiting:** the crypto endpoints are in the stricter "sensitive" bucket (KMS cost abuse + access-key brute force).
- **Data residency:** the KMS key must live in the configured EEA region (`safevoice.aws.region`, default `eu-central-1`).

## 6. Configuration

```properties
safevoice.aws.region=${SAFEVOICE_AWS_REGION:eu-central-1}   # EEA region
safevoice.kms.key-id=${SAFEVOICE_KMS_KEY_ID:}               # CMK id/ARN/alias (REQUIRED in prod)
safevoice.kms.endpoint=                                     # LocalStack only; blank for real AWS
safevoice.allow-plaintext-intake-for-local-testing=false    # dev-only bypass; MUST stay false in prod
```

The IAM principal the backend runs as needs `kms:GenerateDataKey` and `kms:Decrypt` on that key.

## 7. Notes / follow-ups

- **Per-tenant CMKs:** CLAUDE.md §Key-Management prefers a separate key per tenant. Today we use one configured CMK + tenant-bound encryption context (cryptographic separation). To move to true per-tenant keys, store a `kmsKeyId` on the `Tenant` document and resolve it in `EnvelopeEncryptionService` — the encryption-context binding stays as defence in depth.
- **This is encryption-at-rest with KMS-managed keys, not zero-knowledge E2E.** Staff must be able to read cases to investigate, so the server (with KMS access) is technically capable of decrypting. The guarantees above (no creds in browser, DB-breach-useless, tenant isolation, full CloudTrail audit) are the achievable, honest posture for a multi-party whistleblower system.
- **Frontend TODO:** call `data-key` before submit/reply, do AES-256-GCM in WebCrypto, send `{ciphertext, iv, wrappedKey}`; call `case-keys` on read and unlock locally.
- **Compliance:** verify the final key-management + residency setup against ISO 27001 / SOC2 controls before go-live (CLAUDE.md §2, §3, §19).
