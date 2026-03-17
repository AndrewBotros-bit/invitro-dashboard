# Pitfalls Research

**Domain:** Google Sheets-backed investor financial dashboard (Next.js + Vercel)
**Researched:** 2026-03-12
**Confidence:** HIGH (based on well-documented Google API and Next.js patterns)

## Critical Pitfalls

### Pitfall 1: Service Account Key Leaked into Git or Client Bundle

**What goes wrong:**
The Google Sheets API requires a service account JSON key (or equivalent credentials). Developers commit this file to the repo, or misconfigure Next.js so the key ends up in the client-side JavaScript bundle. For a financial dashboard with sensitive investor data, this is a security emergency.

**Why it happens:**
Google's quickstart tutorials download a `credentials.json` file into the project root. It is easy to forget to gitignore it. Additionally, Next.js code in `pages/` or `app/` that imports credentials at the top level can accidentally bundle them into client JS if the import is not isolated to server-only code paths (getStaticProps, server components, or API routes).

**How to avoid:**
1. Never store the service account JSON file in the project. Instead, store the key as a Vercel environment variable (e.g., `GOOGLE_SERVICE_ACCOUNT_KEY` as a base64-encoded string or JSON string).
2. Parse it at build time: `JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)`.
3. Add `credentials.json`, `*.pem`, and `service-account*.json` to `.gitignore` on day one.
4. Only reference Google credentials inside `getStaticProps`, server-only modules, or build scripts -- never in components or client code.
5. Use Next.js `server-only` package to guarantee a module cannot be imported client-side.

**Warning signs:**
- `credentials.json` or any `.json` with `private_key` field exists in the repo.
- `NEXT_PUBLIC_` prefix on any Google-related env var (this exposes it to the browser).
- Build output bundle size is unexpectedly large (credential JSON is ~2KB).

**Phase to address:**
Google Sheets integration phase (first phase of this milestone). Set up env vars and gitignore before writing any Sheets code.

---

### Pitfall 2: Google Sheets API Quota Exceeded During Build

**What goes wrong:**
The Google Sheets API has a quota of 300 requests per minute per project (default). If the build script makes separate API calls for each tab, each company, or each metric, a sheet with many tabs can hit rate limits, causing the Vercel build to fail intermittently. Worse, failed builds on Vercel show cryptic 429 errors that are hard to diagnose.

**Why it happens:**
Developers fetch one cell range at a time, or loop through tabs sequentially with individual API calls, instead of batching. The Sheets API supports batch reads (`spreadsheets.values.batchGet`) that fetch multiple ranges in one call, but tutorials often show single-range examples.

**How to avoid:**
1. Use `spreadsheets.values.batchGet` to fetch all needed ranges in a single API call.
2. Alternatively, use `spreadsheets.get` with `includeGridData: true` to get the entire spreadsheet in one call (suitable if the sheet is not enormous).
3. If the sheet has many tabs, fetch the spreadsheet metadata first (one call) to discover tab names, then batch-fetch all tab data (one more call).
4. Total should be 1-3 API calls per build, not N calls per tab.

**Warning signs:**
- Build logs show multiple sequential "Fetching sheet..." messages.
- Intermittent build failures on Vercel that succeed on retry.
- `HttpError 429` or `RATE_LIMIT_EXCEEDED` in build logs.

**Phase to address:**
Google Sheets integration phase. Design the data fetching layer to batch from the start.

---

### Pitfall 3: Sheet Structure Changes Break the Dashboard Silently

**What goes wrong:**
The CFO renames a tab, adds a column, reorders rows, or changes a header label in the Google Sheet. The build succeeds but the dashboard renders wrong data, missing data, or NaN values in charts. Because this is financial data shown to investors, incorrect numbers are worse than showing nothing.

**Why it happens:**
Developers hardcode cell ranges (e.g., `Sheet1!A1:F20`) or column indices (e.g., "column 3 is always EBITDA"). When the sheet structure changes -- which it will, because the CFO maintains it independently -- these assumptions break silently.

