# KSeF Permissions page — explained in simple words

UI route: `/company/{tenantId}/permissions` (menu: "KSeF Permissions")

This guide explains the Permissions page in plain language: **why it exists, how you use it,
how other people (like your accountant) use it, where the information is saved, and the error you
might see.** A short "For developers" section at the end lists the exact files, APIs, and database.

---

## 1. The big idea (read this first)

Think of **KSeF** as a **government office for invoices** 🏛️.

- Your company's invoices don't only live in this app. The **real copy lives at the government (KSeF)**.
- This app (RegulaOne / KSeFFlow) is just **one door** into that government office. There are many doors.
- The government keeps an **"approved list"** of who is allowed to act for your company.

**This Permissions page is where you manage that approved list.**

You are NOT giving anyone a login to your app here. You are telling the **government**:
*"please let this person/company act on my invoices."*

---

## 2. Why we need this page

In KSeF, the company owner does not have to do everything alone. The law lets you hand out specific
jobs to other people — for example:

- an **employee** who issues invoices, or
- an outside **accounting office** (*biuro rachunkowe*) that keeps your books.

The government only lets someone act for your company **if their tax number is on your approved list**.
Without this page, your staff or accountant simply **cannot** issue or read your invoices in KSeF.

It also keeps you safe during a tax inspection: there is a clear, official record of **who you
approved and why**.

---

## 3. Who can use this page

- **Granting and removing** permissions → **the Admin only** (the company owner, or someone the owner
  trusted with admin rights). A normal app user **cannot** do this.
- **Just looking** at the list ("who can do what") → the Admin, plus oversight roles
  (Compliance Officer, Auditor).

So: **the Admin manages it.** Regular users do not.

---

## 4. What each permission means (plain words)

When you add a person, you tick what they are allowed to do:

| On the screen | In plain words |
|---|---|
| **Issue invoices** (InvoiceWrite) | Can create and send invoices for your company |
| **Browse / receive invoices** (InvoiceRead) | Can see your company's invoices |
| **Manage permissions** (CredentialsManage) | Can add/remove other people (like a manager) |
| **View permissions** (CredentialsRead) | Can only look at the approved list |
| **Introspection** | Can review session activity |
| **Manage subunits** (SubunitManage) | Can manage branches/sub-units of the company |
| **Enforcement operations** | Special enforcement-related actions (rarely used) |

Example — your accountant usually needs: ✅ **Issue invoices** + ✅ **Browse / receive invoices**.

---

## 5. How YOU use this page (step by step)

1. Sign in as the **Admin**.
2. Click **"Grant permissions to a person."**
3. **Identifier Type** — choose **NIP** (for a company, e.g. an accounting office) or **PESEL**
   (for an individual person).
4. **Person Identifier** — type their tax number.
5. **Permissions** — tick what they may do.
6. **Description / reason** — write why, e.g. *"Accountant — issues and receives invoices."*
   (The government requires a reason.)
7. Click **Grant Permissions.**
8. The request is sent to the government. It is processed in the background; once done, the person
   appears in the list below. To remove someone later, revoke their entry from the list.

> The change is **not instant** — the government processes it and our app checks back until it's
> confirmed.

---

## 6. How OTHER people use it (the important part)

The accountant (or any outside party) **does NOT log into your app.** They never touch RegulaOne.

