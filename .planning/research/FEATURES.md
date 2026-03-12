# Feature Research

**Domain:** Investor financial dashboard (venture studio LP/shareholder reporting)
**Researched:** 2026-03-12
**Confidence:** MEDIUM (based on domain expertise and existing codebase analysis; no web search available to verify current competitor landscape)

## Feature Landscape

### Table Stakes (Users Expect These)

Features investors assume exist. Missing these means the dashboard feels unprofessional or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Live data from source of truth** | Investors need to trust numbers are current, not stale hardcoded values. A dashboard showing old data is worse than a spreadsheet. | MEDIUM | Currently hardcoded. Milestone goal: pull from Google Sheet at build time. This is the single most important gap. |
| **Authentication / access control** | Financial data is sensitive. An unprotected URL is a non-starter for real investor distribution. | MEDIUM | Method TBD per PROJECT.md. Even a simple shared password is better than nothing for v1. |
| **"Last updated" indicator** | Investors need to know when data was last refreshed. Builds trust, reduces "is this current?" questions. | LOW | Currently hardcoded date. Should auto-populate from build timestamp or sheet metadata. |
| **Consolidated portfolio overview** | Investors in a venture studio expect to see the full portfolio in one view, not navigate per-company. | LOW | Already exists (Overview tab). Keep and enhance. |
| **Revenue by company** | Revenue is the primary metric investors track. Per-company breakdown is expected for multi-entity portfolios. | LOW | Already exists. Needs to be dynamic based on sheet data. |
| **EBITDA / profitability view** | EBITDA is the standard profitability metric for private companies. Investors expect this front and center. | LOW | Already exists. Needs to be dynamic. |
| **Cash position and runway** | For venture-stage portfolios, cash runway is existential. Investors always want to know "how long can we operate." | LOW | Already exists. Needs to be dynamic. |
| **Year-over-year comparisons** | Investors need to see trajectory, not just snapshots. YoY comparison is the minimum bar for trend analysis. | LOW | Already exists. Needs to handle multi-year data from sheet. |
| **Data validation / error handling** | Bad sheet data (missing values, wrong formats) must not crash the dashboard. Graceful degradation is expected. | MEDIUM | Not yet implemented. Critical for production use -- a broken chart destroys investor confidence. |
| **Print / export to PDF** | Investors and board members share financial reports. They will try to print or screenshot the dashboard. | LOW | Not currently supported. Browser print CSS or a PDF export button. Consider this for v1.1. |

### Differentiators (Competitive Advantage)

