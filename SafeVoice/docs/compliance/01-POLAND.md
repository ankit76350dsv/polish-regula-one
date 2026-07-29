# Poland — Whistleblower Compliance

Primary law: **Act of 14 June 2024 on the Protection of Whistleblowers**
(*Ustawa z dnia 14 czerwca 2024 r. o ochronie sygnalistów*), Journal of Laws (Dz.U.) 2024
item 928. In force from **25 September 2024**. It transposes Directive (EU) 2019/1937.

Official English text (Commissioner for Human Rights / BRPO):
https://bip.brpo.gov.pl/en/content/act-protection-whistleblowers

All article references below are confirmed against that official text.

---

## Verified key provisions

| Topic | Rule | Article |
|---|---|---|
| **Anonymous reports** | A legal entity, the Commissioner for Human Rights, and a public authority **may** receive reports made anonymously. | Art. 7(1) |
| **Irrelevant personal data** | Data not relevant to handling the report is not collected, or is deleted; deletion **within 14 days** of finding it irrelevant. | Art. 8(4) |
| **Retention (entity / public authority)** | Personal data and the report register are kept **3 years** after the end of the calendar year in which follow-up ended. | Art. 8(8) |
| **Retention (RPO transmittals)** | The Commissioner retains for **12 months** after the end of the calendar year of transmitting the report onward. | Art. 8(7) |
| **External reporting authority** | The **Commissioner for Human Rights (Rzecznik Praw Obywatelskich, RPO)** receives external reports and forwards them to competent authorities; sector public authorities also receive reports. | Art. 31 |
| **Acknowledgement** | Confirm receipt **within 7 days** (unless the reporter gave no contact address). | Art. 37 |
| **Feedback** | Provide feedback **within 3 months**; extendable to **6 months** in justified, complex cases. | Art. 41(1)–(2) |

## Scope & obligations
- Entities with **50+ persons performing paid work** must set up internal reporting procedures.
- Internal procedure must define channels, the responsible unit/person, acknowledgement and
  feedback timing, and follow-up.
- Anti-retaliation protections mirror the Directive (Arts. 11–17 of the Act).

## Data protection
- The Polish Act sits alongside **GDPR** and the Polish Personal Data Protection Act; the
  supervisory authority is **UODO** (Urząd Ochrony Danych Osobowych, https://uodo.gov.pl).
- Encryption and confidentiality of report data are expected at every stage.

## SafeVoice mapping (Poland)
Configured in [`../../frontend/src/config/jurisdictions.ts`](../../frontend/src/config/jurisdictions.ts) → `POLAND`:

| Config field | Value | Source |
|---|---|---|
| `acknowledgementDays` | 7 | Art. 37 |
| `feedbackMonths` | 3 | Art. 41(1) |
| `feedbackExtensionMonths` | 6 | Art. 41(2) |
| `retentionYears` | 3 | Art. 8(8) |
| `irrelevantDataDeletionDays` | 14 | Art. 8(4) |
| `externalAuthority` | Rzecznik Praw Obywatelskich (RPO) | Art. 31 |
| `defaultLocale` | `pl` | CLAUDE.md §11 + market |

> ⚠️ The **labour-dispute / individual HR grievance** category is deliberately routed to HR
> and does **not** receive an anonymous whistleblower tracking code. Individual employment
> grievances generally fall outside the whistleblower material scope; mixing them creates
> legal and confidentiality risk. Confirm category scope with counsel per deployment.

---

_Last reviewed: 2026-06-18._
