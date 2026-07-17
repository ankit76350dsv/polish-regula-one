# Register & DPIA — Data Model and How the Two Collections Link

A simple, developer-friendly guide to the two central pages and the two central
MongoDB collections behind them:

- **Register** — `GET /register` (list) and `/register/:id` (one activity)
- **DPIA** — the risk study that hangs off a high-risk activity

It explains **what is stored, why we need it, and how the two collections point
at each other.** Every legal point is verified against the GDPR text and UODO
(see the DPIA workflow doc for sources).

---

## 1. The two pages in one minute

### `/register` — the Register list
The **Record of Processing Activities (ROPA)** required by GDPR **Art. 30**.
One row = one thing the company does with personal data (HR & payroll, CCTV,
newsletter…). It's the master list an auditor asks for first.

### `/register/:id` — one activity's detail
Everything about a single activity: its purpose, lawful basis, data categories,
retention, security measures, and its **DPIA screening result**. Example URL:
`/register/act-mrlyanubikhs` opens the activity whose id is `act-mrlyanubikhs`.

> **The Register is the heart of PrivacyPilot.** DPIAs, notices, vendors and
> transfers all hang off these activity records.

---

## 2. The two collections

| Collection | Java model | What one document is |
|---|---|---|
| `privacypilot_activities` | `ProcessingActivity` | One register entry (one Art. 30 activity) |
| `privacypilot_dpias` | `Dpia` | One risk study for one high-risk activity (Art. 35) |

