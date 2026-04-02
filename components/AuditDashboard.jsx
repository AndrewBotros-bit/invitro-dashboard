"use client";
import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { fmt } from "@/lib/formatters";
import { rangeTotal, EXCLUDE_REVENUE, EXCLUDE_EBITDA, EXCLUDE_ALWAYS } from "@/lib/chartHelpers";

const AUDIT_PASSWORD = "invitro2026";
const DISPLAY_COMPANIES = ['AllRx', 'AllCare', 'Osta', 'Needles', 'InVitro Studio'];
const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function severityColor(s) {
  if (s === 'critical') return 'bg-red-50 border-red-300 text-red-900';
  if (s === 'warning') return 'bg-amber-50 border-amber-300 text-amber-900';
  return 'bg-blue-50 border-blue-300 text-blue-900';
}
function severityBadge(s) {
  if (s === 'critical') return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white uppercase">Critical</span>;
  if (s === 'warning') return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white uppercase">Warning</span>;
  return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500 text-white uppercase">Info</span>;
}

/* ── Audit Check Functions ── */

function checkExpenseMismatch(data) {
  const alerts = [];
  const year = 2026;
  for (let month = 1; month <= 12; month++) {
    // P&L total expenses (consolidated)
    const pnlTotal = Math.abs(rangeTotal(data.pnl, 'Total Expenses', { year, month }, { year, month }, EXCLUDE_ALWAYS));
    if (pnlTotal === 0) continue;

    // Transaction breakdown total (from data.expenses)
    const txnTotal = (data.expenses || [])
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      })
      .filter(e => e.department !== 'Direct Cost')
      .filter(e => e.gl !== 'Consultation (Invitro)' && e.gl !== 'G&A Depreciation - Machinery & Equipment')
      .reduce((s, e) => s + Math.abs(e.amount ?? 0), 0);

    if (txnTotal === 0) continue;
    const diff = Math.abs(pnlTotal - txnTotal);
    const pctDiff = pnlTotal > 0 ? (diff / pnlTotal * 100) : 0;

    if (pctDiff > 5) {
      alerts.push({
        severity: pctDiff > 15 ? 'critical' : 'warning',
        category: 'Expense Mismatch',
        title: `${MONTHS[month]} ${year} — P&L vs Transaction gap: ${pctDiff.toFixed(1)}%`,
        detail: `P&L Total Expenses: ${fmt(pnlTotal)} | Transaction Breakdown: ${fmt(txnTotal)} | Difference: ${fmt(diff)}`,
        responsible: 'Finance Team',
        month, year,
      });
    }
  }
  return alerts;
}

function checkHCMismatch(data) {
  const alerts = [];
  const year = 2026;
  for (let month = 1; month <= 12; month++) {
    for (const company of DISPLAY_COMPANIES) {
      // Expense HC total
      const expHC = (data.expenses || [])
        .filter(e => {
          const d = new Date(e.date);
          return d.getFullYear() === year && (d.getMonth() + 1) === month && e.company === company && e.category === 'HC';
        })
        .reduce((s, e) => s + Math.abs(e.amount ?? 0), 0);

      // Headcount sheet salary total
      const hcSalary = (data.headcount || [])
        .filter(h => h.company === company)
        .reduce((s, h) => s + (h.salary?.[`${year}-${month}`] ?? 0), 0);

      if (expHC === 0 && hcSalary === 0) continue;
      const diff = Math.abs(expHC - hcSalary);
      const base = Math.max(expHC, hcSalary);
      const pctDiff = base > 0 ? (diff / base * 100) : 0;

      if (pctDiff > 10 && diff > 5000) {
        alerts.push({
          severity: pctDiff > 25 ? 'critical' : 'warning',
          category: 'HC Cost Mismatch',
          title: `${company} — ${MONTHS[month]} ${year}: Expense vs Headcount gap`,
          detail: `Expense HC: ${fmt(expHC)} | Headcount Sheet: ${fmt(hcSalary)} | Diff: ${fmt(diff)} (${pctDiff.toFixed(1)}%)`,
          responsible: `${company} HR/Finance`,
          month, year,
        });
      }
    }
  }
  return alerts;
}

