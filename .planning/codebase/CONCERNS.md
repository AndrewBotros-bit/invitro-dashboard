# Codebase Concerns

**Analysis Date:** 2026-03-12

## Tech Debt

**Hardcoded Financial Data:**
- Issue: All financial data is hardcoded directly in the component. No API integration or data source abstraction.
- Files: `invitro-dashboard/components/Dashboard.jsx` (535 lines), `invitro-dashboard-1/components/Dashboard.jsx` (535 lines)
- Impact: Manual data updates required. No real-time data. Cannot scale to multiple data sources. Updates require code changes and redeployment.
- Fix approach: Create a data abstraction layer with API/database integration. Extract hardcoded data into a data service (`lib/services/financialData.ts`) or connect to Google Sheets API as referenced in comments.

**Duplicate Project Structures:**
- Issue: Two nearly identical projects (`invitro-dashboard/` and `invitro-dashboard-1/`) with identical code, dependencies, and file structures.
- Files: Both directories contain full duplicate implementations with no meaningful differences.
- Impact: Maintenance burden. Changes must be made in both places. Increased confusion about which is the canonical version.
- Fix approach: Consolidate to single project. Delete `invitro-dashboard-1/` directory. Determine single canonical deployment target.

**Monolithic Component Design:**
- Issue: Entire dashboard is a single 535-line component with hardcoded data, formatters, colors, and all chart definitions inline.
- Files: `invitro-dashboard/components/Dashboard.jsx`
- Impact: Difficult to test individual features. Hard to reuse chart patterns. Makes performance optimization difficult. Component is at 535 lines when best practices suggest max 150-200 lines per component.
- Fix approach: Extract sub-components for each tab (OverviewTab, RevenueTab, ProfitabilityTab, CashFlowTab, InsightsTab). Extract utility functions (formatters, chart configs). Create separate KPI and Insight card components already partially extracted but inline.

**Hard-coded Currency Formatting:**
- Issue: Multiple hardcoded format functions (`fmt`, `fmtShort`, `pct`) are defined inline in Dashboard component rather than in shared utilities.
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 13-23
- Impact: Duplication if charts need to be used elsewhere. Inconsistent formatting if changed. Not testable in isolation.
- Fix approach: Move formatters to `lib/formatters.ts` and export as shared utilities. Import where needed.

## Security Considerations

**Sensitive Financial Data in Code:**
- Risk: Complete financial data for all portfolio companies is committed to version control. Numbers include revenue, EBITDA, cash balances, and internal forecasts.
- Files: `invitro-dashboard/components/Dashboard.jsx` (lines 35-69 contain hardcoded financial numbers), hardcoded in git history
- Current mitigation: None visible. Data is in plaintext JSX.
- Recommendations: (1) Move all financial data to a backend API with authentication. (2) Use environment variables for sensitive numeric data. (3) Never commit actual financial data to version control. (4) If data must live in code during development, segregate to a `.gitignore`'d config file or environment file.

**Exposed Financial Metadata:**
- Risk: Dashboard footer and headers contain references to data sources: "Source: InVitro Capital Consolidated - Actual". This may leak information about internal reporting structure.
- Files: `invitro-dashboard/components/Dashboard.jsx` line 192
- Current mitigation: None
- Recommendations: Use environment-driven attribution metadata. Make data source citations configurable rather than hardcoded.

## Performance Bottlenecks

**Large Component Bundle Size:**
- Problem: Single 535-line component importing recharts (which is a large library), all UI components, and bundling all financial data in memory.
- Files: `invitro-dashboard/components/Dashboard.jsx`
- Cause: No code splitting. All charts and tabs rendered even when not visible. No lazy loading of recharts.
- Improvement path: (1) Lazy load recharts components. (2) Use React.lazy() for tab content. (3) Split Dashboard into separate route-based chunks (e.g., `/dashboard/revenue`, `/dashboard/profitability`).

**Inefficient Re-renders on Interactivity:**
- Problem: Entire 535-line Dashboard component re-renders when any tab is switched (via Tabs state).
- Files: `invitro-dashboard/components/Dashboard.jsx` line 204 (Tabs state triggers full re-render)
- Cause: No memoization of non-interactive content. Charts and data are recalculated on every render.
- Improvement path: Memoize derived data calculations. Use `useMemo()` for monthly derived data (lines 72-103). Memoize non-interactive UI sections.

**Hardcoded Data Initialization:**
- Problem: All financial data and derived calculations happen at render time (e.g., line 172: `consolidatedRevGrowth` calculated on every render).
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 172-175
- Cause: No caching or static analysis.
- Improvement path: Pre-compute derived metrics at build time or cache them. Move to `useMemo()` for runtime calculations.

## Missing Critical Features

**No Test Coverage:**
- What's missing: Zero test files found. No unit tests for formatters, no integration tests for data display, no snapshot tests for charts.
- Files: No `*.test.js`, `*.spec.js` found in either project
- Risk: Chart displays could break silently. Number formatting could produce incorrect output. Regression risk high on any refactoring.
- Priority: High

