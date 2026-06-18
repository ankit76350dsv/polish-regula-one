# SafeVoice Compliance Knowledge Base

Centralized, source-cited reference for building and deploying the SafeVoice whistleblower
platform across the European Union, with Poland as the primary launch market.

> **Disclaimer.** This is an engineering compliance reference, **not legal advice**.
> Every production launch in Poland or any other EU country must be reviewed by qualified
> legal counsel, the Data Protection Officer (DPO), and security leadership. Laws change;
> re-verify each cited article before relying on it.

## How this knowledge base is organised

| File | Scope |
|---|---|
| [`00-EU-WIDE.md`](00-EU-WIDE.md) | Requirements that apply in every EU state: Directive (EU) 2019/1937, GDPR, the European Accessibility Act. |
| [`01-POLAND.md`](01-POLAND.md) | Poland-specific rules from the Act of 14 June 2024 (*Ustawa o ochronie sygnalistów*). |
| [`02-COUNTRY-MATRIX.md`](02-COUNTRY-MATRIX.md) | Per-country variables (authority, retention, deletion window, default language) + how to add a new country. |
| [`03-DATA-RETENTION.md`](03-DATA-RETENTION.md) | Retention periods, deletion timers, legal hold, secure destruction. |
| [`04-USER-RIGHTS.md`](04-USER-RIGHTS.md) | GDPR data-subject rights vs. whistleblower-identity protection, and reporting obligations. |
| [`05-ACCESSIBILITY.md`](05-ACCESSIBILITY.md) | WCAG 2.1 AA / EN 301 549 checklist mapped to SafeVoice components. |
| [`06-SECURITY-DATA-PROTECTION.md`](06-SECURITY-DATA-PROTECTION.md) | Encryption, EEA hosting, no-telemetry rule, file pipeline, what production must enforce. |
| [`07-GAP-ANALYSIS-AND-CHANGE-LOG.md`](07-GAP-ANALYSIS-AND-CHANGE-LOG.md) | The June 2026 review: gaps found, changes made, and what remains for the backend. |

## How the code uses this knowledge base

- Country-specific numbers live in [`../../frontend/src/config/jurisdictions.ts`](../../frontend/src/config/jurisdictions.ts).
  Each value has a comment pointing back to the official article documented here.
- The active country is chosen with `VITE_SAFEVOICE_JURISDICTION` (default `PL`).
- UI text is translated via react-i18next ([`../../frontend/src/i18n/`](../../frontend/src/i18n/)); Polish is the default locale.

## Primary official sources (no blogs)

- **Directive (EU) 2019/1937** (EU Whistleblowing Directive) — https://eur-lex.europa.eu/eli/dir/2019/1937/oj/eng
- **Polish Act of 14 June 2024 on the Protection of Whistleblowers** — official English text published by the Commissioner for Human Rights (BRPO): https://bip.brpo.gov.pl/en/content/act-protection-whistleblowers
- **GDPR — Regulation (EU) 2016/679** — https://eur-lex.europa.eu/eli/reg/2016/679/oj
- **Directive (EU) 2019/882 (European Accessibility Act)** — https://eur-lex.europa.eu/eli/dir/2019/882/oj
- **EN 301 549** (harmonised EU accessibility standard) — referenced in the Official Journal of the EU.

_Last reviewed: 2026-06-18._
