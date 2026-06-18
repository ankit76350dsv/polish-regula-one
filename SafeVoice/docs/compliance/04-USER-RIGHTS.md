# User Rights & Reporting Obligations

This file covers two audiences: **data subjects** (GDPR rights) and the **organisation**
(its reporting obligations), plus the special tension between GDPR access rights and
whistleblower-identity protection.

## GDPR data-subject rights (Arts. 12–22)
- **Access (Art. 15), Rectification (16), Erasure (17), Restriction (18), Portability (20),
  Objection (21).**
- These apply to people whose data is processed in the system — including a person **named in
  a report** (the accused), not only the reporter.

### The key tension: access vs. reporter identity
- A subject-access request by an accused person **must not** be used to unmask the reporter.
  Reporter-identifying information is withheld under the confidentiality duty
  (Directive Art. 16; Polish Act) and GDPR restrictions/exemptions for the rights/freedoms
  of others (GDPR Art. 15(4), Art. 23 national restrictions).
- Erasure can be **refused/deferred** where processing is necessary for a legal obligation or
  the establishment/exercise/defence of legal claims (GDPR Art. 17(3)).

### Design rules in SafeVoice
- Anonymous-by-default: the system **cannot identify** an anonymous reporter from the tracking
  code (stated to the reporter on the success screen).
- Any voluntary contact is stored only as a vault reference and is never shown to
  investigators by default.
- DSAR workflows (production) must include a review step that strips reporter-identifying
  data before disclosure.

## Reporting obligations (organisation)
- Maintain a **register of reports** (Polish Act Art. 8 / Directive Art. 18).
- **Acknowledge within 7 days**, **feedback within 3 months** (extendable to 6 in Poland).
- Provide reporters with **external reporting** information (national authority — RPO in
  Poland) and public-disclosure conditions.
- Keep **records of processing** (GDPR Art. 30) and run a **DPIA** (Art. 35) before launch.

## Reporter-facing transparency (privacy notice)
The report portal shows a privacy-notice summary naming the controller, purpose, external
authority, and feedback deadline. Production needs a full tenant-specific privacy notice and
Data Processing Agreement (DPA).

---

_Last reviewed: 2026-06-18._
