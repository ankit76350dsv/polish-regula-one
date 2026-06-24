# AGENTS.md

# RegulaOne SuperApp
Enterprise Compliance SaaS Platform for Poland & EU

Author: DSV Corporation Pty Ltd
Platform: RegulaOne 
Primary Region: Poland / European Union
Compliance Target:
- KSeF (National e-Invoice System)
- GDPR / RODO
- Polish Labour Code
- BHP Safety Regulations
- Polish Whistleblower Protection Act
- BDO Environmental Reporting
- EU Cybersecurity Standards
- OWASP ASVS Level 2+
- ISO 27001 Alignment
- SOC2 Ready Architecture

---

# 1. GLOBAL ENGINEERING RULES

## Core Principles

The application MUST be designed as:
- enterprise-grade
- audit-ready
- government-compliant
- zero-trust secure
- GDPR compliant
- scalable multi-tenant SaaS
- legally defensible during government audits

Every feature MUST prioritize:
1. Security
2. Compliance
3. Auditability
4. Data integrity
5. Legal traceability

---

# 2. MANDATORY SECURITY STANDARDS

## Encryption

ALL sensitive data MUST use:

### At Rest
- AES-256-GCM encryption
- Database-level encryption
- S3 bucket encryption
- Encrypted backups
- Encrypted certificates
- Encrypted uploaded documents

### In Transit
- TLS 1.3 only
- HSTS enabled
- Secure cookies
- Perfect Forward Secrecy

### Key Management
- AWS KMS or HashiCorp Vault
- Automatic key rotation
- Separate encryption keys per tenant
- Never hardcode secrets

---

# 3. DATA HOSTING RULES

## EEA Hosting Requirement

ALL production data MUST remain inside the EEA.

Allowed:
- AWS Frankfurt
- AWS Ireland
- Azure EU Regions

Forbidden:
- US-only hosting
- Non-EU storage
- Cross-border transfer without SCCs

Infrastructure MUST support:
- GDPR
- RODO
- Data residency
- Data processing agreements

---

# 4. AUTHENTICATION & ACCESS CONTROL

## Authentication

MANDATORY:
- OAuth2/OIDC
- MFA/TOTP support
- Session expiration
- Device tracking
- Refresh token rotation

## RBAC (Role-Based Access Control)

Minimum roles:
- Super Admin
- Company Admin
- HR Manager
- Accountant
- Compliance Officer
- Auditor
- Employee
- Whistleblower Reviewer

Rules:
- Least privilege principle
- Tenant isolation mandatory
- Cross-company access forbidden

---

# 5. AUDIT LOGGING REQUIREMENTS

EVERY critical action MUST generate immutable audit logs.

Audit log fields:
- user_id
- tenant_id
- IP address
- user agent
- timestamp
- old value
- new value
- action type

Audit logs MUST:
- be tamper resistant
- be exportable
- retain minimum 10 years
- support forensic investigation

---

# 6. API SECURITY

MANDATORY:
- Rate limiting
- CSRF protection
- XSS protection
- SQL injection prevention
- Request validation
- JWT validation
- Input sanitization
- API schema validation
- WAF protection

Framework rules:
- Never trust frontend validation
- Validate ALL payloads server-side
- Use DTO validation
- Reject malformed XML
- Reject oversized uploads

---

# 7. FILE STORAGE SECURITY

Allowed uploads:
- PDF
- PNG
- JPG
- XML
- DOCX

All uploads MUST:
- undergo antivirus scanning
- use signed URLs
- have MIME validation
- use size limits
- have malware detection
- be encrypted

Forbidden:
- executable files
- scripts
- ZIP bombs

---

# 8. BACKUP & DISASTER RECOVERY

MANDATORY:
- Daily encrypted backups
- Point-in-time recovery
- Multi-region replication
- Disaster recovery testing
- Automated restore validation

Retention:
- minimum 10 years for legal records

---

# 9. MULTI-TENANCY REQUIREMENTS

Platform MUST support:
- isolated tenants
- isolated encryption keys
- isolated audit logs
- isolated file storage

Cross-tenant access MUST NEVER happen.

All queries MUST filter by:
- tenant_id
- company_id

---

# 10. APPLICATION MODULES

---

# MODULE 1 — KSeFFlow (KSeF E-Invoice System)

## Compliance Requirements

MANDATORY:
- FA(3) XML schema support
- KSeF API integration
- Digital certificate authentication
- XML validation
- UPO storage
- Offline fallback mode

## Legal Requirements

Invoices MUST:
- follow official FA(3) schema
- receive KSeF-ID
- store UPO for 10 years
- support audit export

## Security Requirements

Certificates MUST:
- use AES-256 encryption
- never store plaintext passwords
- use secure vault storage

