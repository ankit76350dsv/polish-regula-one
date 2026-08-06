# RegulaOne backend — production deployment checklist

**Reviewed:** 2026-08-06, against `RegulaOne/backend` on `main` and
`.github/workflows/regulaone-backend.yml`.

Everything in §1 and §2 was verified by reading this repository. Everything in §4 is
infrastructure I cannot see from here and you need to confirm yourself.

**Summary: the pipeline as written cannot deploy this project.** It builds a directory
that does not exist, there is no Dockerfile, and four required environment variables are
not passed. Work through §1 first.

---

## 1. Blockers — the deployment will fail without these

### 1.1 The workflow builds the wrong directory

`.github/workflows/regulaone-backend.yml` uses `working-directory: auth-service-spring`
in both the build and the Docker step. **That directory does not exist in this repository.**
The backend is at `RegulaOne/backend`.

### 1.2 There is no Dockerfile

`docker build -t …/regulaone-backend:latest .` has nothing to build. No `Dockerfile`
exists anywhere in the repository. One has to be added — a two-stage build (Maven →
JRE 17) next to the backend, matching `<java.version>17</java.version>` in `pom.xml`.
Note the workflow installs Java **21** while the project targets **17**; building on 21
is fine, but the runtime image must not be older than 17.

### 1.3 `SPRING_PROFILES_ACTIVE` is never set

This is the one that will bite hardest. `application.properties` (baked into the image)
says `spring.profiles.active=dev`. The container therefore starts on the **dev** profile —
whose properties file is git-ignored and **not in the image** — so the database URI, the
Cognito settings and the sender address are all absent and start-up fails.

```
-e SPRING_PROFILES_ACTIVE=prod
```

### 1.4 Three more required variables are missing

`application-prod.properties` deliberately has **no fallbacks**, so a missing value stops
the deployment rather than silently running on a development default. The workflow does
not pass:

| Variable | Used for |
|---|---|
| `COGNITO_REGION` | `aws.cognito.region` |
| `NOTIFICATION_FROM_EMAIL` | `app.notifications.from` (required — no default anywhere) |
| `NOTIFICATION_INTERNAL_TOKEN` | `notification.internal.service-token` |

It **does** correctly pass `MONGODB_URI`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
and `COGNITO_CLIENT_SECRET`.

### 1.5 Variables passed that nothing reads

`COGNITO_DOMAIN`, `COGNITO_ISSUER`, `ALLOWED_ORIGINS` and `LOG_LEVEL` are injected but no
code or property binds them. `ALLOWED_ORIGINS` is the misleading one: CORS comes from
`cors.allowed-origins`, which `application-prod.properties` sets literally — so changing
that GitHub secret does nothing. Either delete the four lines or wire them up.

### 1.6 The workflow only triggers on `regulaone/backend/prod`

You are on `main`. Nothing deploys until that branch exists and receives the commit.

### 1.7 Tests are skipped

`mvn clean package -DskipTests` skips the whole suite, including `ApiSurfaceTest`, which
is what guards the 67-endpoint contract against accidental change. Use `./mvnw` (the
wrapper, so the build uses the pinned Maven version) and let the tests run. The four `*IT`
tests need a live database and stay skipped by default, so the suite is safe in CI.

---

## 2. Security

> **§2.1–2.4 were fixed on 2026-08-06.** They are kept here with their original
> description so the reasoning survives, each marked with what was done. §2.5 and §2.6
> are still open and need you.

### 2.1 `PUT /api/admin/users/{subId}` can edit users in other companies — **FIXED**

`UserAdminService.updateUser` is the only user-write method with **no tenant check**, and
it calls `Role.valueOf(request.getRole())` with **no whitelist**. A company administrator
who knows a Cognito subject id can therefore change a user in a different organisation,
and can set `ROLE_SUPER_ADMIN`.

The newer `PATCH /api/admin/users/{userId}/role` does this correctly (same-organisation,
not-yourself, not-the-owner, not-the-last-admin, and only ROLE_ADMIN/ROLE_USER). The old
endpoint should get the same guards, or be removed if the frontend no longer calls it —
**it currently does not**.

**Done:** the endpoint now resolves the acting administrator and enforces the same
organisation, and a role change through it goes through the shared whitelist and rules.
A second door was found and closed at the same time: `POST /api/admin/users/invite`
accepted `"role": "SUPER_ADMIN"` and created a platform operator inside the caller's own
company. Both now use one whitelist, covered by `RoleEscalationTest`.

### 2.2 The API documentation is public — **FIXED**

`SecurityConfig` permits `/swagger-ui/**` and `/v3/api-docs/**` for everyone. In
production that publishes your complete API surface — every endpoint, parameter and
schema — to anyone who asks. Either disable springdoc on the prod profile
(`springdoc.api-docs.enabled=false`, `springdoc.swagger-ui.enabled=false`) or restrict
those paths to an internal network.

**Done:** `springdoc.api-docs.enabled=false` and `springdoc.swagger-ui.enabled=false` on
the prod profile, so the paths do not exist in production. The SecurityConfig rule is kept
for local development and now says so.

### 2.3 No rate limiting anywhere — **FIXED**

