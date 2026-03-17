# Phase 3: Display Integration - Research

**Researched:** 2026-03-17
**Domain:** Next.js App Router data wiring, Recharts chart rendering, dynamic color systems, Vercel deploy hooks
**Confidence:** HIGH

## Summary

Phase 3 replaces all hardcoded financial data in `Dashboard.jsx` (lines 14-157) with transformations of the `data` prop already passed from the server component. The existing Recharts charts, KPICard, and InsightCard sub-components are reusable -- only their data sources change. The phase also adds a deterministic company color palette, auto-populated build timestamp from `data.fetchedAt`, auto-generated insight cards, and a CFO redeploy workflow via a Next.js API route proxying to a Vercel deploy hook.

The codebase is well-prepared: `app/page.jsx` already passes `data` from `fetchAllData()`, the `data` prop is declared but unused in `Dashboard.jsx`, `data.fetchedAt` and `data.companies` are already populated, and all formatters are null-safe. The primary engineering work is data transformation (mapping `CompanyPnL[]` and `CompanyCashflow[]` into Recharts-compatible arrays) and insight generation logic.

**Primary recommendation:** Decompose into logical waves: (1) color system + data transformation utilities, (2) wire each tab's charts to live data, (3) auto-generated insights, (4) deploy hook API route + footer/header timestamp. Keep everything in `Dashboard.jsx` per deferred CLNP-02 -- no component refactoring.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use a **Vercel deploy hook** URL as the primary redeploy mechanism
- Store hook URL as a **server-side env var** (`VERCEL_DEPLOY_HOOK_URL`) -- never exposed to the browser
- Add a small **"Refresh Data" link in the dashboard footer** -- visible to everyone but triggers via a Next.js API route that proxies to the deploy hook server-side
- On click, show an **inline confirmation toast** ("Rebuild triggered!") -- no page navigation
- The API route reads the env var and POSTs to the Vercel hook -- client never sees the URL
- **Auto-generate all insight cards from data patterns** -- no hardcoded narrative text
- Generate four categories of insights: growth highlights, profitability milestones, risk flags, cash runway projection
- **Dynamic count** -- show all insights that apply
- **Remove the "Key Metrics to Watch" table** -- defer to v2
- Keep the existing `InsightCard` component with its type-based color coding
- Define a **fixed palette of 10-12 visually distinct colors** suited for the dark theme
- Assign colors **deterministically by sorting company names alphabetically** and mapping to palette positions
- **Hardcoded exclusion list** for holding/parent entities (e.g., 'InVitro Holding', 'InVitro Studio', 'AllRX Holding')
- Excluded companies omitted from revenue/portfolio charts but may appear in EBITDA charts

### Claude's Discretion
- KPI card content and which KPIs appear on each tab -- derive from available data metrics
- YoY trend calculations and how growth percentages are computed from the data
- Chart data transformation logic -- how `CompanyPnL[]` and `CompanyCashflow[]` map to Recharts data arrays
- Insight generation thresholds (e.g., what % growth counts as "notable")
- Color palette selection (specific hex values for the 10-12 color palette)
- Whether to keep the Cash Runway Forecast chart (currently uses hardcoded projection logic)
- How to handle the 2025 vs 2026 YoY comparison when year boundaries come from dynamic data

### Deferred Ideas (OUT OF SCOPE)
- "Key Metrics to Watch" table with manually-set targets -- v2 with dedicated 'Targets' sheet
- Component refactoring of monolithic Dashboard.jsx into smaller files -- tracked as CLNP-02
- Revenue breakdown sheet integration (per-company KPIs + ARPU) -- waiting for sheet creation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-03 | Dashboard dynamically renders charts and KPIs for whatever companies exist in the sheet | Data transformation patterns that iterate `data.pnl` and `data.cashflow` arrays dynamically; company exclusion list for revenue charts |
| DISP-01 | Dashboard auto-populates "Last Updated" timestamp from build time | `data.fetchedAt` already contains ISO timestamp; use `new Date(data.fetchedAt).toLocaleDateString()` in header and footer |
| DISP-02 | Dashboard assigns consistent colors to dynamically discovered companies | Deterministic palette system: sort `data.companies` alphabetically, map to fixed color array by index |
| DISP-03 | All existing chart types render correctly from sheet data | Replace all hardcoded data arrays (lines 24-157) with transformations of `data` prop; preserve existing Recharts chart configurations |
| INFR-02 | CFO can trigger manual redeploy to refresh data from sheet | Next.js API route at `app/api/deploy/route.js` proxying POST to Vercel deploy hook URL from env var |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.15 | App Router, API routes, server components | Already in use; API Route Handlers for deploy hook |
| recharts | 2.15.4 | All chart rendering | Already in use; all existing charts use it |
| react | 18.3.1 | UI framework | Already in use |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | 2.1.1 + 2.5.2 | Conditional CSS class merging | Already used via `cn()` in `lib/utils.js` |
| tailwindcss | 3.4.13 | Styling | All component styling |

