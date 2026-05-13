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

## Commands

All backend commands run from within a module's `backend/` directory (e.g. `RegulaOne/backend/`).

```bash
# Build
./mvnw clean package

# Run (dev profile active by default)
./mvnw spring-boot:run

# Run with explicit profile
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod

# Run tests
./mvnw test

# Run a single test class
./mvnw test -Dtest=AuthControllerTest

# Run a single test method
./mvnw test -Dtest=AuthControllerTest#loginShouldReturnToken
```

---

## Architecture — RegulaOne Backend (Primary)

**Package root:** `com.regulaone.backend`

### Authentication Flow

Authentication is entirely delegated to **AWS Cognito**. There is no local password storage.

1. Users sign up via `/api/auth/signup` → Cognito creates the account
2. Email confirmation via `/api/auth/confirm` → Cognito activates the account
3. Login via `/api/auth/login` → Cognito returns a JWT, which is stored in an **HTTP-only `idToken` cookie** (SameSite=Strict)
4. The JWT is also accepted via `Authorization: Bearer` header for API clients
5. On each request, `CognitoJwtConverter` validates the JWT, then resolves the user's role from MongoDB (not from the JWT claims directly)

Admin-invited users receive a `NEW_PASSWORD_REQUIRED` Cognito challenge, handled by `/api/auth/respond-challenge`.

### Role Resolution

Roles (`ROLE_USER`, `ROLE_ADMIN`) are stored in both:
- **Cognito groups** (source of truth for auth)
- **MongoDB `users` collection** (for offline lookup and audit)

`CognitoJwtConverter` looks up the user by `cognitoSub` (falling back to email) and injects the role from MongoDB into the Spring Security context. This means role changes in MongoDB take effect on the next request without re-login.

### Layer Summary

| Layer | Package | Notes |
|---|---|---|
| Controllers | `controllers` | `AuthController`, `AdminController`, `HealthController` |
| Services | `services` | `CognitoService` (AWS SDK calls), `UserService` (MongoDB sync) |
| Repository | `repository` | `UserRepository` (MongoRepository) |
| Models | `models` | `User` (MongoDB `@Document`), `Role` (enum) |
| DTOs | `dto` | Request/response objects; never expose `User` directly |
| Security config | `configs` | `SecurityConfig`, `CognitoJwtConverter`, `CookieBearerTokenResolver` |
| Exception handling | `utils` | `GlobalExceptionHandler` — maps exceptions to HTTP codes |

### Configuration & Environment Variables

Profiles: `dev` (default) and `prod`. Active profile set in `application.properties`.

Required environment variables for production:

| Variable | Description |
|---|---|
| `COGNITO_REGION` | AWS region (default: `ap-southeast-2`) |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | App client ID |
| `COGNITO_CLIENT_SECRET` | App client secret (used for HMAC secret hash) |
| MongoDB URI | Set via `spring.data.mongodb.uri` in `application-prod.properties` |

Dev credentials are hardcoded in `application-dev.properties` — do not commit production credentials there.

### Security Rules (SecurityConfig)

```
/health/**          → permit all
/api/auth/**        → permit all
/api/admin/**       → ROLE_ADMIN only
/**                 → authenticated
```

CSRF is disabled; sessions are stateless.

---

## Adding a New Module Backend

Skeleton backends (KSeFFlow, SafeVoice, WasteSync) contain only a `BackendApplication.java`. When implementing:

1. Follow the same package structure as `com.regulaone.backend` — controllers → services → repository → models/dto
2. Reuse the same pom.xml dependency set; add domain-specific dependencies as needed
3. Authentication is handled by RegulaOne's gateway — module backends do not reimplement auth
4. All data is EEA-compliant: deploy only to AWS Frankfurt, AWS Ireland, or Azure Europe regions
