# Project Research Summary

**Project:** InVitro Capital Investor Dashboard
**Domain:** Venture studio LP financial reporting dashboard (Next.js + Google Sheets + Auth)
**Researched:** 2026-03-12
**Confidence:** MEDIUM-HIGH

## Executive Summary

The InVitro Capital investor dashboard is a financial reporting product that currently works but is not production-ready. The codebase is a functioning Next.js 14 app with Recharts, Tailwind, and a complete UI — but all data is hardcoded in a 535-line monolithic client component, and there is no authentication. The milestone goal is to replace hardcoded data with live Google Sheets integration and gate the dashboard behind investor authentication. Research strongly supports a build-time-only architecture: fetch Google Sheets data during `next build` using a service account, bake the data into static HTML deployed to Vercel CDN, and protect the route with Next.js middleware-based auth. No runtime API calls to Google, no credentials in the browser, no loading states.

The recommended stack additions are minimal and well-chosen: `googleapis` (official Google SDK) for Sheets access via service account, `next-auth@5` (Auth.js) for Credentials-based investor login, and `zod` for validating sheet data at build time. The investor pool is fewer than 20 people and the data update cycle is monthly — every seemingly appealing feature that adds complexity (real-time sync, per-investor views, external auth platforms, scheduled deploys) is wrong for this scale and should be explicitly rejected. The CFO maintains the Google Sheet as the single source of truth and manually triggers a Vercel redeploy when data changes; the architecture should respect this workflow, not fight it.

The primary risks are concentrated in the Sheets integration phase: credential leakage into git or client bundles, sheet structure changes breaking charts silently, and a data transform that hardcodes company names rather than discovering them from the sheet dynamically. All three are avoidable with well-established practices established before writing any integration code. Authentication carries moderate risk only because the auth method is still TBD per PROJECT.md; the recommendation is NextAuth Credentials provider with an environment-variable-based investor allowlist — simple enough for the CFO to manage without developer intervention.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14.2.15, React 18, Recharts 2.12.7, Tailwind 3.4.13, Vercel) is solid and requires no changes. Three packages are needed as additions. `googleapis` is Google's official Node.js SDK — the only library maintained by Google themselves, covering both service account auth and Sheets v4 API access in one coherent package. `next-auth@5` (Auth.js) is the standard auth solution for Next.js App Router; v5 rebranded as Auth.js and added native App Router and middleware support that v4 lacked. `zod` is the industry-standard runtime validation library that will fail the build loudly when sheet structure drifts rather than deploying charts that show NaN or $0 to investors.

**Core technologies:**
- `googleapis` (^144.0.0): Official Google SDK for Sheets v4 API — only Google-maintained option; covers auth + data access; preferred over community wrapper `google-spreadsheet` for reliability and future API compatibility
- `google-auth-library` (^9.14.0): Peer dependency for JWT/service account authentication — designed for server-to-server auth with no user interaction required at build time
- `next-auth@5` (Auth.js): Investor authentication — native App Router + middleware support; Credentials provider for email/password without external OAuth; encrypted JWT session cookies with no database required
- `zod` (^3.23.0): Build-time schema validation — validates every sheet read; fails build on bad data rather than rendering incorrect financial numbers; zero dependencies

**Note:** Version numbers are training-data estimates. Verify with `npm view <package> version` before installing. NextAuth v5 stability should be confirmed (check `npm dist-tags next-auth`) — v4 is the fallback if v5 has issues.

### Expected Features

The existing dashboard UI already covers all the major display capabilities investors expect. The gap is entirely in the data layer (hardcoded vs. live) and access control (none vs. auth). Research confirms the feature set is correct; the work is plumbing, not product design.

**Must have (table stakes):**
- Google Sheets data fetch at build time — hardcoded data is worse than a spreadsheet; this is the single most important gap
- Sheet schema parsing with dynamic company discovery — dashboard must adapt to whatever companies exist in the sheet without code changes; adding a company to the sheet must not require a code deploy
- Data validation and error handling — bad sheet data must fail the build loudly; incorrect financial numbers destroy investor confidence
- Authentication (any method) — financial data must not be accessible via an unprotected URL before investor distribution
- Auto-populated "Last Updated" timestamp — investors need to know data currency; builds trust; reduces "is this current?" questions to the CFO