### No New Dependencies Needed

This phase requires NO new packages. Everything is achievable with:
- Recharts (already installed) for all charts
- Next.js App Router Route Handlers for the deploy hook API
- Native `fetch()` in the API route to POST to Vercel deploy hook
- Native `Date` for timestamp formatting

## Architecture Patterns

### Recommended Changes to Existing Structure
```
components/
  Dashboard.jsx          # Modify: replace hardcoded data with data prop transformations
lib/
  chartHelpers.js        # NEW: color palette, data transformation, company exclusion
  insights.js            # NEW: auto-generated insight logic
app/
  api/
    deploy/
      route.js           # NEW: Vercel deploy hook proxy
```

### Pattern 1: Data Transformation Layer
**What:** Pure functions that transform `CompanyPnL[]` / `CompanyCashflow[]` into Recharts-compatible flat arrays
**When to use:** Every chart needs data in `[{ month: "Jan", CompanyA: 123, CompanyB: 456 }]` format
**Example:**
```javascript
// Source: Derived from existing data structures in lib/data/types.js
/**
 * Transform CompanyPnL[] into Recharts monthly series data.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName - e.g., "Revenue", "EBITDA"
 * @param {string[]} excludeCompanies - Companies to omit
 * @returns {Array<{month: string, [companyName]: number|null}>}
 */
function buildMonthlySeries(pnlData, metricName, excludeCompanies = []) {
  const filtered = pnlData.filter(c => !excludeCompanies.includes(c.name));
  // Get all unique months from first company's metric
  const allMonths = filtered[0]?.metrics[metricName] ?? [];

  return allMonths.map(mv => {
    const point = { month: shortMonthLabel(mv.month, mv.year) };
    for (const company of filtered) {
      const val = company.metrics[metricName]?.find(
        v => v.year === mv.year && v.month === mv.month
      );
      point[company.name] = val?.value ?? null;
    }
    return point;
  });
}
```

### Pattern 2: Deterministic Company Color Assignment
**What:** Sort company names alphabetically, assign from fixed palette by index
**When to use:** Every chart that shows company-level data
**Example:**
```javascript
const PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#eab308', // yellow
];

/**
 * Build a company->color map from a sorted company list.
 * Same company always gets same color if the full company list is stable.
 */
function buildColorMap(companies) {
  const sorted = [...companies].sort();
  const map = {};
  sorted.forEach((name, i) => {
    map[name] = PALETTE[i % PALETTE.length];
  });
  return map;
}
```

### Pattern 3: Next.js API Route Handler (App Router)
**What:** Server-side route that proxies POST to Vercel deploy hook
**When to use:** INFR-02 requirement
**Example:**
```javascript
// app/api/deploy/route.js
export async function POST() {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return Response.json({ error: 'Deploy hook not configured' }, { status: 500 });
  }

  const res = await fetch(hookUrl, { method: 'POST' });
  if (!res.ok) {
    return Response.json({ error: 'Deploy hook failed' }, { status: 502 });
  }

  return Response.json({ ok: true });
}
```

### Pattern 4: Insight Generation from Data Patterns
**What:** Functions that analyze `CompanyPnL[]` and `CompanyCashflow[]` to produce insight objects
**When to use:** Insights tab
**Example:**
```javascript
/**
 * @typedef {Object} Insight
 * @property {string} type - 'positive' | 'warning' | 'danger' | 'info'
 * @property {string} icon
 * @property {string} title
 * @property {string} body
 */

function generateInsights(data) {
  const insights = [];
  // Growth highlights: companies with >50% YoY revenue growth
  // Profitability milestones: EBITDA crossing from negative to positive
  // Risk flags: persistent losses despite revenue growth
  // Cash runway: months of runway from ending balance / avg burn
  return insights;
}
```

