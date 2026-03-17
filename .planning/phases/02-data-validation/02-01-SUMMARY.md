---
phase: 02-data-validation
plan: 01
subsystem: data
tags: [validation, parsing, null-coercion, vitest]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: parsePnL, parseCashflow, parseExpenses, detectMonthColumns, types.js
provides:
  - validateSheetData function with collect-all-errors pattern
  - toNumberOrNull coercion in all three parsers
  - ValidationError and ValidationResult JSDoc types
  - Test fixtures for invalid sheet data
affects: [02-data-validation, display-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [collect-all-errors validation, toNumberOrNull coercion]

key-files:
  created:
    - lib/data/validate.js
    - tests/fixtures/invalidRows.js
    - tests/data/validate.test.js
  modified:
    - lib/data/types.js
    - lib/data/parsePnL.js
    - lib/data/parseCashflow.js
    - lib/data/parseExpenses.js
    - tests/data/parsePnL.test.js
    - tests/data/parseExpenses.test.js

key-decisions:
  - "toNumberOrNull duplicated in each parser file (internal helper, not shared) to keep modules self-contained"
  - "Expense validation requires header + at least 1 data row (rows.length < 2 is empty)"

patterns-established:
  - "Collect-all-errors: validation never throws, pushes to errors/warnings arrays"
  - "toNumberOrNull pattern: null/undefined/empty -> null, non-finite -> null, finite number preserved"

requirements-completed: [DATA-05, DATA-06]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 02 Plan 01: Data Validation Summary

**Validation module with collect-all-errors pattern and toNumberOrNull coercion across all parsers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T21:41:58Z
- **Completed:** 2026-03-16T21:45:01Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- validateSheetData validates P&L, Cashflow, and Expense tab structure before parsing
- All three parsers now coerce non-numeric values to null via toNumberOrNull
- Fixed parseExpenses bug: `Number(rawAmount) || 0` replaced with `toNumberOrNull(rawAmount)`
- 42 total tests passing (9 new validation + 2 new null-coercion + 31 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Validation module with test fixtures and tests** - `447c682` (feat)
2. **Task 2: Null-safe parser updates with toNumberOrNull** - `6544341` (fix)

_Both tasks followed TDD: RED (failing tests) then GREEN (implementation)_

## Files Created/Modified
- `lib/data/validate.js` - validateSheetData with P&L, Cashflow, Expense structure validation
- `lib/data/types.js` - Added ValidationError, ValidationResult types; updated ExpenseRow.amount to number|null
- `tests/fixtures/invalidRows.js` - Test fixtures for empty tabs, missing headers, no company blocks
- `tests/data/validate.test.js` - 9 tests for validation module
- `lib/data/parsePnL.js` - Added toNumberOrNull, updated value extraction
- `lib/data/parseCashflow.js` - Added toNumberOrNull, updated value extraction
- `lib/data/parseExpenses.js` - Added toNumberOrNull, replaced Number(rawAmount) || 0 bug
- `tests/data/parsePnL.test.js` - Added non-numeric coercion test
- `tests/data/parseExpenses.test.js` - Added null amount test

## Decisions Made
- toNumberOrNull duplicated in each parser as internal helper (not shared) to keep modules self-contained
- Expense validation requires header + at least 1 data row (rows.length < 2 triggers empty error)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- validateSheetData ready for Plan 02 to wire into fetchAllData
- All parsers handle non-numeric values safely with null coercion
- Foundation set for build-time validation that fails on invalid sheet structure

---
*Phase: 02-data-validation*
*Completed: 2026-03-16*
