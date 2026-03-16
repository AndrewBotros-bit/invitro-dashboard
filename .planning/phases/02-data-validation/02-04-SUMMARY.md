---
phase: 02-data-validation
plan: 04
subsystem: ui
tags: [formatters, null-safety, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-data-validation
    provides: "toNumberOrNull parser output (null for missing values)"
provides:
  - "Null-safe fmt, fmtShort, pct formatters in lib/formatters.js"
  - "Dashboard.jsx imports shared formatters instead of inline definitions"
affects: [03-display-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Shared formatter utility with null guards returning '---'"]

key-files:
  created: [lib/formatters.js, tests/components/formatters.test.js]
  modified: [components/Dashboard.jsx]

key-decisions:
  - "Extracted formatters to lib/formatters.js for testability rather than testing inside Dashboard.jsx client component"

patterns-established:
  - "Null-safe formatters: all display formatters return '---' for null/undefined inputs"
  - "Shared utility extraction: pure functions extracted from components for unit testing"

requirements-completed: [DATA-06]

# Metrics
duration: 1min
completed: 2026-03-16
---

# Phase 2 Plan 4: Null-Safe Formatters Summary

**Null-safe fmt/fmtShort/pct formatters extracted to lib/formatters.js, returning '---' for null/undefined instead of '$NaN'**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T21:57:44Z
- **Completed:** 2026-03-16T21:59:04Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Extracted formatters from Dashboard.jsx to lib/formatters.js for testability
- Added null/undefined guards to all three formatters (fmt, fmtShort, pct)
- 14 unit tests covering null safety and existing numeric formatting behavior
- Dashboard.jsx now imports from shared utility instead of inline definitions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing formatter tests** - `f9c53fb` (test)
2. **Task 1 GREEN: Null-safe formatters + Dashboard import** - `306debc` (feat)

_TDD task: test written first (RED), then implementation (GREEN)._

## Files Created/Modified
- `lib/formatters.js` - Null-safe fmt, fmtShort, pct formatter functions
- `tests/components/formatters.test.js` - 14 unit tests for formatter behavior
- `components/Dashboard.jsx` - Replaced inline formatters with import from lib/formatters

## Decisions Made
- Extracted formatters to `lib/formatters.js` rather than testing Dashboard.jsx directly, since Dashboard.jsx is a "use client" component with heavy JSX dependencies not suitable for unit testing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `tests/data/validate.test.js` (from plan 02-03 RED state) is unrelated to this plan's changes. Confirmed by running tests before and after changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Formatters are null-safe and ready for Phase 3 display integration
- When parsePnL/parseCashflow data flows through to Dashboard.jsx, null values will display as '---' instead of '$NaN'
- ROADMAP SC2 display-layer null safety satisfied

---
*Phase: 02-data-validation*
*Completed: 2026-03-16*
