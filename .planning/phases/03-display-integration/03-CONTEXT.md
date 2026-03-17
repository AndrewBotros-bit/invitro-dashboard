# Phase 3: Display Integration - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all dashboard charts, KPIs, and tables to render from the live Google Sheets data pipeline output (`data` prop). Replace all hardcoded financial data in Dashboard.jsx. Add dynamic company colors, auto-populated build timestamp, auto-generated insights, and a CFO redeploy workflow via Vercel deploy hook.

</domain>

<decisions>
## Implementation Decisions

### CFO Redeploy Workflow
- Use a **Vercel deploy hook** URL as the primary redeploy mechanism
- Store hook URL as a **server-side env var** (`VERCEL_DEPLOY_HOOK_URL`) — never exposed to the browser
- Add a small **"Refresh Data" link in the dashboard footer** — visible to everyone but triggers via a Next.js API route that proxies to the deploy hook server-side
- On click, show an **inline confirmation toast** ("Rebuild triggered!") — no page navigation
- The API route reads the env var and POSTs to the Vercel hook — client never sees the URL

### Insights Tab
- **Auto-generate all insight cards from data patterns** — no hardcoded narrative text
- Generate four categories of insights:
  1. **Growth highlights** — flag companies with notable YoY revenue growth
  2. **Profitability milestones** — detect when a company crosses EBITDA breakeven
  3. **Risk flags** — flag companies where losses persist despite revenue growth, or cost structure isn't scaling
  4. **Cash runway projection** — calculate months of runway from ending balance and average burn rate
- **Dynamic count** — show all insights that apply (could be 3 or 10 depending on the data)
- **Remove the "Key Metrics to Watch" table** — the manually-set targets can't be derived from sheet data; defer to v2 (possibly via a dedicated 'Targets' sheet)
- Keep the existing `InsightCard` component with its type-based color coding (positive, warning, danger, info)

### Dynamic Company Colors
- Define a **fixed palette of 10-12 visually distinct colors** suited for the dark theme
- Assign colors **deterministically by sorting company names alphabetically** and mapping to palette positions
- Same company always gets the same color regardless of which companies are present in a given build

### Company Exclusion Logic
- **Hardcoded exclusion list** for holding/parent entities (e.g., 'InVitro Holding', 'InVitro Studio', 'AllRX Holding')
- Excluded companies are **omitted from revenue and portfolio breakdown charts** but may appear in EBITDA charts where relevant
- Matches the existing dashboard pattern of "excl. InVitro Studio" annotations

### Claude's Discretion
- KPI card content and which KPIs appear on each tab — derive from available data metrics
- YoY trend calculations and how growth percentages are computed from the data
- Chart data transformation logic — how `CompanyPnL[]` and `CompanyCashflow[]` map to Recharts data arrays
- Insight generation thresholds (e.g., what % growth counts as "notable")
- Color palette selection (specific hex values for the 10-12 color palette)
- Whether to keep the Cash Runway Forecast chart (currently uses hardcoded projection logic)
- How to handle the 2025 vs 2026 YoY comparison when year boundaries come from dynamic data

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and the following project files:

### Data pipeline
- `.planning/phases/01-data-pipeline/01-CONTEXT.md` — Data source structure, company mapping, 3-layer architecture, sheet layout details
- `lib/data/types.js` — TypeScript-style JSDoc types for DashboardData, CompanyPnL, CompanyCashflow, ExpenseRow

### Validation
- `.planning/phases/02-data-validation/02-01-SUMMARY.md` — Validation module design and null-safe parser updates
- `lib/data/validate.js` — Schema validation and warning generation

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-03, DISP-01, DISP-02, DISP-03, INFR-02 are the Phase 3 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/Dashboard.jsx` — Monolithic component with all chart definitions; already accepts `data` prop (line 160) but ignores it. All charts use Recharts (Area, Bar, Composed, Line, Pie). Contains `KPICard`, `InsightCard`, `CustomTooltip` sub-components that can be reused.
- `lib/formatters.js` — `fmt()`, `fmtShort()`, `pct()` already null-safe (return '---' for null/undefined)
- `components/ui/` — Card, Tabs, Badge, Table components ready for reuse
- `lib/data/companyMapping.js` — Canonical company name mapping (P&L names to expense sheet names)

### Established Patterns
- Next.js App Router: `app/page.jsx` is an async server component that calls `fetchAllData()` and passes result as `data` prop
- Dark theme with HSL CSS custom properties in `globals.css`
- Recharts chart configuration pattern: `ResponsiveContainer` → Chart → Grid/Axes/Tooltip → Series with company-keyed `dataKey`
- `@/*` path alias for all imports

### Integration Points
- `app/page.jsx:4-6` — Already wired: `const data = await fetchAllData(); return <InVitroDashboard data={data} />`
- `components/Dashboard.jsx:160` — `export default function InVitroDashboard({ data })` — prop is received but unused
- `lib/data/index.js:63` — `data.fetchedAt` already contains ISO timestamp for DISP-01
- `lib/data/index.js:61` — `data.companies` already contains sorted union of all company names for DISP-02
- New API route needed at `app/api/deploy/route.js` for the deploy hook proxy

</code_context>

<specifics>
## Specific Ideas

- The existing `const C` color map (line 14-18) with company slug keys should be replaced by the deterministic palette system
- Lines 24-157 of Dashboard.jsx (all hardcoded data + derived arrays) should be entirely replaced by transformations of the `data` prop
- The `InsightCard` component's type system (positive/warning/danger/info) maps well to the four insight categories: growth=positive, milestones=positive, risks=warning/danger, runway=danger/warning
- The footer at line 516-520 has a hardcoded "Generated March 2026" that should use `data.fetchedAt`
- The header "Last Updated" card at line 184-188 is hardcoded "March 12, 2026" — should use `data.fetchedAt`

</specifics>

<deferred>
## Deferred Ideas

- "Key Metrics to Watch" table with manually-set targets — could return in v2 with a dedicated 'Targets' tab in the Google Sheet
- Component refactoring of the monolithic Dashboard.jsx into smaller files — tracked as CLNP-02 in v2 requirements
- Revenue breakdown sheet integration (per-company KPIs + ARPU) — waiting for sheet creation

</deferred>

---

*Phase: 03-display-integration*
*Context gathered: 2026-03-17*