## Offline Mode

If KSeF unavailable:
1. Generate PDF
2. Add QR verification
3. Queue XML
4. Retry with exponential backoff

## XML Rules

Backend MUST:
- validate schema before submission
- reject invalid VAT values
- reject malformed XML
- support sandbox + production environments

## Backend Requirements

Required services:
- InvoiceService
- XMLGeneratorService
- KSeFIntegrationService
- CertificateService
- UPOStorageService
- RetryQueueService

---

# MODULE 2 — WorkPulse (Time Tracking)

## Labour Law Requirements

MUST track:
- clock-in
- clock-out
- break time
- overtime
- absences

## Mobile Security

MANDATORY:
- device authentication
- GPS validation
- anti-spoofing checks
- push notifications

## Overtime Rules

Automatically flag:
- shifts > legal thresholds
- missed breaks
- abnormal working patterns

## Cron Jobs

Required:
- daily attendance reconciliation
- overtime calculations
- shift anomaly detection

## Reports

Generate:
- PDF
- CSV
- payroll exports

---

# MODULE 3 — SafeWork (HR Compliance)

## Required Features

Track:
- medical certificates
- BHP training
- expiry dates
- uploaded documents

## Automatic Enforcement

Employees MUST NOT:
- clock-in with expired certificates
- bypass compliance checks

## Scheduled Jobs

Daily cron MUST:
- detect expiring documents
- send 30-day alerts
- send 7-day alerts

## Storage Rules

Documents MUST:
- remain encrypted
- have access logging
- support audit retrieval

---

# MODULE 4 — SafeVoice (Whistleblower)

## Legal Requirements

MUST support:
- anonymous reporting
- anti-retaliation compliance
- encrypted storage
- secure communication

## Encryption

Reports MUST use:
- AES-256-GCM
- encrypted attachments
- secure PIN tracking

## Special Labour Dispute Rule

IF category = labour_dispute:
- notify HR
- DO NOT encrypt
- DO NOT generate PIN

## Security Rules

Admins MUST NOT:
- identify anonymous users
- access metadata revealing identity

---

# MODULE 5 — WasteSync (BDO Waste Reporting)

## Compliance Requirements

MUST support:
- annual reporting
- XML export
- PDF export
- historical logs

## Data Retention

Minimum:
- 10 years

## XML Rules

Reports MUST include:
- BDO number
- reporting year
- company identity
- waste totals

## Validation

Reject:
- negative weights
- malformed reports
- missing BDO number

---

# MODULE 6 — PrivacyPilot (GDPR/RODO)

## Compliance Requirements

MUST support:
- ROPA generation
- DPIA detection
- privacy policy generation
- audit exports

## GDPR Rules

Sensitive data MUST:
- remain encrypted
- remain in EEA
- support right-to-erasure
- support export requests

## DPIA Detection

Automatically flag:
- health data
- biometric data
- large-scale monitoring
- sensitive processing

## Audit Requirements

Track:
- who changed records
- timestamps
- old/new values

---

# 11. FRONTEND REQUIREMENTS

Frontend MUST:
- use CSP headers
- sanitize HTML
- prevent XSS
- support accessibility
- support i18n
- support Polish language

MANDATORY:
- dark mode
- responsive UI
- WCAG 2.1 compliance

---

# 12. BACKEND REQUIREMENTS

Preferred stack:
- Spring Boot (recommended)
- PostgreSQL
- Redis
- Kafka/SQS
- Docker
- Kubernetes

Architecture:
- modular monolith OR microservices
- event-driven integrations
- queue-based retry systems

---

# 13. DATABASE RULES

MANDATORY:
- UUID primary keys
- soft delete support
- created_at
- updated_at
- deleted_at
- audit columns

Sensitive columns MUST be encrypted.

---

# 14. DEVSECOPS REQUIREMENTS

CI/CD MUST include:
- SAST scanning
- dependency scanning
- secret scanning
- container scanning
- IaC scanning

Mandatory tools:
- SonarQube
- Trivy
- OWASP Dependency Check

---

# 15. OBSERVABILITY

MANDATORY:
- centralized logging
- metrics
- distributed tracing
- uptime monitoring
- alerting

Use:
- Prometheus
- Grafana
- OpenTelemetry

---

# 16. LEGAL RETENTION POLICY

| Data Type | Retention |
|---|---|
| Invoices | 10 years |
| Audit Logs | 10 years |
| Attendance Records | 10 years |
| BDO Reports | 10 years |
| GDPR Records | 10 years |
| Whistleblower Reports | Based on legal policy |

---

# 17. PROHIBITED PRACTICES