Nothing in the project limits request rates, though `CLAUDE.md` §6 requires it. The
unauthenticated endpoints — `POST /api/sso/login`, `POST /api/auth/forgot-password`,
`POST /api/auth/signup` — can be hammered. Cognito applies its own throttling, which is a
backstop, not a control you own. Add a filter or do it at the load balancer / WAF.

**Done:** `RateLimitFilter` caps the unauthenticated sign-in, sign-up and password
endpoints at 10 POSTs per minute per caller per endpoint in production (50 in development),
answering 429 with Retry-After before the request reaches Cognito. It is an in-memory,
per-instance limit — add a load-balancer or WAF limit too. Seven tests cover it.

### 2.4 Personal data in the logs — **FIXED**

`CognitoJwtConverter` logs at INFO **on every single request**: the subject id, the
resolved authority and the whole `JwtAuthenticationToken`, whose principal is the user's
e-mail address. `CLAUDE.md` §17 forbids logging PII. Move those lines to `debug` before
production logs start being retained.

**Done:** the per-request INFO lines are gone. The converter now logs the Cognito subject
at debug — pseudonymous, and never the e-mail or the token.

### 2.5 The internal endpoints must not be reachable from the internet

`/api/internal/**` and `/api/email/send` are `permitAll` in Spring Security and protected
only by the shared `X-Service-Token`. The workflow publishes the container with
`-p 8080:8080`. Restrict those paths at the proxy, or bind the port to the private
interface and let only the load balancer reach 8080.

### 2.6 Rotate the credentials that were committed

An older AWS key pair, an older Cognito client secret and an older MongoDB URI (with
password) are in git history from a June 2026 commit. Deleting a file does not remove it
from history. Confirm all three are revoked. The values in use today are different and are
not in history.

---

## 3. Configuration that must be right on the day

| Item | Why it matters |
|---|---|
| **HTTPS is mandatory** | `application-prod.properties` sets `sso.cookie.secure=true`. Over plain HTTP the browser silently discards the session cookie, and every login appears to succeed and then fails. Terminate TLS at an ALB or nginx in front of the container. |
| **Cookie domain** | `.regulaone.eu` — every app (hub and modules) must be served from that domain, or the shared session does not work. |
| **`X-Forwarded-For`** | `AuditLogService` takes the client IP from this header, first entry. If the proxy does not set it, every audit entry records the load balancer's address instead of the user's. |
| **EC2 instance role** | `application-prod.properties` leaves `aws.access-key-id` blank on purpose, so the SDK falls back to the instance role. That role needs the 13 `cognito-idp:*` actions used by `CognitoService`, scoped to the user pool, plus `ses:SendEmail`. Without it, sign-in and e-mail fail at runtime, not at start-up. |
| **Default plan id** | `regulaone.default-package-id` defaults to `6a0466e9361d1caa88cba7ed`. That package **must exist and be ACTIVE in the production database**, or organisation setup fails for every new customer. Set the property if the production id differs. |
| **SES** | The production account must be out of the SES sandbox, and `NOTIFICATION_FROM_EMAIL` must be a verified sender. Your own note in the dev config says to verify `komplyy.pl` and switch from `komplyy.de` — that is still open. |
| **SES region is hardcoded** | `AwsSesConfig` pins `EU_CENTRAL_1` in code, unlike Cognito's configurable region. Moving SES is a code change. |
| **MongoDB Atlas** | Allow the EC2 address in the Atlas network access list, and confirm the cluster is in an **EU region** — the platform's data-residency promise depends on it (GDPR/RODO). |

---

## 4. Infrastructure I cannot verify from the repository

- **Backups** — Atlas continuous backup / point-in-time recovery enabled, and a restore
  actually tested at least once.
- **Retention** — `CLAUDE.md` §16 requires 10 years for audit logs and invoices. Nothing
  in the code deletes them, which is correct, but nothing enforces the retention either.
- **Monitoring and alerting** — there is no Actuator dependency, so there is no
  `/actuator/health` for a load balancer. `GET /health` exists and returns status plus the
  active profile; use that as the health check. (`/health/db` is dev-profile-only and
  returns 403 in production — as intended.)
- **Log shipping** — application logs currently go to stdout in the container. Decide where
  they are collected and how long they are kept, especially given §2.4.
- **A staging environment** — there is no `application-staging.properties`. The ignore rule
  already covers one if you add it.

---

## 5. Customer-visible features that do not work yet

Not a deployment blocker, but these will be visible to paying customers on day one:

- **My Plan → "Renew" and "Upgrade to …"** (`AdminPlan.jsx`) only show a success toast.
  No request is made and nothing changes. "Upgrade request submitted. Our team will
  contact you." is not true — nobody is told.
- **`getTeamManagementStats`** calls `Integer.parseInt` on the free-text seat capacity, so
  a plan whose capacity reads e.g. "Unlimited" returns a 500 on the Team page. Sibling
  code (`PlatformService.seatLimitOf`, `CompanyOverviewService.parseCapacity`) parses it
  defensively; this one does not.

---

## 6. Suggested order

1. §1 — make the pipeline able to run at all (path, Dockerfile, profile, four variables).
2. §2.1 — close the cross-tenant user-edit hole.
3. §2.2–2.5 — docs, rate limiting, logging, network exposure.
4. §3 — HTTPS, instance role, default plan id, SES, Atlas region.
5. §2.6 — confirm the old credentials are dead.
6. §5 — either finish those features or hide them.
