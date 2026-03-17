---
phase: 01-data-pipeline
plan: 02
subsystem: data
tags: [parser, google-sheets, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-data-pipeline/01
    provides: "types.js, companyMapping.js, test fixtures, batchGet"
provides:
  - "parsePnL(rows) - P&L tab parser with dynamic company discovery"
  - "detectMonthColumns(headerRow) - shared month column detection utility"
  - "parseCashflow(rows) - Cashflow tab parser reusing block-detection"
  - "parseExpenses(rows) - Expense parser with header-based column detection"
affects: [01-data-pipeline/03, 02-data-validation, 03-display-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["block-detection for company/metric discovery", "header-based column lookup"]

key-files:
  created:
    - lib/data/parsePnL.js
    - lib/data/parseCashflow.js
    - lib/data/parseExpenses.js
    - tests/data/parsePnL.test.js
    - tests/data/parseCashflow.test.js
    - tests/data/parseExpenses.test.js
  modified: []

key-decisions:
  - "Shared detectMonthColumns exported from parsePnL and imported by parseCashflow"
  - "Block-detection pattern: company = col B non-empty + col C empty; metric = col C non-empty"

patterns-established:
  - "Block-detection: company headers in col B with empty col C, metrics in col C within company block"
  - "Header-based column lookup: build index map from header row, never hardcode column positions"
  - "Month detection: regex match 'Mon YYYY' pattern, filter to >= 2025"

requirements-completed: [DATA-02, DATA-04]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 1 Plan 2: Sheet Parsers Summary

**P&L, Cashflow, and Expense parsers with dynamic company discovery, header-based column detection, and TDD test suites (15 tests)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T21:13:09Z
- **Completed:** 2026-03-16T21:15:42Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- P&L parser discovers companies dynamically from row structure, handles variable metrics per company (AllRx has 6, Curenta has 3)
- Cashflow parser reuses detectMonthColumns and block-detection pattern from parsePnL
- Expense parser maps columns by header name (resilient to reordering), normalizes company names via canonicalName()
- All 15 new tests passing plus 11 prior Plan 01 tests (26 total)

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: P&L and Cashflow parsers** - `67ffb43` (test: RED) + `8cfb414` (feat: GREEN)
2. **Task 2: Expense parser** - `cfe5c3f` (test: RED) + `f835671` (feat: GREEN)

## Files Created/Modified
- `lib/data/parsePnL.js` - P&L parser with detectMonthColumns and parsePnL exports
- `lib/data/parseCashflow.js` - Cashflow parser importing detectMonthColumns from parsePnL
- `lib/data/parseExpenses.js` - Expense parser with header-based column detection and canonicalName mapping
- `tests/data/parsePnL.test.js` - 7 tests: month detection, company discovery, variable metrics, trailing nulls
- `tests/data/parseCashflow.test.js` - 2 tests: company discovery, metric extraction
- `tests/data/parseExpenses.test.js` - 6 tests: parsing, canonical names, month conversion, column reorder

## Decisions Made
- Shared detectMonthColumns exported from parsePnL and imported by parseCashflow to avoid duplication
- Block-detection pattern: company = col B non-empty + col C empty; metric = col C non-empty within company block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed column reorder test double-swap**
- **Found during:** Task 2 (Expense parser tests)
- **Issue:** Plan-specified test swapped columns in map() then explicitly swapped header again, undoing the header swap
- **Fix:** Removed redundant explicit header swap, kept the map-based swap that correctly reorders all rows including header
- **Files modified:** tests/data/parseExpenses.test.js
- **Verification:** Column reorder test passes -- parser correctly finds Company and Category despite swapped positions
- **Committed in:** f835671

---

**Total deviations:** 1 auto-fixed (1 bug in test)
**Impact on plan:** Minor test fix, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three parsers ready for integration in Plan 03 (fetchDashboardData orchestrator)
- detectMonthColumns is a reusable utility for any future tab with month columns
- 26 total tests provide regression safety for pipeline changes

---
*Phase: 01-data-pipeline*
*Completed: 2026-03-16*
