# ROPA Activities — real backend integration (2026-07-22)

The Processing Activities register (Art. 30 ROPA) is now wired to the **real
PrivacyPilot backend** (`ProcessingActivityController.java`,
`/api/privacypilot/activities`). It no longer uses the in-browser mock.

## What changed (frontend)

| File | Change |
|---|---|
| `src/services/client.js` | **New.** Real authenticated JSON transport for `/api/privacypilot/**`. Sends the shared-domain session cookie (`credentials: 'include'`), unwraps the `AppResponse` envelope, does one silent token refresh + retry on 401, and throws `Error(errorCode)` (FORBIDDEN / NOT_FOUND / …) so existing UI checks keep working. |
| `src/services/http.js` | Added `PRIVACYPILOT_API_BASE` (env `VITE_PRIVACYPILOT_API_URL`, default `http://localhost:9004`). |
| `src/services/activityService.js` | Rewritten: mock `apiGet/apiMutate` → real `get/post/put/del`. Added `toRequest()` mapper → sends only the `ActivityRequest` DTO fields and converts empty-string enums to `null` (an empty code is invalid on the backend). |
| `src/store/slices/activitiesSlice.js` | Thunks no longer pass an `actor` (server derives identity/tenant from the session). Archive now removes the item from the list (backend returns no body). |
| `src/services/mockData.js` | `activities` seed emptied (`[]`). |
| `src/pages/Ropa/ActivityWizardPage.jsx` | Edit-mode hydration coerces backend `null` enums back to `''` for the form controls. Removed the **"Joint controller"** role option — the backend `ProcessingRole` enum only has `controller`/`processor`, and the register has no tab for it. |
| `vite.config.js` | Production CSP `connect-src` now also allows the PrivacyPilot API origin. |
| `.env.example` | Documented `VITE_PRIVACYPILOT_API_URL`. |

## Contract notes
- Server owns: `id`, `tenantId`, `ownerName`, `status` (starts `draft`), `dpiaVerdict`
  (recomputed from `dpiaCriteria`: ≥2 → required, 1 → recommended, 0 → not_indicated),
  timestamps, and the immutable audit entry per write.
- RBAC is enforced server-side (403 FORBIDDEN); the UI still hides actions via `can()`.
- All enum codes (departments, data/recipient categories, TOMs, DPIA criteria,
  Art. 9(2) conditions) already match 1:1 between `gdpr.js` and the backend enums.

## Known follow-ups (still on the mock)
The DPIA and Notices modules still read `db.activities`:
- `dpiaService.createForActivity` ("Start DPIA from activity") and
  `noticeService.checklist/generate` will not see the real activities until those
  modules are integrated too. `db.activities` is intentionally left as `[]` (not
  deleted) so they don't crash. Integrate DPIA next.
