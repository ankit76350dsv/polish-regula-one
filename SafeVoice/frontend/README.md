# SafeVoice — Anonymous Whistleblower Portal (frontend)

SafeVoice is the whistleblower module of the RegulaOne compliance platform. This package is
the **frontend** (React 19 + Vite + Tailwind). It is currently a UI mock backed by
`localStorage`; the production GDPR/security guarantees must be enforced by the backend
(see "Production notes" below).

## Compliance posture

SafeVoice is built privacy-first and is aligned with:

- **Directive (EU) 2019/1937** (EU Whistleblowing Directive)
- **Polish Act of 14 June 2024 on the Protection of Whistleblowers** (*Ustawa o ochronie sygnalistów*)
- **GDPR** (data minimisation, storage limitation, data protection by design & default)
- **Directive (EU) 2019/882** (European Accessibility Act) / **EN 301 549** → **WCAG 2.1 AA**

The full, source-cited compliance knowledge base lives in
[`../docs/compliance/`](../docs/compliance/).

Key principles enforced in the UI:

- Anonymous-by-default intake; no account required to report or track.
- **No reporter telemetry** — no IP, user-agent, device/browser fingerprint, or geolocation.
- **No third-party AI services** and **no non-EEA data transfer**.
- Evidence is metadata-stripped and referenced by vault IDs (original filenames never shown).
- Retention, 14-day irrelevant-data deletion, and legal-hold are modelled as workflow state.

## Internationalisation & EU-wide deployment

- UI strings are localised with **react-i18next** (`src/i18n/`). Polish (`pl`) is the default
  locale; English (`en`) is the fallback. Other EU languages can be added as locale files.
- Country-specific rules (controller, external authority, retention, deletion window, default
  locale) are defined per jurisdiction in `src/config/jurisdictions.ts`. Select the active
  jurisdiction with `VITE_SAFEVOICE_JURISDICTION` (default `PL`).

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint    # tsc --noEmit
npm run build
```

Configuration: copy `.env.example` to `.env.local` and set `VITE_SAFEVOICE_JURISDICTION`.

## Production notes (out of scope for this mock)

The real legal guarantees must be implemented server-side: EEA-only hosting, AES-256-GCM at
rest / TLS 1.3 in transit, KMS key management, immutable (WORM) audit storage, rate limiting,
antivirus scanning + signed upload URLs, and strict tenant isolation. See
[`../docs/compliance/06-SECURITY-DATA-PROTECTION.md`](../docs/compliance/06-SECURITY-DATA-PROTECTION.md).
