# Phase 1: Data Pipeline - Research

**Researched:** 2026-03-16
**Domain:** Google Sheets API integration, Next.js build-time data fetching, sheet parsing
**Confidence:** HIGH

## Summary

Phase 1 connects two Google Sheets to the Next.js dashboard at build time, replacing all hardcoded financial data in `Dashboard.jsx` (lines 35-103) with dynamically fetched and parsed data. The existing `lib/googleSheets.js` already provides a working Sheets API client using `googleapis` with JWT service account auth -- this is the correct foundation but needs two changes: (1) switch from `FORMATTED_VALUE` to `UNFORMATTED_VALUE` for numeric parsing, and (2) add `batchGet` support for efficiency.

The core challenge is parsing two very different sheet layouts: the P&L/Cashflow tabs have a company-block structure (company name in column B, metric labels in column C, monthly values in columns E+), while the expense breakdown is a flat transaction table with 19 columns and 7,242 rows. Both require header-based parsing to satisfy DATA-04.

**Primary recommendation:** Build a `lib/data/` module with three parsers (P&L, Cashflow, Expenses), a company name mapper, and a unified data model. Fetch at build time via async server component in `app/page.jsx`. Use `UNFORMATTED_VALUE` for all numeric data to avoid string-to-number conversion issues.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two Google Sheets connected in Phase 1: Main consolidated (`1WR8yukXZKtVlJgQcIuv410Lg-6kkjsRWoCz-CqZoG1c`) with P&L and Cashflow tabs, and Expense breakdown (`1Kn5aKs1H81UVKyuMCk1ipmg5SP-DrDMDwKtqWXxLd2g`) with Row Data (2026) tab
- Revenue breakdown sheet deferred -- not yet ready, pipeline should accommodate future addition
- Dashboard shows 2025 and 2026 data; pipeline filters from Jan 2022+ source to 2025+
- Explicit company name mapping table (10 companies, 4 P&L-only)
- Direct Cost department = COGS, not part of SG&A breakdown
- Build fails hard on API/credential errors -- no fallback to stale data
- Data model must support 3-layer drill-down architecture (Consolidated, Breakdowns, GL Detail)

### Claude's Discretion
- Google API client library choice (googleapis vs google-auth-library) -- RECOMMENDATION: use existing `googleapis` already installed
- Data fetching approach -- RECOMMENDATION: async server component in `app/page.jsx`
- Internal data model shape and types
- Caching strategy during build
- How to handle P&L tab's varying line items per company

### Deferred Ideas (OUT OF SCOPE)
- Revenue breakdown sheet (per-company KPIs + ARPU) -- waiting for sheet to be created
- Configurable time range selector (monthly/quarterly/annual toggle) -- tracked as PLSH-02 in v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Dashboard fetches all financial data from Google Sheet at build time using service account | Existing `lib/googleSheets.js` provides JWT auth client; server component pattern enables build-time fetch; `batchGet` for efficiency |
| DATA-02 | Dashboard dynamically discovers all companies present in the sheet without hardcoded names | P&L tab parser detects company blocks by scanning column B for non-empty cells that aren't metric labels; expense sheet uses `Company` column distinct values |
| DATA-04 | Dashboard uses header-based parsing so column reordering doesn't break it | P&L: find month headers in row 1-3 by date pattern matching; Expense: match column headers by name not index |
| INFR-01 | Service account credentials stored as environment variables only | `.env.local` for dev, deployment env vars for prod; `.gitignore` must include `.env*`; no `NEXT_PUBLIC_` prefix on Google credentials |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | 171.4.0 | Google Sheets API client | Already installed; official Google client; includes sheets v4 API |
| google-auth-library | 10.6.1 | JWT service account auth | Already installed; peer dependency of googleapis |
| next | 14.2.15 | Framework (App Router) | Already installed; server components enable build-time data fetching |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | No additional dependencies required for Phase 1 |

**No new packages need to be installed.** The existing `googleapis` package handles all Google Sheets API interactions. Number parsing and data transformation are straightforward JavaScript operations.

