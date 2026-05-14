"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Two-phase loading state so the user gets accurate feedback:
  // 'idle'      — sign-in button enabled
  // 'signing'   — calling /api/auth/login
  // 'loading'   — login succeeded; dashboard is fetching sheet data
  //               (this can take 30-60s on cold deploys due to Google
  //                Sheets latency × 5 parallel ranges, so we show
  //                a separate visible state)
  const [phase, setPhase] = useState('idle');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setPhase('signing');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setPhase('idle');
        return;
      }
      // Login succeeded — now we wait for the dashboard server-render
      // to finish (which includes fetching all sheet data). Show a
      // dedicated loading state so the user knows they're past auth.
      setPhase('loading');
      window.location.href = '/';
    } catch {
      setError('Network error');
      setPhase('idle');
    }
  }

  const loading = phase !== 'idle';

  // Full-screen "Loading dashboard…" overlay shown AFTER login succeeds
  // while the dashboard server-render is fetching sheet data. Replaces the
  // confusing "Signing in…" hang. When sheet fetches are slow (cold start,
  // 5 parallel ranges, etc.), this can take 30-60s — the spinner + message
  // tells the user it's not stuck.
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <Logo size={60} />
          </div>
          <div className="inline-flex items-center gap-3 mb-3">
            {/* Inline SVG spinner — no external CSS animation needed,
                lightweight and reliable across browsers. */}
            <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          {/* Login uses the larger icon (60px) — there's room here for a
              more prominent brand moment than the sidebar allows. */}
          <div className="mx-auto mb-3 flex items-center justify-center">
            <Logo size={60} />
          </div>
          <CardTitle className="text-xl">InVitro Capital</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Shareholder Dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {phase === 'signing' ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