NEVER:
- store plaintext passwords
- store unencrypted certificates
- expose tenant data
- log sensitive PII
- bypass audit logging
- disable encryption
- trust frontend validation
- use hardcoded secrets

---

# 18. TESTING REQUIREMENTS

MANDATORY:
- unit testing
- integration testing
- penetration testing
- security testing
- XML validation testing
- API contract testing
- load testing

Minimum coverage:
- 80% backend coverage

---

# 19. COMPLIANCE CHECKLIST

Before release ensure:
- GDPR compliant
- KSeF schema validated
- OWASP checks passed
- Penetration test completed
- Audit logging verified
- Data residency verified
- Backups tested
- Encryption validated
- Retention policies active

---

# 20. AI DEVELOPMENT RULES

When generating code:
- ALWAYS prioritize security
- ALWAYS include validation
- ALWAYS include audit logging
- ALWAYS include error handling
- ALWAYS include tenant isolation
- ALWAYS include DTO validation
- ALWAYS include encryption where required
- NEVER generate insecure examples

Generated code MUST:
- be production ready
- follow SOLID principles
- support scaling
- support compliance audits

---

# 21. FUTURE CERTIFICATIONS TARGET

Architecture should remain compatible with:
- ISO 27001
- SOC2
- NIS2
- DORA
- GDPR
- EU AI Act







# ADDITIONAL ENTERPRISE RULES FOR REGULAONE

---

# 22. AI CODING AGENT GOVERNANCE

This repository may be modified by:
- Codex
- Cursor AI
- OpenAI Codex
- GitHub Copilot
- Internal AI agents

All AI coding agents MUST follow the rules below.

---

## AI AGENT SAFETY RULES

### NEVER
- Never delete code immediately
- Never overwrite business-critical logic blindly
- Never bypass compliance requirements
- Never expose secrets
- Never hardcode credentials
- Never expose stack traces
- Never disable encryption
- Never disable audit logging
- Never access databases directly from controllers
- Never create circular dependencies
- Never duplicate business logic
- Never skip validation
- Never skip authorization checks
- Never trust frontend inputs
- Never use deprecated cryptography
- Never use MD5/SHA1
- Never create insecure JWT handling
- Never store tokens in plaintext
- Never store certificates unencrypted
- Never commit `.env` files
- Never disable rate limiting on public endpoints
- Never generate fake compliance logic
- Never create mock production implementations

---

## ALWAYS
- Always write production-ready code
- Always add explanatory comments
- Always validate DTOs
- Always add retry handling
- Always use centralized exception handling
- Always use immutable audit logs
- Always use environment variables
- Always implement tenant isolation
- Always sanitize inputs
- Always implement logging
- Always implement authorization
- Always think about GDPR
- Always think about auditability
- Always write scalable code
- Always use queues for async jobs
- Always use transactions where needed
- Always preserve backward compatibility
- Always implement API versioning
- Always consider legal impact

---

# 23. CLEAN ARCHITECTURE STANDARDS

Backend architecture MUST follow:

```text
Controller Layer
↓
Service Layer
↓
Domain Layer
↓
Repository Layer
↓
Database
```

---

# 24. REDUX TOOLKIT DEVELOPMENT INSTRUCTIONS

Throughout this entire project, use Redux Toolkit for state management and API integration.

## State Management Rules

- Use Redux Toolkit (RTK) as the standard state management solution.
- Create a dedicated Redux store.
- Organize state into feature-based slices.
- For every API integration, create or update the appropriate Redux slice to manage:
  - Loading state
  - Success state
  - Error state
  - Response data
- Components MUST access and update shared/API state through Redux slices.
- Components MUST NOT manage API response data in local component state unless it is purely local UI state.

## API Integration Rules

- All API calls MUST be integrated through Redux Toolkit.
- Create separate service/API files for network requests.
- Dispatch Redux actions from components.
- Update the store through reducers and async thunk lifecycle handlers.
- Ensure proper error handling, loading indicators, and state updates for all API requests.

## Project Structure

- `store/` -> Redux store configuration
- `slices/` -> Feature-based Redux slices
- `services/` -> API service functions
- `components/` -> UI components
- `pages/` -> Page-level components

## Mandatory Instruction for All AI Agents

If any AI coding agent, including Claude, Codex, Antigravity, Cursor AI, GitHub Copilot, or any other coding assistant, works on this project, it MUST follow these rules:

- Always use Redux Toolkit for state management.
- Always create or update Redux slices when integrating APIs.
- Always connect API responses through Redux state.
- Never bypass Redux by storing API data directly in component state unless it is purely local UI state.
- Reuse existing slices and store configuration whenever possible.
- Follow the established Redux architecture consistently across the entire codebase.

These instructions are mandatory and MUST be followed for all future development tasks in this project.

---

# END OF AGENTS.md
