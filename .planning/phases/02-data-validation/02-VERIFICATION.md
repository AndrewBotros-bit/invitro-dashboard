---
phase: 02-data-validation
verified: 2026-03-16T22:01:00Z
status: passed
score: 14/14 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 11/14
  gaps_closed:
    - "Optional metrics warning logic implemented — warnings.push present in validatePnLStructure; test asserts warnings.length > 0 and checks Curenta warning content"
    - "Display-layer null safety implemented — lib/formatters.js exports null-safe fmt, fmtShort, pct; Dashboard.jsx imports from lib/formatters.js; 14 formatter tests pass"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Build manifest readability for CFO"
    expected: "Running next build with valid credentials should produce console output that clearly shows discovered tabs, companies, month range, and per-company detail in a readable format"
    why_human: "Subjective readability judgment — automated tests verify the strings are logged but cannot assess CFO usability"
---

# Phase 02: Data Validation Verification Report

**Phase Goal:** Build fails loudly on invalid sheet structure and charts handle missing cell values gracefully instead of crashing
**Verified:** 2026-03-16T22:01:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plans 03 and 04)

---

## Re-verification Summary

Previous score was 11/14. Two gaps were identified:

1. **Gap 1 (Plan 03):** `validate.js` initialized a `warnings` array but never pushed to it. Test only asserted no errors, not that warnings were generated.
2. **Gap 2 (Plan 04):** `Dashboard.jsx` formatters `fmt`, `fmtShort`, `pct` had no null guards — `fmt(null)` returned `'$NaN'`. ROADMAP SC2 was not satisfied.

Both gaps are now closed. All 14 must-haves verified. 61/61 tests pass.

---

## Goal Achievement

### Observable Truths — All Plans

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | validateSheetData returns errors when P&L tab is empty or has no month columns | VERIFIED | validate.js lines 35-43: empty check + detectMonthColumns check with error push; test at line 17 and 30 pass |
| 2 | validateSheetData returns errors when Cashflow tab is empty or has no month columns | VERIFIED | validate.js lines 116-125: identical checks for Cashflow; test at line 56 passes |
| 3 | validateSheetData returns errors when Expense tab is missing required header columns | VERIFIED | validate.js lines 160-163: iterates REQUIRED_EXPENSE_COLUMNS, pushes error for each missing; test at line 69 passes |
| 4 | validateSheetData collects ALL errors before returning (not fail-on-first) | VERIFIED | All three validate* calls happen before return; test at line 83 confirms errors from P&L, Cashflow, and Expenses when all invalid |
| 5 | Optional metrics like Cost of Sales produce warnings not errors | VERIFIED | validate.js lines 66-76: checkOptionalMetrics pushes warnings for each OPTIONAL_PNL_METRIC absent from a company block; test at line 106 asserts warnings.length > 0 and checks Curenta content |
| 6 | parsePnL coerces non-numeric cell values to null via toNumberOrNull | VERIFIED | parsePnL.js uses toNumberOrNull for value extraction; test asserts 'N/A' and '' become null |
| 7 | parseCashflow coerces non-numeric cell values to null via toNumberOrNull | VERIFIED | parseCashflow.js uses toNumberOrNull; same coercion pattern as parsePnL |
| 8 | parseExpenses returns null for missing/invalid amounts instead of 0 | VERIFIED | parseExpenses.js uses toNumberOrNull(rawAmount); test asserts undefined/'N/A'/'' become null |
| 9 | fetchAllData calls validateSheetData after fetch and before parsing | VERIFIED | lib/data/index.js line 39: validateSheetData called after raw row fetch, before parsePnL |
| 10 | If validation returns errors, fetchAllData throws an Error with all error messages joined | VERIFIED | index.js lines 47-50: joins all errors with '\n' and throws; test confirms all tab names in thrown message |
| 11 | Validation warnings are logged to console.warn with [DATA WARNING] prefix | VERIFIED | index.js lines 42-44; test spies on console.warn and asserts [DATA WARNING] prefix |
| 12 | After successful parse, fetchAllData logs a build manifest to console | VERIFIED | index.js line 64: logBuildManifest(data); test checks for 'Build Manifest' and 'AllRx' in log output |
| 13 | Build manifest includes tabs discovered, companies found, month range, per-company detail | VERIFIED | logBuildManifest function (index.js lines 73-89) logs tabs, companies, per-company P&L metrics/cashflow metrics/expense rows |
| 14 | Error messages use [DATA VALIDATION] prefix so they are searchable in Vercel build logs | VERIFIED | index.js line 48: '[DATA VALIDATION] ${e.tab}: ${e.message}'; test asserts .rejects.toThrow('[DATA VALIDATION]') |

**Score: 14/14 truths verified**

### ROADMAP Success Criteria Assessment