## Architecture Patterns

### Recommended Project Structure
```
lib/
  googleSheets.js          # Existing - low-level Sheets API client (modify)
  data/
    index.js               # Main entry: fetchAllData() orchestrator
    parsePnL.js            # P&L tab parser (company blocks, metrics, monthly values)
    parseCashflow.js        # Cashflow tab parser (same block structure as P&L)
    parseExpenses.js        # Expense breakdown parser (flat table with 19 columns)
    companyMapping.js       # Canonical name mapping across sheets
    types.js               # JSDoc type definitions (project uses JS not TS)
app/
  page.jsx                 # Async server component - calls fetchAllData() at build time
components/
  Dashboard.jsx            # Receives data as props (remove hardcoded data)
```

### Pattern 1: Async Server Component for Build-Time Fetch
**What:** `app/page.jsx` becomes an async server component that fetches data and passes it to the client Dashboard component.
**When to use:** Always -- this is the Next.js App Router pattern for static data.
**Example:**
```javascript
// app/page.jsx
// Source: Next.js App Router docs - server components are async by default
import { fetchAllData } from '@/lib/data';
import InVitroDashboard from '@/components/Dashboard';

export default async function Home() {
  const data = await fetchAllData();
  return <InVitroDashboard data={data} />;
}
```

### Pattern 2: Company Block Detection in P&L Tab
**What:** Scan rows to detect company blocks. Column B contains company names at block boundaries; column C contains metric labels within blocks. Blank rows separate companies.
**When to use:** Parsing the P&L and Cashflow tabs.
**Example:**
```javascript
// Pseudo-code for company block detection
// Row structure: [_, companyOrEmpty, metricLabel, _, jan2022Value, feb2022Value, ...]
function parseCompanyBlocks(rows, headerRow) {
  const monthColumns = detectMonthColumns(headerRow); // find columns by header name
  const companies = [];
  let currentCompany = null;

  for (const row of rows) {
    const colB = (row[1] || '').trim();
    const colC = (row[2] || '').trim();

    if (colB && !colC) {
      // New company block starts
      currentCompany = { name: colB, metrics: {} };
      companies.push(currentCompany);
    } else if (currentCompany && colC) {
      // Metric row within a company block
      const values = monthColumns.map(idx => parseNumber(row[idx]));
      currentCompany.metrics[colC] = values;
    }
  }
  return companies;
}
```

### Pattern 3: Header-Based Column Detection
**What:** Find data columns by matching header row content rather than hardcoded indices.
**When to use:** All sheet parsing, to satisfy DATA-04.
**Example:**
```javascript
// Detect month columns by matching date-like headers
function detectMonthColumns(headerRow) {
  const monthMap = [];
  headerRow.forEach((cell, idx) => {
    // Headers might be "Jan 2025", "2025-01", or Date objects
    const parsed = parseMonthHeader(cell);
    if (parsed) {
      monthMap.push({ index: idx, year: parsed.year, month: parsed.month });
    }
  });
  return monthMap;
}
```

### Pattern 4: batchGet for Efficiency
**What:** Use `spreadsheets.values.batchGet` to fetch multiple tabs in a single API call per spreadsheet.
**When to use:** Fetching P&L + Cashflow tabs from the same spreadsheet.
**Example:**
```javascript
// Source: Google Sheets API reference - batchGet
const response = await sheets.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges: ['P&L!A1:ZZ', 'Cashflow!A1:ZZ'],
  valueRenderOption: 'UNFORMATTED_VALUE',
});
// response.data.valueRanges[0].values = P&L data
// response.data.valueRanges[1].values = Cashflow data
```

