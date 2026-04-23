"use client";
import { useState, Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { fmt, fmtShort, pct } from "@/lib/formatters";
import { buildColorMap, buildMonthlySeries, buildCashflowSeries, annualTotal, monthlyTotal, getAvailableMonths, filterSeriesToRange, buildYearlySeries, rangeTotal, EXCLUDE_REVENUE, EXCLUDE_EBITDA, EXCLUDE_ALWAYS, PALETTE } from "@/lib/chartHelpers";
import { Button } from "@/components/ui/button";
import { generateInsights } from "@/lib/insights";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import DashboardSidebar from "@/components/DashboardSidebar";

/* ── Chart styling constants ── */
const CHART_STYLE = {
  positive: "#16a34a",
  negative: "#dc2626",
  muted: "#64748b",
  border: "#e2e8f0",
  totalLine: "#0f172a",
};

/* ── Sub-components ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-lg min-w-[160px]">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 my-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-muted-foreground">{entry.name}:</span>
          <span className="text-xs font-semibold text-foreground ml-auto">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

function ComparisonScorecard({ title, companies, currentData, compData, colorMap, formatter = fmt }) {
  // currentData & compData: [{ name, value }]
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {companies.map(name => {
            const cur = currentData.find(d => d.name === name)?.value ?? 0;
            const comp = compData.find(d => d.name === name)?.value ?? 0;
            const pct = comp !== 0 ? ((cur - comp) / Math.abs(comp) * 100).toFixed(1) : null;
            const up = pct !== null && Number(pct) >= 0;
            const maxVal = Math.max(...companies.map(n => Math.max(
              Math.abs(currentData.find(d => d.name === n)?.value ?? 0),
              Math.abs(compData.find(d => d.name === n)?.value ?? 0)
            )), 1);
            const curWidth = Math.abs(cur) / maxVal * 100;
            const compWidth = Math.abs(comp) / maxVal * 100;
            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap[name] }} />
                    <span className="text-xs font-medium text-foreground">{name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold tabular-nums">{formatter(cur)}</span>
                    {pct !== null && (
                      <span className={`text-[10px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                        {up ? '▲' : '▼'} {Math.abs(Number(pct))}%
                      </span>
                    )}
                  </div>
                </div>
                {/* Current period bar */}
                <div className="relative h-5 rounded-sm overflow-hidden bg-muted/30">
                  <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${curWidth}%`, backgroundColor: colorMap[name], opacity: 0.85 }} />
                  {/* Comparison period bar (outline) */}
                  <div className="absolute inset-y-0 left-0 rounded-sm border-2 border-dashed" style={{ width: `${compWidth}%`, borderColor: colorMap[name], opacity: 0.5 }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Current: {formatter(cur)}</span>
                  <span>Prior: {formatter(comp)}</span>
                </div>
              </div>
            );
          })}
          {/* Total row */}
          {(() => {
            const curTotal = currentData.reduce((s, d) => s + (d.value ?? 0), 0);
            const compTotal = compData.reduce((s, d) => s + (d.value ?? 0), 0);
            const pct = compTotal !== 0 ? ((curTotal - compTotal) / Math.abs(compTotal) * 100).toFixed(1) : null;
            const up = pct !== null && Number(pct) >= 0;
            return (
              <div className="pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Total</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums">{formatter(curTotal)}</span>
                    <span className="text-xs text-muted-foreground">vs {formatter(compTotal)}</span>
                    {pct !== null && (
                      <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                        {up ? '▲' : '▼'} {Math.abs(Number(pct))}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonBadge({ current, compValue, compLabel }) {
  if (!compValue || compValue === 0 || current == null) return null;
  const pct = ((current - compValue) / Math.abs(compValue) * 100).toFixed(1);
  const up = Number(pct) >= 0;
  return (
    <div className="mt-1">
      <span className={`text-[10px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
        {up ? '▲' : '▼'} {Math.abs(Number(pct))}% vs {compLabel}
      </span>
    </div>
  );
}

