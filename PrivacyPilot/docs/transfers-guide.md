# International Transfers (Chapter V) — Guide

A simple, developer-friendly guide to the **Transfers** page (`/transfers`) and the
`Transfer` model behind it.

- **Page:** `/transfers`
- **Model:** `Transfer` → collection `privacypilot_transfers`
- **Frontend:** `src/pages/Transfers/TransfersPage.jsx`

---

## 1. What this page is (plain language)

It's the record of **personal data leaving Europe**. Each entry says: *data goes
to this country, to this recipient, and here is the legal tool that makes it
safe.* In GDPR terms this is the **International Transfers register (Chapter V)**.

---

## 2. Why we need it (the law)

By default, personal data must **stay inside the EEA** (EU + a few countries).
Sending it to a "third country" (e.g. the USA, India) is **restricted** — it is
only allowed if you have a legal safeguard in place (GDPR Chapter V, Arts. 44–49).
And **Art. 30(1)(e)** says the register must record such transfers.

So this page answers the regulator's question: *"Does any of your data leave
Europe, and if so, is it legally protected?"* Without a valid safeguard, the
transfer is illegal.

---

## 3. What you do on this page

For each transfer, record:

| Field on the page | Meaning | Example |
|---|---|---|
| **Destination country** | Where the data goes | USA |
| **Recipient** | Who receives it there | Mailchimp LLC |
| **Mechanism** | The legal tool making it safe (see below) | SCC |
| **Adequacy note** | Reasoning about the safeguard | "Recipient certified under EU-US DPF" |
| **TIA documented?** | Has a Transfer Impact Assessment been done? | Yes |
| **TIA reference** | Link/id of the TIA document | TIA-2026-004 |

### The transfer mechanisms
- **Adequacy decision (Art. 45)** — the EU has ruled the country "safe enough"
  (e.g. UK, Switzerland, Japan). No extra safeguard needed.
- **Standard Contractual Clauses / SCC (Art. 46)** — EU-approved contract terms.
- **Binding Corporate Rules / BCR (Art. 47)** — internal rules for company groups.
- **Art. 49 derogation** — a documented exception for specific situations.

### The TIA (Transfer Impact Assessment)
After the **Schrems II** ruling (and EDPB Recommendations 01/2020), a
non-adequacy transfer must be checked to see whether the destination country's
laws would undermine your safeguards. **The page flags a non-adequacy transfer
that has no TIA as a risk.**

---

## 4. The `Transfer` model

```
Transfer  (collection: privacypilot_transfers, extends BaseDocument)
  vendorId            String (ref, indexed)  the Vendor sending data abroad (optional)
  activityId          String (ref, indexed)  the ProcessingActivity it belongs to (optional)
  destinationCountry  String                 the third country (Art. 30(1)(e))
  recipient           String                 who receives the data there
  mechanism           enum                   ADEQUACY / SCC / BCR / DEROGATION
  adequacyNote        String                 note on the safeguard situation
  tiaDocumented       boolean                has a TIA been documented?
  tiaRef              String                 reference to the TIA document
  + BaseDocument fields: id, tenantId, createdAt/updatedAt/By, soft-delete
```

---

## 5. How it links to other collections

A `Transfer` **points to** up to two other records by id. Both are optional and
both are `@Indexed` (fast reverse lookups).

```
privacypilot_activities              privacypilot_transfers              privacypilot_vendors
┌──────────────────────────┐         ┌──────────────────────────┐        ┌───────────────────┐
│ ProcessingActivity        │         │ Transfer                  │        │ Vendor            │
│  id: "act-newsletter" ◄───┼─────────┤  activityId: "act-news…"  │        │  id: "ven-mc"     │
│  transferIds:["tr-usa"]──►│         │  vendorId:  "ven-mc" ─────┼───────►│                   │
└──────────────────────────┘         │  id: "tr-usa"             │        └───────────────────┘
                                      │  destinationCountry: USA  │
                                      └──────────────────────────┘
```

1. **Transfer → Activity** (`Transfer.activityId`) — which register activity this
   transfer belongs to.
2. **Transfer → Vendor** (`Transfer.vendorId`) — which supplier the transfer goes
   through (e.g. Mailchimp in the USA).
3. **Activity → Transfer** (`ProcessingActivity.transferIds`) — the reverse link:
   on the register form (Step 5) you flag `transfer = true` and store the transfer
   ids. So the link is **two-way with the activity** and **one-way to the vendor**.

Both `vendorId` and `activityId` can be `null` — a transfer can stand alone, or be
tied to a vendor, an activity, or both.

---

## 6. Notes for the backend team

- **Two-way link with the activity:** if `transfer.activityId = "act-x"`, then
  `act-x.transferIds` should include this transfer's id. Set both sides together.
- **TIA rule:** if `mechanism != ADEQUACY` and `tiaDocumented == false`, surface a
  warning — this is the Schrems II gap the page highlights.
- **Adequacy list drifts:** the set of adequate countries changes over time
  (Commission decisions). Keep it in a maintainable place (the frontend uses
  `ADEQUACY_COUNTRIES` in `src/lib/gdpr.js`, checked 2026-07-02) and re-verify
  against the official EU list before relying on it.
- **Referential integrity:** on deleting a vendor or activity, decide what happens
  to transfers that reference it (block, or null the link). Soft-delete only.
- **Tenant isolation:** every query filters by `tenantId`.
- **Permissions:** enforce `MANAGE_TRANSFERS` server-side.

---

## 7. Related docs
- `vendors-guide.md` — the suppliers a transfer often goes through.
- `register-and-dpia-data-model.md` — the Register/DPIA collections and links.
- `register-form-guide.md` — the "Add Activity" wizard (Step 5 flags transfers).
- `project-overview.md` — the whole PrivacyPilot module at a glance.