### Anti-Patterns to Avoid
- **Hardcoding column indices:** Never use `row[4]` to get January data. Always find the column by matching the header.
- **Using FORMATTED_VALUE for numbers:** The existing code uses `FORMATTED_VALUE` which returns "$1,234.56" as a string. Switch to `UNFORMATTED_VALUE` to get raw `1234.56` numbers.
- **Hardcoding company names in parser logic:** The parser should discover companies from the sheet. The only hardcoded mapping is the cross-sheet name normalization table.
- **Fetching the entire sheet with no range bounds:** Use reasonable ranges like `A1:ZZ` rather than fetching unlimited data. The expense sheet has 7,242 rows -- fetch the whole tab but be aware of payload size.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Sheets API auth | Custom OAuth flow | `google.auth.JWT` from googleapis | Service account JWT is 5 lines; OAuth would need token refresh logic |
| Number parsing from formatted strings | Regex-based currency parser | `UNFORMATTED_VALUE` render option | API returns clean numbers; no parsing needed |
| Sheet tab discovery | API call to list all tabs | Hardcode known tab names in config | Only 3 known tabs; dynamic discovery adds complexity without value |

**Key insight:** The `UNFORMATTED_VALUE` option eliminates the most error-prone part of the pipeline (parsing "$1,234.56" strings). This is a one-line change in the API call that saves an entire parsing layer.

## Common Pitfalls

### Pitfall 1: FORMATTED_VALUE Returns Strings, Not Numbers
**What goes wrong:** Cells formatted as currency return "$1,234.56" strings. Percentage cells return "77%" strings. Math operations fail silently (NaN) or concatenate strings.
**Why it happens:** The existing `lib/googleSheets.js` uses `valueRenderOption: 'FORMATTED_VALUE'`.
**How to avoid:** Switch to `UNFORMATTED_VALUE`. Numbers come back as actual numbers, percentages as decimals (0.77), dates as serial numbers.
**Warning signs:** NaN values in aggregations, strings where numbers expected.

### Pitfall 2: Empty Cells in Sparse Rows
**What goes wrong:** Google Sheets API omits trailing empty cells from rows. A row with data in columns A-C and Z will return an array of length 3, not 26. Accessing `row[25]` returns undefined.
**Why it happens:** API optimization -- trailing empties are stripped.
**How to avoid:** When accessing a column by index, always use `row[idx] ?? 0` or `row[idx] ?? null`. Pad rows to expected length if needed.
**Warning signs:** `undefined` values in month columns, especially for months with no data yet.

### Pitfall 3: Private Key Newline Encoding
**What goes wrong:** Service account private keys contain `\n` literals that environment variable systems serialize differently. The key fails auth.
**Why it happens:** `.env` files, Vercel env vars, and Docker all handle multi-line strings differently.
**How to avoid:** The existing code handles this correctly with `rawKey.replace(/\\n/g, "\n")`. Keep this pattern.
**Warning signs:** "invalid_grant" or "PEM routines" errors during auth.

### Pitfall 4: P&L Tab Has Variable Row Structures Per Company
**What goes wrong:** Parser expects every company to have "Revenue", "Cost of Sales", "Gross Profit", etc. But some companies (like Curenta) don't have "Cost of Sales" or "Gross Margin".
**Why it happens:** Different companies have different financial structures.
**How to avoid:** Parser should collect whatever metrics exist for each company. Don't assert that specific metrics must be present. The data model should use optional fields.
**Warning signs:** Build failures when a company doesn't have an expected metric.

### Pitfall 5: "Gorss Margin, %" Typo in Sheet
**What goes wrong:** Parser looks for "Gross Margin" and doesn't find it because the sheet says "Gorss Margin, %".
**Why it happens:** Typo in the source spreadsheet.
**How to avoid:** Use a normalization function that strips extra whitespace, lowercases, and maps known variants. Or match the exact current text and document it.
**Warning signs:** Missing gross margin data for companies that should have it.

### Pitfall 6: .env Files Not in .gitignore
**What goes wrong:** Service account credentials get committed to git.
**Why it happens:** Current `.gitignore` only has `node_modules`, `.next`, `.vercel` -- no `.env*` pattern.
**How to avoid:** Add `.env*` to `.gitignore` as the very first task of Phase 1.
**Warning signs:** `git status` showing `.env.local` as untracked.

