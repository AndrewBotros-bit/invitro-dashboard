# Roadmap: InVitro Capital Investor Dashboard

## Overview

This roadmap delivers a dynamic investor dashboard that replaces hardcoded financial data with live Google Sheets integration. The work progresses from establishing the data pipeline (service account, sheet parsing, company discovery), through validation and error resilience, to full display integration where every chart, KPI, and indicator renders correctly from sheet data. When complete, the CFO updates the Google Sheet, triggers a Vercel redeploy, and investors see current financials -- no code changes required.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Pipeline** - Connect to Google Sheets via service account with dynamic company discovery and header-based parsing
- [ ] **Phase 2: Data Validation** - Build-time schema validation and graceful handling of malformed data
- [ ] **Phase 3: Display Integration** - All charts and KPIs render from live sheet data with dynamic colors and deploy workflow

## Phase Details

### Phase 1: Data Pipeline
**Goal**: Dashboard fetches and parses financial data from the Google Sheet at build time, discovering companies dynamically without hardcoded names or column positions
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-04, INFR-01
**Success Criteria** (what must be TRUE):
  1. Running `next build` fetches data from "InVitro Capital Consolidated - Actual" via service account -- no hardcoded financial data remains in source code
  2. Adding a new company to the Google Sheet causes it to appear in the fetched data on next build without any code changes
  3. Reordering or adding columns in the sheet does not break parsing -- the parser finds data by header name, not column index
  4. Service account credentials exist only in environment variables -- no credentials committed to git, no `NEXT_PUBLIC_` prefixed Google variables
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Test infrastructure, security foundations, types, company mapping, and googleSheets.js batchGet upgrade
- [ ] 01-02-PLAN.md — P&L, Cashflow, and Expense parsers with comprehensive unit tests
- [ ] 01-03-PLAN.md — fetchAllData orchestrator and async server component wiring

### Phase 2: Data Validation
**Goal**: Build fails loudly on invalid sheet structure and charts handle missing cell values gracefully instead of crashing
**Depends on**: Phase 1
**Requirements**: DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. If a critical header is missing or the sheet structure is invalid, `next build` fails with a clear error message describing what is wrong -- it never silently deploys incorrect data
  2. If individual cell values are missing or non-numeric where numbers are expected, affected charts show an error indicator (not NaN, not $0, not a crash)
  3. A build log shows a manifest of discovered tabs, columns, and companies -- the CFO can verify the dashboard found the right data
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Display Integration
**Goal**: Every existing chart type renders correctly from live sheet data with dynamic company colors, auto-populated timestamp, and a clear redeploy workflow for the CFO
**Depends on**: Phase 2
**Requirements**: DATA-03, DISP-01, DISP-02, DISP-03, INFR-02
**Success Criteria** (what must be TRUE):
  1. All five dashboard tabs (Overview, Revenue, Profitability, Cash Flow, Insights) render charts and KPIs using data fetched from the Google Sheet -- no hardcoded data remains anywhere in the rendering path
  2. Dynamically discovered companies each receive a consistent, visually distinct color that persists across all charts
  3. The dashboard displays a "Data as of" timestamp that updates automatically on each build without manual editing
  4. The CFO can trigger a Vercel redeploy (via deploy hook or dashboard button) and the refreshed dashboard reflects current sheet data within minutes
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Pipeline | 0/3 | Planned | - |
| 2. Data Validation | 0/? | Not started | - |
| 3. Display Integration | 0/? | Not started | - |
