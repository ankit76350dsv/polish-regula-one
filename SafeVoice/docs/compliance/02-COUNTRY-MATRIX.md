# EU Country Matrix & How to Add a Country

SafeVoice is built so that launching in a new EU country means **adding one configuration
object**, not editing screens. This file lists the variables that change per country and
how to add one safely.

## What changes per country

These are the fields on the `Jurisdiction` type in
[`../../frontend/src/config/jurisdictions.ts`](../../frontend/src/config/jurisdictions.ts):

| Field | Meaning |
|---|---|
| `controllerName` | The GDPR controller entity in that country. |
| `externalAuthority` | National competent authority for external reports (name + URL). |
| `acknowledgementDays` | Days to confirm receipt (Directive baseline: 7). |
| `feedbackMonths` / `feedbackExtensionMonths` | Feedback deadline and any national extension. |
| `retentionYears` | Report-register retention period. |
| `irrelevantDataDeletionDays` | Deadline to delete irrelevant personal data. |
| `defaultLocale` / `supportedLocales` | Languages shown for that deployment. |
| `legalBasisLabel` | Human-readable law(s) named in notices. |

## Matrix (verify each row before production)

| Country | Authority | Ack | Feedback | Retention | Irrelevant-data | Default lang | Status |
|---|---|---|---|---|---|---|---|
| **EU baseline** | National competent authority | 7 d | 3 mo | 3 yr | 14 d | en | Directive defaults |
| **Poland (PL)** | Rzecznik Praw Obywatelskich (RPO) | 7 d | 3 mo (→6) | 3 yr | 14 d | pl | ✅ Verified (Act 14 Jun 2024) |
| **Germany (DE)** | Bundesamt für Justiz (HinSchG) | 7 d | 3 mo | 3 yr* | 14 d* | de | ⚠️ Template — verify HinSchG |
| **France (FR)** | Défenseur des droits (Loi Sapin II) | 7 d | 3 mo | 3 yr* | 14 d* | fr | ⚠️ Template — verify Loi Sapin II |

\* Template rows inherit EU-baseline numbers until national law is confirmed by counsel.

## Steps to add a new EU country

1. **Research the national transposition law** from official government / EUR-Lex sources
   only (not blogs). Confirm: external authority, acknowledgement/feedback deadlines,
   retention period, irrelevant-data deletion window, anonymous-report handling.
2. **Add a `Jurisdiction` object** in `jurisdictions.ts`, copying `GERMANY`/`FRANCE` as a
   template. Put the official article reference in a comment next to each number.
3. **Register it** in the `JURISDICTIONS` map.
4. **Add a locale file** under `src/i18n/locales/<code>/common.json` and list the language in
   `supportedLocales`.
5. **Document it**: add a verified row to the matrix above and, if substantial, a country
   file like `01-POLAND.md`.
6. **Legal sign-off** from counsel + DPO before flipping `VITE_SAFEVOICE_JURISDICTION`.

---

_Last reviewed: 2026-06-18._
