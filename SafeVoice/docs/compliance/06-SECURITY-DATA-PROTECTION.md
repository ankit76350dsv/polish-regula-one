# Security & Data Protection

SafeVoice's frontend **represents** these controls; the binding guarantees must be enforced
**server-side**. This file is the contract the backend must meet, aligned with GDPR Art. 32,
Directive (EU) 2019/1937 Arts. 16–18, and RegulaOne CLAUDE.md.

## Non-negotiable for a whistleblower channel

### No reporter telemetry
For report handling, **do not collect** reporter IP address, user-agent, device fingerprint,
browser fingerprint, or geolocation. If IP is needed transiently for abuse/rate-limiting,
store it **separately**, with strict purpose limitation, short retention, security-team-only
access, and **never** visible to case handlers. (Modelled by `TechnicalMetadataPolicy`.)

### No third-party AI / no non-EEA transfer
- **Removed**: the Google Gemini SDK (`@google/genai`), `GEMINI_API_KEY`/`APP_URL` plumbing,
  and the `SERVER_SIDE_GEMINI_API` capability flag. Report content (sensitive allegations)
  must never be sent to an external AI service or any host outside the EEA. (GDPR Chapter V;
  CLAUDE.md §3.)
- Keep all production data, backups, logs, queues, and search indexes **inside the EEA**
  (AWS Frankfurt/Ireland or Azure EU).

## Encryption (GDPR Art. 32)
- **At rest:** AES-256-GCM; tenant-scoped KMS keys; automatic rotation.
- **In transit:** TLS 1.3 only; HSTS; secure cookies.
- No plaintext passwords or tokens; no MD5/SHA-1; a tracking code is **not** an encryption key.

## File / evidence pipeline
Allow only PDF, PNG, JPG, XML, DOCX. For each upload: MIME sniffing + extension allow-list,
size limit, **antivirus scan**, **metadata stripping**, quarantine on suspicion, signed
upload URLs, encrypted object storage, and object-level access logging. **Original filenames
are never shown to administrators** (replaced by vault references).

## Access control & sessions
- OIDC + **MFA** for all staff; no bypass role.
- Short idle timeout (15 min) and absolute session lifetime; refresh-token rotation;
  immediate session revocation on role change/departure/compromise; progressive lockout.
- **Least privilege RBAC** (see `rolePermissions`); deny by default; explicit authorization.
- Tenant isolation: every query filtered by tenant; cross-tenant access forbidden.

## Audit logging
- Immutable (**WORM**) audit log for critical staff actions: actor, action, subject,
  timestamp, old/new value, outcome.
- **Never** log report narratives, message bodies, raw filenames, contact values, or reporter
  technical metadata. (The UI hash-chain is a demo only.)

## API security
Server-side DTO/schema validation, rate limiting on public intake/tracking endpoints (without
fingerprinting), CSRF/XSS protections, input sanitisation, WAF. Never trust frontend validation.

## Before production
DPIA completed; pen test passed; backups tested; EEA residency verified; retention/deletion
jobs verified; DPA + sub-processor list in place.

---

_Last reviewed: 2026-06-18._
