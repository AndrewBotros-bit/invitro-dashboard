# Stack Research

**Domain:** Google Sheets integration + investor authentication for Next.js dashboard
**Researched:** 2026-03-12
**Confidence:** MEDIUM (versions from training data, not live-verified -- npm/web tools were unavailable)

## Existing Stack (Do Not Change)

Already in place, not re-researched:

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.15 | Framework (App Router, JSX) |
| React | ^18.3.1 | UI library |
| Recharts | ^2.12.7 | Charts |
| Tailwind CSS | ^3.4.13 | Styling |
| Vercel | — | Hosting/deployment |

## Recommended Additions

### Google Sheets Data Fetching (Build Time)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `googleapis` | ^144.0.0 | Official Google APIs Node.js client | Google's official SDK. Includes Sheets v4 API. The only library maintained by Google themselves. Covers auth + data access in one coherent package. |
| `google-auth-library` | ^9.14.0 | Service account authentication | Peer dependency of googleapis. Handles JWT/service account auth for server-side (build-time) access without user OAuth flows. |

**Why `googleapis` over `google-spreadsheet`:**
- `googleapis` is maintained by Google; `google-spreadsheet` is a community wrapper (theDumpty/node-google-spreadsheet)
- `google-spreadsheet` adds a convenience layer but also adds a dependency that can lag behind API changes
- For build-time fetching where you call `spreadsheets.values.get()` once, the raw API is simple enough that the wrapper adds no real value
- `googleapis` gives you access to all Google APIs if scope expands later (Drive, etc.)

**Architecture: Service Account + Build-Time Fetch**

Use a Google Cloud service account (not OAuth) because:
1. Build-time execution -- no user present to complete OAuth flow
2. Service accounts authenticate with a JSON key, stored as a Vercel environment variable
3. The service account is granted read-only access to the specific spreadsheet via share dialog (share the sheet with the service account email)
4. No tokens to refresh, no browser redirects, no user interaction

The data fetch happens in Next.js `getStaticProps`-equivalent patterns. In App Router (Next.js 14), this means calling the Sheets API in a Server Component or in `generateStaticParams`/data-fetching functions that run at build time. Specifically:

```
app/page.jsx (Server Component) -> calls lib/sheets.js -> googleapis reads sheet -> returns data as props to client components
```

Since the page is a Server Component by default in App Router, the Sheets API call runs at build time during `next build` on Vercel. No API keys reach the browser.

### Investor Authentication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| NextAuth.js (Auth.js) | ^5.0.0 (next-auth@5) | Authentication framework | The standard auth solution for Next.js. v5 (rebranded Auth.js) supports App Router natively, has Credentials provider for simple password auth, and integrates with Next.js middleware for route protection. |

**Why NextAuth.js v5 (Auth.js):**
- Native App Router + middleware support (v4 was Pages Router-oriented)
- Credentials provider allows simple email/password login without external OAuth providers -- perfect for a small investor group
- Middleware-based route protection means unauthenticated users never see dashboard content (not even a flash)
- Session management via encrypted JWT cookies -- no database needed for sessions
- Well-documented, massive community, Vercel-supported

**Why NOT other auth approaches:**

| Approach | Why Not |
|----------|---------|
| Vercel Password Protection (Pro feature) | Simple but too crude -- single shared password, no per-investor identity, no audit trail, requires Vercel Pro plan |
| Clerk / Auth0 / Supabase Auth | Overkill for <20 investors. Adds external dependency, costs money at scale, complex setup for a read-only dashboard |
| Custom JWT implementation | Reinventing what NextAuth already does. More code to maintain, more security surface area |
| Basic HTTP auth | No session management, poor UX (browser popup), credentials sent every request |

**Auth architecture for this project:**

The investor list is small (likely <20 people). Use NextAuth Credentials provider with a hardcoded (environment variable) list of investor credentials, or a simple JSON file. No database needed. If the investor list grows, migrate to a database later.

```
middleware.js -> checks session cookie -> redirects to /login if unauthenticated
app/api/auth/[...nextauth]/route.js -> NextAuth handler
app/login/page.jsx -> login form
```

### Data Validation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `zod` | ^3.23.0 | Runtime schema validation | Validate Google Sheets data at build time before it reaches components. If the sheet structure changes unexpectedly, the build fails with a clear error instead of rendering broken charts. Standard choice for TypeScript/JavaScript validation. |