### Pitfall 7: Sheet Tab Names With Special Characters
**What goes wrong:** Tab names may contain spaces or special characters. A1 notation requires quoting: `'P&L'!A1:ZZ` with single quotes around the tab name.
**Why it happens:** Google Sheets API requires single-quoted tab names when they contain spaces, ampersands, etc.
**How to avoid:** Always wrap tab names in single quotes in range strings: `'${tabName}'!A1:ZZ`.
**Warning signs:** "Unable to parse range" API errors.

## Code Examples

### Modifying googleSheets.js for batchGet and UNFORMATTED_VALUE

```javascript
// lib/googleSheets.js - additions
// Source: Google Sheets API reference - batchGet

export async function batchGetSheetValues({ spreadsheetId, ranges }) {
  const sheets = createSheetsClient();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  return response.data.valueRanges ?? [];
}

export async function getExpenseSheetValues(range) {
  const spreadsheetId = getRequiredEnv('INVITRO_EXPENSE_SHEET_ID');
  return getSheetValues({ spreadsheetId, range });
}
```

### Data Model Shape (JSDoc types)

```javascript
// lib/data/types.js
/**
 * @typedef {Object} MonthlyValue
 * @property {number} year
 * @property {number} month - 1-12
 * @property {number|null} value
 */

/**
 * @typedef {Object} CompanyPnL
 * @property {string} name - Canonical company name
 * @property {Object<string, MonthlyValue[]>} metrics
 *   Keys are metric names (e.g., "Revenue", "EBITDA")
 *   Values are arrays of monthly values sorted chronologically
 */

/**
 * @typedef {Object} CompanyCashflow
 * @property {string} name
 * @property {Object<string, MonthlyValue[]>} metrics
 */

/**
 * @typedef {Object} ExpenseRow
 * @property {string} company - Canonical company name (mapped)
 * @property {string} category - "HC" or "NON-HC"
 * @property {string} department - "G&A", "GTM", "Operations", "R&D", "Direct Cost"
 * @property {string} gl - GL account name
 * @property {number} amount - USD equivalent amount
 * @property {number} year
 * @property {number} month - 1-12
 */

/**
 * @typedef {Object} DashboardData
 * @property {CompanyPnL[]} pnl
 * @property {CompanyCashflow[]} cashflow
 * @property {ExpenseRow[]} expenses
 * @property {string[]} companies - All canonical company names discovered
 * @property {string} fetchedAt - ISO timestamp
 */
```

### Environment Variables Required

```bash
# .env.local (for development -- NEVER commit)
GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n"
INVITRO_MAIN_CONSOLIDATED_SHEET_ID=1WR8yukXZKtVlJgQcIuv410Lg-6kkjsRWoCz-CqZoG1c
INVITRO_EXPENSE_SHEET_ID=1Kn5aKs1H81UVKyuMCk1ipmg5SP-DrDMDwKtqWXxLd2g
```

### Company Name Mapping

```javascript
// lib/data/companyMapping.js
// Maps expense sheet company names to canonical P&L names
const EXPENSE_TO_CANONICAL = {
  'AllRX': 'AllRx',
  'Curenta Technology LLC': 'Curenta',
  'InVitro Studio, LLC': 'InVitro Studio',
  'AllCare': 'AllCare',
  'Osta LLC': 'Osta',
  'Needles': 'Needles',
};

export function canonicalName(expenseSheetName) {
  return EXPENSE_TO_CANONICAL[expenseSheetName] || expenseSheetName;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getStaticProps` (Pages Router) | Async server components (App Router) | Next.js 13+ (2023) | No special export needed; just `await` in component body |
| `FORMATTED_VALUE` + string parsing | `UNFORMATTED_VALUE` for raw data | Always available | Eliminates entire parsing layer |
| Single `values.get` per tab | `values.batchGet` for multiple tabs | Always available | Reduces API calls from N to 1 per spreadsheet |

**Deprecated/outdated:**
- `getStaticProps` / `getServerSideProps`: Pages Router only. This project uses App Router.
- The existing `getSheetValues` with `FORMATTED_VALUE` should be replaced or supplemented with `UNFORMATTED_VALUE` variant.

