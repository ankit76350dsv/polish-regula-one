# Memory Index

- [KSeF API topology](ksef-api-topology.md) — module ports, no gateway, invoices on KSeFFlow 8081 w/ X-Tenant-Id, two drifting frontends
- [KSeF offline compliance](ksef-offline-compliance.md) — two QR codes, deadlines, retention; PDF moved client-side; known gaps (MF spec, no retry scheduler)
- [KSeF 2.0 + FA(3) migration](ksef2-fa3-migration.md) — dates+hash fixed; FA(3) schema & KSeF 2.0 auth still on FA(2)/1.0 (verified, planned)
- [SafeVoice frontend compliance audit](safevoice-frontend-compliance-audit.md) — 2026-06-26 EU/Poland audit; it's a static prototype; 4 blockers: no privacy notice, hardcoded PIN, no working channel, no Polish i18n
- [PrivacyPilot GDPR legal research](privacypilot-gdpr-legal-research.md) — 2026-07-02; Art 30/35/13-14/37-39 verified vs OJ/UODO/M.P. 2019 poz. 666; Toyota Bank ROPA fine precedent; Polish DPO 14-day notification
- [PrivacyPilot frontend A/B validation](privacypilot-frontend-validation.md) — 2026-07-02; product legally validated; verdict: neither frontend1 nor frontend2 is a foundation — new frontend, harvest B as domain spec + A's wizard/audit-diff UX; P0-P2 list inside
- PrivacyPilot new frontend built 2026-07-03 at `PrivacyPilot/frontend/` — RTK slices + services, RegulaOne structure (components/ui copied), frontend2 dark+gold theme via shadcn tokens, PL-default i18n, mock API with enforced RBAC + audit; see its README