**Should have (differentiators):**
- Narrative insights tab with contextual analysis (already built, currently hardcoded — keep and ensure it renders dynamically)
- KPI cards with trend indicators computed from live sheet data (already built — verify they compute dynamically)
- Mobile-responsive layout (Tailwind already in place — verify and refine)
- Print-friendly CSS / PDF export — add after first investor feedback wave

**Defer (v2+):**
- Time period selector (monthly/quarterly/annual toggle) — useful but not blocking launch
- Dynamic insights generation (template-driven from data patterns)
- Company deep-dive pages — only if investors request per-company detail
- Investor onboarding flow — only if user base grows beyond email-based access sharing

**Confirmed anti-features — explicitly do not build:**
- Real-time / live data sync — sheet updates monthly; runtime fetching adds API cost, complexity, rate limit exposure, and credential risk for zero benefit
- Two-way sync (edit from dashboard) — sheet is the CFO's source of truth; read-only by design
- Per-investor personalized views — all investors see the same consolidated view; role-based access adds complexity for a use case that does not exist
- Automated scheduled deploys — sheet updates are irregular; automated deploys would mostly be no-ops and risk deploying mid-edit
- Email/notification system — investor base is <20 people; CFO sends a manual email

### Architecture Approach

The recommended architecture is a strict server/client data split. A server component (`app/page.tsx`) calls `lib/sheets.ts` at build time, receives typed financial data, and passes it as serialized props to the client component (`components/Dashboard.tsx`) which handles all interactive rendering (tab switching, chart tooltips). Authentication is orthogonal: `middleware.ts` checks session cookies on every request before any content is served, redirecting unauthenticated users to `/login`. The data layer (`lib/sheets.ts`) is the sole file that knows about Google Sheets — it parses by header name (not column index) and validates against a Zod schema before returning clean typed objects.

**Major components:**
1. `lib/sheets.ts` — Fetches raw sheet data via service account, parses by header name, validates with Zod, returns clean typed objects. Never imported by client code. Single change point if data source changes.
2. `lib/types.ts` — Shared TypeScript interfaces forming the explicit data contract between server and client; both sides reference the same types
3. `app/page.tsx` (Server Component) — Orchestrates build-time data fetch; passes serializable data to Dashboard as props; runs at build time, not at request time
4. `components/Dashboard.tsx` ("use client") — Receives typed props; renders charts and tabs via Recharts; knows nothing about Google Sheets; uses `useState` only for UI state (active tab)
5. `components/charts/*` — Individual chart components extracted from the current 535-line monolith; each receives its specific data slice, not the full dataset
6. `middleware.ts` — Auth gate on Edge Runtime; checks session cookie; redirects to `/login` if unauthenticated; single enforcement point for all protected routes
7. `app/login/page.tsx` — Public login page with NextAuth Credentials form; only unauthenticated route

### Critical Pitfalls

1. **Service account credentials leaked into git or client bundle** — Store as Vercel env vars only (never a committed JSON file); add `credentials.json`, `*.pem`, `service-account*.json` to `.gitignore` on day one; never use `NEXT_PUBLIC_` prefix on any Google-related var; use the `server-only` package to guarantee the sheets module cannot be imported client-side. A `private_key` field in the git history is a security emergency requiring key revocation and BFG Repo-Cleaner.

2. **Sheet structure changes break charts silently** — Parse by header name, not column index; read the header row first and build a column-name-to-index map; validate expected headers exist at build time via Zod; fail the build loudly with a clear error if critical headers are missing. Rendering NaN or $0 to investors is worse than a failed build. Log a manifest of discovered tabs and columns on every build.

3. **Monolithic data transform hardcodes company names** — Build a company-agnostic data model (`{ companies: [{ name, color, metrics: [...] }] }`) that discovers companies from the sheet at parse time; charts loop over companies from data, never reference company names as string literals; colors assigned from a palette by index. Adding a company to the sheet must cause it to appear on the next deploy with zero code changes.

4. **Authentication that locks out the CFO or requires developer intervention to manage** — Store the investor allowlist in an env var (comma-separated emails or JSON), not in code; the CFO must be able to add/remove an investor by updating a Vercel env var and redeploying, without touching code. Test the full auth flow from the investor perspective: first visit, returning visit, expired session.

