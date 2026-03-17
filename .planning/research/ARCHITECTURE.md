# Architecture Research

**Domain:** Investor financial dashboard (Next.js + Google Sheets + Auth)
**Researched:** 2026-03-12
**Confidence:** HIGH (well-understood patterns; Next.js App Router, Google Sheets API, and auth are mature)

## Current State

The existing codebase is a single monolithic client component (`components/Dashboard.jsx`, ~535 lines) that contains:
- All financial data hardcoded inline (monthly arrays, annual summaries)
- Formatting utilities
- Color constants
- All chart/tab rendering logic

The page (`app/page.jsx`) simply renders `<InVitroDashboard />`. There is no data layer, no auth, no server components doing real work. The entire app is `"use client"`.

## Target Architecture

### System Overview

```
BUILD TIME (next build on Vercel)                    RUNTIME (browser)
========================================            ========================

┌──────────────────────────────────┐
│  Google Sheets API               │
│  "InVitro Capital Consolidated"  │
└──────────┬───────────────────────┘
           │ Service account fetch
           ▼
┌──────────────────────────────────┐
│  lib/sheets.ts                   │
│  - Fetches raw sheet data        │
│  - Parses rows into typed objects│
│  - Validates data integrity      │
└──────────┬───────────────────────┘
           │ Typed financial data
           ▼
┌──────────────────────────────────┐
│  app/page.tsx (Server Component) │
│  - Calls lib/sheets at build     │
│  - Passes data as props          │
└──────────┬───────────────────────┘
           │ Props (serialized JSON)
           ▼
┌──────────────────────────────────┐    ┌──────────────────────────┐
│  components/Dashboard.tsx        │    │  middleware.ts            │
│  "use client"                    │    │  - Checks auth session   │
│  - Receives data via props       │    │  - Redirects to /login   │
│  - Renders charts (Recharts)     │    │    if unauthenticated    │
│  - Tab switching (client state)  │    └──────────────────────────┘
└──────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| `lib/sheets.ts` | Fetch Google Sheet, parse rows, validate, return typed data | Only file that knows about Google Sheets API. Returns plain TypeScript objects. Never imported by client components. |
| `lib/types.ts` | Shared TypeScript types for financial data | Shared by both server and client code. No runtime logic. |
| `app/page.tsx` | Server Component entry point. Calls sheets lib at build time, passes data to Dashboard. | Orchestrates data flow. Does not render charts itself. |
| `app/layout.tsx` | Root layout, session provider wrapper | Wraps app with auth session context |
| `app/login/page.tsx` | Login page (public) | Only unauthenticated route |
| `middleware.ts` | Auth gate. Checks session on every request, redirects unauthenticated users to /login | Runs on Edge. Does not fetch data. |
| `components/Dashboard.tsx` | Client component. Receives typed data props, renders all charts and tabs. | Knows nothing about Google Sheets. Receives data, renders it. |
| `components/charts/*` | Individual chart components extracted from Dashboard | Each chart is self-contained with its own formatting logic |
| `components/ui/*` | Reusable UI primitives (Card, Tabs, Badge, Table) | Already exists. No changes needed. |

## Data Flow

### Build-Time Data Flow (the critical path)

```
Google Sheet (source of truth)
    │
    │  googleapis / google-spreadsheets npm
    │  Authenticated via service account
    ▼
lib/sheets.ts :: fetchFinancialData()
    │
    │  1. Connect with service account credentials (from env vars)
    │  2. Read specified ranges (revenue sheet, EBITDA sheet, etc.)
    │  3. Parse raw cell values into typed arrays
    │  4. Validate: no NaN, no missing months, companies match expected set
    │  5. Return: { monthly: MonthlyData[], annual: AnnualData, companies: string[] }
    ▼
app/page.tsx (Server Component, runs at build)
    │
    │  const data = await fetchFinancialData()
    │  return <Dashboard data={data} />
    ▼
components/Dashboard.tsx ("use client")
    │
    │  Receives data as serializable props
    │  useState for active tab only
    │  Renders Recharts components with data
    ▼
Static HTML + JS bundle (deployed to Vercel CDN)
```

### Authentication Flow (runtime)

```
Browser request to /
    │
    ▼
middleware.ts
    │
    ├── Has valid session cookie? ──YES──► Serve static page (from CDN)
    │
    └── No session? ──► Redirect to /login
                            │
                            ▼
                        /login page
                            │
                            ├── Option A: NextAuth with Google OAuth
                            │   User signs in with Google
                            │   Session cookie set
                            │   Redirect to /
                            │
                            └── Option B: Simple password/invite code
                                User enters shared password
                                Session cookie set
                                Redirect to /
```

### Key Design Decision: Build-Time Only

Data fetching happens exclusively at `next build` time. This means:

- **No API keys in the browser.** Service account credentials exist only in Vercel environment variables, used during build.
- **No runtime Google API calls.** The deployed site is fully static HTML/JS with data baked in.
- **Update cycle:** CFO updates sheet, triggers Vercel redeploy, new static build picks up latest data.
- **Trade-off:** Data is stale until next deploy. Acceptable per PROJECT.md requirements.

## Recommended Project Structure

```
invitro-dashboard/
├── app/
│   ├── layout.tsx           # Root layout, metadata, session provider
│   ├── page.tsx             # Server Component: fetches data, renders Dashboard
│   └── login/
│       └── page.tsx         # Login form (public route)
├── components/
│   ├── Dashboard.tsx        # Main dashboard (client component, receives data props)
│   ├── charts/
│   │   ├── RevenueChart.tsx
│   │   ├── EbitdaChart.tsx
│   │   ├── CashFlowChart.tsx
│   │   ├── AnnualComparison.tsx
│   │   └── KpiCards.tsx
│   └── ui/
│       ├── card.jsx         # Existing
│       ├── tabs.jsx         # Existing
│       ├── badge.jsx        # Existing
│       └── table.jsx        # Existing
├── lib/
│   ├── sheets.ts            # Google Sheets fetch + parse + validate
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── format.ts            # Number/currency formatters (extracted from Dashboard)
│   └── colors.ts            # Company color map (extracted from Dashboard)
├── middleware.ts             # Auth gate (redirects unauthenticated to /login)
├── next.config.js
├── package.json
└── .env.local               # Google service account creds (NEVER committed)
```

### Structure Rationale

- **`lib/sheets.ts` isolated:** The only file that imports `googleapis`. If the data source ever changes (e.g., Airtable, database), only this file changes. Dashboard components are unaffected.
- **`lib/types.ts` shared:** Both server-side sheets code and client-side Dashboard reference the same types. Ensures data contract is explicit.
- **`components/charts/` extracted:** The 535-line monolith needs to be split. Each chart component receives its slice of data. Makes individual charts testable and maintainable.
- **`lib/format.ts` and `lib/colors.ts`:** Extract the utility functions and color constants that currently live inline in Dashboard.jsx. Shared across chart components.
- **`middleware.ts` at root:** Next.js convention. Runs on every request before page rendering.

## Architectural Patterns

### Pattern 1: Server Component Data Fetching (Build-Time)

**What:** The page server component calls an async data function. In Next.js App Router with `output: 'export'` or default static generation, this runs at build time.

**When to use:** Exactly this case -- data that changes infrequently, fetched from an external API, where freshness within minutes is not required.

**Example:**
```typescript
// app/page.tsx
import { fetchFinancialData } from '@/lib/sheets';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  const data = await fetchFinancialData();
  return <Dashboard data={data} />;
}
```

**Trade-offs:**
- Pro: Zero client-side API calls, no loading states, instant page load
- Pro: Service account credentials never reach the browser
- Con: Data is stale until next build. Acceptable here.

### Pattern 2: Props-Down Data Contract

**What:** Server component passes data to client component via props. The client component never fetches data itself. The TypeScript interface defines the contract.

**When to use:** When client components need server-fetched data but must remain interactive (useState for tabs, tooltips, etc.).

**Example:**
```typescript
// lib/types.ts
export interface CompanyMonthly {
  company: string;
  color: string;
  months: {
    month: string;
    revenue: number;
    ebitda: number;
    grossMargin: number;
  }[];
}

export interface DashboardData {
  monthly: CompanyMonthly[];
  annual: Record<string, AnnualSummary>;
  kpis: KpiData;
  lastUpdated: string;
}
```

**Trade-offs:**
- Pro: Clear boundary between "where data comes from" and "how data is rendered"
- Pro: Dashboard component is easily testable with mock data
- Con: All data must be JSON-serializable (no Date objects, no functions in props)

### Pattern 3: Middleware Auth Gate

**What:** `middleware.ts` checks for a valid session on every request. Protected routes get auth enforcement without any per-page logic.

**When to use:** When the entire app (except login) requires authentication.

**Example:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');

  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Trade-offs:**
- Pro: Single enforcement point. Cannot accidentally expose an unprotected route.
- Pro: Works with any auth provider (NextAuth, custom, simple password).
- Con: Runs on Edge Runtime, limited Node.js API access. Keep logic simple.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Data Fetching for Static Data

**What people do:** Use `useEffect` + `fetch` to call a `/api/sheets` route at runtime, displaying loading spinners while waiting for Google Sheets API response.

**Why it's wrong:** Exposes API route that must be authenticated separately. Adds latency on every page load. Requires managing loading/error states in the UI. Service account credentials must be available at runtime, not just build time.

**Do this instead:** Fetch at build time via server component. Data is baked into the static HTML. No loading states, no runtime API calls, no exposed endpoints.

### Anti-Pattern 2: Putting Auth Logic in Individual Pages

**What people do:** Check authentication inside each page component (`if (!session) redirect('/login')`).

**Why it's wrong:** Easy to forget on new pages. Auth check happens after page rendering begins. Inconsistent enforcement.

**Do this instead:** Use `middleware.ts` for centralized auth enforcement. Every route is protected by default; only `/login` is explicitly excluded.

### Anti-Pattern 3: Parsing Spreadsheet Data in the Component

**What people do:** Pass raw spreadsheet rows to the Dashboard component and parse/transform them there.

**Why it's wrong:** Mixes data transformation concerns with rendering. Makes the component untestable without real sheet data. Breaks if sheet structure changes (ripple effect into UI code).

**Do this instead:** `lib/sheets.ts` handles all parsing and returns clean, typed objects. Dashboard receives data in exactly the shape it needs to render.

### Anti-Pattern 4: Storing Financial Data in Git

**What people do:** Commit a `data.json` file with financial numbers for convenience.

**Why it's wrong:** Financial data is sensitive. Once in git history, it's permanent. Also creates a manual sync burden -- someone has to remember to update the JSON when the sheet changes.

**Do this instead:** Always fetch from Google Sheets at build time. The only things in git are the code to fetch and transform.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Sheets API | `googleapis` npm package with service account | Service account JSON stored in Vercel env var (`GOOGLE_SERVICE_ACCOUNT_KEY`). Sheet ID stored in env var (`GOOGLE_SHEET_ID`). Scopes: `spreadsheets.readonly`. |
| Vercel | Deploy platform | Build runs `next build`, which triggers server component data fetch. Env vars configured in Vercel dashboard. |
| Auth provider (TBD) | NextAuth.js or custom session | Session cookie checked by middleware. Provider choice deferred per PROJECT.md. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `lib/sheets` to `app/page` | Function call returning typed data | Build-time only. No network boundary. |
| `app/page` (server) to `Dashboard` (client) | Serialized props across server/client boundary | Data must be JSON-serializable. No functions, no class instances. |
| `middleware` to pages | HTTP redirect or pass-through | Middleware sees cookies only. Does not access data layer. |
| `Dashboard` to `charts/*` | React props | Each chart receives its specific data slice, not the full dataset. |

## Build Order (Suggested Implementation Sequence)

The dependency chain determines what must be built first:

```
Phase 1: Data Layer (no visual changes yet)
  lib/types.ts          ← Define data interfaces first
  lib/sheets.ts         ← Fetch + parse + validate
  app/page.tsx          ← Wire server component to call sheets

Phase 2: Component Refactor (split monolith)
  lib/format.ts         ← Extract formatters
  lib/colors.ts         ← Extract color map
  components/charts/*   ← Extract individual chart components
  components/Dashboard  ← Refactor to receive props, delegate to chart components

Phase 3: Auth Layer (protect the app)
  middleware.ts         ← Auth gate
  app/login/page.tsx    ← Login UI
  app/layout.tsx        ← Session provider wrapper
```

**Why this order:**
1. Data layer first because the current hardcoded data must be replaced before anything else. The Dashboard can initially still be monolithic -- just fed by props instead of inline constants.
2. Component refactor second because it's a pure code quality improvement. Easier to do after data is flowing correctly (you can verify charts still render correctly).
3. Auth last because the dashboard already has no public traffic. Auth is important but not blocking -- the site is not yet live for investors.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 investors (current) | Fully static site is perfect. No server costs beyond Vercel free/hobby tier. |
| 10-100 investors | Same architecture. Static site handles unlimited read traffic via CDN. Auth is the only dynamic part. |
| Multiple dashboards / per-investor views | Would need ISR (Incremental Static Regeneration) or dynamic routes. Not needed now. |

### First Bottleneck: Google Sheets API Rate Limits

At build time, if fetching many sheet ranges, you could hit Google's 60 requests/minute limit. **Mitigation:** Batch reads into a single `spreadsheets.values.batchGet` call. One API call fetches all ranges.

### Not a Bottleneck: Page Serving

Static HTML on CDN. Effectively unlimited throughput. Authentication middleware adds negligible latency (cookie check only).

## Sources

- Next.js App Router documentation (Server Components, static generation, middleware) -- based on Next.js 14.x knowledge
- Google Sheets API v4 documentation (service accounts, batchGet) -- based on googleapis npm package
- NextAuth.js documentation (App Router integration) -- based on NextAuth v4/v5 knowledge
- Direct analysis of existing codebase at `/Users/andrewmaher/invitro-dashboard/`

**Confidence note:** WebSearch was unavailable during this research. All recommendations are based on direct codebase analysis and established patterns for Next.js 14 App Router + Google Sheets API + auth middleware. These are mature, well-documented patterns. Confidence remains HIGH.

---
*Architecture research for: InVitro Capital Investor Dashboard*
*Researched: 2026-03-12*