**No Linting or Code Style Configuration:**
- What's missing: No `.eslintrc`, `prettier` config, `biome.json`, or code style enforcement.
- Files: No linting configuration found
- Risk: Code quality inconsistency. Future contributors may follow different patterns.
- Priority: Medium

**No Error Boundaries:**
- What's missing: If recharts fails to render a chart, entire dashboard crashes.
- Files: `invitro-dashboard/components/Dashboard.jsx`
- Risk: Unhandled chart errors could render app unusable.
- Priority: Medium

**No Data Validation:**
- What's missing: All hardcoded financial data is used as-is with no validation. Bad data structure will crash chart renders.
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 35-69
- Risk: Data entry errors are silent until chart rendering fails.
- Priority: Medium

## Fragile Areas

**Chart Data Structure Assumptions:**
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 335-343 (revenue by month chart), lines 394-407 (EBITDA by month chart)
- Why fragile: Chart rendering assumes exact data structure. If hardcoded data structure changes, charts break with cryptic recharts errors.
- Safe modification: (1) Extract chart data schemas as TypeScript types. (2) Add runtime validation with zod or similar. (3) Write tests for each chart's expected data shape.
- Test coverage: No existing tests. Cannot safely refactor data structure.

**Color Constants Without Validation:**
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 26-30 (const C = { ... colors ... })
- Why fragile: Colors are arbitrary hex strings. No consistency check. If color is mistyped, no validation catches it until render.
- Safe modification: Define color palette as TypeScript enum with validation. Use Tailwind classes instead of inline hex values where possible.
- Test coverage: None

**Manual Date Calculations:**
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 462-466 (cash runway forecast inline arrow function)
- Why fragile: Complex forecast logic embedded in arrow function. If burn rate or balance changes, calculations could be incorrect. No formula tests.
- Safe modification: Extract to `lib/utils/forecasting.ts` with unit tests. Add parameter validation.
- Test coverage: None

## Dependencies at Risk

**Recharts Version Specificity:**
- Risk: Recharts is locked to `^2.12.7` (allowing 2.12.7 through 2.x). No upper bound. Next major version (v3) could introduce breaking changes.
- Impact: If recharts 3.0 releases with API changes, charts could break without notice.
- Migration plan: (1) Add explicit upper bound in package.json to `^2.12.7 <3.0`. (2) Set up CI to check for new major versions. (3) Plan v3 migration when stable.

**Outdated Next.js Version:**
- Risk: Next.js 14.2.15 is not the latest stable. Future versions may change CSS/image handling, breaking the build.
- Impact: Security patches may be missed. Performance improvements unavailable.
- Migration plan: Evaluate upgrading to Next.js 15.x after testing. Use `next upgrade` command carefully and test all charts.

**No Version Pinning in some Dependencies:**
- Risk: `react@^18.3.1` and `react-dom@^18.3.1` allow minor/patch updates. While generally safe, could introduce unexpected behavior.
- Impact: Builds may be non-deterministic if lockfile is lost/regenerated.
- Migration plan: Ensure `package-lock.json` (or `yarn.lock`/`pnpm-lock.yaml`) is always committed and used.

## Scaling Limits

**Hardcoded Monthly Data Array Size:**
- Current capacity: 12 months of data hardcoded per company (5 companies = 60 data points)
- Limit: Cannot easily scale to quarterly/weekly/daily data or multiple years
- Scaling path: Move to date-indexed data structure. Use date math to aggregate/disaggregate. Query data from API by date range.

**Single-Page Component Rendering:**
- Current capacity: Dashboard renders all tabs' content at once even if hidden
- Limit: Adding new tabs or charts will increase bundle size and initial render time
- Scaling path: Implement route-based tab pages or lazy-loaded tab content with React.lazy()

## Test Coverage Gaps

**No Unit Tests for Formatters:**
- What's not tested: `fmt()`, `fmtShort()`, `pct()` functions have no test coverage. Edge cases like negative numbers, zero, very large numbers not tested.
- Files: `invitro-dashboard/components/Dashboard.jsx` lines 13-23
- Risk: Number formatting could produce incorrect display (e.g., "$NaN", "$undefinedM") without anyone noticing.
- Priority: High

**No Component Snapshot or Rendering Tests:**
- What's not tested: Whether charts render without errors. Whether tabs switch properly. Whether numbers display correctly on screen.
- Files: `invitro-dashboard/components/Dashboard.jsx`
- Risk: Visual regressions go unnoticed. Breaking changes only caught in manual QA or user reports.
- Priority: High

**No Integration Tests with Recharts:**
- What's not tested: Whether recharts actually renders with the provided data structure. Whether tooltips work. Whether responsive container resizes properly.
- Files: `invitro-dashboard/components/Dashboard.jsx` (all chart code)
- Risk: Charts could fail to render in production with subtle data or browser issues.
- Priority: Medium

**No Accessibility Tests:**
- What's not tested: Charts have alt text. Color contrast meets WCAG standards. Keyboard navigation works for tabs.
- Files: `invitro-dashboard/components/Dashboard.jsx` (entire file)
- Risk: Dashboard not accessible to visually impaired users.
- Priority: Medium

---

*Concerns audit: 2026-03-12*