function checkRevenueSanity(data) {
  const alerts = [];
  const year = 2026;
  for (let month = 1; month <= 12; month++) {
    const consolidatedRev = rangeTotal(data.pnl, 'Revenues', { year, month }, { year, month }, EXCLUDE_REVENUE);
    if (consolidatedRev === 0) continue;

    const companySum = DISPLAY_COMPANIES
      .filter(c => !EXCLUDE_REVENUE.includes(c))
      .reduce((s, name) => {
        const co = data.pnl.find(c => c.name === name);
        const rev = (co?.metrics['Revenues'] ?? []).filter(v => v.year === year && v.month === month).reduce((a, v) => a + (v.value ?? 0), 0);
        return s + rev;
      }, 0);

    const diff = Math.abs(consolidatedRev - companySum);
    const pctDiff = consolidatedRev > 0 ? (diff / Math.abs(consolidatedRev) * 100) : 0;

    if (pctDiff > 2 && diff > 1000) {
      alerts.push({
        severity: pctDiff > 10 ? 'critical' : 'warning',
        category: 'Revenue Sanity',
        title: `${MONTHS[month]} ${year} — Company sum ≠ consolidated total`,
        detail: `Consolidated: ${fmt(consolidatedRev)} | Sum of companies: ${fmt(companySum)} | Diff: ${fmt(diff)} (${pctDiff.toFixed(1)}%)`,
        responsible: 'Finance Team',
        month, year,
      });
    }
  }
  return alerts;
}

function checkMissingData(data) {
  const alerts = [];
  const year = 2026;
  for (const company of DISPLAY_COMPANIES) {
    const co = data.pnl.find(c => c.name === company);
    if (!co) continue;
    const revMetric = co.metrics['Revenues'] ?? [];
    const months2026 = revMetric.filter(v => v.year === year);

    // Find gaps: month has no data but adjacent months do
    for (let m = 1; m <= 12; m++) {
      const hasData = months2026.some(v => v.month === m && v.value !== null);
      const prevHas = months2026.some(v => v.month === m - 1 && v.value !== null);
      const nextHas = months2026.some(v => v.month === m + 1 && v.value !== null);
      if (!hasData && (prevHas || nextHas)) {
        alerts.push({
          severity: 'info',
          category: 'Missing Data',
          title: `${company} — ${MONTHS[m]} ${year}: No revenue data`,
          detail: `Adjacent months have data but ${MONTHS[m]} is empty. May need data entry.`,
          responsible: `${company} Finance`,
          month: m, year,
        });
      }
    }
  }
  return alerts;
}

function checkExpensePerCompanyMismatch(data) {
  const alerts = [];
  const year = 2026;
  for (let month = 1; month <= 12; month++) {
    for (const company of DISPLAY_COMPANIES) {
      // P&L SG&A for this company
      const co = data.pnl.find(c => c.name === company);
      const pnlExp = Math.abs((co?.metrics['SG&A + R&D Expenses'] ?? [])
        .filter(v => v.year === year && v.month === month)
        .reduce((s, v) => s + (v.value ?? 0), 0));
      if (pnlExp === 0) continue;

      // Transaction total for this company
      const txnExp = (data.expenses || [])
        .filter(e => {
          const d = new Date(e.date);
          return d.getFullYear() === year && (d.getMonth() + 1) === month && e.company === company;
        })
        .filter(e => e.department !== 'Direct Cost')
        .filter(e => e.gl !== 'Consultation (Invitro)' && e.gl !== 'G&A Depreciation - Machinery & Equipment')
        .reduce((s, e) => s + Math.abs(e.amount ?? 0), 0);

      if (txnExp === 0) continue;
      const diff = Math.abs(pnlExp - txnExp);
      const pctDiff = pnlExp > 0 ? (diff / pnlExp * 100) : 0;

      if (pctDiff > 10 && diff > 3000) {
        alerts.push({
          severity: pctDiff > 20 ? 'critical' : 'warning',
          category: 'Per-Company Expense Gap',
          title: `${company} — ${MONTHS[month]} ${year}: P&L vs breakdown gap`,
          detail: `P&L SG&A: ${fmt(pnlExp)} | Breakdown: ${fmt(txnExp)} | Diff: ${fmt(diff)} (${pctDiff.toFixed(1)}%)`,
          responsible: `${company} Finance`,
          month, year,
        });
      }
    }
  }
  return alerts;
}

/* ── Main Component ── */