### Anti-Patterns to Avoid
- **Hardcoding company names in chart JSX:** Use `data.companies` and iterate dynamically. The `<Area>`, `<Bar>`, `<Line>` components should be generated from the company list, not listed individually.
- **Importing data modules at component level:** All data comes through the `data` prop. No direct imports of sheet data.
- **Mutating the data prop:** All transformations should produce new arrays, never modify `data` in place.
- **Client-side data fetching:** The deploy hook API route is the only runtime fetch. All dashboard data is build-time via the server component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Month label formatting | Custom month formatter | `new Date(year, month-1).toLocaleDateString('en-US', {month:'short'})` | Handles locale, short names |
| Date formatting for timestamp | Manual string formatting | `new Date(isoString).toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'})` | Consistent, locale-aware |
| Chart color cycling | Manual if/else per company | Palette array with modulo index | Scales to any number of companies |
| Number formatting | New formatters | Existing `fmt()`, `fmtShort()`, `pct()` from `lib/formatters.js` | Already null-safe and tested |
| Tooltip rendering | New tooltip component | Existing `CustomTooltip` component | Already styled for dark theme |

## Common Pitfalls

### Pitfall 1: Recharts Dynamic Series with Null Values
**What goes wrong:** Recharts renders null values as gaps in Area/Line charts but as zero in stacked Bar charts. Mixed behavior confuses the visual.
**Why it happens:** Recharts treats `null` and `undefined` differently from `0`. In stacked charts, `null` can break the stack.
**How to avoid:** For stacked charts, convert `null` to `0`. For line/area charts, keep `null` to show gaps. Use `connectNulls={true}` on Line/Area if you want interpolation instead of gaps.
**Warning signs:** Missing bars in stacked charts, NaN in tooltips.

### Pitfall 2: Company Name Mismatch Between P&L and Charts
**What goes wrong:** The `dataKey` in Recharts must exactly match the property name in the data object. If the company name from `data.pnl` is "AllRx" but the data transformation creates a key "Allrx", the chart shows nothing.
**Why it happens:** String case sensitivity, trimming issues.
**How to avoid:** Use `company.name` consistently as both the object key during transformation and the `dataKey` in chart components. Never transform company names in the chart layer.
**Warning signs:** Empty chart series, console warnings about missing keys.

### Pitfall 3: Recharts ResponsiveContainer Must Have Explicit Parent Height
**What goes wrong:** Charts collapse to 0 height or render at wrong size.
**Why it happens:** `ResponsiveContainer` measures its parent. If the parent has no explicit height, it computes 0.
**How to avoid:** The existing code already wraps each `ResponsiveContainer` with `height={260}` etc. Keep this pattern.
**Warning signs:** Charts not visible after data wiring.

### Pitfall 4: Client Component "use client" Serialization Boundary
**What goes wrong:** Passing non-serializable data (functions, Date objects, Symbols) from server component to client component causes a runtime error.
**Why it happens:** Next.js App Router serializes props across the server/client boundary.
**How to avoid:** The `data` object from `fetchAllData()` contains only plain objects, arrays, strings, numbers, and null. The `fetchedAt` is an ISO string, not a Date object. This is already correct -- just don't add non-serializable fields.
**Warning signs:** "Error: Only plain objects can be passed to Client Components" in build output.

### Pitfall 5: Stale Closure in Deploy Hook Toast State
**What goes wrong:** The "Rebuild triggered!" toast shows stale state or doesn't update.
**Why it happens:** React state updates in event handlers can have stale closure issues if using `setTimeout` or `async`.
**How to avoid:** Use simple `useState` for toast visibility. Set `true` on click, `setTimeout(() => setToast(false), 3000)` for auto-dismiss.
**Warning signs:** Toast persists or never appears.

### Pitfall 6: YoY Calculation When Only One Year Exists
**What goes wrong:** Division by zero or NaN when computing year-over-year growth with only 2026 data and no 2025.
**Why it happens:** The sheet might have partial year data. The data pipeline returns whatever months exist.
**How to avoid:** Check that both years have data before computing YoY. If prior year revenue is 0 or missing, show "N/A" or "New" instead of a percentage. Guard all division operations.
**Warning signs:** NaN or Infinity displayed in KPI cards.