function KPICard({ title, value, subtitle, trend, trendUp, comparison }) {
  return (
    <Card className="flex-1 min-w-[220px] gap-2 py-4 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="space-y-1 px-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`text-[11px] font-semibold ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
              {trendUp ? "\u25B2" : "\u25BC"} {trend}
            </span>
          )}
          {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
        </div>
        {comparison}
      </CardContent>
    </Card>
  );
}

function InsightCard({ icon, title, body, type = "info" }) {
  const styles = {
    positive: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-red-50 border-red-200 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };
  const subtextStyles = {
    positive: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    info: "text-blue-700",
  };
  return (
    <div className={`rounded-lg border p-4 mb-3 ${styles[type]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className={`text-sm leading-relaxed ${subtextStyles[type]}`}>{body}</p>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function InVitroDashboard({ data, user }) {
  // Permission helpers
  const perms = user?.permissions || { companies: '*', tabs: '*', breakdowns: '*' };
  const canSeeCompany = (name) => perms.companies === '*' || (Array.isArray(perms.companies) && perms.companies.includes(name));
  const canSeeTab = (tab) => perms.tabs === '*' || (Array.isArray(perms.tabs) && perms.tabs.includes(tab));
  const canBreakdown = (key, company = null) => {
    if (perms.breakdowns === '*') return true;
    const val = perms.breakdowns?.[key];
    if (val === true) return true;
    if (val === false || val == null) return false;
    if (Array.isArray(val)) {
      if (company === null) return val.length > 0;
      return val.includes(company);
    }
    return false;
  };
  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState(null);

  // Sidebar & navigation state
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Company selector state
  const ALL_COMPANIES = ['AllRx', 'AllCare', 'Osta', 'Needles', 'InVitro Studio'];
  const DISPLAY_COMPANIES = ALL_COMPANIES.filter(canSeeCompany);
  const [selectedCompany, setSelectedCompany] = useState(null); // null = consolidated
  const [expenseDrilldown, setExpenseDrilldown] = useState(null); // { year, month } or null
  const [revenueDrilldown, setRevenueDrilldown] = useState(null); // { year, month } or null
  const [expandedDept, setExpandedDept] = useState(null); // 'G&A' | 'GTM' | etc. or null
  const [expandedGL, setExpandedGL] = useState(null); // GL name string or null

  // View mode & date range state
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareFromKey, setCompareFromKey] = useState(null); // null = auto-compute
  const [compareToKey, setCompareToKey] = useState(null);
  const availableMonths = getAvailableMonths(data.pnl);
  // Available years (unique, sorted)
  const availableYears = [...new Set(availableMonths.map(m => m.year))].sort();
  // Default to current FY (Jan–Dec of currentYear)
  const defaultFrom = availableMonths.find(m => m.year === 2026 && m.month === 1) ?? availableMonths[0] ?? { year: 2026, month: 1, key: '2026-1', label: 'Jan 26' };
  const defaultTo = availableMonths.find(m => m.year === 2026 && m.month === 12) ?? availableMonths[availableMonths.length - 1] ?? { year: 2026, month: 12, key: '2026-12', label: 'Dec 26' };
  const [rangeFromKey, setRangeFromKey] = useState(defaultFrom.key);
  const [rangeToKey, setRangeToKey] = useState(defaultTo.key);
  const [yearFrom, setYearFrom] = useState(2026);
  const [yearTo, setYearTo] = useState(2026);
  // Resolve range based on viewMode
  const rangeFrom = viewMode === 'yearly'
    ? { year: yearFrom, month: 1, key: `${yearFrom}-1`, label: `Jan ${String(yearFrom).slice(-2)}` }
    : (availableMonths.find(m => m.key === rangeFromKey) ?? defaultFrom);
  const rangeTo = viewMode === 'yearly'
    ? { year: yearTo, month: 12, key: `${yearTo}-12`, label: `Dec ${String(yearTo).slice(-2)}` }
    : (availableMonths.find(m => m.key === rangeToKey) ?? defaultTo);
  const rangeLabel = viewMode === 'yearly'
    ? (yearFrom === yearTo ? String(yearFrom) : `${yearFrom}–${yearTo}`)
    : `${rangeFrom.label}–${rangeTo.label}`;

  // ── Comparison range (user-selected or disabled) ──
  const MONTHS_S = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtCompLabel = (r) => {
    if (r.from.month === r.to.month && r.from.year === r.to.year)
      return `${MONTHS_S[r.from.month]} ${String(r.from.year).slice(-2)}`;
    if (r.from.year === r.to.year)
      return `${MONTHS_S[r.from.month]}–${MONTHS_S[r.to.month]} ${String(r.to.year).slice(-2)}`;
    return `${MONTHS_S[r.from.month]} ${String(r.from.year).slice(-2)}–${MONTHS_S[r.to.month]} ${String(r.to.year).slice(-2)}`;
  };
  // Resolve comparison range from user selection or default to YoY
  const compFromResolved = compareFromKey ? (() => {
    const [y, m] = compareFromKey.split('-').map(Number);
    return { year: y, month: m };
  })() : { year: rangeFrom.year - 1, month: rangeFrom.month };
  const compToResolved = compareToKey ? (() => {
    const [y, m] = compareToKey.split('-').map(Number);
    return { year: y, month: m };
  })() : { year: rangeTo.year - 1, month: rangeTo.month };
  const compRange = { from: compFromResolved, to: compToResolved };
  const compLabel = compareEnabled ? fmtCompLabel(compRange) : '';

  // Color map from dynamic company list
  const colorMap = buildColorMap(data.companies);

  // Dynamic exclude lists based on selectedCompany
  const allNames = data.pnl.map(c => c.name);
  const dynExcludeRevenue = selectedCompany
    ? allNames.filter(n => n !== selectedCompany)
    : EXCLUDE_REVENUE;
  const dynExcludeEbitda = selectedCompany
    ? allNames.filter(n => n !== selectedCompany)
    : EXCLUDE_EBITDA;

  // Determine current and prior year from data
  const allYears = data.pnl.flatMap(c =>
    Object.values(c.metrics).flat().map(v => v.year)
  );
  const currentYear = 2026;
  const priorYear = currentYear - 1;
  const hasPriorYear = allYears.includes(priorYear);

  // Monthly KPI logic: use last actual month from P&L sheet row 2
  const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lastActual = data.lastActualMonth;
  const prevMonth = lastActual?.month ?? ((new Date().getMonth()) || 12);
  const prevMonthYear = lastActual?.year ?? (prevMonth === 12 ? currentYear - 1 : currentYear);
  const prevMonthLabel = MONTH_NAMES[prevMonth];
  const currentMonth = prevMonth === 12 ? 1 : prevMonth + 1;
  const currMonthLabel = MONTH_NAMES[currentMonth];

  // Previous month actuals
  const prevRevenue = monthlyTotal(data.pnl, 'Revenues', prevMonthYear, prevMonth, dynExcludeRevenue);
  const currRevenue = monthlyTotal(data.pnl, 'Revenues', currentYear, currentMonth, dynExcludeRevenue);
  const prevEbitda = monthlyTotal(data.pnl, 'EBITDA', prevMonthYear, prevMonth, dynExcludeEbitda);
  const currEbitda = monthlyTotal(data.pnl, 'EBITDA', currentYear, currentMonth, dynExcludeEbitda);
  const prevGrossProfit = monthlyTotal(data.pnl, 'Gross Profit', prevMonthYear, prevMonth, dynExcludeRevenue);
  const prevGrossMargin = prevRevenue > 0 ? prevGrossProfit / prevRevenue : null;
  const currGrossProfit = monthlyTotal(data.pnl, 'Gross Profit', currentYear, currentMonth, dynExcludeRevenue);
  const currGrossMargin = currRevenue > 0 ? currGrossProfit / currRevenue : null;

  // Range-based KPI totals (used when viewMode === 'yearly')
  const rangeRevenue = rangeTotal(data.pnl, 'Revenues', rangeFrom, rangeTo, dynExcludeRevenue);
  const rangeEbitda = rangeTotal(data.pnl, 'EBITDA', rangeFrom, rangeTo, dynExcludeEbitda);
  const rangeGrossProfit = rangeTotal(data.pnl, 'Gross Profit', rangeFrom, rangeTo, dynExcludeRevenue);
  const rangeGrossMargin = rangeRevenue > 0 ? rangeGrossProfit / rangeRevenue : null;

  // Cashflow: use selected company's data, or consolidated "ALL Holdings"
  const consolidatedCF = selectedCompany
    ? data.cashflow.find(c => c.name === selectedCompany)
    : data.cashflow.find(c => c.name === 'ALL Holdings');
  const cfMonthVal = (metric, year, month) => {
    if (!consolidatedCF) return 0;
    // Try exact metric name first, then fallbacks for per-company variants
    const fallbacks = {
      'Total Cash Inflow': ['Cash Inflow'],
      'Total Cash Outflow': ['Cash Outflow'],
      'Total net cash movement': ['Net Cash Flow', 'Direct Operational Cash Flow', 'Operational Cash Flow'],
      'Consolidated Cash balance': ['Cash Balance'],
    };
    let vals = consolidatedCF.metrics[metric];
    if (!vals && fallbacks[metric]) {
      for (const fb of fallbacks[metric]) {
        if (consolidatedCF.metrics[fb]) { vals = consolidatedCF.metrics[fb]; break; }
      }
    }
    vals = vals ?? [];
    const mv = vals.find(v => v.year === year && v.month === month);
    return mv?.value ?? 0;
  };
  const prevInflow = cfMonthVal('Total Cash Inflow', prevMonthYear, prevMonth);
  const currInflow = cfMonthVal('Total Cash Inflow', currentYear, currentMonth);
  const prevNetCash = cfMonthVal('Total net cash movement', prevMonthYear, prevMonth);
  const currNetCash = cfMonthVal('Total net cash movement', currentYear, currentMonth);

  // Revenue companies (excl. InVitro Studio + always-hidden)
  const revenueCompanies = data.pnl
    .filter(c => !dynExcludeRevenue.includes(c.name))
    .map(c => c.name);

  // EBITDA companies (InVitro Studio included)
  const allCompanyNames = data.pnl
    .filter(c => !dynExcludeEbitda.includes(c.name))
    .map(c => c.name);

  // Build chart data series — responsive to viewMode + dateRange
  const rawRevenueByMonth = buildMonthlySeries(data.pnl, 'Revenues', dynExcludeRevenue, null);
  const rawEbitdaByMonth = buildMonthlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, null);
  const revenueByMonth = viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'Revenues', dynExcludeRevenue, yearFrom, yearTo)
    : filterSeriesToRange(rawRevenueByMonth, rangeFrom, rangeTo, availableMonths);
  const ebitdaByMonth = viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, yearFrom, yearTo)
    : filterSeriesToRange(rawEbitdaByMonth, rangeFrom, rangeTo, availableMonths);
  // ── Comparison ghost series (dashed overlay) ──
  // Build comparison series aligned to current period months
  const compRevenueByMonth = compareEnabled ? (viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'Revenues', dynExcludeRevenue, compRange.from.year, compRange.to.year)
    : filterSeriesToRange(rawRevenueByMonth, compRange.from, compRange.to, availableMonths)
  ) : [];
  const compEbitdaByMonth = compareEnabled ? (viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, compRange.from.year, compRange.to.year)
    : filterSeriesToRange(rawEbitdaByMonth, compRange.from, compRange.to, availableMonths)
  ) : [];
  // Merge comparison Total into current series (align by index, not by month label)
  const addCompTotal = (currentSeries, compSeries) => {
    if (!compareEnabled || compSeries.length === 0) return currentSeries;
    return currentSeries.map((point, idx) => {
      const compPoint = compSeries[idx];
      if (!compPoint) return point;
      // Sum all numeric values in compPoint (except 'month') for total
      const compTotal = Object.entries(compPoint).reduce((s, [k, v]) => k === 'month' ? s : s + (Number(v) || 0), 0);
      return { ...point, Total_comp: compTotal };
    });
  };
  // grossMarginByMonth is now computed inline from Revenue & Gross Profit
  // Build cashflow series — metric names differ between consolidated and per-company
  const cashBalanceByMonth = (() => {
    if (!consolidatedCF) return [];
    const fromVal = rangeFrom.year * 100 + rangeFrom.month;
    const toVal = rangeTo.year * 100 + rangeTo.month;
    // Consolidated uses "Total Cash Inflow", per-company uses "Cash Inflow"
    // Find first available metric name from a priority list
    const findMetric = (...keys) => keys.find(k => consolidatedCF.metrics[k]) || keys[0];
    const inflowKey = findMetric('Total Cash Inflow', 'Cash Inflow');
    const outflowKey = findMetric('Total Cash Outflow', 'Cash Outflow');
    const opsCFKey = findMetric('Holdings net cash movement', 'Operating Cash Flow', 'Operational Cash Flow', 'Direct Operational Cash Flow', 'Operational Cash Flow (Internal budget)');
    const netKey = findMetric('Total net cash movement', 'Net Cash Flow', 'Direct Operational Cash Flow', 'Operational Cash Flow');
    const inRangeCF = (v) => {
      const pv = v.year * 100 + v.month;
      return pv >= fromVal && pv <= toVal;
    };
    const inflowMetric = (consolidatedCF.metrics[inflowKey] ?? []).filter(inRangeCF);
    const outflowMetric = (consolidatedCF.metrics[outflowKey] ?? []).filter(inRangeCF);
    const opsCFMetric = (consolidatedCF.metrics[opsCFKey] ?? []).filter(inRangeCF);
    const netMetric = (consolidatedCF.metrics[netKey] ?? []).filter(inRangeCF);
    const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return inflowMetric
      .map((mv, i) => ({
        month: `${MONTHS[mv.month]} ${String(mv.year).slice(-2)}`,
        inflow: mv.value ?? 0,
        outflow: Math.abs(outflowMetric[i]?.value ?? 0),
        opsCashFlow: opsCFMetric[i]?.value ?? 0,
        net: netMetric[i]?.value ?? 0,
        _year: mv.year,
        _month: mv.month,
      }))
      .filter(p => {
        const pVal = p._year * 100 + p._month;
        return pVal >= fromVal && pVal <= toVal;
      });
  })();

  // Revenue by month with Total
  const revenueByMonthWithTotal = addCompTotal(revenueByMonth.map(point => ({
    ...point,
    Total: revenueCompanies.reduce((sum, name) => sum + (point[name] ?? 0), 0),
  })), compRevenueByMonth);

  // EBITDA by month with Total
  const ebitdaByMonthWithTotal = addCompTotal(ebitdaByMonth.map(point => ({
    ...point,
    Total: allCompanyNames.reduce((sum, name) => sum + (point[name] ?? 0), 0),
  })), compEbitdaByMonth);

  // Expenses data — InVitro Studio uses "Fixed Expenses" + "Direct Expenses"; others use "SG&A + R&D Expenses"
  // Helper: get expense values for a company (handles InVitro Studio's different metric names)
  const getCompanyExpenseValues = (co) => {
    if (!co) return [];
    if (co.name === 'InVitro Studio') {
      // Merge Fixed + Direct expenses by month
      const fixed = co.metrics['Fixed Expenses'] ?? [];
      const direct = co.metrics['Direct Expenses'] ?? [];
      const byKey = {};
      for (const v of [...fixed, ...direct]) {
        const k = `${v.year}-${v.month}`;
        byKey[k] = byKey[k] || { year: v.year, month: v.month, value: 0 };
        byKey[k].value += v.value ?? 0;
      }
      return Object.values(byKey);
    }
    return co.metrics['SG&A + R&D Expenses'] ?? [];
  };
  const getExpenseLabel = () => {
    if (!selectedCompany) return 'Total Expenses';
    if (selectedCompany === 'InVitro Studio') return 'Fixed + Direct Expenses';
    return 'SG&A + R&D';
  };
  // For the chart: consolidated shows per-company breakdown, individual shows single company
  const expenseChartCompanies = selectedCompany
    ? [selectedCompany]
    : data.pnl.filter(c => !dynExcludeEbitda.includes(c.name)).map(c => c.name);
  // Build expense chart series — handles InVitro Studio's different metric names
  const expenseByMonth = (() => {
    const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // If single company is InVitro Studio, build series from Fixed+Direct
    if (selectedCompany === 'InVitro Studio') {
      const studio = data.pnl.find(c => c.name === 'InVitro Studio');
      if (!studio) return [];
      const vals = getCompanyExpenseValues(studio);
      const fromVal = rangeFrom.year * 100 + rangeFrom.month;
      const toVal = rangeTo.year * 100 + rangeTo.month;
      if (viewMode === 'yearly') {
        const byYear = {};
        for (const v of vals) {
          if (v.year < yearFrom || v.year > yearTo) continue;
          byYear[v.year] = byYear[v.year] || { month: String(v.year), 'InVitro Studio': 0 };
          byYear[v.year]['InVitro Studio'] += v.value ?? 0;
        }
        return Object.values(byYear).sort((a, b) => a.month - b.month);
      }
      return vals
        .filter(v => { const pv = v.year * 100 + v.month; return pv >= fromVal && pv <= toVal; })
        .map(v => ({ month: `${MONTHS[v.month]} ${String(v.year).slice(-2)}`, 'InVitro Studio': v.value ?? 0 }));
    }
    // Standard: use SG&A + R&D Expenses, then merge InVitro Studio
    const rawSgna = buildMonthlySeries(data.pnl, 'SG&A + R&D Expenses', dynExcludeEbitda, null);
    const base = viewMode === 'yearly'
      ? buildYearlySeries(data.pnl, 'SG&A + R&D Expenses', dynExcludeEbitda, yearFrom, yearTo)
      : filterSeriesToRange(rawSgna, rangeFrom, rangeTo, availableMonths);
    // Merge InVitro Studio's Fixed+Direct into the consolidated series
    const studio = data.pnl.find(c => c.name === 'InVitro Studio');
    if (studio && !dynExcludeEbitda.includes('InVitro Studio')) {
      const studioVals = getCompanyExpenseValues(studio);
      for (const point of base) {
        const match = studioVals.find(v => {
          if (viewMode === 'yearly') return String(v.year) === point.month;
          return `${MONTHS[v.month]} ${String(v.year).slice(-2)}` === point.month;
        });
        if (match) point['InVitro Studio'] = match.value;
      }
    }
    return base;
  })();
  // Flip expense signs to positive for display
  const expenseByMonthPositive = expenseByMonth.map(point => {
    const flipped = { month: point.month };
    for (const name of expenseChartCompanies) {
      flipped[name] = Math.abs(point[name] ?? 0);
    }
    return flipped;
  });
  const compExpenseByMonth = compareEnabled ? (() => {
    const rawExp = buildMonthlySeries(data.pnl, selectedCompany ? 'SG&A + R&D Expenses' : 'Total Expenses', dynExcludeEbitda, null);
    return viewMode === 'yearly'
      ? buildYearlySeries(data.pnl, selectedCompany ? 'SG&A + R&D Expenses' : 'Total Expenses', dynExcludeEbitda, compRange.from.year, compRange.to.year)
      : filterSeriesToRange(rawExp, compRange.from, compRange.to, availableMonths);
  })() : [];
  const expenseByMonthWithTotal = addCompTotal(expenseByMonthPositive.map(point => ({
    ...point,
    Total: expenseChartCompanies.reduce((sum, name) => sum + (point[name] ?? 0), 0),
  })), compExpenseByMonth.map(p => {
    const total = Object.entries(p).reduce((s, [k, v]) => k === 'month' ? s : s + Math.abs(Number(v) || 0), 0);
    return { month: p.month, Total: total };
  }));

  // Annual totals
  const totalRevCurrent = annualTotal(data.pnl, 'Revenues', currentYear, dynExcludeRevenue);
  const totalRevPrior = annualTotal(data.pnl, 'Revenues', priorYear, dynExcludeRevenue);
  const revGrowth = hasPriorYear && totalRevPrior > 0
    ? (totalRevCurrent - totalRevPrior) / totalRevPrior
    : null;

  const totalEbitdaCurrent = annualTotal(data.pnl, 'EBITDA', currentYear, dynExcludeEbitda);
  const totalEbitdaPrior = annualTotal(data.pnl, 'EBITDA', priorYear, dynExcludeEbitda);
  const ebitdaSwing = hasPriorYear ? totalEbitdaCurrent - totalEbitdaPrior : null;
  const ebitdaMargin = totalRevCurrent > 0 ? totalEbitdaCurrent / totalRevCurrent : null;

  const totalGrossProfitCurrent = annualTotal(data.pnl, 'Gross Profit', currentYear, dynExcludeRevenue);
  const grossMarginCurrent = totalRevCurrent > 0 ? totalGrossProfitCurrent / totalRevCurrent : null;
  const totalGrossProfitPrior = annualTotal(data.pnl, 'Gross Profit', priorYear, dynExcludeRevenue);
  const grossMarginPrior = totalRevPrior > 0 ? totalGrossProfitPrior / totalRevPrior : null;
  const grossMarginChange = grossMarginCurrent !== null && grossMarginPrior !== null
    ? grossMarginCurrent - grossMarginPrior
    : null;

  // Cashflow totals from consolidated "ALL Holdings"
  const totalInflow = cashBalanceByMonth.reduce((s, m) => s + m.inflow, 0);
  const totalOutflow = cashBalanceByMonth.reduce((s, m) => s + m.outflow, 0);
  const totalNetCash = cashBalanceByMonth.reduce((s, m) => s + m.net, 0);
  const monthCount = cashBalanceByMonth.length || 1;
  const totalOpsCF = cashBalanceByMonth.reduce((s, m) => s + m.opsCashFlow, 0);
  const avgMonthlyBurn = totalOpsCF / monthCount;
  const endingOpsCF = cashBalanceByMonth.length > 0
    ? cashBalanceByMonth[cashBalanceByMonth.length - 1].opsCashFlow
    : 0;

  // Range-aware metric filter: returns values within selected range
  const inRange = (v) => {
    const pv = v.year * 100 + v.month;
    return pv >= rangeFrom.year * 100 + rangeFrom.month && pv <= rangeTo.year * 100 + rangeTo.month;
  };

  // Expense breakdown per company for pie chart
  const expensePieData = data.pnl
    .filter(c => !dynExcludeEbitda.includes(c.name))
    .map(c => {
      const vals = getCompanyExpenseValues(c).filter(inRange);
      const total = vals.reduce((s, v) => s + Math.abs(v.value ?? 0), 0);
      return { name: c.name, value: total, color: colorMap[c.name] };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Expense range totals (depend on inRange)
  const rangeExpenses = (() => {
    if (selectedCompany) {
      const co = data.pnl.find(c => c.name === selectedCompany);
      return getCompanyExpenseValues(co).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
    }
    const allH = data.pnl.find(c => c.name === 'ALL Holdings');
    return (allH?.metrics['Total Expenses'] ?? []).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
  })();
  const avgMonthlyExpense = monthCount > 0 ? rangeExpenses / monthCount : 0;

  // Cash runway from consolidated sheet row 180 (only for consolidated view)
  const cashRunwayValues = !selectedCompany ? (data.cashRunwayRow ?? []).filter(inRange) : [];
  const runwayMonths = cashRunwayValues.length > 0
    ? cashRunwayValues.reduce((s, v) => s + (v.value ?? 0), 0) / cashRunwayValues.length
    : null;

  // EBITDA contribution by company (InVitro Studio included)
  const companyEbitdaData = data.pnl
    .filter(c => !dynExcludeEbitda.includes(c.name))
    .map(c => {
      const vals = (c.metrics['EBITDA'] ?? []).filter(inRange);
      const total = vals.reduce((s, v) => s + (v.value ?? 0), 0);
      return { name: c.name, value: total };
    }).sort((a, b) => b.value - a.value);

  // Revenue pie (excl. InVitro Studio)
  const revenuePieData = data.pnl
    .filter(c => !dynExcludeRevenue.includes(c.name))
    .map(c => {
      const vals = (c.metrics['Revenues'] ?? []).filter(inRange);
      const total = vals.reduce((s, v) => s + (v.value ?? 0), 0);
      return { name: c.name, value: total, color: colorMap[c.name] };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Company performance table rows (EBITDA scope — includes InVitro Studio)
  // Uses range filter so table respects the selected date range
  const companyRows = data.pnl.filter(c => !dynExcludeEbitda.includes(c.name)).map(c => {
    const revCurrent = (c.metrics['Revenues'] ?? []).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
    // Use comparison range when enabled, otherwise fall back to prior year
    const inCompRange = (v) => {
      const pv = v.year * 100 + v.month;
      return pv >= compRange.from.year * 100 + compRange.from.month && pv <= compRange.to.year * 100 + compRange.to.month;
    };
    const revPrior = compareEnabled
      ? (c.metrics['Revenues'] ?? []).filter(inCompRange).reduce((s, v) => s + (v.value ?? 0), 0)
      : (c.metrics['Revenues'] ?? []).filter(v => v.year === priorYear).reduce((s, v) => s + (v.value ?? 0), 0);
    const ebitda = (c.metrics['EBITDA'] ?? []).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
    const gp = (c.metrics['Gross Profit'] ?? []).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
    const grossMargin = revCurrent > 0 ? gp / revCurrent : null;
    const companyRevGrowth = revPrior > 0 ? (revCurrent - revPrior) / revPrior : null;
    return { name: c.name, rev: revCurrent, ebitda, grossMargin, revGrowth: companyRevGrowth, color: colorMap[c.name] };
  });

  // Totals row (excl holdings) — uses range-filtered data to match individual rows
  const totalRowRev = companyRows.filter(c => !dynExcludeRevenue.includes(c.name)).reduce((s, c) => s + c.rev, 0);
  const totalRowEbitda = companyRows.reduce((s, c) => s + c.ebitda, 0);
  const totalRowGP = companyRows.filter(c => !dynExcludeRevenue.includes(c.name)).reduce((s, c) => {
    const gp = (data.pnl.find(p => p.name === c.name)?.metrics['Gross Profit'] ?? [])
      .filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0);
    return s + gp;
  }, 0);
  const totalRowGrossMargin = totalRowRev > 0 ? totalRowGP / totalRowRev : null;

  // Gross margin percentage by month — computed from Revenue & Gross Profit
  const rawGpByMonth = buildMonthlySeries(data.pnl, 'Gross Profit', dynExcludeRevenue, null);
  const gpByMonth = viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'Gross Profit', dynExcludeRevenue, yearFrom, yearTo)
    : filterSeriesToRange(rawGpByMonth, rangeFrom, rangeTo, availableMonths);
  const grossMarginPctByMonth = revenueByMonth.map((revPoint, i) => {
    const gpPoint = gpByMonth[i] || {};
    const pctPoint = { month: revPoint.month };
    for (const name of revenueCompanies) {
      const rev = revPoint[name] ?? 0;
      const gp = gpPoint[name] ?? 0;
      pctPoint[name] = rev > 0 ? (gp / rev) * 100 : null;
    }
    return pctPoint;
  });
  const gmCompanies = revenueCompanies.filter(name =>
    grossMarginPctByMonth.some(p => p[name] !== null && p[name] > 0)
  );

  // Profitability: find breakeven company
  let breakevenCompany = null;
  if (hasPriorYear) {
    for (const c of data.pnl) {
      if (dynExcludeEbitda.includes(c.name)) continue;
      const priorEbitda = (c.metrics['EBITDA'] ?? []).filter(v => v.year === priorYear).reduce((s, v) => s + (v.value ?? 0), 0);
      const currEbitda = (c.metrics['EBITDA'] ?? []).filter(v => v.year === currentYear).reduce((s, v) => s + (v.value ?? 0), 0);
      if (priorEbitda < 0 && currEbitda >= 0) {
        breakevenCompany = c.name;
        break;
      }
    }
  }

  // Timestamp formatting
  const lastUpdated = new Date(data.fetchedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const lastUpdatedShort = new Date(data.fetchedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long'
  });

  // Insights
  const insights = generateInsights(data, rangeFrom, rangeTo, selectedCompany);

  // Deploy handler
  const [reloadCountdown, setReloadCountdown] = useState(null);
  async function handleDeploy() {
    setDeploying(true);
    setDeployMsg(null);
    try {
      const res = await fetch('/api/deploy', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setDeployMsg('Rebuild started — page will reload in 90s with fresh data...');
        setDeploying(false);
        let remaining = 90;
        setReloadCountdown(remaining);
        const interval = setInterval(() => {
          remaining--;
          setReloadCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(interval);
            window.location.reload();
          }
        }, 1000);
      } else {
        setDeployMsg(json.error || 'Deploy failed');
        setDeploying(false);
      }
    } catch {
      setDeployMsg('Failed to trigger rebuild');
      setDeploying(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <DashboardSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        selectedCompany={selectedCompany}
        setSelectedCompany={(c) => { setSelectedCompany(c); setExpenseDrilldown(null); }}
        companies={DISPLAY_COMPANIES}
        colorMap={colorMap}
        lastActualLabel={`Actuals till ${prevMonthLabel} ${prevMonthYear}`}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        canSeeTab={canSeeTab}
        canBreakdown={canBreakdown}
        userName={user?.name}
        userRole={user?.role}
      />

      {/* Main content area — offset by sidebar width */}
      <div className="md:ml-64">
      {/* Header */}
      <header className="border-b border-border bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Monthly / Yearly toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => { setViewMode('monthly'); setExpenseDrilldown(null); if (compareEnabled) { setCompareFromKey(`${rangeFrom.year - 1}-${rangeFrom.month}`); setCompareToKey(`${rangeTo.year - 1}-${rangeTo.month}`); } }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => { setViewMode('yearly'); setExpenseDrilldown(null); if (compareEnabled) { setCompareFromKey(`${yearFrom - 1}-1`); setCompareToKey(`${yearTo - 1}-12`); } }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'yearly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly
              </button>
            </div>

            {/* Date range selectors */}
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1">
              {viewMode === 'monthly' ? (
                <>
                  <select value={rangeFromKey} onChange={e => { setRangeFromKey(e.target.value); setExpenseDrilldown(null); }}
                    className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {availableMonths.map(m => (<option key={m.key} value={m.key}>{m.label}</option>))}
                  </select>
                  <span className="text-[10px] text-muted-foreground font-medium">to</span>
                  <select value={rangeToKey} onChange={e => { setRangeToKey(e.target.value); setExpenseDrilldown(null); }}
                    className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {availableMonths.map(m => (<option key={m.key} value={m.key}>{m.label}</option>))}
                  </select>
                </>
              ) : (
                <>
                  <select value={yearFrom} onChange={e => { setYearFrom(Number(e.target.value)); setExpenseDrilldown(null); }}
                    className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
                  </select>
                  <span className="text-[10px] text-muted-foreground font-medium">to</span>
                  <select value={yearTo} onChange={e => { setYearTo(Number(e.target.value)); setExpenseDrilldown(null); }}
                    className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
                  </select>
                </>
              )}
            </div>

            {/* Comparison toggle */}
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compareEnabled}
                  onChange={e => {
                    setCompareEnabled(e.target.checked);
                    if (e.target.checked && !compareFromKey) {
                      if (viewMode === 'yearly') {
                        setCompareFromKey(`${yearFrom - 1}-1`);
                        setCompareToKey(`${yearTo - 1}-12`);
                      } else {
                        setCompareFromKey(`${rangeFrom.year - 1}-${rangeFrom.month}`);
                        setCompareToKey(`${rangeTo.year - 1}-${rangeTo.month}`);
                      }
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Compare</span>
              </label>
              {compareEnabled && (
                viewMode === 'yearly' ? (
                  <>
                    <select value={compareFromKey ? compareFromKey.split('-')[0] : ''} onChange={e => { setCompareFromKey(`${e.target.value}-1`); setCompareToKey(`${compareToKey ? compareToKey.split('-')[0] : e.target.value}-12`); }}
                      className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                      {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                    <span className="text-[10px] text-muted-foreground font-medium">to</span>
                    <select value={compareToKey ? compareToKey.split('-')[0] : ''} onChange={e => setCompareToKey(`${e.target.value}-12`)}
                      className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                      {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                  </>
                ) : (
                  <>
                    <select value={compareFromKey || ''} onChange={e => setCompareFromKey(e.target.value)}
                      className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                      {availableMonths.map(m => (<option key={m.key} value={m.key}>{m.label}</option>))}
                    </select>
                    <span className="text-[10px] text-muted-foreground font-medium">to</span>
                    <select value={compareToKey || ''} onChange={e => setCompareToKey(e.target.value)}
                      className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                      {availableMonths.map(m => (<option key={m.key} value={m.key}>{m.label}</option>))}
                    </select>
                  </>
                )
              )}
            </div>

            {/* Last Updated */}
            <div className="text-right pl-2 border-l border-border/60">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Updated</p>
              <p className="text-xs font-semibold text-foreground">{lastUpdated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">

          {/* ────── OVERVIEW ────── */}
          {activeSection === 'overview' && (<>
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title={`Revenue — ${rangeLabel}`} value={fmt(rangeRevenue)} subtitle="excl. holdings"
                comparison={compareEnabled && <ComparisonBadge current={rangeRevenue} compValue={rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue)} compLabel={compLabel} />} />
              <KPICard title={`EBITDA — ${rangeLabel}`} value={fmt(rangeEbitda)} subtitle={rangeRevenue > 0 ? (rangeEbitda / rangeRevenue * 100).toFixed(0) + '% margin' : ''}
                comparison={compareEnabled && <ComparisonBadge current={rangeEbitda} compValue={rangeTotal(data.pnl, 'EBITDA', compRange.from, compRange.to, dynExcludeEbitda)} compLabel={compLabel} />} />
              <KPICard title="Operational Cash Flow" value={fmt(totalOpsCF)} trend={runwayMonths !== null ? '~' + runwayMonths.toFixed(1) + ' months' : (totalOpsCF >= 0 ? 'Cash positive' : 'Cash negative')} trendUp={totalOpsCF >= 0} subtitle="at current burn rate"
                comparison={compareEnabled && <ComparisonBadge current={totalOpsCF} compValue={(() => { const cfKey = selectedCompany ? 'Operational Cash Flow' : 'Holdings net cash movement'; for (const co of (data.cashflow||[])) { const m = co.metrics?.[cfKey]; if (m) { return m.filter(v => { const vi = v.year*100+v.month; return vi >= compRange.from.year*100+compRange.from.month && vi <= compRange.to.year*100+compRange.to.month; }).reduce((s,v) => s+(v.value??0), 0); } } return 0; })()} compLabel={compLabel} />} />
              <KPICard title={`Gross Margin — ${rangeLabel}`} value={pct(rangeGrossMargin)} subtitle="portfolio weighted"
                comparison={compareEnabled && (() => { const compRev = rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue); const compGP = rangeTotal(data.pnl, 'Gross Profit', compRange.from, compRange.to, dynExcludeRevenue); const compGM = compRev > 0 ? compGP / compRev * 100 : 0; return <ComparisonBadge current={rangeGrossMargin} compValue={compGM} compLabel={compLabel} />; })()} />
            </div>

            {/* Single-month + compare: show scorecards instead of tiny bar charts */}
            {compareEnabled && revenueByMonthWithTotal.length === 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                <ComparisonScorecard
                  title={`Revenue Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={revenueCompanies}
                  currentData={revenueCompanies.map(name => ({ name, value: revenueByMonthWithTotal[0]?.[name] ?? 0 }))}
                  compData={revenueCompanies.map(name => {
                    const compPoint = compRevenueByMonth[0];
                    return { name, value: compPoint?.[name] ?? 0 };
                  })}
                  colorMap={colorMap}
                />
                <ComparisonScorecard
                  title={`EBITDA Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={allCompanyNames}
                  currentData={allCompanyNames.map(name => ({ name, value: ebitdaByMonthWithTotal[0]?.[name] ?? 0 }))}
                  compData={allCompanyNames.map(name => {
                    const compPoint = compEbitdaByMonth[0];
                    return { name, value: compPoint?.[name] ?? 0 };
                  })}
                  colorMap={colorMap}
                />
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} Revenue Trend ({rangeLabel}) &mdash; excl. Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    {revenueByMonthWithTotal.length < 3 ? (
                      <ComposedChart data={revenueByMonthWithTotal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        {revenueCompanies.map((name, i) => (
                          <Bar key={name} dataKey={name} stackId="1" fill={colorMap[name]}
                            radius={i === revenueCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                        <Line type="monotone" dataKey="Total" stroke="#1e293b" strokeWidth={2} dot={{ fill: "#1e293b", r: 3 }} />
                        {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke="#1e293b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                        <Legend />
                      </ComposedChart>
                    ) : (
                      <ComposedChart data={revenueByMonthWithTotal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        {revenueCompanies.map(name => (
                          <Area key={name} type="monotone" dataKey={name} stackId="1"
                            stroke={colorMap[name]} fill={colorMap[name]} fillOpacity={0.6} />
                        ))}
                        <Line type="monotone" dataKey="Total" stroke="#1e293b" strokeWidth={2} dot={{ fill: "#1e293b", r: 3 }} />
                        {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke="#1e293b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                        <Legend />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} EBITDA by Company ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    {ebitdaByMonthWithTotal.length < 3 ? (
                      <ComposedChart data={ebitdaByMonthWithTotal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        {(selectedCompany ? [selectedCompany] : allCompanyNames).map((name, i, arr) => (
                          <Bar key={name} dataKey={name} stackId="1" fill={colorMap[name]}
                            radius={i === arr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                        <Line type="monotone" dataKey="Total" stroke="#1e293b" strokeWidth={2} dot={{ fill: "#1e293b", r: 3 }} />
                        {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke="#1e293b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                        <Legend />
                      </ComposedChart>
                    ) : (
                      <ComposedChart data={ebitdaByMonthWithTotal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        {(selectedCompany ? [selectedCompany] : allCompanyNames).map(name => (
                          <Area key={name} type="monotone" dataKey={name} stackId="1"
                            stroke={colorMap[name]} fill={colorMap[name]} fillOpacity={0.6} />
                        ))}
                        <Line type="monotone" dataKey="Total" stroke="#1e293b" strokeWidth={2} dot={{ fill: "#1e293b", r: 3 }} />
                        {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke="#1e293b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                        <Legend />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            )}

            {/* Company Performance Table */}
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-1">Company Performance Summary</h2>
              <p className="text-sm text-muted-foreground mb-4">All active portfolio companies &mdash; {rangeLabel}</p>
            </div>
            <Card className="py-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="w-[180px]">Company</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">EBITDA</TableHead>
                    <TableHead className="text-right">Gross %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyRows.map((co) => (
                    <TableRow key={co.name}>
                      <TableCell className="font-semibold">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: co.color }} />
                        {co.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">{fmt(co.rev)}</div>
                        {co.revGrowth !== null ? (
                          <div className={`text-[11px] ${co.revGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {co.revGrowth >= 0 ? "+" : ""}{(co.revGrowth * 100).toFixed(0)}% {compareEnabled ? `vs ${compLabel}` : 'YoY'}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">New</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-semibold ${co.ebitda >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(co.ebitda)}</div>
                        <div className="text-[11px] text-muted-foreground">{co.rev > 0 ? (co.ebitda / co.rev * 100).toFixed(1) + '% margin' : 'N/A'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {co.grossMargin !== null && co.grossMargin > 0 ? `${(co.grossMargin * 100).toFixed(0)}%` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableCell className="font-bold">TOTAL (excl. holdings)</TableCell>
                    <TableCell className="text-right font-bold">{fmt(totalRowRev)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{fmt(totalRowEbitda)}</TableCell>
                    <TableCell className="text-right font-bold">{totalRowGrossMargin !== null ? (totalRowGrossMargin * 100).toFixed(0) + '%' : 'N/A'}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>
          </>)}

          {/* ────── REVENUE ────── */}
          {activeSection === 'revenue' && (<>
            <div className="flex flex-wrap gap-4 mb-6">
              {revenueCompanies.map(name => {
                const coRevValues = (data.pnl.find(c => c.name === name)?.metrics['Revenues'] ?? []).filter(inRange);
                const coRev = coRevValues.reduce((s, v) => s + (v.value ?? 0), 0);

                // ARR = latest month's revenue × 12. Fall back to most recent non-zero month in range.
                const sortedDesc = [...coRevValues].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
                const latestNonZero = sortedDesc.find(v => (v.value ?? 0) > 0);
                const latestMonthRev = sortedDesc[0]?.value ?? 0;
                const arrBase = latestMonthRev > 0 ? latestMonthRev : (latestNonZero?.value ?? 0);
                const arr = arrBase * 12;

                // Revenue KPI badges for AllRx/AllCare from revenueDetails
                const rd = data.revenueDetails;
                let kpiBadge = null;
                if (rd && name === 'AllRx' && rd.AllRx?.segments) {
                  const totalRx = rd.AllRx.segments.reduce((s, seg) => s + (seg.metrics['RX Count'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const totalSegRev = rd.AllRx.segments.reduce((s, seg) => s + (seg.metrics['Total Revenues'] ?? seg.metrics['Revenues'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const arpu = totalRx > 0 ? totalSegRev / totalRx : 0;
                  kpiBadge = <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    <span className="text-[10px] text-blue-600 font-medium">RX: {totalRx.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground">|</span>
                    <span className="text-[10px] text-blue-600 font-medium">ARPU: ${arpu.toFixed(2)}</span>
                    {arr > 0 && <>
                      <span className="text-[10px] text-muted-foreground">|</span>
                      <span className="text-[10px] text-blue-600 font-medium">ARR: {fmt(arr)}</span>
                    </>}
                  </div>;
                } else if (rd && name === 'AllCare' && rd.AllCare?.serviceLines) {
                  const totalSUs = rd.AllCare.serviceLines.reduce((s, sl) => s + (sl.metrics['SUs'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const totalSlRev = rd.AllCare.serviceLines.reduce((s, sl) => s + (sl.metrics['Revenues'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const arpu = totalSUs > 0 ? totalSlRev / totalSUs : 0;
                  kpiBadge = <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    <span className="text-[10px] text-emerald-600 font-medium">SUs: {totalSUs.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground">|</span>
                    <span className="text-[10px] text-emerald-600 font-medium">ARPU: ${arpu.toFixed(2)}</span>
                    {arr > 0 && <>
                      <span className="text-[10px] text-muted-foreground">|</span>
                      <span className="text-[10px] text-emerald-600 font-medium">ARR: {fmt(arr)}</span>
                    </>}
                  </div>;
                } else if (arr > 0) {
                  // Other companies (Osta, Needles, InVitro Studio) — just show ARR
                  kpiBadge = <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-foreground/70 font-medium">ARR: {fmt(arr)}</span>
                  </div>;
                }
                return (
                  <KPICard key={name} title={`${name} — ${rangeLabel}`}
                    value={fmt(coRev)}
                    subtitle={rangeRevenue > 0 ? `${(coRev / rangeRevenue * 100).toFixed(0)}% of total` : ''}
                    comparison={<>{compareEnabled && <ComparisonBadge current={coRev}
                      compValue={(data.pnl.find(c => c.name === name)?.metrics['Revenues'] ?? []).filter(v => { const vi = v.year * 100 + v.month; return vi >= compRange.from.year * 100 + compRange.from.month && vi <= compRange.to.year * 100 + compRange.to.month; }).reduce((s, v) => s + (v.value ?? 0), 0)}
                      compLabel={compLabel} />}{kpiBadge}</>}
                  />
                );
              })}
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} Revenue by Company ({rangeLabel}){data.revenueDetails && selectedCompany ? ' — click a bar for breakdown' : ''}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={revenueByMonthWithTotal} onClick={(e) => {
                    // Drill-down is only available when viewing a single company (not consolidated)
                    if (!selectedCompany) return;
                    if (!data.revenueDetails || !e?.activePayload?.[0]) return;
                    const label = e.activePayload[0].payload.month;
                    if (viewMode === 'yearly') {
                      setRevenueDrilldown({ year: Number(label), month: 0 });
                    } else {
                      const MONTH_PARSE = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
                      const parts = String(label).match(/(\w+)\s*'?(\d+)/);
                      if (parts) {
                        const m = MONTH_PARSE[parts[1]] || 0;
                        const y = 2000 + Number(parts[2]);
                        if (m > 0) setRevenueDrilldown({ year: y, month: m });
                      }
                    }
                  }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {revenueCompanies.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="1" fill={colorMap[name]}
                        radius={i === revenueCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2} dot={false} />
                    {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke={CHART_STYLE.totalLine} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Revenue Mix ({rangeLabel}) &mdash; excl. Holdings</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={revenuePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {revenuePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Drill-Down Drawer */}
            {canBreakdown('revenueDrilldown', selectedCompany) && selectedCompany && <Drawer open={!!revenueDrilldown} onOpenChange={(open) => { if (!open) setRevenueDrilldown(null); }}>
              <DrawerContent>
                {revenueDrilldown && data.revenueDetails && (() => {
                  const rd = data.revenueDetails;
                  const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const isYearDrill = revenueDrilldown.month === 0;
                  const drillLabel = isYearDrill ? String(revenueDrilldown.year) : `${ML[revenueDrilldown.month]} ${revenueDrilldown.year}`;
                  const inDrillRange = (v) => isYearDrill ? v.year === revenueDrilldown.year : (v.year === revenueDrilldown.year && v.month === revenueDrilldown.month);
                  const sumMetric = (metrics, name) => (metrics?.[name] ?? []).filter(inDrillRange).reduce((s, v) => s + (v.value ?? 0), 0);
                  const gmColor = (pct) => pct >= 40 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-red-500';

                  // Build sections based on company view
                  const sections = [];
                  if (!selectedCompany || selectedCompany === 'AllRx') {
                    if (rd.AllRx?.segments?.length > 0) {
                      sections.push({ company: 'AllRx', label: 'AllRx — Customer Segments', items: rd.AllRx.segments, unitLabel: 'RX Count', unitKey: 'RX Count', revKey: 'Revenues' });
                    }
                  }
                  if (!selectedCompany || selectedCompany === 'AllCare') {
                    if (rd.AllCare?.serviceLines?.length > 0) {
                      sections.push({ company: 'AllCare', label: 'AllCare — Service Lines', items: rd.AllCare.serviceLines, unitLabel: 'SUs', unitKey: 'SUs', revKey: 'Revenues' });
                    }
                  }

                  return (
                    <>
                      <DrawerHeader>
                        <DrawerTitle>Revenue Breakdown &mdash; {drillLabel}{selectedCompany ? ` (${selectedCompany})` : ''}</DrawerTitle>
                        <DrawerDescription>Sub-product metrics, ARPU, and gross margins</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-4 pb-6 overflow-auto space-y-6">
                        {sections.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No sub-product data available for this company/period.</p>
                        ) : sections.map(sec => {
                          const totals = { units: 0, rev: 0, cos: 0, gp: 0 };
                          const rows = sec.items.map(item => {
                            const units = sumMetric(item.metrics, sec.unitKey);
                            const rev = sumMetric(item.metrics, sec.revKey) || sumMetric(item.metrics, 'Revenues');
                            const cos = sumMetric(item.metrics, 'Cost of Sales') || sumMetric(item.metrics, 'Cost of Sales (SDRA)');
                            const gpExplicit = sumMetric(item.metrics, 'Gross Profit');
                            const gp = gpExplicit || (rev - cos);
                            const gm = rev > 0 ? (gp / rev * 100) : 0;
                            const arpu = units > 0 ? rev / units : 0;
                            totals.units += units; totals.rev += rev; totals.cos += cos; totals.gp += gp;
                            return { name: item.name, units, rev, arpu, cos, gp, gm };
                          });
                          const totalGM = totals.rev > 0 ? (totals.gp / totals.rev * 100) : 0;
                          const totalARPU = totals.units > 0 ? totals.rev / totals.units : 0;

                          return (
                            <div key={sec.company}>
                              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[sec.company] }} />
                                {sec.label}
                              </h3>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{sec.company === 'AllCare' ? 'Service Line' : 'Segment'}</TableHead>
                                    <TableHead className="text-right">{sec.unitLabel}</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">ARPU</TableHead>
                                    <TableHead className="text-right">Cost of Sales</TableHead>
                                    <TableHead className="text-right">Gross Profit</TableHead>
                                    <TableHead className="text-right">GM %</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map(r => (
                                    <TableRow key={r.name}>
                                      <TableCell className="font-medium">{r.name}</TableCell>
                                      <TableCell className="text-right tabular-nums">{r.units.toLocaleString()}</TableCell>
                                      <TableCell className="text-right tabular-nums">{fmt(r.rev)}</TableCell>
                                      <TableCell className="text-right tabular-nums">${r.arpu.toFixed(2)}</TableCell>
                                      <TableCell className="text-right tabular-nums">{fmt(r.cos)}</TableCell>
                                      <TableCell className="text-right tabular-nums">{fmt(r.gp)}</TableCell>
                                      <TableCell className={`text-right font-semibold tabular-nums ${gmColor(r.gm)}`}>{r.gm.toFixed(1)}%</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                                <TableFooter>
                                  <TableRow>
                                    <TableCell className="font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">{totals.units.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">{fmt(totals.rev)}</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">${totalARPU.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">{fmt(totals.cos)}</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">{fmt(totals.gp)}</TableCell>
                                    <TableCell className={`text-right font-bold tabular-nums ${gmColor(totalGM)}`}>{totalGM.toFixed(1)}%</TableCell>
                                  </TableRow>
                                </TableFooter>
                              </Table>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </DrawerContent>
            </Drawer>}
          </>)}

          {/* ────── PROFITABILITY ────── */}
          {activeSection === 'profitability' && (<>
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title={`EBITDA — ${rangeLabel}`} value={fmt(rangeEbitda)} subtitle={rangeRevenue > 0 ? (rangeEbitda / rangeRevenue * 100).toFixed(0) + '% margin' : ''}
                comparison={compareEnabled && <ComparisonBadge current={rangeEbitda} compValue={rangeTotal(data.pnl, 'EBITDA', compRange.from, compRange.to, dynExcludeEbitda)} compLabel={compLabel} />} />
              <KPICard title={`EBITDA Margin — ${rangeLabel}`} value={rangeRevenue > 0 ? (rangeEbitda / rangeRevenue * 100).toFixed(0) + '%' : 'N/A'}
                comparison={compareEnabled && (() => { const cRev = rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue); const cEb = rangeTotal(data.pnl, 'EBITDA', compRange.from, compRange.to, dynExcludeEbitda); const cur = rangeRevenue > 0 ? rangeEbitda/rangeRevenue*100 : 0; const comp = cRev > 0 ? cEb/cRev*100 : 0; return <ComparisonBadge current={cur} compValue={comp} compLabel={compLabel} />; })()} />
              <KPICard title={`Gross Margin — ${rangeLabel}`} value={pct(rangeGrossMargin)} subtitle="portfolio weighted"
                comparison={compareEnabled && (() => { const cRev = rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue); const cGP = rangeTotal(data.pnl, 'Gross Profit', compRange.from, compRange.to, dynExcludeRevenue); return <ComparisonBadge current={rangeGrossMargin} compValue={cRev > 0 ? cGP/cRev*100 : 0} compLabel={compLabel} />; })()} />
              {breakevenCompany ? (
                <KPICard title={`${breakevenCompany} Breakeven`} value={`FY ${currentYear}`} trend="Reached EBITDA breakeven" trendUp={true} />
              ) : (
                <KPICard title="Portfolio Companies" value={String(revenueCompanies.length)} subtitle="active operating entities" />
              )}
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} EBITDA by Company ({rangeLabel})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={ebitdaByMonthWithTotal}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {allCompanyNames.map(name => (
                      <Bar key={name} dataKey={name} fill={colorMap[name]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2.5} dot={{ fill: CHART_STYLE.totalLine, r: 3 }} />
                    {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke={CHART_STYLE.totalLine} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Gross Profit & Margin ({rangeLabel})</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  // Combine GP dollar values (bars) + margin % (lines) into one dataset
                  const combinedGM = gpByMonth.map((gpPoint, i) => {
                    const pctPoint = grossMarginPctByMonth[i] || {};
                    const point = { month: gpPoint.month };
                    for (const name of gmCompanies) {
                      point[`${name}_gp`] = gpPoint[name] ?? 0; // dollar GP for bars
                      point[`${name}_pct`] = pctPoint[name] ?? null; // margin % for lines
                    }
                    return point;
                  });
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={combinedGM}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis yAxisId="gp" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fill: '#6366f1', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload) return null;
                          return (
                            <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-lg min-w-[200px]">
                              <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
                              {payload.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2 my-0.5">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-xs text-muted-foreground">{entry.name}:</span>
                                  <span className="text-xs font-semibold text-foreground ml-auto">
                                    {String(entry.dataKey).endsWith('_pct') ? `${Number(entry.value).toFixed(1)}%` : fmt(entry.value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }} />
                        {gmCompanies.map((name, i) => (
                          <Bar key={`${name}_gp`} yAxisId="gp" dataKey={`${name}_gp`} stackId="gp"
                            fill={colorMap[name]} radius={i === gmCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            name={`${name} GP`} />
                        ))}
                        {gmCompanies.map(name => (
                          <Line key={`${name}_pct`} yAxisId="pct" type="monotone" dataKey={`${name}_pct`}
                            stroke={colorMap[name]} strokeWidth={2} strokeDasharray="5 3"
                            dot={{ r: 3 }} connectNulls={true} name={`${name} %`} />
                        ))}
                        <Legend />
                      </ComposedChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>
          </>)}

          {/* ────── CASH FLOW ────── */}
          {activeSection === 'cashflow' && (<>
            <div className="flex flex-wrap gap-4 mb-6">
              {(() => {
                // Helper: sum a cashflow metric across comparison range
                const cfCompSum = (metricKey) => {
                  for (const co of (data.cashflow || [])) {
                    const m = co.metrics?.[metricKey];
                    if (m) return m.filter(v => { const vi = v.year*100+v.month; return vi >= compRange.from.year*100+compRange.from.month && vi <= compRange.to.year*100+compRange.to.month; }).reduce((s,v) => s+(v.value??0), 0);
                  }
                  return null;
                };
                const compMonths = (compRange.to.year*12+compRange.to.month) - (compRange.from.year*12+compRange.from.month) + 1;
                const opsKey = selectedCompany ? 'Operational Cash Flow' : 'Holdings net cash movement';
                const compOps = cfCompSum(opsKey);
                const compInflow = cfCompSum('Cash Inflow');
                const compOutflow = cfCompSum('Cash Outflow');
                const compBurn = compOps !== null && compMonths > 0 ? compOps / compMonths : null;
                return (<>
                  <KPICard title="Operational Cash Flow" value={fmt(totalOpsCF)} trend={runwayMonths !== null ? '~' + runwayMonths.toFixed(1) + ' months runway' : (totalOpsCF >= 0 ? 'Cash positive' : 'Cash negative')} trendUp={totalOpsCF >= 0 || (runwayMonths !== null && runwayMonths > 3)} subtitle="at current burn rate"
                    comparison={compareEnabled && compOps !== null && <ComparisonBadge current={totalOpsCF} compValue={compOps} compLabel={compLabel} />} />
                  <KPICard title={`Cash Inflow — ${rangeLabel}`} value={fmt(totalInflow)} subtitle="all entities"
                    comparison={compareEnabled && compInflow !== null && <ComparisonBadge current={totalInflow} compValue={compInflow} compLabel={compLabel} />} />
                  <KPICard title={`Cash Outflow — ${rangeLabel}`} value={fmt(totalOutflow)} subtitle="total outflows"
                    comparison={compareEnabled && compOutflow !== null && <ComparisonBadge current={totalOutflow} compValue={compOutflow} compLabel={compLabel} />} />
                  <KPICard title="Avg Monthly Burn" value={fmt(avgMonthlyBurn)} subtitle="average per month"
                    comparison={compareEnabled && compBurn !== null && <ComparisonBadge current={avgMonthlyBurn} compValue={compBurn} compLabel={compLabel} />} />
                </>);
              })()}
              {/* Cash Balance badge — end of range period */}
              {(() => {
                const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                // For consolidated: use "Consolidated Cash balance" metric from any cashflow company that has it
                // For per-company: use "Ending cash balance" or "Cash Balance" from the company's cashflow block
                let balMetric = null;
                if (selectedCompany) {
                  const co = data.cashflow?.find(c => c.name === selectedCompany);
                  balMetric = co?.metrics?.['Ending cash balance'] || co?.metrics?.['Cash Balance'] || co?.metrics?.['Cash balance'];
                } else {
                  // Consolidated — search all cashflow companies for "Consolidated Cash balance"
                  for (const co of (data.cashflow || [])) {
                    if (co.metrics?.['Consolidated Cash balance']) { balMetric = co.metrics['Consolidated Cash balance']; break; }
                  }
                }
                if (!balMetric || balMetric.length === 0) return null;
                // Try exact end-of-range, fall back to latest non-null
                const endVal = balMetric.find(v => v.year === rangeTo.year && v.month === rangeTo.month && v.value !== null);
                let val, asOfLabel;
                if (endVal) {
                  val = endVal.value;
                  asOfLabel = `${ML[rangeTo.month]} ${String(rangeTo.year).slice(-2)}`;
                } else {
                  const toIdx = rangeTo.year * 100 + rangeTo.month;
                  const sorted = balMetric.filter(v => v.value !== null && v.year * 100 + v.month <= toIdx).sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
                  if (sorted.length === 0) return null;
                  val = sorted[0].value;
                  asOfLabel = `${ML[sorted[0].month]} ${String(sorted[0].year).slice(-2)}`;
                }
                return <KPICard title={`Cash Balance — ${asOfLabel}`} value={fmt(val)} subtitle={val >= 0 ? 'ending balance' : 'deficit'} />;
              })()}
              {/* Debt Loan badge — PNC loan balance at end of range (consolidated only) */}
              {!selectedCompany && (() => {
                const pncCompany = data.cashflow?.find(c => c.name === 'PNC loan');
                const balanceMetric = pncCompany?.metrics?.['Balance'];
                if (!balanceMetric) return null;
                // Get value at end of range
                const endVal = balanceMetric.find(v => v.year === rangeTo.year && v.month === rangeTo.month);
                const val = endVal?.value ?? 0;
                const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return <KPICard title={`Debt Loan — ${ML[rangeTo.month]} ${String(rangeTo.year).slice(-2)}`} value={fmt(val)} subtitle="PNC loan balance" />;
              })()}
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly Cash Flows &amp; Operational CF</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={cashBalanceByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="inflow" name="Cash Inflow" fill="#22c55e" fillOpacity={0.4} />
                    <Bar yAxisId="left" dataKey="outflow" name="Cash Outflow" fill="#ef4444" fillOpacity={0.4} />
                    <Line yAxisId="right" type="monotone" dataKey="opsCashFlow" name="Ops Cash Flow" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Operating Cash Flow by Company — stacked bars */}
            {(() => {
              const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const OPS_KEYS = ['Operational Cash Flow', 'Direct Operational Cash Flow', 'Operational Cash Flow (Internal budget)'];
              const companies = selectedCompany ? [selectedCompany] : DISPLAY_COMPANIES;
              const monthMap = {};
              for (const name of companies) {
                const co = data.cashflow.find(c => c.name === name);
                if (!co) continue;
                const metric = OPS_KEYS.reduce((found, key) => found || co.metrics?.[key], null);
                if (!metric) continue;
                for (const v of metric) {
                  if (!inRange(v)) continue;
                  const label = viewMode === 'yearly' ? String(v.year) : `${ML[v.month]} '${String(v.year).slice(-2)}`;
                  if (!monthMap[label]) monthMap[label] = { month: label };
                  monthMap[label][name] = (monthMap[label][name] || 0) + (v.value ?? 0);
                }
              }
              const opsCFData = Object.values(monthMap).map(point => ({
                ...point,
                Total: companies.reduce((s, name) => s + (point[name] || 0), 0),
              }));
              if (opsCFData.length === 0) return null;
              return (
                <Card className="mb-4">
                  <CardHeader><CardTitle className="text-sm">Monthly Operating Cash Flow by Company ({rangeLabel})</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={opsCFData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        {companies.map((name, i) => (
                          <Bar key={name} dataKey={name} stackId="ops" fill={colorMap[name]}
                            radius={i === companies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                        <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2} dot={{ r: 3, fill: CHART_STYLE.totalLine }} />
                        <Legend />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Combined: Normal Cash Burn (bars) + Cash Runway (line) — consolidated only shows burn */}
            {(() => {
              const MONTHS_L = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              // Build runway data
              const runwayData = cashRunwayValues.map(v => ({
                month: viewMode === 'yearly' ? String(v.year) : `${MONTHS_L[v.month]} '${String(v.year).slice(-2)}`,
                runway: (v.value !== null && v.value !== 0) ? v.value : null,
                year: v.year, m: v.month,
              }));
              // Build normal cash burn data (consolidated only)
              let burnMap = {};
              if (!selectedCompany) {
                const ncbCompany = data.cashflow?.find(c => c.name === 'Normal Cash Burn');
                const ncbMetric = ncbCompany?.metrics?.['Normal Cashburn without Adhocks'];
                if (ncbMetric) {
                  ncbMetric.filter(v => {
                    if (viewMode === 'yearly') return v.year >= rangeFrom.year && v.year <= rangeTo.year;
                    const vi = v.year * 12 + v.month;
                    return vi >= rangeFrom.year * 12 + rangeFrom.month && vi <= rangeTo.year * 12 + rangeTo.month;
                  }).filter(v => v.value !== null).forEach(v => {
                    const key = viewMode === 'yearly' ? String(v.year) : `${MONTHS_L[v.month]} '${String(v.year).slice(-2)}`;
                    burnMap[key] = v.value;
                  });
                }
              }
              // Merge into one dataset
              const combined = runwayData.map(d => ({ ...d, burn: burnMap[d.month] ?? null }));
              const hasBurn = Object.keys(burnMap).length > 0;
              if (combined.length === 0) return null;
              return (
                <Card>
                  <CardHeader><CardTitle className="text-sm">
                    {hasBurn ? 'Normal Cash Burn (excl. Ad hocs) & Runway' : 'Cash Runway'} ({rangeLabel})
                  </CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={combined}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        {hasBurn && <YAxis yAxisId="burn" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />}
                        <YAxis yAxisId="runway" orientation={hasBurn ? 'right' : 'left'} tick={{ fill: '#3b82f6', fontSize: 11 }} unit=" mo" />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload) return null;
                          return (
                            <div className="rounded-lg border border-border bg-white px-4 py-3 shadow-lg min-w-[180px]">
                              <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
                              {payload.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2 my-0.5">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-xs text-muted-foreground">{entry.name}:</span>
                                  <span className="text-xs font-semibold text-foreground ml-auto">
                                    {entry.name === 'Runway' ? `${entry.value} mo` : fmt(entry.value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }} />
                        {hasBurn && <Bar yAxisId="burn" dataKey="burn" radius={[4, 4, 0, 0]} name="Cash Burn">
                          {combined.map((d, i) => (
                            <Cell key={i} fill={d.burn >= 0 ? '#16a34a' : '#ef4444'} />
                          ))}
                        </Bar>}
                        <Line yAxisId="runway" type="monotone" dataKey="runway" stroke="#3b82f6" strokeWidth={2.5}
                          dot={{ r: 4, fill: '#3b82f6', stroke: '#3b82f6' }} name="Runway" connectNulls={false} />
                        <Legend />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <p className="mt-3 text-xs italic text-muted-foreground">
                      Average runway: ~{runwayMonths !== null ? runwayMonths.toFixed(1) : '0'} months.
                      {hasBurn && ' Bars show normal cash burn excl. ad hocs.'}
                    </p>
                  </CardContent>
                </Card>
              );
            })()}
          </>)}

          {/* ────── INSIGHTS ────── */}
          {/* ────── EXPENSES ────── */}
          {activeSection === 'expenses' && (<>
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title={`${getExpenseLabel()} — ${rangeLabel}`}
                value={fmt(Math.abs(rangeExpenses))}
                subtitle={(() => {
                  if (selectedCompany) return selectedCompany;
                  // Compute ad hoc expense for consolidated view — sum ALL metrics in "Add hocks"
                  const adHocCo = data.pnl.find(c => c.name === 'Add hocks');
                  let adHocVal = 0;
                  if (adHocCo) {
                    const fromVal = rangeFrom.year * 100 + rangeFrom.month;
                    const toVal = rangeTo.year * 100 + rangeTo.month;
                    for (const [, vals] of Object.entries(adHocCo.metrics)) {
                      for (const v of vals) {
                        const pv = v.year * 100 + v.month;
                        if (pv >= fromVal && pv <= toVal && v.value) adHocVal += v.value;
                      }
                    }
                  }
                  adHocVal = Math.abs(adHocVal);
                  const exclAdHoc = Math.abs(rangeExpenses) - adHocVal;
                  return adHocVal > 0 ? `Incl. ${fmt(adHocVal)} ad hocs · Excl: ${fmt(exclAdHoc)}` : 'all entities';
                })()}
                comparison={compareEnabled && <ComparisonBadge current={Math.abs(rangeExpenses)}
                  compValue={Math.abs(rangeTotal(data.pnl, selectedCompany ? 'SG&A + R&D Expenses' : 'Total Expenses', compRange.from, compRange.to, selectedCompany ? [...EXCLUDE_ALWAYS.filter(n => n !== selectedCompany)] : dynExcludeEbitda))}
                  compLabel={compLabel} />}
              />
              <KPICard title={`Avg Monthly Expense`}
                value={fmt(Math.abs(avgMonthlyExpense))}
                subtitle="average per month"
                comparison={compareEnabled && (() => { const compExp = Math.abs(rangeTotal(data.pnl, selectedCompany ? 'SG&A + R&D Expenses' : 'Total Expenses', compRange.from, compRange.to, selectedCompany ? [...EXCLUDE_ALWAYS.filter(n => n !== selectedCompany)] : dynExcludeEbitda)); const compMo = (compRange.to.year*12+compRange.to.month) - (compRange.from.year*12+compRange.from.month) + 1; return <ComparisonBadge current={Math.abs(avgMonthlyExpense)} compValue={compMo > 0 ? compExp/compMo : 0} compLabel={compLabel} />; })()}
              />
              {rangeRevenue > 0 && (
                <KPICard title={`Expense Ratio — ${rangeLabel}`}
                  value={`${(Math.abs(rangeExpenses) / rangeRevenue * 100).toFixed(1)}%`}
                  subtitle="expenses / revenue"
                  comparison={compareEnabled && (() => { const cExp = Math.abs(rangeTotal(data.pnl, selectedCompany ? 'SG&A + R&D Expenses' : 'Total Expenses', compRange.from, compRange.to, selectedCompany ? [...EXCLUDE_ALWAYS.filter(n => n !== selectedCompany)] : dynExcludeEbitda)); const cRev = rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue); const cur = rangeRevenue > 0 ? Math.abs(rangeExpenses)/rangeRevenue*100 : 0; const comp = cRev > 0 ? cExp/cRev*100 : 0; return <ComparisonBadge current={cur} compValue={comp} compLabel={compLabel} />; })()}
                />
              )}
            </div>

            {/* Chart always full-width, breakdown in bottom drawer */}
            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} Expenses ({rangeLabel}) &mdash; click a bar for breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={expenseByMonthWithTotal} onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const label = e.activePayload[0].payload.month;
                      if (viewMode === 'yearly') {
                        setExpenseDrilldown({ year: Number(label), month: 0 }); setExpandedDept(null);
                      } else {
                        const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        const parts = label.split(' ');
                        const m = MONTHS_SHORT.indexOf(parts[0]) + 1;
                        const y = 2000 + Number(parts[1]);
                        if (m > 0) { setExpenseDrilldown({ year: y, month: m }); setExpandedDept(null); }
                      }
                    }
                  }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {expenseChartCompanies.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="1" fill={colorMap[name]} cursor="pointer"
                        radius={i === expenseChartCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2} dot={false} />
                    {compareEnabled && <Line type="monotone" dataKey="Total_comp" stroke={CHART_STYLE.totalLine} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={`Total (${compLabel})`} />}
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Expense breakdown drawer */}
            {canBreakdown('expenseDrilldown', selectedCompany) && <Drawer open={!!expenseDrilldown} onOpenChange={(open) => { if (!open) setExpenseDrilldown(null); }}>
              <DrawerContent>
                {expenseDrilldown && (() => {
                  const MONTHS_FULL = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
                  const isYearDrill = expenseDrilldown.month === 0;
                  const drillLabel = isYearDrill ? `FY ${expenseDrilldown.year}` : `${MONTHS_FULL[expenseDrilldown.month]} ${expenseDrilldown.year}`;
                  const EXCLUDED_GL = ['Consultation (Invitro)', 'G&A Depreciation - Machinery & Equipment'];
                  const filtered = (data.expenses ?? []).filter(e =>
                    e.year === expenseDrilldown.year &&
                    (isYearDrill || e.month === expenseDrilldown.month) &&
                    e.department !== 'Direct Cost' &&
                    !EXCLUDED_GL.includes(e.gl) &&
                    (selectedCompany ? e.company === selectedCompany : DISPLAY_COMPANIES.includes(e.company))
                  );
                  const DEPTS = ['G&A', 'GTM', 'Operations', 'R&D'];
                  const breakdown = DEPTS.map(dept => {
                    const deptRows = filtered.filter(e => e.department === dept);
                    const hc = deptRows.filter(e => e.category === 'HC').reduce((s, e) => s + (e.amount ?? 0), 0);
                    const nonHc = deptRows.filter(e => e.category === 'NON-HC').reduce((s, e) => s + (e.amount ?? 0), 0);
                    return { department: dept, hc, nonHc, total: hc + nonHc };
                  }).filter(r => r.total !== 0);
                  const totalHc = breakdown.reduce((s, r) => s + r.hc, 0);
                  const totalNonHc = breakdown.reduce((s, r) => s + r.nonHc, 0);
                  const totalAll = totalHc + totalNonHc;
                  return (
                    <>
                      <DrawerHeader>
                        <DrawerTitle>Expense Breakdown &mdash; {drillLabel}{selectedCompany ? ` (${selectedCompany})` : ''}</DrawerTitle>
                        <DrawerDescription>By department and category (excl. Direct Cost)</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-4 pb-6 overflow-auto">
                        {breakdown.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Department</TableHead>
                                <TableHead className="text-right">HC</TableHead>
                                <TableHead className="text-right">Non-HC</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {breakdown.map(r => {
                                const isExpanded = expandedDept === r.department;
                                // GL sub-breakdown for Non-HC when expanded
                                const glRows = isExpanded ? (() => {
                                  const byGL = {};
                                  filtered.filter(e => e.department === r.department && e.category === 'NON-HC')
                                    .forEach(e => { byGL[e.gl || 'Other'] = (byGL[e.gl || 'Other'] || 0) + (e.amount ?? 0); });
                                  return Object.entries(byGL).sort((a, b) => b[1] - a[1]).map(([gl, amt]) => ({ gl, amount: amt }));
                                })() : [];
                                return (
                                  <Fragment key={r.department}>
                                    {/* ── Level 1: Department row ── */}
                                    <TableRow
                                      className="cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/40"
                                      onClick={() => { setExpandedDept(isExpanded ? null : r.department); setExpandedGL(null); }}
                                    >
                                      <TableCell className="font-semibold text-sm py-3">
                                        <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded text-xs mr-2", isExpanded ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{isExpanded ? '▾' : '›'}</span>
                                        {r.department}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-blue-600">{fmt(r.hc)}</TableCell>
                                      <TableCell className="text-right font-medium text-amber-600">{fmt(r.nonHc)}</TableCell>
                                      <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                                    </TableRow>
                                    {/* ── Expanded: HC + Non-HC card sections ── */}
                                    {isExpanded && (
                                      <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={4} className="p-0 pt-1 pb-3">
                                          <div className="mx-2 grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                            {/* ── BLUE: HC Section (col 2, under HC column) ── */}
                                            {(() => {
                                              const hcPeople = (data.headcount || []).filter(h => {
                                                const matchDept = h.department === r.department;
                                                // Consolidated: include ALL indirect employees (to match P&L totals)
                                                // Single company: filter by that company
                                                const matchCompany = selectedCompany ? h.company === selectedCompany : true;
                                                return matchDept && matchCompany;
                                              });
                                              const byDiv = {};
                                              const bydivCount = {};
                                              const byDivPrior = {};
                                              const drillMonth = expenseDrilldown?.month;
                                              const drillYear = expenseDrilldown?.year;
                                              // Prior month for comparison
                                              const priorM = drillMonth === 1 ? 12 : drillMonth - 1;
                                              const priorY = drillMonth === 1 ? drillYear - 1 : drillYear;
                                              const priorKey = `${priorY}-${priorM}`;
                                              hcPeople.forEach(h => {
                                                const d = h.division || 'Other';
                                                if (!byDiv[d]) { byDiv[d] = 0; bydivCount[d] = 0; byDivPrior[d] = 0; }
                                                if (h.salary && drillMonth && drillYear) {
                                                  const key = `${drillYear}-${drillMonth}`;
                                                  const salaryVal = h.salary[key] ?? 0;
                                                  if (salaryVal !== 0) {
                                                    byDiv[d] += salaryVal;
                                                    bydivCount[d]++;
                                                  }
                                                  // Prior month salary
                                                  byDivPrior[d] += (h.salary[priorKey] ?? 0);
                                                }
                                              });
                                              const divRows = Object.entries(byDiv).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
                                              const hcTotal = divRows.reduce((s, [, c]) => s + c, 0);
                                              // Revenue for cost/rev ratio
                                              const drillRevenue = drillMonth && drillYear ? (selectedCompany
                                                ? (data.pnl.find(c => c.name === selectedCompany)?.metrics['Revenues'] ?? [])
                                                    .filter(v => v.year === drillYear && v.month === drillMonth)
                                                    .reduce((s, v) => s + (v.value ?? 0), 0)
                                                : rangeTotal(data.pnl, 'Revenues', {year: drillYear, month: drillMonth}, {year: drillYear, month: drillMonth}, dynExcludeRevenue)
                                              ) : 0;
                                              if (divRows.length === 0 && r.hc === 0) return <div></div>;
                                              return (
                                                <div className="rounded-lg border border-blue-200/60 bg-blue-50/30 overflow-hidden">
                                                  <div className="flex items-center justify-between px-4 py-2 border-b border-blue-200/40">
                                                    <div className="flex items-center gap-2">
                                                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                                                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Headcount</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-blue-700 tabular-nums">{fmt(hcTotal || r.hc)}</span>
                                                  </div>
                                                  <div className="py-1">
                                                    {divRows.length > 0 ? divRows.map(([div, cost]) => {
                                                      const priorCost = byDivPrior[div] || 0;
                                                      const pctChg = priorCost > 0 ? ((cost - priorCost) / priorCost * 100) : null;
                                                      const costRevPct = drillRevenue > 0 ? (cost / drillRevenue * 100) : null;
                                                      return (
                                                        <div key={div} className="px-4 py-2 text-xs hover:bg-blue-50/50 rounded mx-1">
                                                          <div className="flex items-center justify-between">
                                                            <span className="text-foreground/80">
                                                              {div} <span className="ml-1 text-muted-foreground/50">({bydivCount[div]})</span>
                                                            </span>
                                                            <span className="font-medium text-foreground/70 tabular-nums">{fmt(cost)}</span>
                                                          </div>
                                                          <div className="flex items-center gap-3 mt-0.5">
                                                            {pctChg !== null && (
                                                              <span className={`text-[10px] font-medium ${pctChg > 0 ? 'text-red-500' : pctChg < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                                {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}% vs {MONTHS_S[priorM]} {String(priorY).slice(-2)}
                                                              </span>
                                                            )}
                                                            {costRevPct !== null && (
                                                              <span className="text-[10px] text-muted-foreground/70">
                                                                {costRevPct.toFixed(1)}% of rev
                                                              </span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    }) : (
                                                      <p className="px-4 py-2 text-xs text-muted-foreground italic">No HC salary data for this month</p>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                            {/* ── AMBER: Non-HC Section ── */}
                                            {r.nonHc !== 0 && (
                                              <div className="rounded-lg border border-amber-200/60 bg-amber-50/20 overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 border-b border-amber-200/40">
                                                  <div className="flex items-center gap-2">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Non-Headcount</span>
                                                  </div>
                                                  <span className="text-xs font-bold text-amber-700 tabular-nums">{fmt(r.nonHc)}</span>
                                                </div>
                                                <div className="py-1">
                                                  {glRows.map(g => {
                                                    const glExpanded = expandedGL === g.gl;
                                                    const merchantRows = glExpanded ? (() => {
                                                      const byMerchant = {};
                                                      filtered.filter(e => e.department === r.department && e.category === 'NON-HC' && e.gl === g.gl)
                                                        .forEach(e => { const m = e.merchant?.trim() || 'Unknown'; byMerchant[m] = (byMerchant[m] || 0) + (e.amount ?? 0); });
                                                      return Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).map(([name, amt]) => ({ name, amount: amt }));
                                                    })() : [];
                                                    return (
                                                      <div key={g.gl}>
                                                        <div
                                                          className="flex items-center justify-between px-4 py-2 text-xs cursor-pointer hover:bg-amber-50/50 rounded mx-1"
                                                          onClick={() => setExpandedGL(glExpanded ? null : g.gl)}
                                                        >
                                                          <span className="font-medium text-foreground/80">
                                                            <span className="inline-block w-3 mr-1 text-muted-foreground">{glExpanded ? '▾' : '›'}</span>
                                                            {g.gl}
                                                          </span>
                                                          <span className="font-medium text-foreground/70 tabular-nums">{fmt(g.amount)}</span>
                                                        </div>
                                                        {glExpanded && (
                                                          <div className="ml-7 mb-1 border-l-2 border-amber-200/40 pl-3">
                                                            {merchantRows.map(mr => (
                                                              <div key={mr.name} className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
                                                                <span>
                                                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300/50 mr-2 align-middle"></span>
                                                                  {mr.name}
                                                                </span>
                                                                <span className="tabular-nums">{fmt(mr.amount)}</span>
                                                              </div>
                                                            ))}
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </TableBody>
                            <TableFooter>
                              <TableRow>
                                <TableCell className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">{fmt(totalHc)}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(totalNonHc)}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(totalAll)}</TableCell>
                              </TableRow>
                            </TableFooter>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground">No expense transactions found for {drillLabel}.</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </DrawerContent>
            </Drawer>}

            {!selectedCompany && expensePieData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Expense Distribution by Company ({rangeLabel})</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {expensePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>)}

          {activeSection === 'insights' && (<>
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-1">Executive Insights &amp; Analysis</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Auto-generated findings from the latest financial data
              </p>
            </div>

            {insights.length > 0 ? (
              insights.map((insight, i) => (
                <InsightCard key={i} type={insight.type} icon={insight.icon}
                  title={insight.title} body={insight.body} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No notable insights detected in current data.</p>
            )}
          </>)}
        {/* Footer */}
        <div className="mt-10 border-t border-border/50 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            InVitro Capital &mdash; Confidential Shareholder Dashboard &bull;
            Data from &quot;InVitro Capital Consolidated - Actual&quot; &bull;
            Generated {lastUpdatedShort}
          </p>
          <button
            onClick={handleDeploy}
            disabled={deploying || reloadCountdown !== null}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying ? 'Triggering rebuild...' : reloadCountdown !== null ? `Reloading in ${reloadCountdown}s...` : 'Refresh Data'}
          </button>
          {reloadCountdown !== null && (
            <button onClick={() => window.location.reload()} className="ml-2 text-xs text-blue-400 hover:text-blue-300 underline">
              Reload now
            </button>
          )}
          {deployMsg && (
            <p className={`mt-1 text-xs ${deployMsg.includes('failed') || deployMsg.includes('error') || deployMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-600'}`}>{deployMsg}</p>
          )}
        </div>
      </main>
      </div>{/* end sidebar offset */}
    </div>
  );
}
