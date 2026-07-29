# SafeVoice — Client-Side Encryption, Explained End to End

A complete, plain-English guide to how SafeVoice locks (encrypts) and unlocks (decrypts) report
and message text. If you read this top to bottom you will understand every field we store, every
AWS call we make, and exactly when each one happens.

> **The one-line summary:** the readable text is locked and unlocked **inside the browser**. Our
> server only ever handles tiny keys — never the readable words. The browser never holds an AWS
> password; it asks our backend for a one-time key, and only the backend talks to AWS KMS.

---

## Table of contents

1. [The mental model (envelope encryption)](#1-the-mental-model)
2. [Glossary — every field, what it is, example value](#2-glossary)
3. [The KMS key ARN, decoded piece by piece](#3-the-kms-key-arn-decoded)
4. [The AWS APIs we use, and when](#4-the-aws-apis-we-use-and-when)
5. [ENCRYPTION — step by step (submitting a report)](#5-encryption-step-by-step)
6. [DECRYPTION — step by step (reading a case)](#6-decryption-step-by-step)
7. [Messages (the two-way thread)](#7-messages)
8. [What the database actually stores](#8-what-the-database-stores)
9. [Why each piece is safe to expose (or not)](#9-why-each-piece-is-safe)
10. [Tenant isolation (encryption context)](#10-tenant-isolation)
11. [Failure modes & the dev plaintext flag](#11-failure-modes)
12. [Where everything lives in the code](#12-code-map)
13. [FAQ](#13-faq)

---

## 1. The mental model

We use **envelope encryption**. Picture a master safe bolted to the floor at AWS that never opens
from the outside — that is **AWS KMS** and the **master key (CMK)**.

- To **lock** a report, the browser asks the backend for a fresh **data key**. KMS makes one and
  gives it back in two forms: a **plain copy** (used once, right away) and a **wrapped copy**
  (locked by the master key, safe to store).
- The browser locks the text with the plain copy, **throws the plain copy away**, and stores the
  ciphertext next to the wrapped copy.
- To **unlock** later, the wrapped copy is sent back; KMS unwraps it and hands the plain copy to
  the browser, which unlocks the text on the user's screen.

Two keys, hence "envelope": a small **data key** locks your text, and the big **master key** locks
the data key.

```
        ┌──────────── AWS KMS (master key / CMK) ────────────┐
        │   never leaves AWS; only the backend may call it   │
        └───────────────┬───────────────────▲────────────────┘
       GenerateDataKey   │                   │  Decrypt
      (make a data key)  │                   │ (unwrap a data key)
                         ▼                   │
                 ┌───────────────── SafeVoice backend ─────────────────┐
                 │  holds AWS credentials (IAM role). Mediates KMS.     │
                 │  Stores only ciphertext + wrapped key. Reads neither.│
                 └───────────────▲───────────────────┬─────────────────┘
                   data key /     │                   │  ciphertext + wrapped key
                   case keys      │                   ▼
                 ┌───────────────────────── Browser ───────────────────────────┐
                 │  AES-256-GCM lock/unlock (Web Crypto). Holds NO AWS password.│
                 │  Uses the plain data key once, then forgets it.              │
                 └──────────────────────────────────────────────────────────────┘
```

---

## 2. Glossary

Every value below is **Base64 text** when it travels or is stored (Base64 = a safe way to write
raw bytes as plain letters so they fit in JSON).

| Field | What it is | Made by | Example (truncated) |
|---|---|---|---|
| **plaintextKey** | The actual 256-bit AES data key, in the clear. Used **once** in the browser to lock/unlock, then discarded. Never stored. | AWS KMS (`GenerateDataKey`) | `k9Fh2q...c1w==` (32 raw bytes) |
| **wrappedKey** | The **same** data key, but locked by the KMS master key. Safe to store; useless without a KMS `Decrypt` call. | AWS KMS (`GenerateDataKey`) | `AQIDAHjR...9Xg==` (~184 bytes) |
| **ciphertext** | Your locked report/message text. Includes the AES-GCM authentication tag at the end. | Browser (Web Crypto) | `8fJk2Zx...==` (grows with text) |
| **iv** | *Initialization Vector*: a small random "starter value" AES-GCM needs. 12 bytes (96 bits). Not secret; unique per lock. | Browser (`crypto.getRandomValues`) | `q1Vf9aZ2bQ==` |
| **algorithm** | A label saying how it was locked, always `AES-256-GCM`. Informational. | Browser | `AES-256-GCM` |
| **kmsKeyId** | The ARN of the master key that wrapped the data key. An address, **not a secret**. | AWS KMS (returned in the response) | `arn:aws:kms:eu-central-1:...` |
| **accessKey** | The reporter's own 64-char credential (how a reporter proves they own a case). This is a SafeVoice concept, **not** a crypto key. | SafeVoice backend at submit | `a1b2c3...` (64 hex chars) |

### The 3 fields we actually store per locked item

Only these three (plus the two labels) are saved in the database, as an `EncryptedPayload`:

```json
{
  "ciphertext": "8fJk2Zx...==",   // the locked words
  "iv":         "q1Vf9aZ2bQ==",   // the random starter value
  "wrappedKey": "AQIDAHjR...==",  // the data key, locked by the master key
  "algorithm":  "AES-256-GCM",    // how it was locked (label)
  "kmsKeyId":   "arn:aws:kms:..." // which master key wrapped it (label; may be null)
}
```

### Why is the IV needed?

AES-GCM needs `key + iv + text`. If you locked the same text with the same key and **no** IV, the
result would look identical every time — so a thief seeing two identical blobs would learn "these
two reports say the same thing" without decrypting anything. A fresh random IV makes identical text
produce completely different-looking ciphertext each time. **Rule: never reuse an IV with the same
key.** Because we use a brand-new data key for every report and every message, this is guaranteed.

---

## 3. The KMS key ARN, decoded

An ARN (Amazon Resource Name) is just the full "address" of an AWS resource. Ours:

```
arn:aws:kms:eu-central-1:864456252731:key/5ded0d5b-2a18-42b0-8394-0ccb28f6d347
│   │   │   │            │            │   └── resource id: the key's unique UUID
│   │   │   │            │            └────── resource type: "key"
│   │   │   │            └─────────────────── AWS account id (12 digits) that owns the key
│   │   │   └──────────────────────────────── region: eu-central-1 = Frankfurt (inside the EEA ✅)
│   │   └──────────────────────────────────── service: kms (Key Management Service)
│   └──────────────────────────────────────── partition: aws (standard; aws-cn / aws-us-gov differ)
└──────────────────────────────────────────── literal prefix "arn"
```

**Is the ARN a secret? No.** It is an address, like a house address — it tells you *where* the key
lives, not how to open it. To actually use the key you need **AWS credentials with IAM permission**
for it, which live only on the server. Knowing the ARN alone lets an attacker do nothing.

The only mildly sensitive thing it reveals is the **account id** (`864456252731`) and region — pure
reconnaissance, not access. That is why the browser is fine to see it. (We can still omit it from
the public response since the browser does not use it — see the code map.)

**The key MUST stay in an EEA region** (`eu-central-1`) so key material and its CloudTrail audit
never leave the allowed area — that is our GDPR / data-residency requirement.

---

## 4. The AWS APIs we use, and when

There are only **two** KMS calls in the whole system, and **only the backend** ever makes them.
(The browser's own AES-GCM lock/unlock is **not** an AWS call — it is local Web Crypto.)

| AWS API | When it runs | Who triggers it | Input | Output | Frequency |
|---|---|---|---|---|---|
| **KMS `GenerateDataKey`** | Just before locking something | Backend, when the browser asks for a data key | master key id + `AES_256` + encryption context | `plaintextKey` + `wrappedKey` | Once per report; once per message |
| **KMS `Decrypt`** | Just before unlocking something | Backend, when a reader asks for a case's keys | `wrappedKey` (ciphertext blob) + same encryption context + key id | `plaintextKey` | Once per wrapped key being unwrapped (report + each message) |

Cost is tiny (fractions of a cent per call) and irrelevant at low volume. Every call is recorded in
**AWS CloudTrail**, giving a full audit trail of who used the key and when.

**What the browser does (no AWS involved):**
- `crypto.subtle.encrypt` / `crypto.subtle.decrypt` with AES-256-GCM — runs on the user's device.

---

## 5. ENCRYPTION step by step

Scenario: an anonymous reporter submits a report for organisation `acme` (their `tenantId`).

```
Reporter's browser                 SafeVoice backend                 AWS KMS
       │                                  │                             │
  (1)  │ POST /crypto/data-key {tenantId} │                             │
       │─────────────────────────────────▶│                             │
       │                                  │ (2) GenerateDataKey          │
       │                                  │     keySpec=AES_256          │
       │                                  │     context={tenantId,purpose}│
       │                                  │────────────────────────────▶│
       │                                  │     {Plaintext, CiphertextBlob}
       │                                  │◀────────────────────────────│
       │ (3) {plaintextKey, wrappedKey}   │                             │
       │◀─────────────────────────────────│                             │
       │                                  │                             │
  (4)  │ AES-256-GCM lock (Web Crypto):   │                             │
       │   iv = random 12 bytes           │                             │
       │   ciphertext = enc(plaintextKey, iv, facts)                    │
       │ (5) THROW AWAY plaintextKey      │                             │
       │                                  │                             │
  (6)  │ POST /reports                    │                             │
       │   { tenantId, category, ...,     │                             │
       │     encryptedContent:{ciphertext,iv,wrappedKey,algorithm} }    │
       │─────────────────────────────────▶│                             │
       │                                  │ (7) store as-is. Cannot read │
       │                                  │     the words. Returns the   │
       │                                  │     one-time access key.     │
       │ (8) { accessKey }                │                             │
       │◀─────────────────────────────────│                             │
```

1. Browser asks the backend for a one-time data key for `acme`.
2. **AWS call #1 — `GenerateDataKey`.** Backend asks KMS for a fresh 256-bit key, bound to this
   tenant via the encryption context.
3. Backend returns `{ plaintextKey, wrappedKey }` to the browser over TLS.
4. Browser locks the report text with AES-256-GCM using `plaintextKey` and a fresh random `iv`.
5. Browser **discards `plaintextKey`** — it is never sent back or stored.
6. Browser posts the report with `encryptedContent = { ciphertext, iv, wrappedKey, algorithm }`
   instead of the plain `facts`.
7. Backend stores those three parts. It never saw the plain words and kept no plain key.
8. Backend returns the reporter's one-time **access key** (their future proof of ownership).

---

## 6. DECRYPTION step by step

Scenario: the same reporter comes back and reads their case with their access key.

```
Reporter's browser                 SafeVoice backend                 AWS KMS
       │                                  │                             │
  (1)  │ POST /reports/track {accessKey}  │                             │
       │─────────────────────────────────▶│ verify accessKey → find case│
       │ (2) { report(encryptedContent), messages(encryptedText) }      │
       │◀─────────────────────────────────│                             │
       │                                  │                             │
  (3)  │ POST /crypto/case-keys {accessKey}│                            │
       │─────────────────────────────────▶│                             │
       │                                  │ (4) Decrypt(wrappedKey,      │
       │                                  │     context={tenantId,...})  │
       │                                  │     for the report + each msg│
       │                                  │────────────────────────────▶│
       │                                  │     {Plaintext}  (xN)        │
       │                                  │◀────────────────────────────│
       │ (5) { contentKey, messageKeys{} }│                             │
       │◀─────────────────────────────────│                             │
       │                                  │                             │
  (6)  │ AES-256-GCM unlock (Web Crypto) using each returned key + the  │
       │   stored iv → readable text shown on screen                    │
```

1. Browser looks the case up with the access key.
2. Backend returns the case + messages — still **locked** (`encryptedContent` / `encryptedText`).
3. Browser asks for the keys to read this case (again proving ownership with the access key).
4. **AWS call #2 — `Decrypt`.** For the report's `wrappedKey` **and each message's `wrappedKey`**,
   the backend asks KMS to unwrap it, using the **same encryption context** as at lock time.
5. Backend returns the plain data keys: `contentKey` (for the report) and `messageKeys` (a map of
   `messageId → key`). These keys exist only for this one response; nothing is stored.
6. Browser unlocks the report + messages locally with AES-256-GCM and shows the readable text.

> We only ever unwrap the wrapped keys **already stored on a case the caller proved they can
> access**. You cannot hand the server a random wrapped blob and have it unwrapped for you.

**Staff read the same way**, but authenticated by their login session instead of an access key:
`GET /api/v1/internal/crypto/case-keys/{caseId}` returns the same `{ contentKey, messageKeys }`,
scoped to the staff member's own organisation.

---

## 7. Messages

The two-way thread works exactly like the report, per message:

- **Sending:** the sender's browser gets a fresh data key (`/crypto/data-key` for reporters,
  `/api/v1/internal/crypto/data-key` for staff), locks the message text, and sends
  `ciphertext + iv + wrappedKey` as multipart form fields (instead of a plain `text` field).
- **Reading:** the `case-keys` response includes a `messageKeys` map, so the browser unlocks each
  message with its own key.
- **Live messages (WebSocket):** an incoming message arrives locked; the browser unlocks it (with a
  `case-keys` call) before showing it. The sender sees their own message instantly from the plain
  text they just typed — no decrypt round-trip.

**Two exceptions that stay plain text on purpose:**
- **System notices** (e.g. the automatic 7-day acknowledgement) — the server writes these itself,
  there is no browser to lock them, and they contain no personal data.
- **The dev plaintext flag** (local testing without AWS — see §11).

Everything else — including **HR / labour-dispute** cases — is encrypted.

---

## 8. What the database stores

For a normal report row, the sensitive part looks like this — all gibberish without KMS + a browser:

```json
{
  "caseReference": "SV/2026/0709/1408",
  "tenantId": "acme",
  "category": "FRAUD",
  "description": null,                         // ← no readable text
  "encryptedContent": {
    "ciphertext": "8fJk2Zx...==",
    "iv": "q1Vf9aZ2bQ==",
    "wrappedKey": "AQIDAHjR...==",
    "algorithm": "AES-256-GCM"
  },
  "keyHash": "…",                              // SHA-256 of the access key (never the key itself)
  "status": "RECEIVED"
}
```

A thief who copies the entire database gets **only ciphertext + wrapped keys**. To read anything
they would *also* need AWS permission to call KMS `Decrypt` — which a database dump does not grant.

---

## 9. Why each piece is safe

| Thing visible in the browser / DB | Safe? | Reason |
|---|---|---|
| `kmsKeyId` (ARN) | ✅ | An address, not a key. Using the key needs AWS credentials the browser never has. |
| `wrappedKey` (in DB and browser) | ✅ | Locked by the master key; unwrapping needs a server-side KMS `Decrypt`. |
| `ciphertext`, `iv` (in DB and browser) | ✅ | The IV is not secret; the ciphertext is unreadable without the data key. |
| `plaintextKey` (sent to the browser) | ✅ *by design* | Travels over TLS, used once for a **single** item, then discarded. Cannot decrypt anything else. |
| **AWS access key / secret** | ❌ **never** | These are the real credentials. They live only on the server (IAM role). The demo exposed these — we do not. |

---

## 10. Tenant isolation (encryption context)

Every data key is tied to one organisation using a KMS **encryption context**:

```
{ "tenantId": "acme", "purpose": "safevoice-report" }
```

The context is passed at `GenerateDataKey` time **and must be passed identically at `Decrypt`
time** — otherwise KMS refuses. So a wrapped key stolen from company A can never be unwrapped as
company B, even if both share one master key. This gives cryptographic separation between tenants
on top of the normal application checks.

---

## 11. Failure modes & the dev plaintext flag

| Situation | What happens |
|---|---|
| KMS unreachable / no key configured | The `/crypto` calls return **HTTP 503 `CRYPTO_UNAVAILABLE`** (a neutral message — no AWS detail leaks). |
| Wrong tenant / tampered wrapped key | KMS `Decrypt` fails; the backend returns a neutral error. Nothing is revealed. |
| A single message can't be decrypted in the browser | That message shows `[unable to decrypt this message]`; the rest of the thread is unaffected. |
| **Local dev without AWS** | Set backend `safevoice.allow-plaintext-intake-for-local-testing=true` **and** frontend `VITE_SAFEVOICE_ALLOW_PLAINTEXT=true`. Then text is stored/sent as plain `description`/`text`. **Both default to false**, so production always encrypts for real. |

**Key rotation:** because KMS knows which key wrapped each `wrappedKey`, you can rotate/retire the
master key and old data still unwraps. `kmsKeyId` is stored (or can be) purely to make audits easy.

---

## 12. Code map

**Backend (Spring Boot)**
| Concern | File |
|---|---|
| KMS client bean (region, credentials) | `config/KmsConfig.java` |
| `GenerateDataKey` / `Decrypt` + encryption context | `service/crypto/EnvelopeEncryptionService.java` |
| Stored shape of locked text | `model/embedded/EncryptedPayload.java` |
| Where it is stored | `CaseReport.encryptedContent`, `CaseMessage.encryptedText` |
| Public endpoints (reporter) | `controller/PublicCryptoController.java` |
| Staff endpoints | `controller/InternalCryptoController.java` |
| Submit stores encrypted content; issues/unwraps keys | `service/report/CaseReportService.java` |
| Neutral KMS error → 503 | `exception/GlobalExceptionHandler.java` (`CryptoOperationException`) |
| Config | `safevoice.kms.key-id` (`SAFEVOICE_KMS_KEY_ID`), `safevoice.aws.region` |

**Frontend (React / Redux)**
| Concern | File |
|---|---|
| All browser crypto (Web Crypto AES-256-GCM) + `/crypto` calls | `src/services/cryptoService.js` |
| Encrypt on submit / decrypt on read / reporter messages | `src/services/reportService.js` |
| Staff message encrypt/decrypt | `src/services/messageService.js` |
| Live (WebSocket) message decryption | `TrackCasePage`, `CaseDetailsPage`, `CentralEncryptedInboxPage` |

**Endpoint reference**
| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/safevoice/crypto/data-key` | reporter (public) | get a one-time key to LOCK a report/message |
| `POST /api/safevoice/crypto/case-keys` | reporter (access key) | get keys to READ own case |
| `POST /api/v1/internal/crypto/data-key` | staff | get a one-time key to LOCK a reply |
| `GET /api/v1/internal/crypto/case-keys/{caseId}` | staff | get keys to READ a case |

---

## 13. FAQ

**Q: Isn't sending the `plaintextKey` to the browser dangerous?**
No — that is the whole point of client-side encryption. The browser must have the plain key to
lock/unlock on the user's device. It travels over TLS, is used once for **one** item, and is
discarded. It can never unlock any other report. What must never go to the browser is the AWS
**credentials** — and they don't.

**Q: Can our own server read the reports?**
The server *could* call KMS to decrypt (it needs to, so staff can read cases to investigate). So
this is strong **encryption at rest with KMS-managed keys**, not zero-knowledge end-to-end. The
guarantees are: no AWS credentials in the browser, a database breach alone is useless, per-tenant
isolation, and full CloudTrail audit. For a multi-party whistleblower system this is the correct,
honest model.

**Q: What if two reports contain the exact same sentence?**
They still look completely different in the database, because each uses a different data key and a
different random IV.

**Q: How many AWS calls for one case with 5 messages?**
Encrypting: 1 `GenerateDataKey` for the report + 1 per message as they are sent. Reading: 1
`Decrypt` for the report + 1 per message, all bundled into a single `case-keys` request.

**Q: Do HR / labour-dispute cases get encrypted?**
Yes — all categories are encrypted. Only server-generated System notices and the dev plaintext flag
stay in plain text. (Note: this is stricter than CLAUDE.md Module 4's original rule; that rule
should be updated to match.)

---

*See also: `CLIENT_SIDE_ENCRYPTION.md` (the shorter architecture + compliance overview).*
