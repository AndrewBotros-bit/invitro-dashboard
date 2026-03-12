# Requirements: InVitro Capital Investor Dashboard

**Defined:** 2026-03-12
**Core Value:** Investors can view up-to-date, accurate financials for all InVitro Capital portfolio companies through a web dashboard that stays in sync with the master Google Sheet.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Pipeline

- [ ] **DATA-01**: Dashboard fetches all financial data from Google Sheet "InVitro Capital Consolidated - Actual" at build time using a service account
- [ ] **DATA-02**: Dashboard dynamically discovers all companies present in the sheet without hardcoded company names
- [ ] **DATA-03**: Dashboard dynamically renders charts and KPIs for whatever companies exist in the sheet
- [ ] **DATA-04**: Dashboard uses header-based sheet parsing (not hardcoded cell ranges) so column reordering doesn't break it
- [ ] **DATA-05**: Dashboard validates sheet data at build time using schemas — build fails loudly if sheet structure is invalid
- [ ] **DATA-06**: Dashboard gracefully handles missing or malformed cell values without crashing charts (shows error indicators instead)

### Display

- [ ] **DISP-01**: Dashboard auto-populates "Last Updated" timestamp from build time
- [ ] **DISP-02**: Dashboard assigns consistent colors to dynamically discovered companies
- [ ] **DISP-03**: All existing chart types (revenue, EBITDA, cash flow, KPIs, insights) render correctly from sheet data

### Infrastructure

- [ ] **INFR-01**: Service account credentials stored as environment variables (never committed to git)
- [ ] **INFR-02**: CFO can trigger a manual redeploy to refresh data from the sheet

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication

- **AUTH-01**: Dashboard requires investor login to access financial data
- **AUTH-02**: Investor accounts managed by CFO (add/remove access)

### Cleanup

- **CLNP-01**: Duplicate project directories consolidated into single canonical project
- **CLNP-02**: Monolithic 535-line Dashboard.jsx refactored into smaller components

### Polish

- **PLSH-01**: Print-friendly CSS or PDF export for sharing with boards
- **PLSH-02**: Time period selector (monthly/quarterly/annual toggle)
- **PLSH-03**: Dynamic insights generation from data patterns

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time / live data sync | Sheet updates ad hoc; build-time fetch is sufficient. Runtime fetching exposes API keys to browser. |
| Two-way sync (write back to sheet) | Google Sheet is single source of truth maintained by CFO. Dashboard is read-only. |
| Per-investor personalized views | All investors see the same consolidated studio view. |
| Automated scheduled deploys | Sheet updates are irregular; auto-deploys could deploy mid-edit broken state. |
| Complex forecasting models | Financial modeling belongs in the spreadsheet where CFO controls assumptions. |
| Email/notification system | Small investor base (<20); CFO sends manual update emails. |
| Transaction-level drill-down | Monthly aggregation is the appropriate level for investor reporting. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 3 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 2 | Pending |
| DATA-06 | Phase 2 | Pending |
| DISP-01 | Phase 3 | Pending |
| DISP-02 | Phase 3 | Pending |
| DISP-03 | Phase 3 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after roadmap creation*
