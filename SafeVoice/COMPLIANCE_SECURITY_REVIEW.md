# SafeVoice Compliance and Security Review

Review date: 2026-06-18
Scope: SafeVoice mock frontend, anonymous reporting workflows, logging, file handling, encryption posture, retention, and administrative controls.

This is an engineering compliance review, not legal advice. Production launch in Poland or the EU still requires review by qualified counsel, the data protection officer, and security leadership.

## Legal and Compliance Basis Checked

- GDPR Article 5 principles: lawfulness, fairness, transparency, purpose limitation, data minimisation, storage limitation, integrity/confidentiality, and accountability.
- GDPR Article 25: data protection by design and by default.
- Directive (EU) 2019/1937 Article 9: secure channels, acknowledgement within 7 days, diligent follow-up, feedback within 3 months, and external reporting information.
- Directive (EU) 2019/1937 Articles 16 to 18: confidentiality, GDPR-aligned processing, deletion of irrelevant personal data, and proportionate record keeping.
- Polish Act of 14 June 2024 on the protection of whistleblowers: anonymous reports may be accepted, identity must be confidential, irrelevant personal data is not collected or is deleted within 14 days after it is found irrelevant, authorized access is required, and report documentation retention is generally 3 years after the relevant calendar year.

## High-Risk Issues Found in the Existing Mock

- Public users could access staff workspaces by automatic role escalation.
- Audit logs displayed fixed IP addresses to administrators.
- Reporter PINs were described as AES decryption keys.
- File names were retained and displayed, which can reveal identity.
- XLSX uploads were allowed, conflicting with the repository upload policy.
- Dashboards showed small-cell trend and department analytics that can re-identify reporters in low-volume teams.
- Labour dispute routing forced named HR disclosure and mixed HR grievances with whistleblower reporting.
- Retention was only described in copy and not represented as a workflow state.
- Administrative controls such as MFA, session expiration, revocation, and lockout were not represented.

## Implemented Frontend Changes

- Rebuilt SafeVoice mock state around minimised case records, vault references, retention status, and technical metadata policy fields.
- Removed admin-facing reporter IP, user-agent, device fingerprint, browser fingerprint, and geolocation display.
- Replaced raw file names with generic evidence references and limited uploads to PDF, PNG, JPG, XML, and DOCX.
- Added evidence workflow states for malware scan and metadata stripping.
- Replaced automatic public-to-admin escalation with explicit access denial.
- Added role permission matrix with least-privilege controls.
- Removed low-volume dashboard analytics and department heatmaps.
- Added retention state, deletion schedule, 14-day irrelevant-data review, and legal hold.
- Added privacy notice summary, lawful basis summary, controller/processor responsibility copy, and external reporting reminder.
- Added an in-app Keep/Modify/Remove/Add review matrix under Compliance Settings.

## Feature Classification

| Area | Existing feature | Decision | Justification | Risk |
|---|---|---:|---|---|
| Public report intake | Category, incident date, department, narrative, evidence | Modify | Keep only facts needed for follow-up and add privacy notice, lawful basis, external reporting information, and anonymous defaults. | Broad free-text fields can reveal reporter identity. |
| Reporter identity fields | Legal name and corporate email | Remove | Anonymous reporting should not require direct identifiers. Optional contact must be vault-backed and voluntary. | Administrators could infer or disclose reporter identity. |
| Labour dispute handling | Forced named HR routing | Modify | Separate ordinary HR grievances from whistleblower reports and do not promise anonymous whistleblower tracking for out-of-scope grievances. | Legal confusion and confidentiality failures. |
| Tracking workflow | PIN-based status and two-way messaging | Keep | Supports acknowledgement, follow-up questions, and feedback without accounts or direct identifiers. | Tracking code must be high entropy and rate-limited. |
| File upload | File names retained, XLSX allowed | Modify | Use only allowed formats, strip metadata, scan malware, and hide original names from administrators. | Filenames and metadata can identify reporters. |
| Audit logs | Admin-facing IP address column | Modify | Reporter technical metadata must not be collected for handling or shown to case staff. | IP/user-agent can defeat anonymity. |
| Analytics | Trend charts and department heatmaps | Remove | Not necessary for case handling and dangerous for low-volume teams. | Small-cell analytics can reveal reporting patterns. |
| RBAC | Public users auto-upgraded to admin | Modify | Deny by default and require explicit authorized staff role. | Privilege confusion and unauthorized access. |
| Retention | Static copy only | Add | Add retention state, configurable deletion, 14-day irrelevant-data deletion timer, and legal hold. | Storage limitation violations. |
| Administrative security | Role simulator only | Add | Require MFA, session expiration, revocation, password policy, login monitoring, and lockout. | Back-office compromise exposes sensitive reports. |

## Production Controls Still Required

- Backend enforcement: server-side DTO validation, schema validation, rate limiting, CSRF protection, RBAC, tenant isolation, and audit generation. Frontend controls are advisory only.
- Anonymous channel protection: do not log reporter IP/user-agent for report handling. If security abuse controls require IP capture, store it separately with strict purpose limitation, short retention, restricted security-only access, and no case-handler visibility.
- File pipeline: signed upload URLs, MIME sniffing, extension allow-list, max size, antivirus scanning, metadata stripping, quarantine, encrypted object storage, and object-level access logging.
- Encryption: AES-256-GCM at rest, TLS 1.3 in transit, tenant-scoped KMS keys, rotation, no plaintext tokens, and no client-side claims that a tracking code is an encryption key.
- Data residency: keep production data, backups, logs, queues, and search indexes in the EEA.
- Retention automation: delete irrelevant personal data within 14 days of irrelevance determination, delete reports after the configured legal retention period unless legal hold applies, and destroy derived indexes/caches.
- Legal hold: require reason, approver, timestamp, periodic review, and audit trail.
- Access: OIDC, MFA, short idle timeout, absolute session lifetime, refresh token rotation, account lockout, session revocation, written authorization for handlers, and periodic access recertification.
- Logging: immutable audit log for critical staff actions, but avoid logging report narratives, message bodies, raw filenames, contact values, or reporter technical metadata.
- Data subject rights: implement access/export/rectification/erasure workflows with safeguards that do not reveal whistleblower identity or compromise investigations.
- Processor/controller governance: tenant-specific privacy notice, DPA, sub-processor list, EU hosting commitments, audit rights, breach notification terms, and deletion certificates.
- DPIA: required before production because anonymous reporting can involve sensitive allegations, criminal conduct, employment data, and high retaliation risk.
- External reporting information: provide clear links and instructions for reporting to the Polish Ombudsman or competent authority where applicable.
- Testing: add unit, integration, API contract, XML/file validation, security, penetration, accessibility, and retention-deletion tests.

## Production Acceptance Checklist

- No analytics, marketing pixels, session replay, browser fingerprinting, device fingerprinting, or geolocation in the reporting portal.
- Anonymous report can be submitted and tracked without account creation.
- Reporter identity, if voluntarily provided, is stored only in a restricted vault and never shown by default to investigators.
- Admin views do not expose reporter IP, user-agent, or original filenames.
- Report acknowledgement and feedback deadlines are visible and enforced.
- Legal hold blocks deletion only with documented approval.
- Closed cases enter a deletion schedule.
- File uploads are scanned, stripped, encrypted, and stored in EEA regions.
- Audit events are immutable and exportable but do not duplicate sensitive case bodies.
- RBAC denies access by default and enforces least privilege.
