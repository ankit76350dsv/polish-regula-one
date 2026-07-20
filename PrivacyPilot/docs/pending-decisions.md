# PrivacyPilot — Pending Decisions / TODO

Open design decisions captured for later. These are choices the team still needs
to make, not bugs.

---

## 1. "Other" data category — free-text "specify" field (OPEN)

**Status:** decision pending — logged 2026-07-17.

**Context:** We added an `OTHER("other", "Other (please specify)", false, false)`
value to `DataCategory` (backend enum) and to `DATA_CATEGORIES` (frontend
`gdpr.js`) so the register/breach forms can describe data that isn't one of the
fixed categories.

**Limitation:** Right now "Other" is only a **selectable option** — there is **no
free-text box** to type what the "other" data actually is. So the register can
say "other data is involved" but not *what* it is.

**To make it a true "specify":**
- Add a small free-text field (e.g. `dataCategoriesOther` / `otherDataNote`) on
  `ProcessingActivity` and `Breach`.
- Show a **conditional input** on the two forms that appears only when "Other" is
  ticked (register wizard Step 3, and the breach "Record breach" form).
- Include that text in the register view, the privacy-notice output, and the
  breach report.
- Effort: model field + conditional input on two forms + surface in outputs.

**Question for the team:** add the free-text "specify" field, or is the
selectable option enough for now?

---

## 2. "Other" recipient category (OPEN)

**Status:** decision pending — logged 2026-07-17.

**Context:** `RecipientCategory` is currently a **closed enum** (9 fixed values).
GDPR Art. 30(1)(d) only requires recording *categories* of recipients — it does
**not** prescribe a fixed list, so a real activity could share data with a
category not on the list.

**Question for the team:** add an "Other" value to `RecipientCategory` (parallel
to the DataCategory change above), or keep it closed?

---

## 3. TenantSettings — DEFERRED ("cover this later")

**Status:** parked — logged 2026-07-20.

**What:** `TenantSettings.java` (one settings doc per tenant: `company`
[`CompanyDetails`], `dpo` [`DpoDetails`], `ai` [`AiPreferences`], stored in the
`privacypilot_settings` collection) has been moved into a
`.../models/document/notdone/` folder to mark it as **not yet worked on**.

**Note:** the file still declares package `com.privacypilot.backend.model.document`
(only the folder changed, not the package), so it still compiles where it is.

**Why it matters later:** notices and the ROPA are meant to read the "who is the
controller" and "who is the DPO" details from here — so this needs to be finished
before those outputs can be fully populated. Revisit when we pick the settings
work back up.

---

## Notes
- The Art. 9 special categories and the Art. 10 criminal category in
  `DataCategory` are the **complete, closed legal set** — do not add/remove those.
- `RiskLevel` (LOW/MEDIUM/HIGH) is a design choice, shared with `Vendor`; a
  `NONE`/negligible level could be added to mirror the Art. 33 "unlikely to result
  in a risk" threshold, but is not required.