**How to avoid:**
1. Parse by header names, not column indices. Read the header row first, build a column-name-to-index map, then extract data by name.
2. Validate data at build time: check that expected headers exist, that numeric columns contain numbers, that date columns are parseable.
3. Fail the build loudly if critical headers are missing, rather than rendering garbage.
4. Log a clear manifest of what was found: "Found tabs: [AllRx, AllCare, Osta, Needles]. Found columns: [Month, Revenue, EBITDA, ...]".
5. Consider writing a schema file that documents expected sheet structure, and validate against it.

**Warning signs:**
- Data fetching code uses hardcoded ranges like `A1:G50`.
- No validation step between fetching and rendering.
- Charts show $0 or NaN for companies that clearly have data.

**Phase to address:**
Google Sheets integration phase. Build the parser with header-based lookups and validation from the beginning. This is the single most important design decision in the data layer.

---

### Pitfall 4: Authentication That Locks Out the CFO

**What goes wrong:**
Auth is implemented but the flow is confusing, tokens expire with no clear re-auth path, or the auth setup is so complex that the CFO (who triggers deploys and is the primary admin) cannot manage it. Alternatively, auth is added but there is no way to add/remove investors without a code change and redeploy.

**Why it happens:**
Developers choose an auth system optimized for developer experience (OAuth with GitHub, complex JWT flows) rather than the actual users (a small number of investors who need simple, reliable access). For a dashboard with maybe 5-20 investors, enterprise auth is overkill and creates friction.

**How to avoid:**
1. For the likely scale (under 50 users), use a simple approach: Vercel's built-in password protection (Pro plan), NextAuth with a simple email allowlist, or Clerk/Auth0 with magic links.
2. Avoid requiring investors to create accounts on third-party platforms they do not use.
3. Make sure the CFO can add/remove investor access without deploying code. An env var with a comma-separated email list is the simplest version; a small admin UI is better.
4. Test the full auth flow from the investor's perspective: first visit, returning visit, expired session, password reset.

**Warning signs:**
- Auth requires investors to sign up on a third-party service.
- Adding a new investor requires a code change and redeploy.
- No session expiry or refresh strategy defined.
- Auth works locally but breaks on Vercel due to different callback URLs.

**Phase to address:**
Authentication phase (after Sheets integration is working). Keep auth simple given the small user base.

---

### Pitfall 5: Build-Time Data Becomes Invisibly Stale

**What goes wrong:**
The dashboard shows build-time data but there is no visible indication of when the data was last updated. Investors see numbers and assume they are current. The CFO updates the sheet but forgets to trigger a redeploy. Weeks go by with stale data that looks fresh.

**Why it happens:**
Build-time static generation is the right architecture for this use case, but it requires the manual redeploy step to be reliable. Without a visible "last updated" timestamp, there is no way for anyone to notice staleness.