### Pitfall 7: Company Exclusion Must Be Case-Sensitive
**What goes wrong:** Exclusion list says "InVitro Studio" but data has "InVitro studio" (different case).
**Why it happens:** Canonical names come from the sheet, which the CFO types manually.
**How to avoid:** Use exact canonical names from `data.companies`. The exclusion list should match the canonical names from `companyMapping.js`. Consider case-insensitive comparison as a safety measure.
**Warning signs:** Excluded companies still appearing in charts.

## Code Examples

### Wiring the Data Prop -- Overview Tab KPIs
```javascript
// Inside InVitroDashboard({ data })
// Build color map once
const colorMap = buildColorMap(data.companies);
const excludeList = ['InVitro Holding', 'InVitro Studio', 'AllRX Holding'];

// Compute annual totals from monthly P&L data
function annualTotal(pnlData, metricName, year, exclude = []) {
  return pnlData
    .filter(c => !exclude.includes(c.name))
    .reduce((sum, company) => {
      const yearValues = (company.metrics[metricName] ?? [])
        .filter(v => v.year === year);
      const companyTotal = yearValues.reduce((s, v) => s + (v.value ?? 0), 0);
      return sum + companyTotal;
    }, 0);
}

const currentYear = Math.max(...data.pnl.flatMap(c =>
  Object.values(c.metrics).flat().map(v => v.year)
));
const priorYear = currentYear - 1;

const totalRevCurrent = annualTotal(data.pnl, 'Revenue', currentYear, excludeList);
const totalRevPrior = annualTotal(data.pnl, 'Revenue', priorYear, excludeList);
const revGrowth = totalRevPrior > 0 ? (totalRevCurrent - totalRevPrior) / totalRevPrior : null;
```

### Dynamic Recharts Series Generation
```javascript
// Generate <Area> components dynamically from company list
const revenueCompanies = data.pnl
  .filter(c => !excludeList.includes(c.name))
  .map(c => c.name);

// In JSX:
// <AreaChart data={revenueByMonth}>
//   {revenueCompanies.map((name, i) => (
//     <Area key={name} type="monotone" dataKey={name}
//       stackId="1" stroke={colorMap[name]} fill={colorMap[name]} fillOpacity={0.6} />
//   ))}
// </AreaChart>
```

### Vercel Deploy Hook API Route
```javascript
// app/api/deploy/route.js
export async function POST() {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return Response.json(
      { error: 'Deploy hook not configured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      return Response.json({ error: 'Hook returned error' }, { status: 502 });
    }
    return Response.json({ ok: true, message: 'Rebuild triggered' });
  } catch (err) {
    return Response.json({ error: 'Failed to reach deploy hook' }, { status: 502 });
  }
}
```

### Client-Side Deploy Trigger
```javascript
// Inside Dashboard.jsx, in the footer section
const [deploying, setDeploying] = useState(false);
const [deployMsg, setDeployMsg] = useState(null);

async function handleDeploy() {
  setDeploying(true);
  try {
    const res = await fetch('/api/deploy', { method: 'POST' });
    const json = await res.json();
    setDeployMsg(res.ok ? 'Rebuild triggered!' : json.error);
  } catch {
    setDeployMsg('Failed to trigger rebuild');
  }
  setDeploying(false);
  setTimeout(() => setDeployMsg(null), 3000);
}
```

