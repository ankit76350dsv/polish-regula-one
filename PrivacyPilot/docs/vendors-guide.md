# Vendors (Processors & DPAs) — Guide

A simple, developer-friendly guide to the **Vendors** page (`/vendors`) and the
`Vendor` model behind it.

- **Page:** `/vendors`
- **Model:** `Vendor` → collection `privacypilot_vendors`
- **Frontend:** `src/pages/Vendors/VendorsPage.jsx`

---

## 1. What this page is (plain language)

It's the **list of every outside company that handles your data for you**, and
whether you have the required contract with each. In GDPR terms these outside
companies are **processors** (Art. 28) — e.g. a payroll bureau, a cloud host, a
mailing tool like Mailchimp, an ERP provider.

Think of it as an **address book of your data suppliers**, where each entry also
shows: *"do we have a signed contract with them, and how risky are they?"*

---

## 2. Why we need it (the law)

Under GDPR **Art. 28**, even when you hand data to an outside company, **you stay
responsible for it**. The law requires you to:

1. Use only processors that give **sufficient guarantees** of protection.
2. Have a **signed DPA (Data Processing Agreement)** — a written contract — with
   each one (Art. 28(3)).
3. Know their **sub-processors** (the suppliers they use), which must also be
   covered (Art. 28(2)/(4)).

So when a regulator (UODO) asks *"who touches your data, and do you have
contracts with them?"*, this page is the evidence. **A missing DPA is a real
compliance gap** — the page shows it in red, not as a decoration.

---

## 3. What you do on this page

Keep one entry per supplier and track:

| Field on the page | Meaning | Example |
|---|---|---|
| **Name** | The supplier | Mailchimp |
| **Country** | Where the supplier is based | USA |
| **Region** | Where the data actually sits (EEA check) | AWS eu-central-1 (Frankfurt) |
| **DPA status** | Signed ✅ / In negotiation ⚠️ / Missing 🔴 | Signed |
| **Sub-processors** | The vendor's own suppliers | AWS, SendGrid |
| **Risk level** | Overall rating | Medium |
| **Last review** | When last checked (blank = never) | 2026-01-15 |

Only a user with the `MANAGE_VENDORS` permission can add or edit vendors.

---

## 4. The `Vendor` model

```
Vendor  (collection: privacypilot_vendors, extends BaseDocument)
  name           String        supplier name
  country        String        where the supplier is based
  region         String        where the data physically sits (EEA residency)
  dpaStatus      enum          SIGNED / IN_NEGOTIATION / MISSING
  subprocessors  List<String>  the vendor's own sub-suppliers (Art. 28(2)/(4))
  riskLevel      enum          LOW / MEDIUM / HIGH
  lastReviewAt   Instant       last review date; null = never reviewed
  + BaseDocument fields: id, tenantId, createdAt/updatedAt/By, soft-delete
```

---

## 5. How it links to other collections

A `Vendor` is a **shared building block**. Other records point *to* it by its id
(like a foreign key). The vendor document itself does not point back — you look
it up by id when needed (a normal MongoDB reference, not an embedded copy).

```
privacypilot_activities                 privacypilot_vendors            privacypilot_transfers
┌──────────────────────────┐            ┌───────────────────┐           ┌──────────────────────────┐
│ ProcessingActivity        │            │ Vendor            │           │ Transfer                  │
│  vendorIds: ["ven-99"] ───┼───────────►│  id: "ven-99"  ◄──┼───────────┤  vendorId: "ven-99"       │
└──────────────────────────┘            └───────────────────┘           └──────────────────────────┘
   an activity uses this processor          the supplier                  a transfer uses this vendor
```

1. **Activity → Vendor** — `ProcessingActivity.vendorIds` (a list). On the register
   form (Step 4 "Processors") you tick which vendors handle that activity's data.
   One activity can use many vendors; one vendor can serve many activities
   (**many-to-many**).
2. **Transfer → Vendor** — `Transfer.vendorId`. If data leaves the EEA through a
   supplier, the transfer record points to that vendor.

---

## 6. Notes for the backend team

- **DPA status is compliance-critical:** a `MISSING` DPA on a vendor that is
  linked to a live activity should surface as a warning, not stay silent.
- **Referential integrity:** before letting a user delete a vendor, check no
  activity `vendorIds` and no transfer `vendorId` still references it (or block
  the delete). Vendors are soft-deleted like all compliance records.
- **EEA residency:** `region` (not `country`) is the field that tells you where
  data actually sits — use it for the "data stays in EEA" check, and pair it with
  the Transfers records for anything outside the EEA.
- **Tenant isolation:** every query filters by `tenantId`.
- **Permissions:** enforce `MANAGE_VENDORS` server-side for create/update/delete.

---

## 7. Related docs
- `register-and-dpia-data-model.md` — the Register/DPIA collections and links.
- `register-form-guide.md` — the "Add Activity" wizard (Step 4 picks processors).
- `project-overview.md` — the whole PrivacyPilot module at a glance.
