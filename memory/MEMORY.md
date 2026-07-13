# Memory Index

- [KSeF API topology](ksef-api-topology.md) — module ports, no gateway, invoices on KSeFFlow 8081 w/ X-Tenant-Id, two drifting frontends
- [KSeF offline compliance](ksef-offline-compliance.md) — two QR codes, deadlines, retention; PDF moved client-side; known gaps (MF spec, no retry scheduler)
- [KSeF 2.0 + FA(3) migration](ksef2-fa3-migration.md) — dates+hash fixed; FA(3) schema & KSeF 2.0 auth still on FA(2)/1.0 (verified, planned)
- [SafeVoice frontend compliance audit](safevoice-frontend-compliance-audit.md) — 2026-06-26 EU/Poland audit; it's a static prototype; 4 blockers: no privacy notice, hardcoded PIN, no working channel, no Polish i18n
- [PrivacyPilot GDPR legal research](privacypilot-gdpr-legal-research.md) — 2026-07-02; Art 30/35/13-14/37-39 verified vs OJ/UODO/M.P. 2019 poz. 666; Toyota Bank ROPA fine precedent; Polish DPO 14-day notification
- [PrivacyPilot frontend A/B validation](privacypilot-frontend-validation.md) — 2026-07-02; product legally validated; verdict: neither frontend1 nor frontend2 is a foundation — new frontend, harvest B as domain spec + A's wizard/audit-diff UX; P0-P2 list inside
- PrivacyPilot new frontend built 2026-07-03 at `PrivacyPilot/frontend/` — RTK slices + services, RegulaOne structure (components/ui copied), frontend2 dark+gold theme via shadcn tokens, PL-default i18n, mock API with enforced RBAC + audit; see its README

- [No asChild prop](feedback_no_aschild.md) — RegulaOne frontend uses @base-ui/react, not Radix; asChild crashes the page
- [Save memory in repo](feedback-memory-in-repo.md) — persist notes/audits in the repo's memory/ or docs/ folder so the user can review them; harness memory = pointers only
- [SafeVoice frontend EU compliance audit](safevoice-frontend-eu-compliance-audit.md) — 2026-06-26 audit; static prototype; full doc in repo memory/; blockers: no privacy notice, hardcoded PIN, no working channel, no Polish i18n
- [PrivacyPilot validation](privacypilot-validation-2026-07.md) — new PrivacyPilot/frontend built & GDPR-hardened (2026-07-09); production-shaped, RBAC+audit+all Module-6 features; remaining work is backend-shaped
- [SafeVoice KMS encryption](safevoice-kms-encryption.md) — 2026-07-09; backend-mediated AWS KMS envelope encryption for report/message content; browser encrypts, no AWS creds in browser; doc in SafeVoice/backend/docs/
- [SafeVoice RegulaOne username immutable](safevoice-regulaone-username-immutable.md) — RegulaOne user name is the actor identity everywhere (audit/timeline/sender); TODO: make that name non-editable for integrity