# InVitro Capital Investor Dashboard

## What This Is

A financial dashboard for InVitro Capital's investors, displaying consolidated actuals across portfolio companies. Built with Next.js and Recharts, deployed on Vercel. The Google Sheet "InVitro Capital Consolidated - Actual" is the single source of truth for all financial data — the dashboard renders whatever is in the sheet.

## Core Value

Investors can view up-to-date, accurate financials for all InVitro Capital portfolio companies through a protected web dashboard that stays in sync with the master Google Sheet.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ Dashboard displays monthly revenue by portfolio company — existing
- ✓ Dashboard displays monthly EBITDA by portfolio company — existing
- ✓ Dashboard displays cash flow (balance, inflow, outflow) — existing
- ✓ Dashboard displays annual summary comparisons (2025 vs 2026) — existing
- ✓ Dashboard displays KPI cards (consolidated revenue, growth, EBITDA, cash runway) — existing
- ✓ Dashboard has tabbed interface (Overview, Revenue, Profitability, Cash Flow, Insights) — existing
- ✓ Charts use consistent company color coding — existing
- ✓ Dashboard deployed on Vercel — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Dashboard pulls all financial data from Google Sheet at build time (replace hardcoded data)
- [ ] Dashboard displays all companies and metrics present in the sheet (not just the 4 currently hardcoded)
- [ ] Investor authentication — protected access (method TBD)
- [ ] Duplicate project directories consolidated into single canonical project
- [ ] Data validation so bad sheet data doesn't crash charts

### Out of Scope

- Live/real-time data fetching at runtime — data syncs at deploy time only
- Two-way sync (writing back to Google Sheets from the dashboard)
- Automated scheduled deploys — CFO triggers manual redeploy when sheet is updated
- Mobile app — web only
- Auth method selection — deferred, will decide later

## Context

- InVitro Capital is a venture studio with several portfolio companies (currently AllRx, AllCare, Osta, Needles, plus others in the sheet)
- Andrew Maher is the CFO and maintains the Google Sheet
- The `gws` CLI tool provides access to Google Workspace including Sheets
- Dashboard is not yet live for investors — currently in development
- There are two duplicate project directories (`invitro-dashboard/` and `invitro-dashboard-1/`) that need consolidation
- Financial data is sensitive — should not be committed to version control
- Dashboard component is monolithic (535 lines) with all data, formatters, and charts inline

## Constraints

- **Data source**: Google Sheet "InVitro Capital Consolidated - Actual" is the single source of truth — dashboard must adapt to its structure, not the other way around
- **Deploy flow**: Manual redeploy by CFO after updating sheet — no automated triggers
- **Hosting**: Vercel (already configured)
- **Stack**: Next.js + React + Recharts + Tailwind (existing, no reason to change)
- **Security**: Financial data must not be hardcoded in source code or committed to git

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build-time data fetch (not runtime) | Simpler architecture, no API keys in browser, sheet doesn't change frequently | — Pending |
| Use gws CLI for sheet access | Already available and configured in user's environment | — Pending |
| Auth approach TBD | CFO wants to decide auth method later, focus on data connection first | — Pending |

---
*Last updated: 2026-03-12 after initialization*
