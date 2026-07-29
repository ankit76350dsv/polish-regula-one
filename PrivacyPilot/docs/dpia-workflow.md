# DPIA Workflow — Who Does What, and Where

This note explains, in simple language, **where** the DPIA work happens (in our app
vs. at the government office) and **who** drafts, reviews, and approves it. Every
legal point below is verified against the official GDPR text and UODO guidance —
see **Sources** at the bottom.

> **DPIA = Data Protection Impact Assessment** (Polish: *ocena skutków dla ochrony
> danych*). It is a written risk study done **before** a high-risk data activity
> starts (GDPR Art. 35).

---

## 1. The one-line answer

**The screening and the DPIA itself are done by the company, inside PrivacyPilot.**
You do **not** send a normal DPIA to the government. The Polish regulator (**UODO**)
is involved in **only one** situation: *prior consultation*, when a high risk
still remains after your safeguards (Art. 36).

---

## 2. Where does each part happen?

| Step | Where | Who does it |
|---|---|---|
| **DPIA screening** (wizard Step 8) | ✅ Inside our app | The company user filling the register form |
| **Full DPIA** (the risk study, if screening = *required*) | ✅ Inside our app / inside the company | Company staff (Compliance Officer drafts; DPO advises) |
| **Prior consultation** (only if high risk *remains* after safeguards) | 🏛️ At the government office — **UODO** | The company sends it to UODO **before** starting |

So screening and the DPIA are 100% the company's own work. The regulator only
ever sees a DPIA in the rare prior-consultation case.

---

## 3. Who drafts, reviews, and approves? → The company's own staff

It is **the company**, never the government, that drafts/reviews/approves. This
maps directly to PrivacyPilot's RBAC permission matrix (`src/lib/permissions.js`):

| Action | Role in our app | Permission |
|---|---|---|
| **Draft / write** the DPIA | **Compliance Officer** | `MANAGE_DPIA` |
| **Review + advise + sign** the DPIA | **DPO (IOD)** | `SIGN_DPIA` |
| **Approve** the related activity | **DPO or Company Admin** | `APPROVE_ACTIVITY` |
| Everything (incl. sign & approve) | **Company Admin** | all |

The DPO **advises and signs**, but under the law the **controller (the company)**
stays responsible for the DPIA.

---

## 4. What the government (UODO) actually does

UODO is **not** a drafter, reviewer, or approver in the normal flow. UODO only:

1. **Publishes the list** of processing types that require a DPIA (Art. 35(4)).
   In Poland this is the *Komunikat Prezesa UODO z 17 czerwca 2019 r.* (Monitor
   Polski 2019, poz. 666) — the 12 criteria our screening is built from.
2. **Receives a prior consultation** (Art. 36) when a high risk cannot be
   mitigated by the controller.

---

## 5. The full flow (picture)

```
IN OUR APP — the company does all of this:

  Screening (wizard Step 8)
        │
   verdict = REQUIRED?
        │ yes
        ▼
  Compliance Officer DRAFTS  ─►  DPO REVIEWS + SIGNS  ─►  Admin/DPO APPROVES
  the DPIA                        (advises)               the activity
        │
   high risk STILL remains after safeguards?
        │
        ├── yes ─►  🏛️ CONSULT UODO first (Art. 36)   ← the only government touchpoint
        │
        └── no  ─►  Start the processing
```

---

## 6. The three screening verdicts (recap)

The screening counts the matched criteria and gives a verdict. The user does **not**
pick it — the app computes it (`evaluateDpia()`).

| Verdict | Meaning | What the company must do |
|---|---|---|
| **NOT_INDICATED** | No criteria matched — not "likely high risk". | No DPIA now. Re-screen if the activity changes (Art. 35(11)). |
| **RECOMMENDED** | Exactly **1** criterion. Borderline — one *may* suffice. | Assess and **document the decision** either way (accountability, Art. 5(2)). |
| **REQUIRED** | **2+** criteria (UODO rule), **or** an Art. 35(3) mandatory case. | Do the **full DPIA before processing starts** (Art. 35(1)/(7)); DPO signs off; if residual high risk → **consult UODO** (Art. 36). |

**Art. 35(3)** always requires a DPIA (regardless of count) for: (a) large-scale
systematic profiling with legal/significant effects; (b) large-scale special
(Art. 9) or criminal (Art. 10) data; (c) large-scale systematic monitoring of a
publicly accessible area.

---

## 7. Notes for the backend team

- The DPIA verdict logic is **legally load-bearing** — keep the same rule on the
  server: `2+ criteria → REQUIRED`, Art. 35(3) cases always `REQUIRED`, `1 →
  RECOMMENDED`, `0 → NOT_INDICATED`. Mirror `evaluateDpia()`.
- A DPIA belongs to one activity (`Dpia.activityId`); the activity keeps the
  screening result (`dpiaCriteria`, `dpiaVerdict`) and a link (`dpiaId`).
- Model the DPO sign-off and the "prior consultation" flag explicitly (see
  `Dpia.priorConsultation` / `DpiaApproval`) so the Art. 36 step is auditable.
- Enforce the RBAC actions above **server-side** — a user must hold `MANAGE_DPIA`
  to draft and `SIGN_DPIA` to sign; never trust the frontend guard alone.

---

## Sources (official)

- Art. 35 GDPR — Data Protection Impact Assessment: https://gdpr-info.eu/art-35-gdpr/
- Art. 36 GDPR — Prior consultation: https://gdpr-info.eu/art-36-gdpr/
- Art. 39 GDPR — Tasks of the DPO (advice on DPIA): https://gdpr-info.eu/art-39-gdpr/
- UODO — Kiedy trzeba przeprowadzić ocenę skutków (the two-criteria rule): https://uodo.gov.pl/pl/598/3617
- UODO — Uprzednie konsultacje (prior consultation, Art. 36): https://uodo.gov.pl/500
- Monitor Polski 2019 poz. 666 — UODO mandatory DPIA list: https://monitorpolski.gov.pl/MP/2019/666
