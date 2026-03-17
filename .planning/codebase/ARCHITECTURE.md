# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** Next.js App Router with client-side rendered financial dashboard

**Key Characteristics:**
- Single-page application (SPA) built with Next.js 14.2.15 and React 18.3.1
- Client-side rendering for interactive visualizations and tabbed interface
- Embedded financial data (no external API integration)
- Component-driven UI architecture with composable chart and card components
- Tailwind CSS for styling with dark theme (slate-800/slate-900 background)
- Data sourced from Google Sheets ("InVitro Capital Consolidated - Actual")

## Layers

**Page Layer:**
- Purpose: Next.js App Router entry point and layout configuration
- Location: `app/`
- Contains: Root layout metadata, main page component
- Depends on: Component layer, styling layer
- Used by: Next.js framework

**Component Layer:**
- Purpose: Reusable UI components and the main dashboard container
- Location: `components/`
- Contains: `Dashboard.jsx` (main component), UI primitives (Card, Tabs, Badge, Table)
- Depends on: Recharts for visualizations, Tailwind CSS for styling
- Used by: Page layer

**Utility Layer:**
- Purpose: Shared helpers and CSS class merging utilities
- Location: `lib/utils.js`
- Contains: `cn()` function for merging Tailwind classes
- Depends on: clsx and tailwind-merge packages
- Used by: UI components

**Data Layer:**
- Purpose: Embedded financial datasets hardcoded in Dashboard component
- Location: Embedded in `components/Dashboard.jsx` (lines 35-103)
- Contains: Monthly revenue, EBITDA, cash flow, annual summaries for all portfolio companies
- Depends on: None (static data)
- Used by: Dashboard component for rendering charts and KPI cards

**Styling Layer:**
- Purpose: Design system configuration and global styles
- Location: `app/globals.css`, `tailwind.config.js`
- Contains: CSS custom properties (color palette, border radius), Tailwind theme extensions
- Depends on: Tailwind CSS framework
- Used by: All components via className props

## Data Flow

**Dashboard Initialization:**

1. User requests `/` → Next.js routes to `app/page.jsx`
2. `page.jsx` renders `InVitroDashboard` component
3. Dashboard component initializes with hardcoded financial data objects
4. Derives computed datasets (monthly trends, YoY comparisons, watch metrics)
5. Renders tabbed interface with overview, revenue, profitability, cashflow, insights tabs
6. User interacts with tabs to switch views (client-side state only)

**Financial Data Computation:**

1. Raw monthly data arrays in `monthly2026` object (line 35-41)
2. Annual summary in `annual` object (lines 43-60)
3. Cash flow data in `cashflow2026` object (lines 62-69)
4. Derived datasets computed on render (lines 72-103):
   - `revenueByMonth`: Stacked monthly revenue by company
   - `ebitdaByMonth`: Monthly EBITDA trends
   - `cashBalanceByMonth`: Cash flows with balance
   - `companyEbitda2026`: EBITDA contribution breakdown
   - `revenuePie`: Revenue distribution by company

**Visualization Rendering:**

1. Charts use Recharts components (BarChart, LineChart, PieChart, AreaChart, ComposedChart)
2. Custom tooltip (`CustomTooltip` component, lines 106-118) formats values with formatters
3. Color constants object (`C`, lines 26-30) ensures consistent color mapping across charts
4. Responsive containers adapt charts to viewport width

**State Management:**

- Tabs: Internal state managed via React Context in `components/ui/tabs.jsx`
- Dashboard: No global state management (Zustand, Redux not used)
- Computed values calculated on every render (no memoization)
- KPI calculations (revenue growth, cash runway, EBITDA swing) performed inline

## Key Abstractions

**Formatter Functions:**

- Purpose: Standardize numerical display across dashboard
- Examples: `fmt()`, `fmtShort()`, `pct()`
- Pattern: Pure functions that scale and format numbers (millions to dollars/percentages)
- Used in: Chart tooltips, KPI cards, table cells

**Color Constants Object (C):**

- Purpose: Centralized color palette for company-specific visualization consistency
- Examples: `C.allrx`, `C.allcare`, `C.osta`, `C.needles`, `C.invitro`
- Pattern: Object map of company names to hex color codes
- Used in: Every chart, badge, and company indicator component

**UI Primitive Components:**

- Purpose: Reusable, composable building blocks with consistent styling
- Examples: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Tabs`, `TabsTrigger`, `Badge`, `Table`
- Pattern: Wrapper components using `cn()` utility to merge Tailwind classes
- Used in: Composed into larger dashboard sections

**Sub-Components:**

- Purpose: Specialized components for recurring patterns
- Examples: `KPICard` (lines 120-137), `InsightCard` (lines 139-150)
- Pattern: React functional components that accept props for flexible reuse
- Used in: KPI section at top of tabs, Insights tab insights list

**Data Shape Objects:**

- Purpose: Organize raw financial data by company and time period
- Examples: `monthly2026`, `annual`, `cashflow2026`, `companies`, `watchMetrics`
- Pattern: Objects with nested arrays/metrics keyed by company name
- Used in: Chart data, table rows, computed metrics

## Entry Points

**App Entry (Next.js):**
- Location: `app/page.jsx`
- Triggers: HTTP GET to `/`
- Responsibilities: Renders root layout and `InVitroDashboard` component

**Dashboard Component:**
- Location: `components/Dashboard.jsx`
- Triggers: Page component imports and renders it
- Responsibilities: Hosts all financial data, tab routing logic, renders all visualizations, KPIs, and insights

**Layout Root:**
- Location: `app/layout.jsx`
- Triggers: Wraps all pages
- Responsibilities: Sets metadata (title, description), includes global styles, renders HTML structure

## Error Handling

**Strategy:** No explicit error handling

**Patterns:**
- No try/catch blocks in component code
- No error boundaries
- No validation of data structure
- Assumes all data shapes are correct and complete

**Implications:**
- Missing data property would cause runtime error
- Chart rendering failures would crash the page
- No graceful degradation for malformed data

## Cross-Cutting Concerns

**Logging:** Not implemented (no console.log calls for debugging)

**Validation:** Not implemented (data assumed valid)

**Authentication:** Not implemented (dashboard is public, no auth required)

**Caching:** Browser cache only (no API caching strategy)

**Performance:** No code splitting, dynamic imports, or lazy loading (all components bundled together)

---

*Architecture analysis: 2026-03-12*
