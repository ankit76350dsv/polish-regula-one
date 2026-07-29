# Privacy Notices (klauzula informacyjna) — Guide

A simple, developer-friendly guide to the **Notices** page (`/notices`) and the
`PrivacyNotice` model behind it.

- **Page:** `/notices`
- **Model:** `PrivacyNotice` → collection `privacypilot_notices`
- **Frontend:** `src/pages/Notices/NoticesPage.jsx`

---

## 1. What this page is (plain language)

It's the **Privacy Notice Generator**. A privacy notice (in Polish: **klauzula
informacyjna**) is the text a company must **show people to explain how it uses
their data** — the "we collect X, for reason Y, kept for Z, here are your rights"
text you see on websites and job-application forms.

The clever part: PrivacyPilot **builds the notice automatically from the
Register**. Because all the facts (purpose, lawful basis, retention, recipients)
already live in the activity records, the app compiles them into a proper notice
— so the notice **always matches what the company actually does**. No copy-paste,
no out-of-date text.

---

## 2. Why we need it (the law)

GDPR **Art. 13 and Art. 14** require you to **tell people** certain things when
you collect their data:

- **Art. 13** — when data is collected **directly from the person** (e.g. a
  sign-up form). 
- **Art. 14** — when data is collected **about the person from elsewhere** (e.g. a
  data broker, a public register).

The two articles require slightly different content, which is why a notice is
**per-audience**, not one generic "privacy policy".

If you don't provide a proper notice, that's a compliance breach.

---

## 3. What you do on this page

1. **Pick the audience** — Employees, Website users, Job candidates, Contractors,
   Whistleblowers. Each gets its own notice (Art. 13 vs Art. 14 differ).
2. **Pick the language** — Polish or English.
3. The app runs a **completeness checklist** (the Art. 13/14 required items).
4. **Generation is BLOCKED until the checklist passes.** If something required is
   missing (e.g. no DPO contact, no retention period), the page lists exactly
   what's missing and where to fix it — so you can't publish an incomplete,
   illegal notice.
5. Once complete, the app **generates the notice text** (Markdown) from the linked
   activities. You can **download or print** it (print-to-PDF).
6. Notices are **versioned** — regenerating for the same audience makes version 2,
   3… and keeps the old ones, proving *what people were told and when*.

> Like the Register and DPIA, the output is a **draft for the DPO / legal to
> review** before publishing.

---

## 4. The `PrivacyNotice` model

```
PrivacyNotice  (collection: privacypilot_notices, extends BaseDocument)
  audience      enum          WHO it is for (EMPLOYEES, WEBSITE_USERS, ...)
  activityIds   List<String>  which register activities it was built from
  language      enum          PL / EN
  title         String        the heading
  content       String        the full generated notice text (Markdown)
  version       int           1, 2, 3... — +1 each regeneration
  generatedAt   Instant       when this version was produced
  generatedBy   String        who produced it (for the audit trail)
  + BaseDocument fields: id, tenantId, createdAt/updatedAt/By, soft-delete
```

**Versioning rule:** a notice is never overwritten. Regenerating for the same
audience inserts a **new** document with `version + 1`, keeping the history.

---

## 5. How it links to other collections

```
privacypilot_activities                    privacypilot_notices
┌─────────────────────────────┐            ┌──────────────────────────────┐
│ ProcessingActivity           │            │ PrivacyNotice                │
│  id: "act-hr-payroll"  ◄─────┼────────────┤  activityIds: ["act-hr-...", │
│  purpose, lawfulBasis,       │            │                "act-recruit"]│
│  retention, recipients ...   │            │  audience: EMPLOYEES         │
└─────────────────────────────┘            │  content: "## Kto jest ..."  │
                                            └──────────────────────────────┘
   the FACTS live here  ───compiled into───►  the NOTICE text lives here
```

- **Notice → Activities** — `PrivacyNotice.activityIds` holds the ids of the
  register activities the notice was compiled from (references into
  `privacypilot_activities`).
- The notice **reads the facts** (purpose, lawful basis, retention, recipients,
  transfers) from those activities at generation time and writes them into
  `content`. This is why the notice always matches the real register.
- It also reads the **controller identity and DPO contact** from
  `TenantSettings` (required items Art. 13(1)(a)/(b)).

---

## 6. The completeness checklist (why generation can be blocked)

Art. 13/14 list mandatory items a notice MUST contain. The generator checks each
one can be filled from register + settings data before it will produce anything.
Typical required items:

- Controller identity and contact (Art. 13(1)(a) / 14(1)(a))
- DPO contact details (Art. 13(1)(b) / 14(1)(b))
- Purposes and legal basis (Art. 13(1)(c) / 14(1)(c))
- Recipients or categories of recipients (Art. 13(1)(e) / 14(1)(e))
- Third-country transfers and safeguards (conditional)
- Retention period or criteria (Art. 13(2)(a) / 14(2)(a))
- Data subject rights (Arts. 15–21)
- Right to withdraw consent, if consent is the basis (Art. 7(3))
- Right to complain to UODO (Art. 13(2)(d) / 14(2)(e))
- Whether providing data is statutory/contractual + consequences (Art. 13 only)
- Source of the data (Art. 14 notices only)
- Automated decision-making incl. profiling (conditional)

> The full list is the single source of truth in `src/lib/gdpr.js`
> (`NOTICE_REQUIRED_ITEMS`). Keep the backend checklist in sync with it.

---

## 7. Notes for the backend team

- **Never overwrite** — generation inserts a new version; keep all prior versions
  for the 10-year retention / proof of what was shown.
- **Block on incomplete data** — re-run the Art. 13/14 completeness check
  server-side; do not trust the frontend gate alone. Report the missing items.
- **Compile from live data** — read purpose/basis/retention/recipients from the
  linked activities and controller/DPO from `TenantSettings` at generation time.
- **Art. 13 vs Art. 14** — the required items differ by audience; apply the right
  set (some items are "Art. 14 only" or "Art. 13 only").
- **Tenant isolation:** every query filters by `tenantId`.
- **Permissions:** enforce `GENERATE_NOTICES` server-side.

---

## 8. Status note

`PrivacyNotice.java` was recently moved out of `document/notdone/` into
`document/` — i.e. it is being promoted from "not built yet" to a live model. When
wiring the backend, also correct its `package` line to match the `models` folder
(it currently reads `...backend.model.document`, singular).

---

## 9. Related docs
- `register-and-dpia-data-model.md` — the Register/DPIA collections and links.
- `register-form-guide.md` — the "Add Activity" wizard the notice reads from.
- `vendors-guide.md` — processors that appear as recipients in a notice.
- `project-overview.md` — the whole PrivacyPilot module at a glance.
