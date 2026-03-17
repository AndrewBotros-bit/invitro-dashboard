# Phase 2: Data Validation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add validation to the data pipeline so builds fail loudly on invalid sheet structure, missing values display gracefully in charts instead of crashing, and a build manifest logs what was discovered for CFO verification.

</domain>

<decisions>
## Implementation Decisions

### Build Validation Behavior
- Critical headers that fail the build: month columns + metric labels (Revenue, EBITDA, etc.) that parsers depend on
- Build error messages: single descriptive line per error, e.g. "P&L tab missing header 'Revenue' in company block 'AllRx'"
- Dedicated validation pass runs before parsing — fail fast, collect all errors at once (don't fail on first)
- Optional metrics (e.g. Gross Margin for companies that don't have Cost of Sales) produce warnings but do not fail the build

### Missing Value Handling in Charts
- Missing/non-numeric values display as dash "---" with muted text color
- Computed metrics (Gross Margin %, etc.) return null when any input is missing — display "---"
- Parsers output null for missing/invalid values, components handle display logic

### Build Manifest
- Structured console log with sections: tabs discovered, companies found, month range, per-company metrics/row counts
- Include per-company detail: "AllRx: 12 months, 8 metrics, 142 expense rows"
- Console/build log only — not visible in deployed dashboard (Phase 3 adds "Data as of" timestamp)

### Claude's Discretion
- Validation function placement (separate module vs integrated into parsers)
- Console log formatting and color choices
- Error aggregation strategy (collect all vs fail on first category)
- Test fixture design for validation edge cases

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/data/parsePnL.js` — detectMonthColumns() and parsePnL() with dynamic discovery
- `lib/data/parseCashflow.js` — parseCashflow() reusing detectMonthColumns
- `lib/data/parseExpenses.js` — parseExpenses() with header-based column detection
- `lib/data/types.js` — JSDoc type definitions for all data structures
- `lib/data/index.js` — fetchAllData() orchestrator
- `tests/fixtures/` — mock sheet data (pnlRows.js, cashflowRows.js, expenseRows.js)
- `vitest.config.js` — test infrastructure already in place

### Established Patterns
- Parsers return null for missing values already in some cases
- Tests use vitest with mock fixtures
- No try/catch in fetchAllData — errors propagate to build

### Integration Points
- Validation hooks into fetchAllData() in lib/data/index.js
- Parser functions need to return null for missing/invalid cell values
- Build manifest logs during fetchAllData() execution
- components/Dashboard.jsx needs null-safe rendering for "---" display

</code_context>

<specifics>
## Specific Ideas

- Phase 1 parsers already handle some missing values but inconsistently — validation should standardize null handling
- The P&L tab has varying line items per company (AllRx has Cost of Sales, Curenta doesn't) — this is expected, not an error
- Build manifest should help CFO verify "did the dashboard find my data?" without looking at code

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-data-validation*
*Context gathered: 2026-03-16 via Smart Discuss*
