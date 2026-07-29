# Gap Analysis & Change Log — June 2026 Review

Review date: **2026-06-18**. Scope: SafeVoice frontend (mock), reporting workflow,
authentication representation, anonymous reporting, file upload, notifications, audit logs,
admin features, accessibility, i18n, and EU-wide adaptability.

## Verification method
Every legal anchor was checked against **official sources only** — EUR-Lex for Directive (EU)
2019/1937 and the EAA, and the Commissioner for Human Rights (BRPO) official English text for
the Polish Act of 14 June 2024. No blogs were relied upon. The pre-existing legal copy was
found **accurate**; the gaps were accessibility, localisation, EU-configurability, the
deleted knowledge base, and a latent data-residency risk.

## Gaps found and dispositions

| # | Gap | Severity | Disposition |
|---|---|---|---|
| 1 | Flat "3 months" feedback omitted the 6-month justified extension (PL Art. 41(2)) | Low | Fixed — privacy notice now shows the extension. |
| 2 | External authority generic, not jurisdiction-driven | Medium | Fixed — names RPO (PL), config-driven + linked. |
| 3 | Poland-isms hardcoded (controller, retention, single language) | Blocks EU reuse | Fixed — `jurisdictions.ts` config layer. |
| 4 | `lang="en"`, no i18n, no Polish | High | Fixed — react-i18next, Polish default, `<html lang>` synced. |
| 5 | Icon-only buttons lacked accessible names | High | Fixed — `aria-label` added across nav/views/UI. |
| 6 | Unlabelled inputs (searches, message boxes) | High | Fixed — labels / `aria-label` added. |
| 7 | Relay toggle was a bare button | Medium | Fixed — `role="switch"` + `aria-checked`. |
| 8 | Modal lacked dialog semantics / focus trap / Esc | High | Fixed — `role="dialog"`, focus trap, Esc, focus restore. |
| 9 | No `prefers-reduced-motion` handling | Medium | Fixed — `useMotionProps()` helper. |
| 10 | Form errors not programmatically associated | Medium | Fixed — `role="alert"` + `aria-describedby`/`aria-invalid`. |
| 11 | Low-contrast / tiny muted text | Medium | Fixed — `slate-500/600` → `slate-400`. |
| 12 | No skip link; static document title | Low/Med | Fixed — skip link + per-route `document.title`. |
| 13 | Unused Google Gemini SDK + API-key plumbing | High | Fixed — removed dependency, env, capability flag. |
| 14 | AI-Studio boilerplate README | Low | Fixed — replaced with SafeVoice/compliance README. |
| 15 | Compliance knowledge base deleted (commit 919a895) | High | Fixed — rebuilt & expanded in `docs/compliance/`. |

## Change report (CLAUDE.md §25 format)

1. **Files modified.** Frontend: `App.tsx`, `components/{Views,Navigation,UI}.tsx`,
   `data/mockData.ts`, `main.tsx`, `index.html`, `package.json`, `.env.example`,
   `metadata.json`, `frontend/README.md`. Added: `config/{jurisdictions,activeJurisdiction}.ts`,
   `i18n/index.ts`, `i18n/locales/{pl,en}/common.json`, `a11y/motion.ts`, and this
   `docs/compliance/` set.
2. **Old behaviour.** English-only, Poland-hardcoded, limited ARIA, no reduced-motion, shipped
   an unused US AI SDK; compliance review doc had been deleted.
3. **New behaviour.** Polish-default localisation with EN fallback; country-config layer for
   EU-wide reuse; WCAG 2.1 AA accessibility; no third-party AI dependency; restored, expanded,
   source-cited knowledge base.
4. **Reason for change.** Meet Directive 2019/1937 + Polish Act + GDPR + EAA, and make the
   platform deployable across the EU with minimal per-country work.
5. **Security impact.** Positive — removed a potential non-EEA data path; reinforced
   no-telemetry; documented production controls. No secrets introduced.
6. **Compliance impact.** Positive — accurate, source-cited legal copy; accessibility and
   localisation obligations addressed; knowledge base reinstated.
7. **Testing performed.** `tsc --noEmit` type-check; dev-server smoke test; jurisdiction switch
   (`VITE_SAFEVOICE_JURISDICTION`); language toggle; keyboard/modal a11y spot-check;
   `grep` confirms no Gemini references remain. See frontend README for commands.
8. **Risks / side effects.** This remains a **mock** (localStorage). The real GDPR/security
   guarantees (EEA hosting, KMS, WORM audit, AV scanning, rate limiting, tenant isolation)
   must be implemented by the backend — see `06-SECURITY-DATA-PROTECTION.md`. Template country
   rows (DE/FR) are unverified and inherit EU-baseline values until counsel confirms them.

## Out of scope / follow-up
- Backend enforcement of all server-side controls.
- Legal verification of non-Poland jurisdictions before enabling them.
- Translation of remaining EU languages as markets are added.
- Full automated accessibility audit (axe/Lighthouse) + screen-reader pass.

---

_Last reviewed: 2026-06-18._