Features that set this dashboard apart from "just send them the spreadsheet." These are not expected but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Narrative insights tab** | The existing Insights tab with contextual analysis (growth stories, risk flags, metrics to watch) is genuinely differentiated. Most dashboards show charts without interpretation. This makes the CFO's analysis accessible. | MEDIUM | Already exists but hardcoded. Making this dynamic or semi-automated (template-driven from sheet data) would be high value. |
| **Auto-adapting company list** | Dashboard dynamically renders whatever companies exist in the sheet -- no code changes needed when portfolio changes. Reduces CFO maintenance burden to zero. | MEDIUM | Core milestone goal. Sheet schema drives rendering rather than hardcoded company names. |
| **KPI cards with trend indicators** | Contextual trend badges (up/down arrows, YoY changes) on summary cards help investors quickly assess direction without reading charts. | LOW | Already exists. Ensure these compute dynamically from sheet data. |
| **Cash runway forecast projection** | Forward-looking projection (even simple straight-line) gives investors actionable info about fundraising timeline. Most basic dashboards only show historical data. | LOW | Already exists as a simple burn-rate extrapolation. Keep it simple -- sophisticated models are anti-features. |
| **Mobile-responsive layout** | Investors check on phones. A dashboard that works on mobile without a separate app is a competitive advantage over PDF reports. | LOW | Tailwind responsive classes already in place. Verify and refine. |
| **Configurable time period selector** | Let investors toggle between monthly, quarterly, and annual views. Reduces information overload for board meetings vs. detailed monthly reviews. | MEDIUM | Not yet built. Consider for v1.1 -- useful but not blocking launch. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time / live data sync** | "Why not always show the latest?" | The sheet updates monthly. Real-time adds API cost, complexity, rate limits, and auth token management for zero benefit. Runtime fetching also exposes API keys to the browser. | Build-time fetch. CFO redeploys when sheet is updated. Data is stale by minutes, not months. |
| **Two-way sync (edit from dashboard)** | "Let me update numbers from the dashboard" | The Google Sheet is the source of truth maintained by the CFO. Two-way sync creates merge conflicts, data integrity issues, and audit trail problems. | Keep sheet as single source of truth. Dashboard is read-only by design. |
| **Per-investor personalized views** | "Show each investor only their portfolio companies" | InVitro Capital investors invest in the studio, not individual companies. All investors see the same consolidated view. Per-investor views add auth complexity (user management, role-based access) for a use case that does not exist. | Single shared view for all authorized investors. |
| **Automated scheduled deploys** | "Redeploy every night automatically" | Sheet updates are irregular (monthly, ad-hoc). Automated deploys would mostly be no-ops, and could deploy mid-edit when the sheet is in a broken state. | CFO-triggered manual redeploy. Intentional, not accidental. |
| **Complex forecasting models** | "Add AI-powered financial projections" | Financial modeling belongs in the spreadsheet where the CFO controls assumptions. Dashboard-level forecasting creates a second source of truth and hides assumptions from investors. | Simple straight-line runway projection only (already exists). All real forecasting stays in the sheet. |
| **Email/notification system** | "Notify investors when data updates" | Adds significant infrastructure (email service, subscription management, GDPR concerns). The investor base is small (likely <20 people). | CFO sends a manual email when dashboard is updated. Personal touch is better for this audience size. |
| **Drill-down to transaction level** | "Let me see individual transactions" | Exposes operational detail that is not appropriate for investor-level reporting. Also requires much deeper sheet integration and potentially different data sources. | Keep reporting at monthly aggregation level. Company-level is the lowest appropriate granularity for investors. |
| **Multi-tenant support** | "What if we manage multiple funds?" | Over-engineering for a single venture studio with one consolidated view. Adds database, tenant isolation, and routing complexity. | Single-tenant. If a second fund emerges, fork or add a tab -- do not build a platform. |

## Feature Dependencies

```
[Google Sheets Data Fetch]
    |-- requires --> [Sheet Schema Parsing]
    |                   |-- requires --> [Data Validation]
    |
    |-- enables --> [Dynamic Company List]
    |                   |-- enables --> [Dynamic Charts]
    |                   |-- enables --> [Dynamic KPI Cards]
    |
    |-- enables --> [Auto "Last Updated" Timestamp]

[Authentication]
    |-- independent of --> [Google Sheets Data Fetch]
    |-- blocks --> [Production Investor Access]

[Data Validation]
    |-- enables --> [Graceful Error States]
    |-- enables --> [Missing Data Indicators]

[Dynamic Charts] -- enhances --> [Time Period Selector]

[Print/PDF Export] -- enhances --> [All Chart Views]
                   -- independent of --> [Authentication]
```

### Dependency Notes

- **Google Sheets Data Fetch requires Sheet Schema Parsing:** The sheet structure must be understood and mapped to the dashboard's data model before any data can flow.
- **Dynamic Company List requires Sheet Schema Parsing:** Companies must be discovered from the sheet, not hardcoded. Color assignment must be dynamic (e.g., hash-based or from a palette).
- **Authentication is independent of data fetch:** These can be built in parallel. Auth protects the page; data fetch populates it. Neither blocks the other technically.
- **Data Validation enables Graceful Error States:** Without validation, a missing cell in the sheet crashes a chart. Validation must come before or alongside data fetch.
- **Time Period Selector enhances Dynamic Charts:** Only makes sense once charts render dynamic data. Low priority until core data pipeline works.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to share the dashboard with real investors.

- [x] Consolidated overview with KPI cards -- already exists
- [x] Revenue, Profitability, Cash Flow tabs with charts -- already exists
- [x] Insights tab with narrative analysis -- already exists
- [ ] **Google Sheet data fetch at build time** -- replaces hardcoded data, the core milestone deliverable
- [ ] **Sheet schema parsing with dynamic company discovery** -- dashboard adapts to whatever is in the sheet
- [ ] **Data validation and error handling** -- prevents bad sheet data from crashing charts
- [ ] **Authentication** -- any method (even simple password protection) to gate access
- [ ] **Auto-populated "Last Updated" timestamp** -- from build time, not hardcoded

