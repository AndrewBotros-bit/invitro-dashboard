# Phase 1: Data Pipeline - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect to Google Sheets via service account and fetch financial data at build time from multiple sheets. Parser discovers companies dynamically using header-based parsing (no hardcoded names or column positions). Data model supports a 3-layer drill-down dashboard architecture.

</domain>

<decisions>
## Implementation Decisions

### Data Sources

Three Google Sheets feed the dashboard (two connected in Phase 1, one deferred):

1. **Main consolidated sheet** (`1WR8yukXZKtVlJgQcIuv410Lg-6kkjsRWoCz-CqZoG1c`)
   - **P&L tab**: Revenue, Cost of Sales, Gross Profit, Gross Margin %, SG&A + R&D Expenses, Direct EBITDA, Studio Expense, EBITDA, Operational/Investment/Net Cash Flow — per company, monthly columns
   - **Cashflow tab**: Cash Inflow, Cash Outflow, Operational/Investment/Net Cash Flow — per company, monthly columns
   - Layout: Column B = company name, Column C = metric label, Columns E+ = monthly values (Jan 2022 onward)
   - Companies appear as row groups separated by blank rows

2. **Expense breakdown sheet** (`1Kn5aKs1H81UVKyuMCk1ipmg5SP-DrDMDwKtqWXxLd2g`)
   - **Row Data (2026) tab**: Transaction-level expense rows (7,242 rows)
   - 19 columns: Type, Category, Original Month, Transaction date, Original Amount, Posted Date, USD Equivalent Amount, Budget or Limit, User, Department, Merchant Name, GL, Account, Company, Year, Month, Month Order, Cashflow Amount, Cashflow Date
   - Key dimensions: Category (HC/NON-HC), Department (G&A, GTM, Operations, R&D, Direct Cost), GL (67 accounts), Company (6 entities)

3. **Revenue breakdown sheet** — NOT YET READY. Will contain per-company KPIs and ARPU. Pipeline should be designed so this can be added later without restructuring.

### Time Range
- Dashboard shows **2025 and 2026** data (for YoY comparisons)
- P&L/Cashflow tabs contain data back to Jan 2022 — pipeline filters to 2025+

### Company Name Mapping
P&L tab names are canonical. Explicit mapping for cross-sheet joins:

| Canonical Name (P&L) | Expense Sheet Name |
|---|---|
| AllRx | AllRX |
| Curenta | Curenta Technology LLC |
| InVitro Studio | InVitro Studio, LLC |
| AllCare | AllCare |
| Osta | Osta LLC |
| Needles | Needles |
| AllRX Holding | *(P&L only — no expense data)* |
| Confider | *(P&L only — no expense data)* |
| Yalent | *(P&L only — no expense data)* |
| InVitro Holding | *(P&L only — no expense data)* |

All 10 companies included. 4 companies (AllRX Holding, Confider, Yalent, InVitro Holding) appear only in P&L — they have Layer 1 data but no expense drill-down.

### Direct Cost Department
- "Direct Cost" in the expense sheet maps to **COGS / Cost of Sales** — it is NOT part of the SG&A expense breakdown
- Layer 2 expense drill-down shows 4 departments: G&A, GTM, Operations, R&D
- Direct Cost feeds into Gross Margin calculation in Layer 1

### Dashboard Layer Architecture (data model must support)

**Layer 1 — Consolidated** (from P&L + Cashflow tabs):
- P&L: Revenue, Gross Margin, Expenses (SG&A + R&D), EBITDA
- Cash Flow: Inflows, Outflows, Cash Burn, Cash Balance — by Operating, Investment, Financing
- Two views: consolidated total AND per-company breakdown (toggle)

**Layer 2 — Breakdowns** (from expense sheet + future revenue sheet):
- Expenses: Headcount vs Non-Headcount, split by department (G&A, GTM, Ops, R&D)
- Revenue: Per-company KPIs + ARPU *(deferred — revenue sheet not ready)*

**Layer 3 — GL Detail** (from same expense sheet):
- Expense type by department at GL account level
- Drill path: Total Expenses → Department → HC/NON-HC → GL accounts

### Build Failure Behavior
- If Google Sheets API is unreachable or credentials are wrong, **build fails hard** with a clear error message
- No fallback to cached/stale data — investors must never see outdated numbers without knowing

### Claude's Discretion
- Google API client library choice (googleapis vs google-auth-library)
- Data fetching approach (server components, build script, getStaticProps equivalent)
- Internal data model shape and TypeScript types
- Caching strategy during build (if multiple sheet reads needed)
- How to handle the P&L tab's varying line items per company

</decisions>

<specifics>
## Specific Ideas

- The P&L tab has different line items per company (AllRx has Cost of Sales/Gross Margin, Curenta doesn't). Parser must handle variable row structures per company block.
- Expense sheet amounts are in "USD Equivalent Amount" column with formatting (spaces, commas) — parser must clean these.
- P&L tab uses comma-formatted numbers with some negative values using minus prefix.
- "Gorss Margin, %" appears to be a typo in the sheet — parser should match by normalized/fuzzy header names or exact current text.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/` — Card, Tabs, Badge, Table components ready for reuse
- `lib/utils.js` — `cn()` utility for Tailwind class merging
- Format helpers in Dashboard.jsx (`fmt()`, `fmtShort()`, `pct()`) — should be extracted to shared module

### Established Patterns
- Next.js App Router (not Pages Router) — data fetching should use server components or route handlers
- All imports use `@/` alias (jsconfig.json)
- Tailwind CSS with dark theme (slate-800/slate-900)
- JavaScript (not TypeScript) — no type definitions currently

### Integration Points
- `components/Dashboard.jsx` lines 35-103: hardcoded data objects that the pipeline output must replace
- `components/Dashboard.jsx` lines 26-30: color constants object `C` keyed by hardcoded company names — needs to become dynamic
- `app/page.jsx`: entry point that renders Dashboard — may need to pass fetched data as props or use server component pattern

</code_context>

<deferred>
## Deferred Ideas

- Revenue breakdown sheet (per-company KPIs + ARPU) — waiting for sheet to be created, will be added as a data source in a future phase or as a Phase 1 extension
- Configurable time range selector (monthly/quarterly/annual toggle) — tracked as PLSH-02 in v2 requirements

</deferred>

---

*Phase: 01-data-pipeline*
*Context gathered: 2026-03-12*
