# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RegulaOne** is a monorepo compliance platform for Polish businesses. It contains 7 modules, each with a `backend/` and `frontend/` directory:

| Module | Purpose | Backend Status |
|---|---|---|
| `RegulaOne` | Auth gateway + user management | Fully implemented |
| `KSeFFlow` | E-invoicing (Polish KSeF mandate) | Skeleton |
| `SafeVoice` | Whistleblower reporting (AES-256 encrypted) | Skeleton |
| `WasteSync` | BDO waste reporting | Skeleton |
| `PrivacyPilot` | GDPR/RODO compliance | Empty |
| `SafeWork` | HR / BHP workplace safety | Empty |
| `WorkPulse` | Time tracking / attendance | Empty |

Each backend is a Spring Boot 4.0.6 / Java 17 / Maven project. Frontends are not yet scaffolded.

---

## IMPORTANT DEVELOPMENT RULES

### Code Modification Rules

1. **NEVER remove existing code directly**
   - If code is incorrect, outdated, or replaced, COMMENT IT OUT instead of deleting it
   - Preserve old implementation for reference and debugging history

2. **Always explain newly added code**
   - Every new logic block, class, method, or configuration MUST include comments explaining:
     - Why it was added
     - What problem it solves
     - Important implementation details if needed

3. **When replacing logic**
   - Keep old code commented
   - Add the new implementation below it
   - Clearly mention why the old implementation was replaced

Example:

```java
// OLD IMPLEMENTATION - Commented out because JWT parsing
// is now handled directly by Spring Security OAuth2 Resource Server
// and CognitoJwtConverter.
//
// String token = Jwts.parser()
//      .setSigningKey(secret)
//      .parseClaimsJws(jwt)
//      .getBody();


// NEW IMPLEMENTATION
// Added to use AWS Cognito JWT validation via Spring Security.
// This ensures automatic signature validation using Cognito JWKS.
Authentication authentication = SecurityContextHolder.getContext().getAuthentication();




# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and all AI coding agents when working on the RegulaOne platform.

---

# Project Overview

## Platform Name
# RegulaOne

RegulaOne is a multi-module SaaS compliance platform for Polish businesses.

The platform combines multiple legally required compliance systems into one unified application.

All modules share:
- Authentication
- Organization management
- Role-based access control
- Audit logging
- Notification system
- File storage
- Compliance infrastructure
- Encryption standards
- Reporting engine

---

# Core Philosophy

This is a:
- Compliance-first platform
- Security-first platform
- Enterprise SaaS architecture
- Multi-tenant application
- Modular monorepo system

The system must prioritize:
1. Legal compliance
2. Data integrity
3. Auditability
4. Security
5. Reliability
6. Scalability
7. Maintainability

---

# IMPORTANT AI AGENT RULES

## NEVER
- Never delete existing code directly
- Never rewrite large sections unnecessarily
- Never remove APIs without comment
- Never break backward compatibility without explanation
- Never hardcode secrets
- Never store sensitive data unencrypted
- Never bypass validation
- Never bypass audit logging
- Never ignore compliance requirements
- Never use mock implementations in production code
- Never create duplicate business logic
- Never directly access database from controllers
- Never place business logic inside controllers
- Never skip error handling
- Never use insecure encryption methods
- Never use non-EU hosting references
- Never expose internal stack traces to users

---

## ALWAYS
- Always comment why new code is added
- Always comment deprecated or replaced code
- Always use clean architecture
- Always follow modular design
- Always use DTO validation
- Always use centralized exception handling
- Always use audit logs
- Always write scalable code
- Always consider GDPR/RODO compliance
- Always use encryption for sensitive data
- Always write production-ready code
- Always think about multi-tenancy
- Always use environment variables
- Always write reusable services
- Always separate infrastructure/business/domain layers
- Always create meaningful logs
- Always add retry handling for external APIs
- Always add proper API documentation
- Always implement rate limiting for public APIs
- Always write defensive code

---

# Architecture

## Application Type
Multi-tenant SaaS platform.

## Primary Regions
- Poland
- European Union (EEA only)

## Hosting Rules
ALL infrastructure MUST remain inside EEA regions.

Allowed:
- AWS Frankfurt
- AWS Ireland
- Azure Europe
- EU Datacenters

Not Allowed:
- US-only hosting
- Non-EU storage providers

---

# Tech Stack

## Backend
- Java Spring Boot
- Spring Security
- JWT / OAuth2 / Cognito
- MongoDB
- PostgreSQL
- Redis
- RabbitMQ / Kafka
- Docker
- Kubernetes

## Frontend
- React / Next.js
- TailwindCSS
- TypeScript

## Mobile
- Flutter

## Cloud
- AWS EU Regions only

## Storage
- S3-compatible encrypted storage

---

# Multi-Tenant Architecture

Every organization/company must be isolated.

All tables/documents must support:
- tenant_id
- audit metadata
- timestamps

Tenant isolation is mandatory.

---

# Shared Platform Modules

## Shared Authentication
Supports:
- Company Admin
- HR Manager
- Employee
- Accountant
- Auditor
- Compliance Officer

Features:
- Login
- Signup
- MFA
- RBAC
- Session management
- Audit logs

---

# Shared Security Rules

## Encryption
Use:
- AES-256 encryption at rest
- TLS 1.3 in transit

## Sensitive Data
Must always be encrypted:
- Certificates
- Personal data
- Medical documents
- Whistleblower reports
- GDPR records
- Tokens
- Secrets

---

# Audit Logging

Every important action MUST generate audit logs.

Example:
- User login
- Invoice submission
- Document upload
- Status change
- Data export
- Record modification

Audit logs must contain:
- user_id
- tenant_id
- action
- timestamp
- old_value
- new_value
- ip_address

Audit logs are immutable.

---

# Shared File Storage Rules

Supported files:
- PDF
- DOCX
- XML
- Images
- CSV

All uploads must:
- be virus scanned
- be encrypted
- support audit logs
- support retention policies

---

# Notification System

Support:
- Email
- Push notifications
- In-app notifications

Use queues for async processing.

---

# Background Jobs

Use scheduled jobs/cron workers for:
- Expiry alerts
- Retry queues
- Report generation
- Cleanup
- Compliance checks
- Offline sync

---

# Application Modules

# 1. KSeFFlow — E-Invoice System

## Purpose
Polish government e-invoice integration.

Mandatory from April 2026.

## Core Requirements
- FA(3) XML generation
- KSeF API integration
- Digital certificate authentication
- UPO storage
- Offline queue support
- QR code generation

## Features
- Create invoice
- Send invoice
- Receive KSeF-ID
- Store UPO
- Retry failed invoices
- Sandbox/Production support

## Compliance
Mandatory:
- 10-year invoice retention
- Certificate encryption
- FA(3) XML compliance

## Important Rules
- XML schema must follow official FA(3)
- Never allow custom invoice schema
- Always validate before submission
- Offline mode is legally required

---

# 2. WorkPulse — Time Tracking System

## Purpose
Employee attendance and work tracking.

## Features
- Clock in
- Clock out
- Break tracking
- GPS tracking
- Overtime calculation
- Monthly reports
- Push notifications

## Compliance
Polish Labour Code.

## Important Rules
- Attendance records are immutable
- Overtime must be auto-calculated
- Break tracking is mandatory
- Reports exportable to PDF/CSV

## Integrations
Connected with:
- SafeWork module

If employee compliance expires:
- block clock-in

---

# 3. SafeWork — HR Compliance System

## Purpose
Employee compliance and safety tracking.

## Features
- Employee compliance dashboard
- Medical certificate tracking
- BHP training tracking
- Expiry alerts
- Document uploads
- Work-blocking system

## Background Jobs
Daily midnight cron:
- check expiry dates
- send notifications

## Compliance
- BHP regulations
- Labour safety law
- GDPR

## Important Rules
Expired compliance:
- must block employee shifts

Medical documents:
- encrypted storage mandatory

---

# 4. SafeVoice — Whistleblower System

## Purpose
Anonymous reporting platform.

## Features
- Anonymous reports
- End-to-end encryption
- Tracking PIN
- Status tracking
- Admin dashboard

## Encryption
Use:
- AES-256-GCM

## Special Legal Rule
If category == labour_dispute:
- notify HR
- DO NOT encrypt
- DO NOT generate PIN

## Important Rules
Admins must NOT read encrypted reports directly.

---

# 5. WasteSync — BDO Waste Reporting

## Purpose
Environmental waste reporting system.

## Features
- Monthly waste entry
- Annual totals
- XML generation
- PDF reports
- Historical logs
- Audit exports

## Required Data
- BDO Number
- Waste totals
- Reporting year
- Company identity

## Compliance
- BDO regulations
- GDPR
- 10-year retention

## XML Rules
Generated XML must follow government reporting structure.

---

# 6. PrivacyPilot — GDPR / RODO System

## Purpose
GDPR compliance automation platform.

## Features
- Processing activity wizard
- GDPR register generation
- Privacy policy generation
- DPIA detection
- PDF/DOCX exports

## Compliance
- GDPR / RODO
- EEA hosting mandatory
- AES-256 encryption mandatory

## Roles
- Admin
- Compliance Officer
- Auditor

## Important Rules
All changes must generate audit logs.

---

# Coding Standards

## Backend Rules
- Use layered architecture
- Controllers must stay thin
- Services contain business logic
- Repositories contain persistence logic
- DTOs for API communication
- Never expose entities directly

## API Standards
- RESTful APIs
- Versioned APIs
- OpenAPI/Swagger docs
- Consistent response structure

## Exception Handling
Use centralized exception handling.

Never return raw exceptions.

---

# Database Standards

## Required Common Fields

Every entity should contain:
- id
- tenant_id
- created_at
- updated_at
- created_by
- updated_by
- audit metadata

---

# Queue & Retry Standards

Use queues for:
- Notifications
- KSeF retries
- Report generation
- Background processing

Retry strategy:
- exponential backoff

---

# Offline Support Rules

Critical modules must support offline fallback:
- KSeFFlow
- WorkPulse mobile

Offline data must:
- sync safely
- avoid duplication
- maintain audit history

---

# AI Agent Development Rules

## Before Writing Code
AI agent must:
1. Understand module boundaries
2. Check compliance impact
3. Check tenant impact
4. Check security implications
5. Check audit logging requirements

---

## When Modifying Code
ALWAYS:
- Comment old logic instead of deleting immediately
- Add explanation comments for new code
- Preserve backward compatibility when possible

Example:
```java
// OLD IMPLEMENTATION - kept for backward compatibility