- They use **their own software** (their own accounting program, or the government's free KSeF app)
  and **their own** KSeF login.
- When they try to work on your invoices, the government checks its approved list. Because you put
  their tax number on it, the government **lets them in**.

```
   YOU                          THE ACCOUNTANT
   │ use THIS app               │ uses THEIR OWN software
   ▼                            ▼
   ┌──────────────────────────────────────────┐
   │        GOVERNMENT OFFICE (KSeF)            │
   │  • holds your company's invoices           │
   │  • checks your "approved list"             │
   │  • allowed? ✅ / not allowed? ❌            │
   └──────────────────────────────────────────┘
```

You both work on the **same invoices**, through **different doors**, because the invoices live at
the government — not inside any single app. That is the whole point of a central national system.

This is also why the approved list is a **separate page** and not hidden "inside each app user":
the people on it (like an outside accounting office) are usually **not** users of your app at all.

---

## 7. Where is the information saved?

Three simple facts:

1. **The approved list lives at the government (KSeF) — that is the real, official copy.** When this
   page shows the list, it is **asking the government live**. Our app does **not** keep its own copy
   of the list.
2. **Our app only keeps a diary note** (an audit log) saying *"on this date, this person was approved
   / removed, and why."* That is the only thing saved in our database about this page.
3. **To talk to the government, our app shows a company ID card — the *certificate*.** It is kept
   safely (encrypted) and used to sign each request.

---

## 8. The red error you might see 🔴

```
"Nieprawidłowy certyfikat"  =  "Invalid certificate"
```

In plain words: **the government rejected your company's ID card (certificate).**

Our app tried to open the door at KSeF using your company's certificate, and the government said
*"this card is not valid."* So **nothing on this page can work yet** — you cannot add or view
approved people until the government accepts your ID card.

**This is not a bug in the page.** The fix is on the **certificate** side: a valid KSeF certificate
must be set up for your company (see the [certificates guide](./certificates.md)). Once the
certificate works, this page will work too.

---

## 9. For developers (the technical map)

**Frontend:** [`PermissionsManager.jsx`](../frontend/src/components/PermissionsManager.jsx) ·
API calls in [`ksefApi.js`](../frontend/src/api/ksefApi.js) ·
UI gating in [`permissions.js`](../frontend/src/lib/permissions.js)
(`can.managePermissions` = `KSEF_ADMIN`; `can.readPermissions` = admin / compliance / auditor).

**Our backend API** ([`KsefPermissionsController`](../backend/src/main/java/com/ksefflow/backend/controllers/KsefPermissionsController.java),
base `/api/v1/permissions`):

| Endpoint | Who | What it does |
|---|---|---|
| `POST /persons/grants?nip=` | `KSEF_ADMIN` | Grant a person KSeF rights. Returns a `referenceNumber` (async). |
| `POST /query?nip=` | admin / compliance / auditor | List "who can do what" in this company context (paged). |
| `DELETE /{permissionId}?nip=` | `KSEF_ADMIN` | Revoke one grant. Returns a `referenceNumber` (async). |
| `GET /operations/{referenceNumber}?nip=` | admin / compliance / auditor | Check whether a grant/revoke finished. |

**Government KSeF API** is the real store. [`KsefPermissionsService`](../backend/src/main/java/com/ksefflow/backend/services/KsefPermissionsService.java)
opens a signed KSeF session ([`KSeFAuthService`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KSeFAuthService.java))
then calls KSeF via [`KsefApiClient`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KsefApiClient.java).
Grants/revokes are **asynchronous** — KSeF returns a `referenceNumber` you poll.

**Our endpoint → government KSeF endpoint** (every call first opens a signed session — see the auth
note below). `{ksefBaseUrl}` is the active KSeF base URL — sandbox `https://api-test.ksef.mf.gov.pl/v2`,
production `https://api.ksef.mf.gov.pl/v2` (from [`KsefApiProperties`](../backend/src/main/java/com/ksefflow/backend/config/KsefApiProperties.java)):

| Our endpoint (KSeFFlow `:8081`) | Government KSeF endpoint it calls | Notes |
|---|---|---|
| `POST /api/v1/permissions/persons/grants` | `POST {ksefBaseUrl}/permissions/persons/grants` | async → returns `referenceNumber` (202) |
| `POST /api/v1/permissions/query` | `POST {ksefBaseUrl}/permissions/query/persons/grants?pageOffset=&pageSize=` | paged list of grants |
| `DELETE /api/v1/permissions/{permissionId}` | `DELETE {ksefBaseUrl}/permissions/common/grants/{permissionId}` | async → returns `referenceNumber` (202) |
| `GET /api/v1/permissions/operations/{referenceNumber}` | `GET {ksefBaseUrl}/permissions/operations/{referenceNumber}` | poll the async grant/revoke result |

**Auth step (runs before every call above).** To act for the company, the backend first opens a
certificate-signed KSeF session. That uses these government endpoints (in [`KsefApiClient`](../backend/src/main/java/com/ksefflow/backend/services/ksefauth/KsefApiClient.java)):

| Step | Government KSeF endpoint |
|---|---|
| 1. Ask for a login challenge | `POST {ksefBaseUrl}/auth/challenge` |
| 2. Submit the **XAdES-signed** challenge (uses the certificate) | `POST {ksefBaseUrl}/auth/xades-signature` |
| 3. Wait for the auth result | `GET {ksefBaseUrl}/auth/{referenceNumber}` |
| 4. Redeem the access token | `POST {ksefBaseUrl}/auth/token/redeem` |

> The **"invalid certificate" (21115)** error happens at **step 2** (`/auth/xades-signature`) — KSeF
> rejects the certificate, so the session never opens and none of the permission endpoints can run.

**Databases / storage:**
- **KSeF national system** — the source of truth for the grants themselves. KSeFFlow stores **no**
  local copy of the permission list.
- **KSeFFlow MongoDB** — audit log only (`KsefAuditLog`: `PERMISSION_GRANTED`, `PERMISSION_REVOKED`).
- **AWS S3** — the encrypted KSeF certificate used to sign the session (metadata in Mongo). See the
  [certificates guide](./certificates.md).

**Permission subject types** sent to KSeF: `Nip`, `Pesel`, `Fingerprint`
(`subjectDetailsType` defaults to `PersonByIdentifier`).
**Permission codes:** `InvoiceWrite`, `InvoiceRead`, `CredentialsManage`, `CredentialsRead`,
`Introspection`, `SubunitManage`, `EnforcementOperations`.

**Official references (Ministry of Finance):**
- [Moduł Certyfikatów i Uprawnień (MCU)](https://ksef.podatki.gov.pl/modul-certyfikatow-i-uprawnien-mcu/)
- [Uprawnienia i autoryzacja](https://ksef.podatki.gov.pl/ksef-news/uprawnienia-i-autoryzacja/)
- [Pytania i odpowiedzi — Uprawnienia i autoryzacja](https://ksef.podatki.gov.pl/pytania-i-odpowiedzi-ksef-20/?category=Uprawnienia+i+autoryzacja)

---

## 10. One-paragraph summary

The Permissions page manages your company's **"approved list" at the government (KSeF)** — who may
issue or read your invoices on your behalf. Only the **Admin** sets it up, by **tax number**
(NIP/PESEL), not by app login. Outside people like your **accountant use their own software** and
the government lets them in because they are on your list. The list itself **lives at the
government**; our app only keeps an audit note and uses your **certificate** to talk to KSeF. Right
now the **"invalid certificate"** error blocks everything until a valid certificate is set up.