## Open Questions

1. **Exact header row position in P&L and Cashflow tabs**
   - What we know: Month headers are in one of the first few rows, columns E+
   - What's unclear: Exact row number (row 1, 2, or 3?)
   - Recommendation: Parser should scan first 5 rows looking for date-like headers. Can also be verified via `gws sheets` before implementation.

2. **Company block detection heuristic**
   - What we know: Column B has company names, column C has metric labels, blank rows separate blocks
   - What's unclear: Are there edge cases (merged cells, sub-headers, totals rows)?
   - Recommendation: Implementer should fetch actual sheet data with `gws sheets` to examine the exact layout before writing parser. Build in logging for unrecognized rows.

3. **Expense sheet date filtering**
   - What we know: Tab is "Row Data (2026)" suggesting it only contains 2026 data
   - What's unclear: Is there a separate 2025 tab? The P&L tab has data back to 2022.
   - Recommendation: Check for "Row Data (2025)" tab. If expense drill-down is only needed for current year, this may be fine. Design the parser to accept a tab name parameter.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended -- needs install) or Node.js built-in test runner |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | fetchAllData() returns structured data from sheets | integration | `npx vitest run tests/data/fetchAll.test.js -t "fetches data"` | No -- Wave 0 |
| DATA-02 | Parser discovers companies dynamically from row data | unit | `npx vitest run tests/data/parsePnL.test.js -t "discovers companies"` | No -- Wave 0 |
| DATA-04 | Parser finds columns by header name not index | unit | `npx vitest run tests/data/parsePnL.test.js -t "header-based"` | No -- Wave 0 |
| INFR-01 | Missing env vars throw clear errors; no NEXT_PUBLIC_ prefix | unit | `npx vitest run tests/data/env.test.js -t "env validation"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install vitest: `npm install -D vitest`
- [ ] `vitest.config.js` -- configure with path aliases matching jsconfig.json
- [ ] `tests/data/parsePnL.test.js` -- unit tests for P&L parser with mock sheet data
- [ ] `tests/data/parseCashflow.test.js` -- unit tests for cashflow parser
- [ ] `tests/data/parseExpenses.test.js` -- unit tests for expense parser
- [ ] `tests/data/companyMapping.test.js` -- name mapping tests
- [ ] `tests/data/fetchAll.test.js` -- integration test with mocked googleapis
- [ ] `tests/data/env.test.js` -- environment variable validation tests
- [ ] `tests/fixtures/` -- mock sheet data matching real layout for deterministic testing

## Sources

### Primary (HIGH confidence)
- [Google Sheets API batchGet reference](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet) - batchGet parameters, response structure
- [Google Sheets API ValueRenderOption](https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueRenderOption) - FORMATTED_VALUE vs UNFORMATTED_VALUE behavior
- [Next.js App Router data fetching docs](https://nextjs.org/docs/app/getting-started/fetching-data) - async server component pattern
- Installed packages verified: googleapis 171.4.0, google-auth-library 10.6.1, next 14.2.15

### Secondary (MEDIUM confidence)
- [Google Workspace Node.js samples - batchGet](https://github.com/googleworkspace/node-samples/blob/main/sheets/snippets/sheets_batch_get_values.js) - reference implementation pattern
- Existing `lib/googleSheets.js` in project -- working JWT auth pattern verified by code review

### Tertiary (LOW confidence)
- P&L tab exact row layout -- inferred from CONTEXT.md description, needs verification with `gws sheets`
- Expense tab date range assumptions -- tab name suggests 2026 only, needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already installed and verified, API docs reviewed
- Architecture: HIGH - Next.js App Router async server components are the documented pattern; Google Sheets API patterns well-documented
- Pitfalls: HIGH - identified from code review (FORMATTED_VALUE issue, missing .gitignore entries) and API documentation (trailing empty cells, tab name quoting)
- Data model: MEDIUM - based on CONTEXT.md sheet descriptions, not direct sheet inspection

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain -- Google Sheets API and Next.js 14 are mature)
