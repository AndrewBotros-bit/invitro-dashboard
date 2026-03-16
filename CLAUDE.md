# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server
- `npm run build` — production build (also validates the app compiles)
- `npm run start` — serve production build locally
- `npx vitest run` — run all tests
- `npx vitest run tests/data/env.test.js` — run specific test file
- No linter is configured yet.

## Architecture

This is a Next.js 14 (App Router) shareholder dashboard for InVitro Capital, deployed on Vercel. It displays consolidated financials across portfolio companies (AllRx, AllCare, Osta, Needles, InVitro Studio).

**Current state:** The dashboard component (`components/Dashboard.jsx`, ~535 lines) is a single monolithic client component with all financial data hardcoded inline. An active initiative is replacing this with build-time data fetching from Google Sheets.

### Data flow (in progress)

- **Source of truth:** Google Sheet named "InVitro Capital Consolidated - Actual"
- `lib/googleSheets.js` — Google Sheets API client using service account auth. Requires env vars: `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `INVITRO_MAIN_CONSOLIDATED_SHEET_ID`
- The plan is build-time fetch (not runtime) — no API keys in the browser

### UI layer

- shadcn/ui-style components in `components/ui/` (card, badge, table, tabs) — manually created, not using the shadcn CLI
- Charts via Recharts (Bar, Line, Area, Pie, Composed)
- Tailwind CSS with dark theme using HSL CSS custom properties defined in `app/globals.css`
- `@/*` path alias maps to project root (configured in `jsconfig.json`)
- `lib/utils.js` exports `cn()` (clsx + tailwind-merge)

## Key constraints

- Financial data is sensitive — must not be hardcoded in source or committed to git
- The Google Sheet structure dictates what the dashboard shows — adapt to the sheet, not vice versa
- Deploy workflow: CFO manually redeploys on Vercel after updating the sheet

## Google Workspace

You have access to Google Workspace via the `gws` CLI tool. Use it when the user asks about emails, files, spreadsheets, calendar, or documents that aren't in the local project.

## InVitro Capital Financials

When the user asks about any financial numbers related to InVitro Capital holdings, always look up the Google Sheet named **"InVitro Capital Consolidated - Actual"** using `gws sheets` and answer from the data there.
