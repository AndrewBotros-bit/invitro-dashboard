import { Logo } from "@/components/ui/logo";

/**
 * Next.js convention: app/loading.jsx is rendered automatically during
 * the server render of app/page.jsx (and other routes in the same
 * segment). It shows while data fetches and React Server Components
 * resolve. Replaces the "blank screen with browser-tab spinner" with
 * a branded loading state.
 *
 * Why this matters here: the dashboard's home page calls fetchAllData()
 * which makes 5 parallel Google Sheets API requests. On cold deploys
 * or when the Sheets API is slow, this can take 10-60 seconds. Without
 * a loading.jsx, users see the previous page (login form) or a blank
 * screen during that window. With it, they see a clear "the dashboard
 * is loading, please wait" message.
 *
 * Triggers automatically on:
 *   - First navigation to /
 *   - Any internal Next.js router.push() to /
 *   - Hard refreshes while data is being fetched
 *
 * Does NOT trigger when using window.location.href = '/' for navigation
 * (that's a full page reload, browser controls the loading UX). The
 * login page handles that case with its own in-page 'loading' phase.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-5 flex items-center justify-center">
          <Logo size={60} />
        </div>
        <div className="inline-flex items-center gap-3 mb-3">
          <svg
            className="animate-spin h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="text-base font-semibold text-foreground">Loading your dashboard…</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Fetching the latest data from the consolidated sheet. This usually takes 10–30 seconds.
        </p>
      </div>
    </div>
  );
}