### Add After Validation (v1.x)

Features to add once investors are actively using the dashboard and providing feedback.

- [ ] **Print-friendly CSS / PDF export** -- add when investors ask "how do I share this with my board"
- [ ] **Time period selector** (monthly/quarterly/annual toggle) -- add when investors say "too much detail" or "not enough detail"
- [ ] **Dynamic insights generation** -- template-driven analysis based on data patterns (e.g., auto-detect which company grew fastest)
- [ ] **Historical data** (2024 and earlier if in sheet) -- add when investors want longer-term trend analysis

### Future Consideration (v2+)

Features to defer until the dashboard is proven and actively used.

- [ ] **Investor onboarding flow** -- only if the investor base grows beyond email-based access sharing
- [ ] **Company deep-dive pages** -- only if investors request per-company detail beyond what the tabs provide
- [ ] **Benchmark comparisons** -- only if the CFO wants to show portfolio performance vs. market benchmarks
- [ ] **API for programmatic access** -- only if downstream systems need to consume the data

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google Sheet data fetch | HIGH | MEDIUM | P1 |
| Sheet schema parsing / dynamic companies | HIGH | MEDIUM | P1 |
| Data validation / error handling | HIGH | LOW | P1 |
| Authentication (any method) | HIGH | LOW-MEDIUM | P1 |
| Auto "Last Updated" timestamp | MEDIUM | LOW | P1 |
| Print/PDF export | MEDIUM | LOW | P2 |
| Time period selector | MEDIUM | MEDIUM | P2 |
| Dynamic insights generation | MEDIUM | HIGH | P2 |
| Historical multi-year data | LOW | MEDIUM | P3 |
| Company deep-dive pages | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- blocks investor distribution
- P2: Should have, add based on investor feedback
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Note: This analysis is based on domain knowledge of LP/investor reporting tools. Confidence: MEDIUM.

| Feature | Carta (LP Portal) | Juniper Square | Visible.vc | Our Approach |
|---------|-------------------|----------------|------------|--------------|
| Portfolio overview | Full with NAV, IRR, TVPI | Fund-level metrics | Company-level KPIs | Consolidated revenue/EBITDA/cash -- appropriate for venture studio |
| Data source | Direct integrations | Manual upload + integrations | API integrations | Google Sheets -- simpler, CFO-controlled, fits the workflow |
| Auth | SSO, MFA | SSO, role-based | Email magic link | TBD -- start simple, upgrade if needed |
| Reporting frequency | Quarterly | Quarterly | Monthly | Monthly (when CFO updates sheet) |
| Export | PDF, Excel | PDF, custom reports | PDF, slides | Browser print initially, PDF export v1.1 |
| Cost | $$$$ (enterprise) | $$$ (mid-market) | $$ (startup) | Free (self-hosted on Vercel) |
| Customization | Limited templates | Moderate | High | Full control -- it is our code |

**Key insight:** Enterprise LP portals (Carta, Juniper Square) are designed for traditional VC funds with IRR/TVPI/DPI metrics, capital calls, and distributions. InVitro Capital is a venture studio -- the reporting needs are simpler (revenue, EBITDA, cash) but the narrative context (insights tab) is more important. A custom dashboard is the right call because off-the-shelf tools are either too complex (enterprise LP portals) or too generic (BI tools like Metabase).

## Sources

- Existing codebase analysis: `/Users/andrewmaher/invitro-dashboard/components/Dashboard.jsx` (535 lines, monolithic component with hardcoded data)
- Project context: `/Users/andrewmaher/.planning/PROJECT.md`
- Domain knowledge of investor reporting tools (Carta, Juniper Square, Visible.vc, Metabase) -- MEDIUM confidence, based on training data
- LP portal feature expectations based on venture capital industry standards -- MEDIUM confidence

---
*Feature research for: InVitro Capital Investor Dashboard*
*Researched: 2026-03-12*