5. **Build-time data becomes invisibly stale** — Display "Data as of: [date]" prominently on every dashboard page; pull the timestamp from build time (`new Date().toISOString()`) or from the sheet's Drive `modifiedTime` metadata; document the Vercel deploy hook URL in a shared document the CFO can bookmark. Without this, investors have no way to know if they are looking at current or month-old numbers.

## Implications for Roadmap

Based on combined research, the work organizes into three phases following the dependency chain established in ARCHITECTURE.md. The architecture research explicitly suggests this order; the pitfalls research confirms why each phase must address certain concerns before the next phase begins.

### Phase 1: Google Sheets Data Layer

**Rationale:** The hardcoded data is the foundational gap. All existing UI already works; replacing the data source is the highest-value change and unblocks all subsequent work. Authentication is independent (can be built in parallel) but the dashboard has no live investor traffic, so it is not blocking. Getting data flowing correctly before adding auth avoids debugging two systems simultaneously.

**Delivers:** A fully dynamic dashboard that reads from Google Sheets at build time. Every chart, KPI card, and table reflects live sheet data. A new company added to the sheet appears on the dashboard on next deploy with no code changes. Build fails loudly on bad sheet data rather than deploying incorrect numbers. "Last Updated" timestamp auto-populated from build time.

**Addresses:** Live data from source of truth, dynamic company discovery, data validation/error handling, auto "Last Updated" timestamp (all FEATURES.md P1 items)

**Must avoid during this phase:**
- Credential leakage (configure `.gitignore` and Vercel env vars before writing any Sheets code)
- Hardcoded column indices (use header-based parsing from day one — retrofitting this is expensive)
- Company names as string literals in transforms (build generic data model from the start)
- API quota exceeded (use `batchGet` for all ranges in a single call; target 1-3 API calls total per build)
- Fetching data in runtime API routes instead of build-time Server Components

**Pre-requisite:** Inspect the actual "InVitro Capital Consolidated - Actual" spreadsheet structure (tab names, header row format, column layout, date format) before designing the parser. This is a discovery task, not a development task.

**Research flag:** LOW — googleapis service account + Next.js Server Component patterns are mature and stable. Main unknown is the actual sheet structure; inspect the real spreadsheet before designing the parser schema.

### Phase 2: Component Refactor — Split the Monolith

**Rationale:** Once data is flowing correctly through props (Phase 1), the 535-line monolith can be decomposed without risk of data regressions. Each chart component can be verified individually against the now-live data. This is a pure code quality improvement that makes Phase 3 (auth) and all future maintenance significantly easier. It also extracts formatting utilities and the color map into shared modules, eliminating duplication.

**Delivers:** A maintainable component structure: individual chart components in `components/charts/`, shared utilities in `lib/format.ts` and `lib/colors.ts`, and a Dashboard component that delegates to sub-components. Each chart is independently testable with mock data matching the `lib/types.ts` interfaces established in Phase 1.

**Addresses:** Long-term maintainability; eliminates the monolith before auth integration adds more complexity

**Must avoid during this phase:**
- Breaking chart output during extraction (verify each chart renders identically after refactoring)
- Skipping the `lib/types.ts` interfaces (must be defined in Phase 1 before splitting is safe)

**Research flag:** NONE — standard React component extraction following established patterns. No novel technical challenges.

### Phase 3: Investor Authentication

**Rationale:** Auth comes last because the dashboard is not yet live for investors and there is no urgent access risk during development. Building it after Phases 1 and 2 means the auth layer sits cleanly on top of a working, well-structured app. Middleware-based auth is additive — it does not require changes to the data layer or chart components.

**Delivers:** A fully protected dashboard. All routes except `/login` are protected by `middleware.ts`. Investors log in with email/password credentials. The CFO can add or remove investor access by updating a Vercel env var without a code change. Sessions managed via encrypted JWT cookies (no database needed). Unauthenticated users see the login page, never a flash of dashboard content.

**Addresses:** Authentication (FEATURES.md P1 item); production investor distribution readiness

**Must avoid during this phase:**
- Auth method requiring investors to create accounts on third-party platforms
- Investor allowlist hardcoded in source code (must be env var for CFO self-service)
- OAuth callback URLs configured only for localhost (configure production Vercel domain from the start)
- Per-page auth checks (use `middleware.ts` as the single enforcement point)
- `localStorage` for session tokens (NextAuth httpOnly cookies by default is correct)

