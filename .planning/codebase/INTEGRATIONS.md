# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**Financial Data:**
- Not detected - All financial data is hardcoded in `components/Dashboard.jsx` (monthly 2026 data, annual data for 2025-2026, cash flow data)
- Source reference: "InVitro Capital Consolidated - Actual" (Google Sheet mentioned in comments, but not accessed via API)

## Data Storage

**Databases:**
- Not detected - Application is a static/client-side dashboard with no backend database

**File Storage:**
- Not detected - No cloud file storage integration

**Caching:**
- Not detected - No explicit caching layer implemented

## Authentication & Identity

**Auth Provider:**
- Not detected - Application has no authentication mechanism or protected access

**Public Access:**
- Dashboard is fully public with no user authentication

## Monitoring & Observability

**Error Tracking:**
- Not detected - No error tracking service integrated

**Logs:**
- Not detected - No logging infrastructure configured; relies on browser console and server-side stdout

## CI/CD & Deployment

**Hosting:**
- Vercel - Deployment platform evidence in `.vercel/` directory
- Next.js native support for Vercel deployment

**CI Pipeline:**
- Not detected - No CI configuration files found (no `.github/workflows`, `.gitlab-ci.yml`, Jenkins config, etc.)

## Environment Configuration

**Required env vars:**
- Not detected - Application has no environment variable dependencies

**Secrets location:**
- Not applicable - Application contains no secrets or sensitive configuration

## Data Sources

**Hardcoded Financial Data:**
- Location: `components/Dashboard.jsx` (lines 35-69)
- Monthly 2026 data: AllRx, AllCare, Osta, Needles revenue and EBITDA arrays
- Annual data: 2025 and 2026 consolidated financials for all portfolio companies
- Cash flow data: Monthly balance, inflow, outflow projections for 2026
- No external data fetching - all data is static and part of component code

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints defined

**Outgoing:**
- Not detected - No webhook notifications or callbacks triggered

## Client-Side Operations

**State Management:**
- React hooks (useState) - Used in `components/Dashboard.jsx` for local UI state
- No state management library (Redux, Zustand, etc.)

**Data Processing:**
- All calculations and formatting performed in component code
- Formatters defined in-component: `fmt()` for currency formatting, `fmtShort()` for abbreviated numbers, `pct()` for percentages
- Derived data computed from static arrays (e.g., monthly revenue totals, EBITDA by month)

---

*Integration audit: 2026-03-12*
