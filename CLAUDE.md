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