### Insight Generation Sketch
```javascript
function generateGrowthInsights(pnl, currentYear, priorYear, excludeList) {
  const insights = [];
  for (const company of pnl) {
    if (excludeList.includes(company.name)) continue;
    const revMetric = company.metrics['Revenue'] ?? [];
    const curRev = revMetric.filter(v => v.year === currentYear).reduce((s, v) => s + (v.value ?? 0), 0);
    const priorRev = revMetric.filter(v => v.year === priorYear).reduce((s, v) => s + (v.value ?? 0), 0);
    if (priorRev > 0) {
      const growth = (curRev - priorRev) / priorRev;
      if (growth > 0.5) { // >50% growth is "notable"
        insights.push({
          type: 'positive', icon: '\uD83D\uDCC8',
          title: `${company.name} revenue grew ${(growth * 100).toFixed(0)}% YoY`,
          body: `Revenue increased from ${fmt(priorRev)} to ${fmt(curRev)}.`,
        });
      }
    }
  }
  return insights;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded data arrays in component | Build-time fetched data via server component prop | Phase 1-2 (pipeline built) | Phase 3 completes the wiring |
| Static color map keyed by slug | Deterministic palette from sorted company list | Phase 3 (this phase) | Colors work for any company set |
| Hardcoded "March 12, 2026" timestamp | `data.fetchedAt` ISO string from build time | Phase 3 (this phase) | Auto-updates on each build |
| Manual insight text | Auto-generated from data patterns | Phase 3 (this phase) | Insights stay current with data |

## Open Questions

1. **Which companies appear in the actual sheet as holding/parent entities?**
   - What we know: CONTEXT.md lists 'InVitro Holding', 'InVitro Studio', 'AllRX Holding' as examples
   - What's unclear: Whether these exact names appear in `data.companies` or if there are others
   - Recommendation: Define the exclusion list, but log a warning during build if an excluded company isn't found in the data (helps catch renames)

2. **What metric names exist in the P&L sheet beyond the known ones?**
   - What we know: Fixtures show Revenue, Cost of Sales, Gross Profit, Gorss Margin %, SG&A Expenses, EBITDA
   - What's unclear: Full list of metric names across all companies (some may have R&D, etc.)
   - Recommendation: Data transformations should work with "Revenue" and "EBITDA" as the key metrics; other metrics can be displayed if present but not relied upon

3. **Cash Runway Forecast chart -- keep or drop?**
   - What we know: Currently uses hardcoded projection logic (linear burn extrapolation)
   - What's unclear: Whether this is useful enough to auto-generate from data
   - Recommendation: Keep it -- derive ending balance and avg monthly burn from cashflow data. It provides actionable runway visibility. Use same approach as current code but with dynamic data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-03 | Dynamic chart data transformation | unit | `npx vitest run tests/lib/chartHelpers.test.js -x` | No -- Wave 0 |
| DISP-01 | Timestamp auto-populated from fetchedAt | unit | `npx vitest run tests/lib/chartHelpers.test.js -x` | No -- Wave 0 |
| DISP-02 | Deterministic color assignment | unit | `npx vitest run tests/lib/chartHelpers.test.js -x` | No -- Wave 0 |
| DISP-03 | All chart types render from data | smoke | `npm run build` (build succeeds = charts compile) | Existing |
| INFR-02 | Deploy hook API route | unit | `npx vitest run tests/api/deploy.test.js -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npm run build`
- **Phase gate:** Full suite green + successful build before verification

### Wave 0 Gaps
- [ ] `tests/lib/chartHelpers.test.js` -- covers DATA-03, DISP-01, DISP-02 (color map, data transformations, annual totals, month labels)
- [ ] `tests/lib/insights.test.js` -- covers insight generation logic (growth, milestones, risks, runway)
- [ ] `tests/api/deploy.test.js` -- covers INFR-02 (API route behavior with/without env var)
- [ ] `tests/fixtures/dashboardData.js` -- shared fixture providing a complete `DashboardData` object for chart helper and insight tests

## Sources

### Primary (HIGH confidence)
- Project source code: `components/Dashboard.jsx`, `lib/data/index.js`, `lib/data/types.js`, `app/page.jsx` -- direct inspection of current implementation
- Project fixtures: `tests/fixtures/pnlRows.js`, `tests/fixtures/cashflowRows.js` -- real data structure examples
- CONTEXT.md decisions -- locked user choices for this phase

### Secondary (MEDIUM confidence)
- Recharts API: version 2.15.4 installed, patterns verified from existing working charts in Dashboard.jsx
- Next.js 14.2.15 App Router: Route Handler pattern (`export async function POST()`) is standard for API routes

### Tertiary (LOW confidence)
- Vercel deploy hook behavior (POST returns 2xx on success) -- based on general Vercel documentation knowledge; recommend testing with actual hook URL during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use; no new dependencies
- Architecture: HIGH - data pipeline output types well-documented, existing chart patterns clear, transformation logic straightforward
- Pitfalls: HIGH - identified from direct code inspection of Recharts usage patterns and serialization boundary
- Insight generation: MEDIUM - thresholds and exact logic are Claude's discretion; patterns clear but specific numbers TBD during implementation
- Deploy hook: MEDIUM - API route pattern is standard Next.js, but Vercel deploy hook integration not yet tested

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- all dependencies pinned, no fast-moving targets)
