# Dashboard — pending dedicated API (2026-07-22)

**Decision:** The compliance dashboard will be powered by its own dedicated
**dashboard/stats API** (to be built on the PrivacyPilot backend), instead of
aggregating feature data client-side.

## Current state (interim)
- `DashboardPage.jsx` is **decoupled from the real activities integration**. It no
  longer fetches or reads the `activities` slice; a stable `NO_ACTIVITIES = []`
  feeds the activity-derived pieces so they render empty/zero:
  - "Processing activities" stat card → shows `—` with hint `dash.pendingApi`
    ("Awaiting dashboard API" / "Oczekiwanie na API pulpitu");
  - "By department" and "By lawful basis" charts → empty;
  - the "DPIA required" attention items derived from activities → none.
- Everything else on the dashboard (DPIA in-progress, breaches, DSARs, vendors,
  audit) still reads the existing **mock** slices, unchanged.

## Why decoupled now
The activities API is live (see `activities-api-integration.md`), but the dashboard
should NOT re-derive its numbers from the register client-side. Those aggregates
belong server-side (tenant-isolated, auditable) and will come from the new API.

## Follow-up (when the dashboard API is ready)
1. Add a `dashboardService` + `dashboardSlice` (RTK) calling the new endpoint via
   `client.js` (same cookie-auth transport as `activityService`).
2. In `DashboardPage.jsx`: replace `NO_ACTIVITIES`/the interim placeholders with the
   API response — restore the ROPA count, completeness, and the two charts.
3. Remove the `dash.pendingApi` placeholder usage.