**Research flag:** LOW-MEDIUM — Verify `next-auth@5` is production-stable before committing to it (`npm view next-auth dist-tags` or check GitHub releases). If v5 has issues, `next-auth@4` with App Router adapter is the safe fallback and patterns are nearly identical.

### Phase Ordering Rationale

- Data layer must come first: it is the core milestone deliverable; auth testing is meaningless without real data; auth and data are independent so sequencing them avoids debugging two systems simultaneously
- Component refactor second: easiest to verify when data is already flowing correctly; makes auth integration cleaner; pure code quality work with no external dependencies
- Auth third: fully independent of the data pipeline; no live investor traffic makes this non-blocking during development; additive change on top of a well-structured app
- This order also front-loads the highest-risk pitfalls (credential management, parser design, generic data model) so foundational decisions are correct before layers are added on top

### Research Flags

Needs targeted investigation before/during planning:
- **Phase 1:** Inspect the real "InVitro Capital Consolidated - Actual" spreadsheet before designing the Zod schema and parser (tab names, header format, data layout, date format). Use `gws sheets` to read it.
- **Phase 3:** Confirm `next-auth@5` production stability before planning begins. If unstable, plan for v4 instead.
- **All phases:** Confirm whether a Google Cloud project with Sheets API enabled already exists, or if project setup is a prerequisite for Phase 1.

Standard patterns (no research needed during planning):
- **Phase 1 (Sheets integration):** googleapis service account auth, `batchGet`, Next.js Server Component data fetching — mature and well-documented
- **Phase 2 (Refactor):** React component extraction — standard patterns
- **Phase 3 (Auth, conditional on v5 stability):** NextAuth Credentials provider, middleware route protection — well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core library choices are HIGH confidence; exact version numbers are LOW confidence (training-data estimates, not live-verified); NextAuth v5 stability needs confirmation |
| Features | MEDIUM | Feature prioritization based on domain expertise and codebase analysis; no live competitor research was possible; anti-feature list is well-grounded in project constraints |
| Architecture | HIGH | Direct codebase analysis of existing 535-line monolith; well-established Next.js App Router + Google Sheets API patterns; these patterns have been stable for years |
| Pitfalls | HIGH | Well-documented failure modes for Google API and Next.js ecosystems; project-specific constraints (small user base, build-time only, CFO-maintained sheet) make recommendations well-grounded |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Sheet structure is unknown:** The parser schema design depends on the actual tab names, header row format, column layout, and date formats in "InVitro Capital Consolidated - Actual." Inspect the real sheet via `gws sheets` before designing `lib/sheets.ts`. This is the most important unknown.

- **Auth method still TBD:** PROJECT.md defers the auth approach decision. Research recommends NextAuth v5 Credentials with env-var-based investor allowlist. Confirm this is the chosen approach at the start of Phase 3 planning.

- **NextAuth v5 stability:** Versions listed are estimates. Verify `npm view next-auth dist-tags` before committing. If v5 is not fully stable, plan for v4 with App Router adapter (minor implementation difference, same patterns).

- **Google Cloud project setup:** Research assumes a service account can be created. If no Google Cloud project exists yet, this is a pre-requisite setup task (Google Cloud Console access, enabling Sheets API, creating service account, granting viewer access to the sheet) that is not a development task but must complete before Phase 1 can begin.

- **Investor list size and access model:** Research assumes <20 investors with email/password access. If the actual model is different (e.g., magic links, SSO, more than 50 investors), the auth recommendation changes. Confirm with the CFO before Phase 3 planning.

## Sources

### Primary (HIGH confidence)
- Existing codebase at `/Users/andrewmaher/invitro-dashboard/` — direct analysis of Dashboard.jsx (535 lines), package.json, app directory structure
- Google Cloud service account documentation patterns — stable server-to-server auth model; well-documented for years
- Next.js 14 App Router documentation — Server Components, static generation at build time, middleware patterns

### Secondary (MEDIUM confidence)
- Training data knowledge of googleapis, NextAuth, Zod ecosystems — not live-verified; architectural patterns are well-established even if version numbers may be stale
- Domain knowledge of LP/investor reporting tools (Carta, Juniper Square, Visible.vc) — basis for feature prioritization and anti-feature decisions
- PROJECT.md project context — primary source for constraints and requirements

### Tertiary (LOW confidence)
- Exact package version numbers — should be verified with `npm view <package> version` before installation
- NextAuth v5 production stability — should be confirmed before Phase 3 planning

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
