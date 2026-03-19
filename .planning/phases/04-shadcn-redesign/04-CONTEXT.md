# Phase 4: shadcn redesign - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the Dashboard.jsx UI composition using native shadcn components with proper layout, alignment, and light theme polish. All data logic, chart configurations, and business logic remain unchanged — this is purely a UI/layout/component-composition pass.

</domain>

<decisions>
## Implementation Decisions

### Layout & Grid
- Replace ALL `flex flex-wrap` KPI rows with `grid grid-cols-2 lg:grid-cols-4 gap-4` to eliminate orphan 4th-card wrapping
- Increase vertical rhythm between sections: use `space-y-8` between major sections (KPIs → Charts → Table), `gap-4` within
- Revenue tab: replace 9-card KPI wall with a compact shadcn `Table` (columns: Company, Revenue, YoY %, Share %)

### Component Composition
- KPICard: restructure to use `Card` > `CardHeader` (title) > `CardContent` (value + trend) instead of cramming everything in CardContent
- Section headings (Company Performance, Executive Insights): wrap in `Card` > `CardHeader` > `CardTitle` + `CardDescription` instead of raw h2/p
- InsightCards: replace custom div with shadcn `Alert` + `AlertTitle` + `AlertDescription` (install `alert` component)
- InsightCard icons: replace emoji (🔴, 💰) with Lucide React icons (`AlertTriangle`, `TrendingDown`, `DollarSign`, `Info`)
- "Last Updated" in header: replace Card wrapper with plain text or `Badge variant="secondary"`
- Company color dots in table: increase from `w-2 h-2` to `w-3 h-3` for visibility

### Tabs
- Fix TabsList containment — it's currently floating and overlapping chart content on scroll. Ensure it's inside the normal document flow, not position-breaking

### Charts
- Remove `className="text-sm"` override from all `CardTitle` elements — let shadcn default sizing work
- Add `CardDescription` subtitles to chart cards (e.g., "excl. Holdings", "All companies")
- Add empty state for charts with no data: `CardContent` with centered muted text "No data available for {year}"
- Increase Y-axis label width from `width={100}` to `width={120}` on horizontal bar charts to prevent company name truncation
- Replace hardcoded chart fills (`#94a3b8`, `#3b82f6`, `#22c55e`, `#ef4444`) with CSS custom properties (`--chart-1` through `--chart-5`) where possible
- Increase bar fillOpacity from 0.4 to 0.6 on Cash Flow chart for better visibility on white background
- Add right padding to Cash Flow dual-axis chart to prevent right Y-axis label overlap

### Font
- Fix Geist font loading in layout.jsx — the globals.css `font-family: -apple-system...` line may be overriding Geist. Ensure Geist Sans is the primary font.

### Data Display
- Show "N/A" instead of "---" for null percentage values (Gross Margin)
- Catch nonsensical negative runway months and display "N/A" instead of "-48.0 months"

### Claude's Discretion
- Exact spacing values for vertical rhythm
- Whether to add zebra striping to table rows
- Legend handling for charts with >5 series (vertical legend, top-5 only, or scrollable)
- Whether to install `separator` and `collapsible` shadcn components or solve with simpler approaches

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above from the design audit conducted in this session.

### Audit Source
- Design audit was conducted by screenshotting all 5 tabs (Overview, Revenue, Profitability, Cash Flow, Insights) via Playwright and analyzing layout/component/alignment issues

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/card.jsx` — Native shadcn Card with CardHeader, CardTitle, CardDescription, CardContent, CardFooter (just installed)
- `components/ui/table.jsx` — Native shadcn Table with all sub-components (just installed, uses p-2 padding)
- `components/ui/tabs.jsx` — Native shadcn Tabs with Radix primitives (just installed)
- `components/ui/badge.jsx` — Native shadcn Badge with CVA variants (just installed)
- `components/ui/button.jsx` — Native shadcn Button (installed during init)
- `lib/formatters.js` — `fmt`, `fmtShort`, `pct` formatting utilities
- `lib/chartHelpers.js` — `buildColorMap`, `buildMonthlySeries`, `EXCLUDE_COMPANIES`, `PALETTE`
- `lib/insights.js` — `generateInsights` function

### Components to Install
- `alert` — for InsightCards replacement
- `lucide-react` — for professional severity icons (may already be a dep)

### Established Patterns
- All chart logic is in `components/Dashboard.jsx` (~618 lines, single monolithic client component)
- Chart styling via `CHART_STYLE` constant object at top of file
- Custom sub-components: `KPICard`, `InsightCard`, `CustomTooltip` defined inline
- CSS custom properties for theming defined in `app/globals.css` (oklch-based light theme)
- `--chart-1` through `--chart-5` already defined in globals.css

### Integration Points
- `app/layout.jsx` — Font configuration (Geist)
- `app/globals.css` — Theme variables, font-family declaration
- `components/Dashboard.jsx` — All UI changes happen here (single file)
- `lib/formatters.js` — `pct()` function needs to return "N/A" for null instead of "---"

</code_context>

<specifics>
## Specific Ideas

- User explicitly said "looks like AI slop" — the goal is a clean, professional financial dashboard, not a generic template
- User wants "native light shadcn with whites, greys and blacks" — no custom color variants, no dark theme
- The CFO is the primary user — dashboard should look like a proper financial report, not a startup SaaS product
- Keep all current layouts intact — only change component styling, alignment, and composition

</specifics>

<deferred>
## Deferred Ideas

- CLNP-02 (from REQUIREMENTS.md): Refactoring the monolithic Dashboard.jsx into smaller components — this phase improves composition within the single file but doesn't split it
- Print-friendly CSS / PDF export (PLSH-01)
- Time period selector (PLSH-02)

</deferred>

---

*Phase: 04-shadcn-redesign*
*Context gathered: 2026-03-19*
