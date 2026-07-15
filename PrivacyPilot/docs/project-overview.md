# PrivacyPilot — Project Overview

**Module 6 of the RegulaOne SuperApp** — the GDPR / RODO compliance module.

> RegulaOne is an enterprise compliance platform for the Polish / EU market
> (author: DSV Corporation Pty Ltd). PrivacyPilot is the module that helps a
> company meet its data-protection obligations under the EU General Data
> Protection Regulation (GDPR), known in Poland as **RODO**.

---

## 1. What PrivacyPilot is (in plain language)

If a company collects people's personal data — employee names, salaries, CCTV
footage, customer emails — the law says it must be able to **prove** it handles
that data responsibly. A regulator (in Poland, the **UODO** — Urząd Ochrony
Danych Osobowych) can ask to see this proof at any time, and missing paperwork
can lead to heavy fines.

PrivacyPilot is the tool that keeps all of that paperwork **in one place, always
audit-ready**. Think of it as three things combined:

1. A **filing cabinet** for every privacy record the law requires.
2. A **reminder / workflow system** so nothing (like a 72-hour breach deadline
   or a 1-month data request) is missed.
3. An **audit-proof logbook** that records who did what and when, so the company
   can defend itself during a government audit.

---

## 2. The legal duties it covers

Each part of the app maps directly to an obligation in the GDPR / RODO:

| Duty | Legal basis | Where in the app |
|---|---|---|
| Keep a Register of Processing Activities (ROPA) | Art. 30 | Register |
| Assess high-risk processing before starting | Art. 35 (DPIA) | DPIA |
| Tell people how their data is used | Art. 13 / 14 | Notices |
| Control data shared with third parties | Art. 28 (processors) | Vendors |
| Restrict data leaving the EEA | Chapter V | Transfers |
| Report breaches within 72 hours | Art. 33 / 34 | Breaches |
| Answer data-subject requests within 1 month | Art. 15–22 (DSAR) | DSAR |
| Prove records were not tampered with | Accountability (Art. 5(2)) | Audit Trail |

> **Everything flows from the Register.** DPIAs, notices, and transfers all
> reference activities recorded in the Art. 30 register. It is the backbone of
> the module; the other pages hang off it.

---

## 3. Pages and what each one is for

| Route | Page | Purpose |
|---|---|---|
| `/login` | Login | The front door. No personal data is visible without authenticating. |
| `/dashboard` | Dashboard | A 5-second health check: what's approved, overdue, or needs attention. |
| `/register` | Register (ROPA) | The Art. 30 list of every data-processing activity. Two tabs: **controller** (Art. 30(1)) and **processor** (Art. 30(2)). |
| `/register/new`, `/register/:id/edit` | Activity Wizard | Step-by-step form to add or edit one activity. |
| `/register/:id` | Activity Detail | Full view of a single activity. |
| `/dpia`, `/dpia/:id` | DPIA | Risk assessments for high-risk processing (health, biometrics, CCTV, GPS). |
| `/notices` | Notices | Drafts privacy notices / policies from the register. |
| `/vendors` | Vendors | Third parties the company shares data with, and their contracts. |
| `/transfers` | Transfers | Records of personal data leaving the EU/EEA and its safeguards. |
| `/breaches`, `/breaches/:id` | Breaches | Incident log with the 72-hour reporting deadline tracked. |
| `/dsar`, `/dsar/:id` | DSAR | Data-subject requests (access, erasure, portability) with 1-month deadlines. |
| `/audit-trail` | Audit Trail | Immutable log of who changed what and when. |
| `/users` | Users | Manage who can log in and what each role may do (RBAC). |
| `/settings` | Settings | Company-level configuration. |
| `*` | Not Found | 404 fallback. |

---

## 4. Roles and permissions (RBAC)

Access is **least-privilege** and enforced through a single permission matrix
(`src/lib/permissions.js`) that is used in three places so it cannot drift:

1. **Route guards** in `App.jsx` — can the role open the page at all?
2. **Action checks** inside pages — is a button rendered / enabled?
3. **The (mock) services** — the action is rejected even if the UI is bypassed.

| Role | Summary of what they can do |
|---|---|
| **Company Admin** (`TENANT_ADMIN`) | Everything, including managing users and settings. |
| **Compliance Officer** | Create/edit activities, run DPIAs, manage vendors/transfers/breaches/DSAR, generate notices, export. |
| **DPO / IOD** | Review and **sign** DPIAs, **approve** activities, handle breaches/DSAR, export, view audit trail. |
| **Auditor** | **Read + export only** — must never be able to alter the evidence they audit. |
| **Employee** | Only their own tasks (no compliance-record access). |

> Auditors are deliberately read-only, and the DPO is the person who signs off
> on high-risk decisions — this mirrors how the roles work in a real
> data-protection team.

---

## 5. Current state of the codebase

The frontend is a **production-shaped prototype**: the full UI, workflows, RBAC,
and audit logging are built and wired through Redux, but the data layer is
currently backed by **mock services** (`src/services/*` + `mockData.js`) rather
than a live backend.

- **Working:** all pages, navigation, role-based access, GDPR-hardened
  workflows, and an audit trail — enough to demo and validate the full journey.
- **Not yet real:** persistence, real authentication, encryption at rest, and
  the server-side enforcement of the same permission matrix.

The remaining work is **backend-shaped**: build the API that each page's service
already expects, and re-enforce every permission check on the server (never
trust the frontend alone).

---

## 6. Tech stack

- **React 19** + **Vite 6** (JavaScript, not TypeScript)
- **Redux Toolkit** for all state and API integration — one slice per feature
  (`src/store/slices/*`), one service file per feature (`src/services/*`).
  Components read/write shared and API state through slices, never local state.
- **React Router 7** for routing and route-level RBAC guards
- **Tailwind CSS 4** + **@base-ui/react** for UI primitives
  *(note: this project uses @base-ui/react, not Radix — there is no `asChild` prop)*
- **Recharts** for dashboard charts, **lucide-react** for icons,
  **sonner** for toasts, **next-themes** for dark mode, **date-fns** for dates

### Folder layout
```
PrivacyPilot/frontend/src/
  pages/        page-level components, grouped by feature
  components/   shared UI + layout (DashboardLayout, etc.)
  store/slices/ Redux Toolkit slices (one per feature)
  services/     API/network service functions (currently mock)
  lib/          permissions.js (the RBAC matrix) and helpers
```

---

## 7. Compliance principles baked in

Following the RegulaOne engineering rules, PrivacyPilot is designed to be:

- **Audit-ready** — every critical action produces an immutable audit log
  (user, timestamp, old value, new value, action).
- **Data-resident** — personal data must stay inside the EEA; the Transfers page
  exists specifically to control and justify any exception.
- **Right-respecting** — supports right-to-erasure and export via the DSAR flow.
- **Human-in-the-loop** — generated documents (register entries, notices) are
  **drafts** that a DPO or legal counsel must review before publication.
- **Localised** — Polish (RODO) terminology and labels throughout, with i18n in
  mind.

---

## 8. Where to start when building the backend

1. **Register / ROPA first** — it is the backbone every other feature reads from.
2. Mirror the existing `src/services/*` contracts so the frontend needs minimal
   change to switch from mock to live data.
3. Re-enforce the `permissions.js` matrix **server-side** on every endpoint.
4. Add encryption at rest for sensitive fields, immutable audit logging, and
   tenant isolation (`tenant_id` on every query) per the RegulaOne standards.