| SC | Description | Status | Notes |
|----|-------------|--------|-------|
| SC1 | Build fails with clear error on invalid structure | VERIFIED | validateSheetData + fetchAllData throw with [DATA VALIDATION] prefix |
| SC2 | Charts show error indicator (not NaN/$0/crash) for missing cell values | VERIFIED | lib/formatters.js exports null-safe fmt/fmtShort/pct that return '---' for null/undefined; Dashboard.jsx imports from lib/formatters.js; 14 formatter tests pass |
| SC3 | Build manifest shows tabs, companies, per-company detail | VERIFIED | logBuildManifest covers all required fields |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/data/validate.js` | validateSheetData with warning generation for optional metrics | VERIFIED | 189 lines; OPTIONAL_PNL_METRICS defined on line 17; warnings.push on line 69; checkOptionalMetrics scans all company blocks |
| `lib/data/types.js` | ValidationError and ValidationResult JSDoc types | VERIFIED | Both typedefs present |
| `tests/fixtures/invalidRows.js` | EMPTY_PNL_ROWS, NO_MONTH_PNL_ROWS, MISSING_HEADER_EXPENSE_ROWS, NON_NUMERIC_PNL_ROWS | VERIFIED | All required exports present |
| `tests/data/validate.test.js` | Tests asserting warnings.length > 0 for optional metric absence | VERIFIED | 139 lines; line 116 asserts warnings.length > 0; line 113 asserts Curenta warning content |
| `lib/data/index.js` | fetchAllData with validateSheetData call and build manifest | VERIFIED | 89 lines; validateSheetData imported and called; logBuildManifest on line 64 |
| `tests/data/fetchAll.test.js` | Tests for validation integration and manifest logging | VERIFIED | 204 lines, 10 tests |
| `lib/formatters.js` | Null-safe fmt, fmtShort, pct exportable formatters | VERIFIED | 33 lines; all three functions have null/undefined guard returning '---' on lines 7, 19, 31 |
| `tests/components/formatters.test.js` | Unit tests for null-safe formatter behavior | VERIFIED | 25 lines; 14 tests covering null, undefined, and valid inputs for all three formatters |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/data/validate.js` | `lib/data/parsePnL.js` | `import { detectMonthColumns } from './parsePnL.js'` | VERIFIED | Line 10 of validate.js; detectMonthColumns called on lines 40 and 121 |
| `lib/data/parseExpenses.js` | null amount handling | `toNumberOrNull` replaces `Number(rawAmount) \|\| 0` | VERIFIED | parseExpenses.js uses toNumberOrNull(rawAmount); no `|| 0` pattern remains |
| `lib/data/index.js` | `lib/data/validate.js` | `import { validateSheetData } from '@/lib/data/validate'` | VERIFIED | index.js line 5; called on line 39 |
| `lib/data/index.js` | console.log | `logBuildManifest` function with 'Build Manifest' header | VERIFIED | logBuildManifest logs '=== Build Manifest ===' |
| `components/Dashboard.jsx` | `lib/formatters.js` | `import { fmt, fmtShort, pct } from "@/lib/formatters"` | VERIFIED | Dashboard.jsx line 11; inline `const fmt`, `const fmtShort`, `const pct` declarations removed — grep returns 0 matches for inline definitions |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DATA-05 | 02-01, 02-02, 02-03 | Dashboard validates sheet data at build time — build fails loudly if sheet structure is invalid | SATISFIED | validateSheetData module + fetchAllData throw with [DATA VALIDATION] prefix; warnings generated for optional metric absence; 61/61 tests pass |
| DATA-06 | 02-01, 02-02, 02-04 | Dashboard gracefully handles missing/malformed cell values without crashing charts | SATISFIED | Data layer: all three parsers return null for missing/non-numeric values. Display layer: lib/formatters.js null-safe formatters return '---' for null/undefined; Dashboard.jsx imports from lib/formatters.js. Both layers complete. |

No orphaned requirements — only DATA-05 and DATA-06 are mapped to Phase 2 in REQUIREMENTS.md. Both are marked Complete in the Traceability table.

---

## Anti-Pattern Scan

Files modified in gap-closure plans (02-03, 02-04): `lib/data/validate.js`, `tests/data/validate.test.js`, `lib/formatters.js`, `tests/components/formatters.test.js`, `components/Dashboard.jsx`.

| File | Pattern | Severity | Result |
|------|---------|----------|--------|
| `lib/data/validate.js` | `warnings` array never populated | Was: Warning | RESOLVED — `warnings.push` present on line 69 |
| `components/Dashboard.jsx` | `fmt(v)` no null guard | Was: Blocker | RESOLVED — inline formatters removed; imports null-safe versions from `lib/formatters.js` |
| `lib/formatters.js` | TODO/FIXME/placeholder | None | Clean — no anti-patterns found |
| `tests/data/validate.test.js` | Weak assertion (only errors === []) | Was: Warning | RESOLVED — line 116 asserts `warnings.length > 0`; line 118-125 asserts Curenta warning content and AllRx no-warning behavior |

---

## Test Suite Results

```
Test Files: 8 passed (8)
     Tests: 61 passed (61)
  Duration: 852ms
```

Full suite green. No regressions. 14 new tests added across Plans 03 and 04 (validate warning assertion strengthened + 14 formatter tests).

---

## Human Verification Required

### 1. Build Manifest Readability

**Test:** Run `npm run build` with valid service account credentials and Google Sheet access configured in environment variables.
**Expected:** Console output contains a readable "Build Manifest" section with tabs discovered, company names, and per-company detail lines formatted like "AllRx: 12 months, 8 P&L metrics, 3 cashflow metrics, 142 expense rows"
**Why human:** Automated tests verify the strings are logged, but cannot assess whether the format is clear and usable by the CFO for verification purposes.

---

## Gaps Summary

No gaps remain. All 14 must-haves verified. Both ROADMAP success criteria that were previously failing (SC2: null-safe display, and the warning generation truth) are now satisfied.

---

_Verified: 2026-03-16T22:01:00Z_
_Verifier: Claude (gsd-verifier)_
