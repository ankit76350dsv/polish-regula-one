# PrivacyPilot — Frontend

GDPR / RODO compliance module of the RegulaOne platform (Poland-first).
Built after the 2026-07-02 validation (see repo `memory/privacypilot-frontend-validation.md`):
theme carried from the `frontend2` prototype, code structure aligned with `RegulaOne/frontend`,
state management on Redux Toolkit as mandated by CLAUDE.md §26.

## Stack

- React 19 + Vite 6 (JavaScript/JSX, like the RegulaOne frontend)
- **Redux Toolkit** — `src/store/` + feature slices in `src/store/slices/`
- `react-router-dom` v7 with route-level RBAC guards
- Tailwind CSS v4 + shadcn-style primitives copied from `RegulaOne/frontend/components/ui`
  (@base-ui/react — use the `render` prop, **never** `asChild`)
- Self-hosted fonts via @fontsource (no Google Fonts CDN — EU data-residency)
- Hand-rolled PL/EN i18n (`src/i18n/`), Polish default

## Structure (mirrors RegulaOne/frontend)

```
components/ui/     shadcn primitives (copied from RegulaOne)
lib/utils.js       cn() helper
hooks/             use-mobile (RegulaOne)
src/
  pages/<Domain>/  page components
  components/      layout/ + common/
  store/           Redux store + slices/
  services/        mock API layer (swap for HTTP client later)
  lib/             gdpr.js, dpiaCriteria.js, permissions.js, noticeBuilder.js, completeness.js
  i18n/            en.js, pl.js
```

## Compliance engine highlights

- **ROPA** — full Art. 30(1)/(2) field coverage; all six Art. 6 bases; Art. 9(2)
  condition picker; recipients (30(1)(d)) separated from processors (Art. 28);
  CSV export includes the controller + DPO identity block.
- **DPIA** — 12 criteria from the UODO list (M.P. 2019 poz. 666), pre-suggested
  from wizard data; Art. 35(7)(a)–(d) workspace; Art. 36 flag; role-enforced sign-off.
- **Notices** — per-audience Art. 13/14 documents generated from register data;
  generation blocked until the completeness checklist passes.
- **Breaches** — Art. 33(5) register with a live 72h clock; risk rationale mandatory.
- **DSAR** — 1-month deadline engine with the Art. 12(3) +2-month extension.
- **DPO tracker** — Polish 14-day UODO notification window (Act of 10 May 2018, Art. 10–11).
- **RBAC** — one matrix (`lib/permissions.js`) enforced in routes, buttons AND the
  service layer. **Audit trail** with old/new diffs written by every mutation.

## Mock backend

`src/services/api.js` simulates the backend (latency, RBAC rejection, audit
logging) with data in localStorage (`pp_mock_db_v1`). Delete that key to reseed.
Demo accounts are listed on the login page; password `demo123`.

## Run

```bash
npm install
npm run dev      # http://localhost:5183
npm run build
```
