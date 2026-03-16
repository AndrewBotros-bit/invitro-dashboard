---
phase: 01-data-pipeline
plan: 03
subsystem: api
tags: [google-sheets, data-pipeline, server-components, nextjs]

# Dependency graph
requires:
  - phase: 01-data-pipeline/01-01
    provides: "googleSheets.js with batchGetSheetValues and getExpenseSheetValues"
  - phase: 01-data-pipeline/01-02
    provides: "parsePnL, parseCashflow, parseExpenses parser functions"
provides:
  - "fetchAllData() orchestrator returning DashboardData"
  - "Async server component wiring in app/page.jsx"
  - "Dashboard.jsx accepts data prop"
affects: [display-integration, data-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [parallel-fetch-with-promise-all, async-server-component, build-time-data-fetching]

key-files:
  created: [lib/data/index.js, tests/data/fetchAll.test.js]
  modified: [app/page.jsx, components/Dashboard.jsx]

key-decisions:
  - "P&L and Cashflow fetched in single batchGet, expenses separately, all via Promise.all for parallelism"
  - "Dashboard.jsx keeps hardcoded data; Phase 3 will switch to prop-based rendering"
  - "No error handling in fetchAllData -- build fails hard on API errors per user decision"

patterns-established:
  - "fetchAllData orchestrator pattern: fetch raw -> parse -> aggregate -> return typed object"
  - "Server component data flow: page.jsx (server) fetches, passes to client component as serialized prop"

requirements-completed: [DATA-01, INFR-01]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 1 Plan 3: Data Pipeline Orchestrator Summary

**fetchAllData() orchestrator wiring all three parsers with parallel Sheets API fetch, plus async server component passing DashboardData to client Dashboard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T21:17:23Z
- **Completed:** 2026-03-16T21:19:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- fetchAllData() fetches P&L + Cashflow via batchGet and expenses separately, all in parallel with Promise.all
- Sorted unique company union built from all three data sources (5 companies in test fixtures)
- app/page.jsx converted to async server component that passes fetched data to Dashboard
- 5 integration tests with mocked Sheets API -- all 31 tests across full suite passing

## Task Commits

Each task was committed atomically:

1. **Task 1: fetchAllData orchestrator (TDD RED)** - `6937896` (test)
2. **Task 1: fetchAllData orchestrator (TDD GREEN)** - `08c6346` (feat)
3. **Task 2: Wire async server component** - `e5a0e6b` (feat)

_Note: Task 1 used TDD with separate RED/GREEN commits_

## Files Created/Modified
- `lib/data/index.js` - fetchAllData() orchestrator that calls all parsers and returns DashboardData
- `tests/data/fetchAll.test.js` - 5 integration tests with mocked Google Sheets API
- `app/page.jsx` - Async server component fetching data at build time
- `components/Dashboard.jsx` - Added data prop acceptance (rendering unchanged)

## Decisions Made
- P&L and Cashflow fetched together via batchGet, expenses fetched separately -- both in parallel via Promise.all for efficiency
- Dashboard keeps hardcoded data for now; only the function signature changes to accept the data prop. Phase 3 handles display integration.
- No try/catch in fetchAllData -- errors propagate to fail the build hard, per user decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full data pipeline from Google Sheets through parsers to Dashboard component is wired
- Phase 2 (data validation) can validate the parsed DashboardData structure
- Phase 3 (display integration) can replace hardcoded data with the data prop in Dashboard.jsx
- Build will fetch real data when env vars are set (GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, INVITRO_MAIN_CONSOLIDATED_SHEET_ID, INVITRO_EXPENSE_SHEET_ID)

---
*Phase: 01-data-pipeline*
*Completed: 2026-03-16*