Both extend `BaseDocument`, so every document automatically has: `id` (the
MongoDB `_id`), `tenantId` (so one company never sees another's data),
`createdAt` / `updatedAt` / `createdBy` / `updatedBy`, and soft-delete fields.

---

## 3. How the `Dpia` document stores its data (and why)

A DPIA is a **safety check you must do before a risky activity starts** (Art. 35).
The `Dpia` model stores exactly what the law says a DPIA must contain. Fields are
ordered to match the DPIA detail page top-to-bottom.

### Header — what/why this DPIA exists
| Field | Type | Why we need it | Example |
|---|---|---|---|
| `activityId` | String (ref) | Links the DPIA to the ONE activity it assesses | `"act-mrlyanubikhs"` |
| `title` | String | A readable name | `"DPIA — Kadry i płace"` |
| `status` | enum | How finished it is: DRAFT / IN_PROGRESS / APPROVED / REJECTED | `IN_PROGRESS` |
| `criteriaMatched` | List<enum> | WHY a DPIA was needed (copied from screening) | `[VULNERABLE_SUBJECTS, GENETIC]` |

### The four things a DPIA MUST contain (Art. 35(7)(a)–(d))
| Field | Art. | Plain meaning | Example |
|---|---|---|---|
| `description` | 35(7)(a) | WHAT the processing does | "Payroll, ZUS and tax settlements" |
| `necessity` | 35(7)(b) | WHY it's necessary and not excessive | "Only data the law requires" |
| `risks` | 35(7)(c) | WHAT could go wrong + scores (see below) | one risk, 3×4=12 → 2×3=6 |
| `measures` | 35(7)(d) | Extra safeguards to reduce the risks | `["Encryption", "Access logging"]` |

### Sign-off and the government step
| Field | Art. | Plain meaning | Example |
|---|---|---|---|
| `dpoAdvice` | 35(2) | The DPO's written opinion | "Risks acceptable after safeguards" |
| `priorConsultation` | 36 | True if high risk REMAINS → must consult UODO first | `false` |
| `approvals` | — | The sign-off lines (DPO + Company Admin) | see below |

### How one risk is stored (`DpiaRisk`, embedded)
Each risk carries a **before** and **after** score. Both = **likelihood ×
severity**, each rated **1–5** (so a score is 1–25).

```
likelihood (1-5) × severity (1-5)              = risk BEFORE safeguards   (e.g. 3 × 4 = 12)
residualLikelihood (1-5) × residualSeverity(1-5) = risk AFTER safeguards   (e.g. 2 × 3 = 6)
```

The **residual** (after) score is what the law cares about most — if it stays
high, `priorConsultation` should be set (Art. 36).

### How one sign-off is stored (`DpiaApproval`, embedded)
```
{ role: DPO,          name: "",               approvedAt: null }   // pending
{ role: TENANT_ADMIN, name: "Karolina Wójcik", approvedAt: 2026-07-17 }  // signed
```
Two slots are created automatically for every DPIA. A person can only sign the
slot that matches **their own role**, and the DPIA becomes `APPROVED` only when
**every** slot is signed. This is separation of duties — no one approves a risky
DPIA alone.

---

## 4. The link between the two collections (the key part)

An activity and its DPIA point at each other with **two id references** — like a
foreign key in SQL. The DPIA data is **not** copied inside the activity; only the
id is stored, and you load the full DPIA when you need it.

| Field | Lives on | Holds the `_id` of a document in |
|---|---|---|
| `dpiaId` | `ProcessingActivity` | `privacypilot_dpias` |
| `activityId` | `Dpia` | `privacypilot_activities` |

```
privacypilot_activities                        privacypilot_dpias
┌─────────────────────────────┐                ┌─────────────────────────────┐
│ ProcessingActivity           │                │ Dpia                         │
│  id: "act-mrlyanubikhs" ◄────┼────────────────┤  activityId: "act-mrly..."   │
│  dpiaId: "dpia-777" ─────────┼───────────────►│  id: "dpia-777"              │
│  dpiaVerdict: REQUIRED       │                │  status: IN_PROGRESS         │
└─────────────────────────────┘                └─────────────────────────────┘
      one activity  ────────────────────────────────►  one DPIA (0 or 1)
```

- From an **activity** → `dpiaId` jumps to its DPIA. `null` when no DPIA exists.
- From a **DPIA** → `activityId` says which activity it belongs to. It is
  `@Indexed` because "find the DPIA for this activity" is a common query.

---

## 5. What decides whether a DPIA exists at all

The activity does its own **screening** (wizard Step 8). The result drives
everything:

```
Activity.dpiaCriteria  ──►  Activity.dpiaVerdict  ──►  need a DPIA?  ──►  Activity.dpiaId
(risk boxes ticked)        (computed automatically)     (decision)        (link, if created)
```

| `dpiaVerdict` | Meaning | Is a `Dpia` document created? | `dpiaId` |
|---|---|---|---|
| `NOT_INDICATED` | 0 criteria — low risk | ❌ No | stays `null` |
| `RECOMMENDED` | 1 criterion — borderline | Optional (document the decision) | usually `null` |
| `REQUIRED` | 2+ criteria, or an Art. 35(3) case | ✅ Yes — a full DPIA is opened | set to the DPIA's id |

So a DPIA is **only** created when screening says `REQUIRED` (or you choose to
for `RECOMMENDED`). A simple newsletter → `NOT_INDICATED` → no DPIA. HR & payroll
with vulnerable + genetic data → `REQUIRED` → a DPIA is created and linked.

---

## 6. Typical read/write flows (developer view)

**Open the activity detail page (`/register/:id`):**
1. Load the `ProcessingActivity` by `id` (filtered by `tenantId`).
2. If `dpiaVerdict == REQUIRED` and `dpiaId != null`, load the `Dpia` by that id
   to show its status/summary.

**Create a DPIA from a "required" activity:**
1. Insert a new `Dpia` with `activityId = activity.id`, `status = DRAFT`, the two
   empty `approvals` slots, and `criteriaMatched` copied from the activity.
2. Set `activity.dpiaId = newDpia.id`.
3. Save both, and write an audit entry.

> ⚠️ **Keep the link consistent both ways.** If `activity.dpiaId = "dpia-777"`,
> then `dpia-777.activityId` must equal that activity's id. Set both sides in the
> same operation so the link is never one-directional.

**Find the DPIA for an activity (reverse lookup):**
`db.privacypilot_dpias.find({ activityId: <id>, tenantId: <tenant> })` — fast
because `activityId` is indexed.

---

## 7. What the backend must keep correct

- **Verdict logic is legally load-bearing.** Mirror `evaluateDpia()` server-side:
  `2+ criteria` or an Art. 35(3) case → `REQUIRED`; `1` → `RECOMMENDED`; `0` →
  `NOT_INDICATED`. Do not let the client set the verdict directly.
- **Two-way link integrity** between `dpiaId` and `activityId` (see above).
- **Approval rules server-side:** a signer must hold the matching role +
  `SIGN_DPIA`; DPIA flips to `APPROVED` only when all slots are signed.
- **Tenant isolation:** every query filters by `tenantId`.
- **Soft delete only** for compliance records (10-year retention) — never hard
  delete an activity or a DPIA.

---

## 8. Related docs
- `dpia-workflow.md` — who does what / where (company vs UODO), with sources.
- `register-form-guide.md` — field-by-field guide to the "Add Activity" wizard.
- `project-overview.md` — the whole PrivacyPilot module at a glance.
