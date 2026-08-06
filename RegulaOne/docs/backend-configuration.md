# RegulaOne backend — configuration

**No `application*.properties` file is ever committed to this repository.** They are all
git-ignored, deliberately: they carry the database password, the Cognito client secret and
the internal service token. This document is the record of what the application needs —
setting **names and meanings only, never a value**.

Ask a team member for the development values. Never paste a real value into this file, and
never remove the ignore rule in `backend/.gitignore`.

---

## 1. How configuration is layered

| File | Contains | Committed |
|---|---|---|
| `application.properties` | only what is identical in every environment (application name, default profile) plus a reference explaining the SSO cookie settings | no |
| `application-dev.properties` | every value needed to run locally | no |
| `application-prod.properties` | production: secrets as `${ENV_VAR}` with no fallback, public URLs written out | no |

Each value lives in **exactly one place**. `application.properties` holds no database,
Cognito, CORS or cookie value at all, so there is nothing to keep in step.

The default profile is `dev`. Production must be started with `SPRING_PROFILES_ACTIVE=prod`.

---

## 2. Running the backend locally

Create `backend/src/main/resources/application-dev.properties` with the settings in §3, then:

```bash
cd RegulaOne/backend
./mvnw spring-boot:run
```

If a required setting is missing, start-up stops with the exact name, for example:

```
Could not resolve placeholder 'COGNITO_REGION' in value "${COGNITO_REGION}"
```

That is intended — the application refuses to run half-configured rather than starting and
failing later in a way that is harder to diagnose.

---

## 3. Every setting the backend reads

| Property | What it is | Required |
|---|---|---|
| `spring.mongodb.uri` | MongoDB connection string, including credentials and the `RegulaOne` database name. **Spring Boot 4 uses `spring.mongodb.uri`; in Boot 3 it was `spring.data.mongodb.uri`.** | yes |
| `cors.allowed-origins` | Comma-separated list of browser origins allowed to call this API — scheme + host, no trailing slash. Locally: the module app ports, plus your LAN IP if you open the apps from a phone. | yes |
| `aws.cognito.region` | Region of the Cognito user pool, e.g. `eu-central-1`. | yes |
| `aws.cognito.user-pool-id` | Cognito user pool id. | yes |
| `aws.cognito.client-id` | Cognito app client id. | yes |
| `aws.cognito.client-secret` | Cognito app client secret. Optional only if the app client has none. | usually |
| `app.notifications.from` | Sender address for e-mail. Must be **verified in SES** or sending fails. | yes |
| `notification.internal.service-token` | Shared secret the module apps send in the `X-Service-Token` header. If unset, the internal endpoints stay closed (fail-safe). Generate with `openssl rand -hex 32`. | for module calls |
| `notification.test.enabled` | Exposes `POST /api/notifications/test`, the "send myself test notifications" button. **Must be `false` in production.** | no (default `false`) |
| `sso.cookie.domain` | Empty locally, so the session cookie follows whichever host you open the app on. `.regulaone.eu` in production, which is what shares the session across every module subdomain. | no (default empty) |
| `sso.cookie.secure` | `false` locally (plain HTTP), `true` in production. | no (default `false`) |
| `sso.cookie.same-site` | `Lax` — sent on top-level navigation but not on cross-site POST/XHR, which is what makes it CSRF-safe. | no (default `Lax`) |
| `sso.central-login-url` | Where an unauthenticated module app sends people to sign in. | no |
| `regulaone.default-package-id` | Plan assigned to a brand-new organisation at setup. | no (has a default) |

---

## 4. AWS account credentials

**Not a Spring property, and cannot be.** The AWS SDK reads credentials from environment
variables, JVM system properties or `~/.aws/credentials` — it never looks at Spring's
configuration. Putting `AWS_ACCESS_KEY_ID` in a properties file does nothing at all.

* **Locally** — run `aws configure` once, or `export AWS_PROFILE=<your-profile>`.
* **In production** — give the container or instance an **IAM role**. There is then no
  long-lived key to leak or rotate.

---

## 5. Production environment variables

`application-prod.properties` reads these, each with **no fallback**, so a missing one stops
the deployment instead of silently using a development default:

| Variable | Used for |
|---|---|
| `MONGODB_URI` | `spring.mongodb.uri` |
| `COGNITO_REGION` | `aws.cognito.region` |
| `COGNITO_USER_POOL_ID` | `aws.cognito.user-pool-id` |
| `COGNITO_CLIENT_ID` | `aws.cognito.client-id` |
| `COGNITO_CLIENT_SECRET` | `aws.cognito.client-secret` |
| `NOTIFICATION_FROM_EMAIL` | `app.notifications.from` |
| `NOTIFICATION_INTERNAL_TOKEN` | `notification.internal.service-token` |

Plus `SPRING_PROFILES_ACTIVE=prod`.

---

## 6. Rules

1. **Never commit an `application*.properties` file.** The ignore rule covers profile files
   added later and any `.example` copy.
2. **Never put a secret in this document**, or in any other tracked file.
3. Store the shared development and production values in the team's password manager or
   secrets store, not in chat or e-mail.
4. If a credential is ever committed by accident, **rotate it** — deleting the file does not
   remove it from git history, which everyone who cloned the repository already has.
