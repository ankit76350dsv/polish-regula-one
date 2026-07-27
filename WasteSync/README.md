# WasteSync — BDO Waste & Packaging Reporting

Part of the **RegulaOne** SuperApp (DSV Corporation). WasteSync lets companies in
Poland record monthly packaging-waste figures and generate the annual BDO report
in **XML** (for manual upload to the official BDO portal) and **PDF** (for company
records and audits).

- **Backend:** Node.js + Express + Mongoose (MongoDB)
- **Frontend:** React + Redux Toolkit + React Router + Axios + React Hook Form + Recharts
- **Auth:** SSO via the central **RegulaOne** service (shared AWS Cognito cookie) —
  identical model to the SafeWork module. WasteSync never logs users in itself.
- **Storage:** Generated reports are stored in a private, versioned **AWS S3** bucket
  in an **EEA region** (Frankfurt, `eu-central-1`) for GDPR/RODO compliance.

---

## Ports

| Service | Port |
|---|---|
| RegulaOne backend (auth) | 8080 |
| RegulaOne central login | 3000 |
| WasteSync backend | **8083** |
| WasteSync frontend | **3003** |

## Running locally

### Backend
```bash
cd backend
cp .env.example .env      # fill in Cognito + S3 values
npm install
npm run dev               # starts on http://localhost:8083
```

### Frontend
```bash
cd frontend
cp .env.example .env      # point at the backends if not using defaults
npm install
npm run dev               # starts on http://localhost:3003
```

You must be logged in through the central RegulaOne login (port 3000) and have the
`WASTESYNC` module enabled on your user for the app to load data.

---

## Architecture

Clean layering throughout: **Controller → Service → Model**. Controllers are thin
(parse request, call service, format response); all business logic and audit
logging lives in the service layer.

```
backend/src/
  config/      environment.js, database.js
  middleware/  authMiddleware (Cognito + tenant resolve), moduleGuard, auditLogger,
               errorHandler, rateLimiter, validate
  models/      User, Company, WasteEntry, AnnualReport, WasteThreshold, AuditLog
  controllers/ auth, company, wasteEntry, report, dashboard, audit
  services/    auth, company, wasteEntry, report, dashboard, audit,
               xmlGenerator, pdfGenerator
  routes/      one router per resource
  validators/  express-validator rule sets
  utils/       s3, bdoValidators, wasteCategories, responseHelper, ErrorHandler, catchAsyncError

frontend/src/
  api/         axiosClient (withCredentials), authApi, companyApi, wasteEntryApi,
               reportApi, dashboardApi, auditApi
  store/       Redux Toolkit slices (auth, company, wasteEntry, report, dashboard, audit)
  context/     AuthContext (SSO model)
  routes/      AppRoutes, ProtectedRoute, PublicRoute
  components/  layout/, common/ (reusable Card, StatCard, Badge, Loader, Button, …)
  pages/       Dashboard, Companies, CompanyForm, WasteEntries, Reports, ReportDetail, AuditLogs
```

### Data model
- A **tenant** (RegulaOne customer) owns many **Companies** (each with a mandatory
  9-digit BDO number).
- A company has many **WasteEntry** documents — one per month, **append-only**:
  a correction never edits an existing row, it saves a new `version` and flips the
  old one's `isLatest` to `false`. Full history is preserved for audits.
- A company has many **AnnualReport** documents (regenerating bumps `version`).
- **WasteThreshold** stores configurable legal limits per category/year.
- **AuditLog** is immutable (write-once, blocked from updates) and retained 10 years.

## Compliance notes
- All data scoped by `tenantId`, which is derived **only** from the authenticated
  RegulaOne session — never accepted from the client. Cross-tenant access is impossible.
- Security: Helmet, CORS allow-list with credentials, rate limiting, server-side
  DTO validation (negative weights and malformed BDO numbers rejected), secure
  HttpOnly auth cookie (no token in JS), centralized error handling (no stack leaks),
  S3 server-side encryption + presigned (15-min) download URLs.
- ⚠️ **Before production:** the exact element names / namespace of the generated XML
  must be confirmed against the **current official BDO schema specification**. The
  structure is isolated in `services/xmlGeneratorService.js` so adapting to a new
  schema version is a localised change. Waste categories live in one file
  (`utils/wasteCategories.js`) so regulation changes are a one-line edit.