**How to avoid:**
1. Stamp every build with a "Data as of: [date]" timestamp, prominently displayed on the dashboard.
2. Pull the timestamp from the sheet itself (e.g., a "Last Updated" cell the CFO maintains, or use the Google Sheets API to get the sheet's `modifiedTime` from Drive metadata).
3. Consider adding a build webhook URL that the CFO can bookmark or add to a checklist: "After updating the sheet, click this link to rebuild."
4. Optionally, add a staleness warning: if data is older than N days, show a banner.

**Warning signs:**
- No "last updated" timestamp visible on the dashboard.
- No documented process for the CFO to trigger rebuilds.
- The Vercel deploy hook URL is not saved anywhere accessible.

**Phase to address:**
Google Sheets integration phase. Include the timestamp in the data layer from the start, and document the redeploy process.

---

### Pitfall 6: Monolithic Data Transform Makes Adding Companies Painful

**What goes wrong:**
The current dashboard is already a 535-line monolithic component with hardcoded data for 4 companies. If the Sheets integration is built with the same pattern -- a giant transform function that maps specific sheet columns to specific chart props for each company -- then every time a company is added or removed from the sheet, the code must change.

**Why it happens:**
It is faster in the short term to write a specific transform: "AllRx revenue is column C, AllCare is column D." But the sheet will grow. The PROJECT.md already says the dashboard should display "all companies and metrics present in the sheet."

**How to avoid:**
1. Build a generic data model: the Sheets parser should output a structure like `{ companies: [{ name, metrics: { month, revenue, ebitda, ... } }] }` that is company-agnostic.
2. Charts should render dynamically from this model: loop over companies, assign colors from a palette, generate chart series programmatically.
3. The only "configuration" should be the color palette and display preferences, not the data mapping.
4. This is also the right time to break up the 535-line monolith into smaller components.

**Warning signs:**
- Data transform code references company names as string literals.
- Adding a new company to the sheet requires a code change.
- Chart components have hardcoded series for each company.

**Phase to address:**
Google Sheets integration phase. The data model design determines whether the dashboard is maintainable.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded cell ranges (`A1:G50`) | Quick to implement | Breaks when sheet structure changes | Never -- use header-based parsing |
| Fetching entire sheet and filtering in JS | Simple code | Slow builds if sheet grows large | Acceptable for now (sheet is small), but add a size check |
| Storing investor list in code | No external dependency | Redeploy needed to add/remove users | Only in MVP; move to env var or DB quickly |
| Skipping data validation | Faster initial build | Bad sheet data crashes production charts | Never -- validate at build time |
| Single massive page component | Fast to prototype | Impossible to test, hard to modify | Already exists; refactor during Sheets integration |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Sheets API | Using API key instead of service account (API keys cannot access private sheets) | Use a service account, share the sheet with the service account email |
| Google Sheets API | Forgetting to enable the Sheets API in Google Cloud Console | Enable both Google Sheets API and Google Drive API in the project |
| Google Sheets API | Using `googleapis` (full SDK, 40MB+) instead of `google-spreadsheet` or direct REST calls | Use `google-spreadsheet` npm package or targeted `googleapis/sheets` import to keep build small |
| Vercel env vars | Setting env vars in `.env.local` but not in Vercel dashboard | Set env vars in Vercel project settings; `.env.local` is only for local dev |
| Vercel env vars | Using `NEXT_PUBLIC_` prefix for server-only secrets | Never prefix secrets with `NEXT_PUBLIC_`; use plain names and access only in server code |
| Vercel deploy hooks | Creating a deploy hook but not saving/sharing the URL | Save the deploy hook URL in a shared doc the CFO can access |
| NextAuth / Auth providers | Configuring OAuth callback URLs for localhost but not for the production domain | Set callback URLs for both `localhost:3000` and the production Vercel URL |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full spreadsheet data when only summary is needed | Build times over 30 seconds | Fetch only required ranges via batchGet | Sheet exceeds ~10,000 rows |
| Importing full `googleapis` package | Build bundle bloat, slow cold starts | Use targeted import: `const { google } = require('googleapis')` with tree shaking, or use `google-spreadsheet` package | Immediately -- adds ~40MB to node_modules |
| Rendering all chart data client-side without pagination | Page load time over 3 seconds on mobile | Pre-aggregate data at build time; pass summary data to charts, not raw rows | Over ~500 data points per chart |
| No ISR or cache headers | Every page load re-renders from scratch (not an issue with SSG, but matters if you later add runtime fetching) | Stick with pure SSG for now; if adding runtime API, use ISR with long revalidation | Only if architecture changes to runtime |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service account key in git repo | Anyone with repo access can read all sheets the SA has access to | Store as Vercel env var, add key patterns to .gitignore |
| Service account has editor access to sheet | Compromised key could modify financial data | Grant the service account viewer-only access to the sheet |
| No auth on the dashboard | Anyone with the URL sees investor financials | Add authentication before sharing the URL with investors |
| Auth tokens stored in localStorage | XSS attack could steal session | Use httpOnly cookies for session tokens (NextAuth does this by default) |
| Dashboard URL is guessable | Search engines or link scanners could find it | Use auth (not obscurity), but also set `noindex` meta tag and `X-Robots-Tag: noindex` header |
| CORS misconfiguration on API routes | Other sites could fetch financial data | Not relevant for SSG, but if adding API routes, configure CORS to allow only the dashboard domain |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No "last updated" date on dashboard | Investors cannot tell if data is current | Show build timestamp and/or sheet modification date prominently |
| Charts show $0 for companies with no data instead of omitting them | Investors think the company has zero revenue | Omit companies with no data for a given metric; or show "No data available" |
| Number formatting inconsistent (some with $, some without, different decimal places) | Dashboard looks unprofessional | Centralize all number formatting in utility functions; use consistent currency/percentage formats |
| Auth error messages expose internal details | Confusing or alarming to non-technical investors | Show friendly messages: "Access denied. Contact [CFO email] for access." |
| No loading/error states if auth check is slow | Blank screen flicker before redirect | Show a branded loading state while auth resolves |

## "Looks Done But Isn't" Checklist

- [ ] **Sheets integration:** Data renders, but no validation -- test with a deliberately malformed sheet (missing headers, empty rows, text in numeric columns).
- [ ] **Sheets integration:** Works locally with `.env.local`, but env vars are not set in Vercel -- deploy and verify on production.
- [ ] **Sheets integration:** Fetches data for the 4 known companies, but does not dynamically discover new companies added to the sheet.
- [ ] **Auth:** Login works, but there is no logout button or session expiry -- test what happens after 24 hours.
- [ ] **Auth:** Works on the main page, but API routes (if any) are not protected -- test direct API URL access.
- [ ] **Auth:** Email allowlist works, but there is no way for the CFO to modify it without a developer.
- [ ] **Deploy flow:** Build succeeds once, but no documented process for the CFO to trigger subsequent builds.
- [ ] **Error handling:** Dashboard renders with good data, but shows a blank page or crash with no data (sheet is empty or inaccessible).
- [ ] **Service account:** Works today, but the Google Cloud project is on a free trial that will expire, disabling the API.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Credentials leaked to git | HIGH | Revoke the service account key immediately in Google Cloud Console. Generate a new key. Rotate it into Vercel env vars. Audit git history (use BFG Repo-Cleaner to remove the key from history). |
| Sheet structure change breaks dashboard | LOW | Fix the parser to handle the new structure. Add a validation test for the new structure. This is low cost if using header-based parsing; HIGH cost if using hardcoded ranges. |
| Stale data shown to investors | LOW | Trigger a Vercel redeploy. Add a staleness warning banner to prevent recurrence. |
| Auth lockout (nobody can log in) | MEDIUM | Check Vercel function logs. Common causes: expired OAuth client secret, callback URL mismatch after domain change. Fix config and redeploy. |
| Build fails due to Sheets API quota | LOW | Reduce API calls by batching. If urgent, manually export sheet as CSV and use as static fallback. |
| Monolithic component becomes unmaintainable | MEDIUM | Refactor into smaller components. Easier if data model is already generic; harder if data transforms are coupled to component rendering. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Credential leakage | Sheets Integration (start) | .gitignore includes key patterns; no `NEXT_PUBLIC_` Google vars; service account key only in Vercel env vars |
| API quota exceeded | Sheets Integration | Build log shows 1-3 API calls total; no 429 errors across 5 consecutive builds |
| Sheet structure breaks dashboard | Sheets Integration | Deliberately rename a column in a test sheet; build should fail with a clear error, not render wrong data |
| Auth locks out CFO | Authentication | CFO can add an investor email without developer help; CFO can log in after clearing cookies |
| Stale data invisible | Sheets Integration | "Last updated" date is visible on every dashboard page |
| Monolithic data transform | Sheets Integration | Add a new fake company to the sheet; it appears on the dashboard without code changes |
| Service account over-permissioned | Sheets Integration (start) | Service account has Viewer role on the sheet, not Editor |
| No error handling for bad data | Sheets Integration | Build with empty sheet produces a clear error; build with partial data renders what it can with warnings |

## Sources

- Google Sheets API documentation: quotas (300 requests/min/project), batchGet endpoint, service account auth flow
- Next.js documentation: getStaticProps data fetching, environment variable handling (`NEXT_PUBLIC_` prefix behavior), `server-only` package
- Vercel documentation: environment variable configuration, deploy hooks, build caching
- Project context: PROJECT.md constraints (build-time only, manual redeploy, sensitive financial data, 535-line monolith)
- Confidence note: These pitfalls are based on well-established patterns in the Google API and Next.js ecosystems. The specific project constraints (small user base, build-time only, single sheet source of truth) make the recommendations high-confidence. Auth-specific pitfalls are MEDIUM confidence as the auth approach is still TBD per PROJECT.md.

---
*Pitfalls research for: InVitro Capital Investor Dashboard -- Google Sheets integration and authentication*
*Researched: 2026-03-12*