**Why Zod:** Lightweight, zero dependencies, excellent error messages, works in Node.js (build time). The alternative `yup` is heavier and less popular in 2025+ Next.js ecosystem.

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.23.0 | Sheet data validation | Always -- validate every sheet read at build time |

No other new supporting libraries needed. The existing stack (clsx, tailwind-merge) covers UI needs.

## Installation

```bash
# Google Sheets integration
npm install googleapis google-auth-library

# Authentication
npm install next-auth@5

# Data validation
npm install zod
```

No new dev dependencies required.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `googleapis` (official) | `google-spreadsheet` (community) | If you want a friendlier API for complex cell-level operations (formatting, formulas). Not needed here -- we just read values. |
| NextAuth v5 Credentials | Clerk | If you need SSO, MFA, user management dashboard, or >100 users. Overkill for <20 investors. |
| NextAuth v5 Credentials | Vercel Password Protection | If you literally just need a single shared password and don't care about identity. Too crude for investor access. |
| Zod | No validation | Never skip validation. Sheet structure will drift over time. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `google-spreadsheet` npm package | Community-maintained wrapper over the official API. Adds indirection without meaningful benefit for simple read operations. Has historically lagged behind API changes. | `googleapis` (official Google SDK) |
| NextAuth v4 (`next-auth@4`) | v4 was designed for Pages Router. App Router support is bolted on and awkward. v5 is the proper App Router solution. | `next-auth@5` (Auth.js) |
| Runtime API routes for sheet data | Exposes API credentials in server runtime, adds latency on every page load, requires error handling for Google API downtime | Build-time fetch in Server Components |
| OAuth flow for sheet access | Requires user interaction during build. Service accounts are designed for server-to-server auth. | Service account with JSON key |
| Storing credentials in `.env.local` committed to git | Financial data access credentials must never be in source control | Vercel environment variables (encrypted at rest) |
| `fetch()` to Google Sheets published CSV | Unreliable, limited to first sheet, no column selection, public URL exposes data | `googleapis` with service account |

## Environment Variables Required

```bash
# Google Sheets (service account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_SHEET_ID=1abc...xyz

# NextAuth
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://your-dashboard.vercel.app

# Investor credentials (simple approach)
# Store as JSON in env var, or use a separate config
INVESTOR_CREDENTIALS='[{"email":"investor@example.com","passwordHash":"..."}]'
```

All set in Vercel dashboard, never in committed files.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next-auth@5 | Next.js 14+ | Requires App Router. Works with both JS and TS. |
| googleapis@144+ | Node.js 18+ | Vercel builds use Node 18/20 by default. No issue. |
| zod@3.23+ | Any JS/TS environment | Zero dependencies. No compatibility concerns. |

## Confidence Assessment

| Recommendation | Confidence | Reason |
|----------------|------------|--------|
| `googleapis` for Sheets | HIGH | Google's official SDK, well-established pattern for server-side Sheets access. Pattern unchanged for years. |
| Service account auth | HIGH | Standard Google Cloud pattern for server-to-server. Well-documented. |
| Build-time fetch in Server Components | HIGH | Core Next.js App Router pattern. This is what Server Components are designed for. |
| NextAuth v5 / Auth.js | MEDIUM | v5 was in beta for a long time. Believed to be stable/released by now, but exact version not live-verified. Fallback: NextAuth v4 works fine if v5 has issues. |
| Zod for validation | HIGH | Industry standard. No realistic alternative concern. |
| Exact version numbers | LOW | Versions listed are best estimates from training data (cutoff ~May 2025). Verify with `npm view <package> version` before installing. |

## Sources

- Training data knowledge of googleapis, NextAuth, Zod ecosystems (MEDIUM confidence -- not live-verified)
- Project context from `/Users/andrewmaher/.planning/PROJECT.md` and existing `package.json`
- Google Cloud service account documentation patterns (HIGH confidence -- stable for years)

**Note:** WebSearch, WebFetch, and Bash tools were unavailable during this research. Version numbers should be verified with `npm view <package> version` before installation. The architectural patterns and library choices are well-established and unlikely to have changed.

---
*Stack research for: InVitro Capital Investor Dashboard -- Google Sheets + Auth milestone*
*Researched: 2026-03-12*