export default function AuditDashboard({ data }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'warning' | 'info'
  const [categoryFilter, setCategoryFilter] = useState('all');

  const allAlerts = useMemo(() => {
    if (!authenticated) return [];
    return [
      ...checkExpenseMismatch(data),
      ...checkExpensePerCompanyMismatch(data),
      ...checkHCMismatch(data),
      ...checkRevenueSanity(data),
      ...checkMissingData(data),
    ].sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
    });
  }, [authenticated, data]);

  const categories = useMemo(() => ['all', ...new Set(allAlerts.map(a => a.category))], [allAlerts]);

  const filtered = allAlerts
    .filter(a => filter === 'all' || a.severity === filter)
    .filter(a => categoryFilter === 'all' || a.category === categoryFilter);

  const counts = {
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    warning: allAlerts.filter(a => a.severity === 'warning').length,
    info: allAlerts.filter(a => a.severity === 'info').length,
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-center">Audit Console</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); if (password === AUDIT_PASSWORD) { setAuthenticated(true); setError(''); } else { setError('Invalid password'); } }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter audit password"
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                autoFocus
              />
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              <Button type="submit" className="w-full">Access Audit Console</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-white px-8 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">InVitro Capital — Audit Console</h1>
            <p className="text-xs text-muted-foreground">Data integrity checks • {new Date(data.fetchedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-red-100 text-red-700 font-semibold">{counts.critical} Critical</span>
              <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 font-semibold">{counts.warning} Warning</span>
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 font-semibold">{counts.info} Info</span>
            </div>
            <a href="/" className="text-xs text-blue-600 hover:underline">← Back to Dashboard</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex bg-muted rounded-lg p-0.5">
            {['all', 'critical', 'warning', 'info'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filter === s ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {s === 'all' ? `All (${allAlerts.length})` : `${s} (${counts[s]})`}
              </button>
            ))}
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring">
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
          </select>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className={counts.critical > 0 ? 'border-red-300 bg-red-50/50' : 'border-emerald-300 bg-emerald-50/50'}>
            <CardContent className="py-4 px-5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expense Integrity</p>
              <p className="text-xl font-bold">{allAlerts.filter(a => a.category.includes('Expense')).length === 0 ? '✓ Clean' : `${allAlerts.filter(a => a.category.includes('Expense')).length} issues`}</p>
            </CardContent>
          </Card>
          <Card className={allAlerts.some(a => a.category === 'HC Cost Mismatch' && a.severity === 'critical') ? 'border-red-300 bg-red-50/50' : 'border-emerald-300 bg-emerald-50/50'}>
            <CardContent className="py-4 px-5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">HC Cost Integrity</p>
              <p className="text-xl font-bold">{allAlerts.filter(a => a.category === 'HC Cost Mismatch').length === 0 ? '✓ Clean' : `${allAlerts.filter(a => a.category === 'HC Cost Mismatch').length} issues`}</p>
            </CardContent>
          </Card>
          <Card className={allAlerts.some(a => a.category === 'Revenue Sanity' && a.severity === 'critical') ? 'border-red-300 bg-red-50/50' : 'border-emerald-300 bg-emerald-50/50'}>
            <CardContent className="py-4 px-5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Revenue Integrity</p>
              <p className="text-xl font-bold">{allAlerts.filter(a => a.category === 'Revenue Sanity').length === 0 ? '✓ Clean' : `${allAlerts.filter(a => a.category === 'Revenue Sanity').length} issues`}</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-medium text-muted-foreground">All checks passed — no issues found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert, i) => (
              <div key={i} className={`rounded-lg border p-4 ${severityColor(alert.severity)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {severityBadge(alert.severity)}
                      <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">{alert.category}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">→ {alert.responsible}</span>
                    <a
                      href={`mailto:?subject=Audit Alert: ${encodeURIComponent(alert.title)}&body=${encodeURIComponent(`Hi,\n\nAn audit check flagged the following issue:\n\n${alert.title}\n${alert.detail}\n\nPlease review and resolve.\n\nThanks,\nAndrew`)}`}
                      className="px-3 py-1.5 text-[10px] font-semibold rounded-md bg-white border border-border shadow-sm hover:shadow-md transition-shadow text-foreground"
                    >
                      Send Email
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Data freshness */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Last data fetch: {new Date(data.fetchedAt).toLocaleString()} • Checks run on {allAlerts.length} data points across {DISPLAY_COMPANIES.length} companies
          </p>
        </div>
      </main>
    </div>
  );
}
