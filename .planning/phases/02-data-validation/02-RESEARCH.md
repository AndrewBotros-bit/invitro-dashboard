# Phase 02: Data Validation - Research

**Researched:** 2026-03-16
**Domain:** Build-time data validation, null-safe rendering, structured logging
**Confidence:** HIGH

## Summary

This phase adds three capabilities to the existing data pipeline: (1) a validation pass that fails the Next.js build if sheet structure is invalid, (2) null-safe value handling so charts display "---" instead of crashing on missing data, and (3) a build manifest that logs what was discovered for CFO verification.

The existing codebase is well-structured for this work. Parsers already use `?? null` for missing trailing cells, fetchAllData already throws on missing env vars, and vitest is fully configured with mock fixtures. The primary work is adding a dedicated validation layer between raw sheet fetch and parsing, standardizing null handling across all three parsers, and adding console logging to fetchAllData.

**Primary recommendation:** Create a `lib/data/validate.js` module with pure functions that inspect raw sheet rows before parsing. Validation collects all errors before throwing. Parsers get updated to consistently emit `null` for non-numeric/missing values. fetchAllData orchestrates: fetch -> validate -> parse -> log manifest.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Critical headers that fail the build: month columns + metric labels (Revenue, EBITDA, etc.) that parsers depend on
- Build error messages: single descriptive line per error, e.g. "P&L tab missing header 'Revenue' in company block 'AllRx'"
- Dedicated validation pass runs before parsing -- fail fast, collect all errors at once (don't fail on first)
- Optional metrics (e.g. Gross Margin for companies that don't have Cost of Sales) produce warnings but do not fail the build
- Missing/non-numeric values display as dash "---" with muted text color
- Computed metrics (Gross Margin %, etc.) return null when any input is missing -- display "---"
- Parsers output null for missing/invalid values, components handle display logic
- Structured console log with sections: tabs discovered, companies found, month range, per-company metrics/row counts
- Include per-company detail: "AllRx: 12 months, 8 metrics, 142 expense rows"
- Console/build log only -- not visible in deployed dashboard (Phase 3 adds "Data as of" timestamp)

### Claude's Discretion
- Validation function placement (separate module vs integrated into parsers)
- Console log formatting and color choices
- Error aggregation strategy (collect all vs fail on first category)
- Test fixture design for validation edge cases

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-05 | Dashboard validates sheet data at build time using schemas -- build fails loudly if sheet structure is invalid | Validation module pattern, error aggregation, critical vs optional headers identified from parser analysis |
| DATA-06 | Dashboard gracefully handles missing or malformed cell values without crashing charts (shows error indicators instead) | Null-safe parser updates, "---" display pattern for components, computed metric null propagation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.0 | Test framework | Already installed and configured in project |
| next | 14.2.15 | Build system | Build failure = thrown error in server component |
| recharts | 2.12.7 | Charts | Already used; needs null-safe data formatting |

### Supporting
No new libraries needed. This phase is pure JavaScript validation logic, console logging, and null-safe data handling. Everything builds on the existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written validation | zod/joi schema library | Overkill -- we're validating sheet structure (row patterns), not JSON shapes. A few focused functions are simpler and have zero bundle/dep cost |
| console.log manifest | pino/winston structured logger | Unnecessary for build-time-only logging. console.log is visible in Vercel build logs |

## Architecture Patterns

### Recommended Project Structure
```
lib/data/
  validate.js        # NEW: sheet structure validation functions
  parsePnL.js        # MODIFY: standardize null for non-numeric values
  parseCashflow.js   # MODIFY: same null standardization
  parseExpenses.js   # MODIFY: null for missing/invalid amounts
  index.js           # MODIFY: add validate step + build manifest logging
  types.js           # MODIFY: add ValidationError/ValidationResult types
```

### Pattern 1: Collect-All-Errors Validation
**What:** Validation runs across all tabs, collecting every error into an array. Only after scanning everything does it throw (if errors exist). Warnings are logged but don't throw.
**When to use:** Always -- this is a locked decision from CONTEXT.md.
**Example:**
```javascript
/**
 * @typedef {Object} ValidationError
 * @property {'error'|'warning'} severity
 * @property {string} tab - 'P&L', 'Cashflow', or 'Expenses'
 * @property {string} message - Human-readable description
 */

/**
 * Validates all raw sheet data before parsing.
 * @param {{ pnlRows: any[][], cashflowRows: any[][], expenseRows: any[][] }} raw
 * @returns {{ errors: ValidationError[], warnings: ValidationError[] }}
 */
export function validateSheetData({ pnlRows, cashflowRows, expenseRows }) {
  const errors = [];
  const warnings = [];

  // Validate each tab
  validatePnLStructure(pnlRows, errors, warnings);
  validateCashflowStructure(cashflowRows, errors, warnings);
  validateExpenseStructure(expenseRows, errors, warnings);

  return { errors, warnings };
}
```

### Pattern 2: Null-Coercion in Parsers
**What:** Every numeric value extracted from a cell goes through a coercion function that returns `null` for anything non-numeric (empty string, undefined, NaN, text in a number cell).
**When to use:** In all three parsers when reading cell values.
**Example:**
```javascript
/**
 * Coerce a cell value to a number or null.
 * @param {any} val - Raw cell value from Sheets API
 * @returns {number|null}
 */
function toNumberOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}
```

### Pattern 3: Build Manifest Logging
**What:** After successful validation and parsing, fetchAllData logs a structured manifest to console. Uses console.log with clear section headers.
**When to use:** At the end of fetchAllData, after all data is parsed.
**Example:**
```javascript
function logBuildManifest(data) {
  console.log('\n=== Build Manifest ===');
  console.log(`Tabs: P&L, Cashflow, Expenses`);
  console.log(`Companies: ${data.companies.join(', ')}`);
  console.log(`Fetched at: ${data.fetchedAt}`);
  console.log('');
  // Per-company details
  for (const company of data.companies) {
    const pnlCo = data.pnl.find(c => c.name === company);
    const cfCo = data.cashflow.find(c => c.name === company);
    const expCount = data.expenses.filter(e => e.company === company).length;
    const metrics = pnlCo ? Object.keys(pnlCo.metrics).length : 0;
    const months = pnlCo?.metrics?.Revenue?.length ?? 0;
    console.log(`  ${company}: ${months} months, ${metrics} P&L metrics, ${expCount} expense rows`);
  }
  console.log('=== End Manifest ===\n');
}
```

### Anti-Patterns to Avoid
- **Throwing on first error:** User explicitly wants all errors collected before failing. Never `throw` inside a validation loop.
- **Validating inside parsers:** Validation is a separate pre-parse pass. Parsers should assume structure is valid (validation already ran). Parsers handle individual cell nulls, not structural issues.
- **Hardcoding metric names as "required":** Some companies lack "Cost of Sales" / "Gross Margin" -- this is expected. Only truly universal metrics (Revenue, EBITDA) should be flagged as warnings if missing from a company that the parsers find.
- **Using `Number(val) || 0` for amounts:** This silently converts missing data to 0, which is exactly what we're trying to avoid. Use `toNumberOrNull` and let components show "---".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation library | Custom JSON schema validator | Plain functions checking row structure | The validation is about sheet layout (headers exist, month columns present), not data shape validation. Simple conditional checks are clearer than a schema DSL for this use case |
| Structured logging framework | Custom log formatter | console.log with template literals | Build-time only, Vercel captures stdout. No need for log levels, transports, or JSON formatting |

**Key insight:** This phase is fundamentally about adding guard rails to an existing pipeline, not building infrastructure. Keep it simple -- validation functions are just functions that inspect arrays and return errors.

## Common Pitfalls

### Pitfall 1: Expense Parser Silently Coerces Missing Amounts to 0
**What goes wrong:** Current `parseExpenses` uses `Number(rawAmount) || 0` which converts missing/invalid amounts to 0. This masks data problems -- a $0 expense looks valid but isn't.
**Why it happens:** The `|| 0` fallback was a quick implementation choice.
**How to avoid:** Change to `toNumberOrNull(rawAmount)`. Components must handle null amounts.
**Warning signs:** Expense totals that seem too low, or $0 line items in the data.

### Pitfall 2: Month Columns Returning Empty Array Silently
**What goes wrong:** `detectMonthColumns` returns `[]` if no month headers match, and parsers return `[]` (no companies). The build succeeds with empty data instead of failing.
**Why it happens:** Empty array is truthy, so `if (monthColumns.length === 0) return []` doesn't throw.
**How to avoid:** Validation step checks for `monthColumns.length > 0` before parsers run. If zero months found, it's a structural error.
**Warning signs:** Dashboard loads but shows no data.

### Pitfall 3: Validation Errors Not Surfacing in Vercel Build
**What goes wrong:** If validation throws but the error isn't in the build output, Vercel may show a generic "build failed" message.
**Why it happens:** Error messages can get truncated or wrapped.
**How to avoid:** Use a clear, single-line error format. Prefix with `[DATA VALIDATION]` so it's searchable in build logs. Throw an Error with all validation errors joined by newlines.
**Warning signs:** Build fails but the developer can't tell why from the Vercel dashboard.

### Pitfall 4: Expense Header Validation Missing Required Columns
**What goes wrong:** `parseExpenses` has `REQUIRED_COLUMNS` but `buildColumnMap` silently returns a partial map if headers are missing. Accessing `colMap['Company']` returns `undefined`, leading to broken data.
**Why it happens:** No check that all REQUIRED_COLUMNS were found in the header.
**How to avoid:** Validation step checks that all REQUIRED_COLUMNS exist in the expense header row. Report each missing column as an error.
**Warning signs:** Expense rows with empty company/category fields.

### Pitfall 5: Recharts Crashing on null/undefined in Data Arrays
**What goes wrong:** Recharts components may throw or render incorrectly if data arrays contain null values without proper configuration.
**Why it happens:** Recharts expects numeric values by default. Null handling requires using the `connectNulls` prop on Line/Area charts, or filtering data.
**How to avoid:** When building chart data from parsed results, null values should be preserved (not converted to 0). Recharts Line/Area components should use `connectNulls={false}` to show gaps. For Bar charts, null bars simply don't render (desired behavior). KPI cards and tables use the "---" display pattern.
**Warning signs:** Charts with unexpected $0 bars or connected lines through missing data points.

## Code Examples

### Validated fetchAllData Flow
```javascript
export async function fetchAllData() {
  // 1. Fetch raw data (existing code)
  const [mainRanges, expenseRows] = await Promise.all([...]);
  const pnlRows = mainRanges[0]?.values ?? [];
  const cashflowRows = mainRanges[1]?.values ?? [];

  // 2. Validate structure (NEW)
  const { errors, warnings } = validateSheetData({ pnlRows, cashflowRows, expenseRows });

  // Log warnings (non-fatal)
  for (const w of warnings) {
    console.warn(`[DATA WARNING] ${w.tab}: ${w.message}`);
  }

  // Throw on errors (fatal -- fails the build)
  if (errors.length > 0) {
    const msg = errors.map(e => `[DATA VALIDATION] ${e.tab}: ${e.message}`).join('\n');
    throw new Error(`Sheet validation failed:\n${msg}`);
  }

  // 3. Parse (existing code, updated for null values)
  const pnl = parsePnL(pnlRows);
  const cashflow = parseCashflow(cashflowRows);
  const expenses = parseExpenses(expenseRows);

  // 4. Build manifest (NEW)
  const data = { pnl, cashflow, expenses, companies, fetchedAt };
  logBuildManifest(data);

  return data;
}
```

### Null-Safe Value Display in Components
```jsx
// Utility for displaying monetary values that may be null
function formatValue(value) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">---</span>;
  }
  return fmt(value);  // existing formatter
}

// In a KPI card or table cell:
<TableCell>{formatValue(metric.value)}</TableCell>
```

### P&L Validation Function
```javascript
function validatePnLStructure(rows, errors, warnings) {
  if (!rows || rows.length === 0) {
    errors.push({ severity: 'error', tab: 'P&L', message: 'Tab is empty or missing' });
    return;
  }

  // Check month columns exist
  const monthCols = detectMonthColumns(rows[0]);
  if (monthCols.length === 0) {
    errors.push({ severity: 'error', tab: 'P&L', message: 'No month columns found in header row (expected "Mon YYYY" format)' });
    return;
  }

  // Check at least one company block exists
  let companyCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[1] && !row[2]) companyCount++;
  }
  if (companyCount === 0) {
    errors.push({ severity: 'error', tab: 'P&L', message: 'No company blocks found (expected company name in column B with empty column C)' });
  }
}
```

### Expense Header Validation
```javascript
function validateExpenseStructure(rows, errors, warnings) {
  if (!rows || rows.length < 2) {
    errors.push({ severity: 'error', tab: 'Expenses', message: 'Tab has no data rows (need header + at least 1 row)' });
    return;
  }

  const header = rows[0];
  const REQUIRED = ['Company', 'Category', 'Department', 'GL',
    'USD Equivalent Amount', 'Year', 'Month', 'Merchant Name'];

  for (const col of REQUIRED) {
    if (!header.includes(col)) {
      errors.push({ severity: 'error', tab: 'Expenses', message: `Missing required header column '${col}'` });
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Number(val) \|\| 0` for missing | `toNumberOrNull(val)` returning null | This phase | Prevents silent $0 masking missing data |
| No validation, silent empty data | Pre-parse validation with collected errors | This phase | Build fails with actionable error messages |
| No build logging | Structured manifest in console | This phase | CFO can verify data discovery from build logs |

## Open Questions

1. **Which P&L metrics are truly "required" vs "optional" per company?**
   - What we know: Revenue and EBITDA exist for all companies in fixtures. Cost of Sales / Gross Margin are optional (Curenta lacks them).
   - What's unclear: Should missing Revenue or EBITDA be an error or warning? CONTEXT.md says "metric labels that parsers depend on" are critical.
   - Recommendation: Revenue and EBITDA as errors if missing from any company block. All other metrics as warnings. This is a Claude's Discretion area.

2. **How does the Dashboard component currently consume data?**
   - What we know: Dashboard.jsx is a 535-line monolithic component with hardcoded data. Phase 3 replaces it with dynamic data. The `data` prop is passed from page.jsx but Dashboard.jsx still uses hardcoded arrays.
   - What's unclear: How much of the "---" display logic needs to be in this phase vs Phase 3?
   - Recommendation: This phase should add a `formatValue` utility and ensure parsers emit null. The actual Dashboard component updates for null-safe rendering will overlap with Phase 3's display integration work. Focus on: (a) a shared `formatValue` helper, (b) parser null-safety, (c) document the contract that components must handle null.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.js |
| Quick run command | `npx vitest run tests/data/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-05 | Validation throws on missing P&L month columns | unit | `npx vitest run tests/data/validate.test.js -t "month columns"` | No - Wave 0 |
| DATA-05 | Validation throws on missing expense headers | unit | `npx vitest run tests/data/validate.test.js -t "expense headers"` | No - Wave 0 |
| DATA-05 | Validation throws on empty/missing tabs | unit | `npx vitest run tests/data/validate.test.js -t "empty"` | No - Wave 0 |
| DATA-05 | Validation collects all errors before throwing | unit | `npx vitest run tests/data/validate.test.js -t "collect all"` | No - Wave 0 |
| DATA-05 | Optional metrics produce warnings not errors | unit | `npx vitest run tests/data/validate.test.js -t "warning"` | No - Wave 0 |
| DATA-05 | fetchAllData integrates validation before parsing | unit | `npx vitest run tests/data/fetchAll.test.js -t "validation"` | No - extend existing |
| DATA-06 | parsePnL returns null for non-numeric cells | unit | `npx vitest run tests/data/parsePnL.test.js -t "null"` | Partial - existing test for trailing nulls |
| DATA-06 | parseExpenses returns null for missing amounts (not 0) | unit | `npx vitest run tests/data/parseExpenses.test.js -t "null"` | No - extend existing |
| DATA-06 | Build manifest logs companies and metrics | unit | `npx vitest run tests/data/fetchAll.test.js -t "manifest"` | No - extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/data/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/data/validate.test.js` -- covers DATA-05 validation logic (new file)
- [ ] `tests/fixtures/invalidRows.js` -- fixtures for missing headers, empty tabs, non-numeric cells
- [ ] Extend `tests/data/fetchAll.test.js` -- add validation integration and manifest tests
- [ ] Extend `tests/data/parsePnL.test.js` -- add non-numeric cell null coercion tests
- [ ] Extend `tests/data/parseExpenses.test.js` -- add null amount tests

## Sources

### Primary (HIGH confidence)
- Project source code: `lib/data/*.js`, `tests/data/*.test.js`, `tests/fixtures/*.js` -- direct inspection of current implementation
- `vitest.config.js` and `package.json` -- verified test framework version 4.1.0
- CONTEXT.md -- locked decisions from user discussion

### Secondary (MEDIUM confidence)
- Recharts null handling: based on Recharts API where Line/Area components accept `connectNulls` prop and Bar charts skip null values naturally. This is well-established behavior in recharts 2.x.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything builds on existing code
- Architecture: HIGH -- patterns derived directly from existing codebase analysis and locked decisions
- Pitfalls: HIGH -- identified from direct code inspection (e.g., `Number(rawAmount) || 0` in parseExpenses line 69)

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- no external dependencies changing)
