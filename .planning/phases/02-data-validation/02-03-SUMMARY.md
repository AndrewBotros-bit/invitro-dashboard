---
phase: 02-data-validation
plan: 03
subsystem: testing
tags: [validation, warnings, pnl, tdd]

requires:
  - phase: 02-data-validation/02-01
    provides: "validate.js with validateSheetData returning {errors, warnings}"
provides:
  - "Warning generation for missing optional P&L metrics (Cost of Sales, Gross Profit, Gross Margin)"
  - "OPTIONAL_PNL_METRICS constant for configurable optional metric list"
affects: [03-display-integration]

tech-stack:
  added: []
  patterns: ["Company block scanning with flush-on-boundary for metric collection"]

key-files:
  created: []
  modified: [lib/data/validate.js, tests/data/validate.test.js]

key-decisions:
  - "Used typo 'Gorss Margin, %' to match actual sheet data in fixtures"
  - "Warnings generated per-company per-metric for granular diagnostic output"

patterns-established:
  - "Optional metric checking: define constant array, scan company blocks, push warnings for absent metrics"

requirements-completed: [DATA-05]

duration: 2min
completed: 2026-03-16
---

# Phase 02 Plan 03: Optional Metric Warnings Summary

**validatePnLStructure now pushes warnings for missing optional metrics (Cost of Sales, Gross Profit, Gross Margin) per company block, with TDD test asserting Curenta triggers warnings and AllRx does not**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T21:57:42Z
- **Completed:** 2026-03-16T21:59:20Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Defined OPTIONAL_PNL_METRICS constant with Cost of Sales, Gross Profit, and Gorss Margin %
- Added company block scanning logic to validatePnLStructure that collects metric names per company and checks for optional metric absence
- Strengthened test assertion from "no errors" to "warnings.length > 0 with correct shape and content"
- Full test suite passes: 61 tests across 8 files, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Strengthen optional metric warning test** - `8e8bbac` (test)
2. **Task 1 (GREEN): Implement warning generation** - `8cb1964` (feat)

_TDD task with RED and GREEN commits._

## Files Created/Modified
- `lib/data/validate.js` - Added OPTIONAL_PNL_METRICS constant and company block scanning with warning generation in validatePnLStructure
- `tests/data/validate.test.js` - Strengthened test to assert warnings.length > 0, warning shape, Curenta presence, and AllRx absence

## Decisions Made
- Used the typo 'Gorss Margin, %' to match the actual fixture data (mirrors the real Google Sheet)
- Warnings are granular: one per company per missing metric, enabling clear diagnostic messages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Validation module now actively generates warnings for optional metric gaps
- Ready for 02-04 (next plan in data-validation phase)

---
*Phase: 02-data-validation*
*Completed: 2026-03-16*
