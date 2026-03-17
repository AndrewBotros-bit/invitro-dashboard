"use client";
import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { fmt, fmtShort, pct } from "@/lib/formatters";
import { buildColorMap, buildMonthlySeries, buildCashflowSeries, annualTotal, EXCLUDE_COMPANIES, PALETTE } from "@/lib/chartHelpers";
import { generateInsights } from "@/lib/insights";

/* ── Chart styling constants ── */
const CHART_STYLE = {
  positive: "#10b981",
  negative: "#ef4444",
  muted: "#94a3b8",
  border: "#334155",
  totalLine: "#f1f5f9",
};

/* ── Sub-components ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-slate-200">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="my-0.5 text-xs" style={{ color: entry.color }}>
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
};

function KPICard({ title, value, subtitle, trend, trendUp }) {
  return (
    <Card className="flex-1 min-w-[220px] gap-3 py-5">
      <CardContent className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`text-xs font-semibold ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
              {trendUp ? "\u25B2" : "\u25BC"} {trend}
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ icon, title, body, type = "info" }) {
  const bgMap = { positive: "bg-emerald-950/60 border-emerald-500/40", warning: "bg-amber-950/60 border-amber-500/40", danger: "bg-red-950/60 border-red-500/40", info: "bg-blue-950/60 border-blue-500/40" };
  return (
    <div className={`rounded-lg border p-4 mb-3 ${bgMap[type]}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function InVitroDashboard({ data }) {
  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState(null);

  // Color map from dynamic company list
  const colorMap = buildColorMap(data.companies);

  // Determine current and prior year from data
  const allYears = data.pnl.flatMap(c =>
    Object.values(c.metrics).flat().map(v => v.year)
  );
  const currentYear = Math.max(...allYears);
  const priorYear = currentYear - 1;
  const hasPriorYear = allYears.includes(priorYear);

  // Revenue companies (excluding holdings)
  const revenueCompanies = data.pnl
    .filter(c => !EXCLUDE_COMPANIES.includes(c.name))
    .map(c => c.name);

  // All companies including holdings (for EBITDA charts)
  const allCompanyNames = data.pnl.map(c => c.name);

  // Build chart data series
  const revenueByMonth = buildMonthlySeries(data.pnl, 'Revenue', EXCLUDE_COMPANIES);
  const ebitdaByMonth = buildMonthlySeries(data.pnl, 'EBITDA');
  const grossMarginByMonth = buildMonthlySeries(data.pnl, 'Gorss Margin, %', EXCLUDE_COMPANIES);
  const cashBalanceByMonth = buildCashflowSeries(data.cashflow);

  // Revenue by month with Total
  const revenueByMonthWithTotal = revenueByMonth.map(point => ({
    ...point,
    Total: revenueCompanies.reduce((sum, name) => sum + (point[name] ?? 0), 0),
  }));

  // EBITDA by month with Total
  const ebitdaByMonthWithTotal = ebitdaByMonth.map(point => ({
    ...point,
    Total: allCompanyNames.reduce((sum, name) => sum + (point[name] ?? 0), 0),
  }));

  // Annual totals
  const totalRevCurrent = annualTotal(data.pnl, 'Revenue', currentYear, EXCLUDE_COMPANIES);
  const totalRevPrior = annualTotal(data.pnl, 'Revenue', priorYear, EXCLUDE_COMPANIES);
  const revGrowth = hasPriorYear && totalRevPrior > 0
    ? (totalRevCurrent - totalRevPrior) / totalRevPrior
    : null;

  const totalEbitdaCurrent = annualTotal(data.pnl, 'EBITDA', currentYear);
  const totalEbitdaPrior = annualTotal(data.pnl, 'EBITDA', priorYear);
  const ebitdaSwing = hasPriorYear ? totalEbitdaCurrent - totalEbitdaPrior : null;
  const ebitdaMargin = totalRevCurrent > 0 ? totalEbitdaCurrent / totalRevCurrent : null;

  const totalGrossProfitCurrent = annualTotal(data.pnl, 'Gross Profit', currentYear, EXCLUDE_COMPANIES);
  const grossMarginCurrent = totalRevCurrent > 0 ? totalGrossProfitCurrent / totalRevCurrent : null;
  const totalGrossProfitPrior = annualTotal(data.pnl, 'Gross Profit', priorYear, EXCLUDE_COMPANIES);
  const grossMarginPrior = totalRevPrior > 0 ? totalGrossProfitPrior / totalRevPrior : null;
  const grossMarginChange = grossMarginCurrent !== null && grossMarginPrior !== null
    ? grossMarginCurrent - grossMarginPrior
    : null;

  // Cashflow totals
  const totalInflow = data.cashflow.reduce((sum, c) => {
    const vals = c.metrics['Cash Inflow'] ?? [];
    return sum + vals.reduce((s, v) => s + (v.value ?? 0), 0);
  }, 0);
  const totalNetCash = data.cashflow.reduce((sum, c) => {
    const vals = c.metrics['Net Cash Flow'] ?? [];
    return sum + vals.reduce((s, v) => s + (v.value ?? 0), 0);
  }, 0);
  const monthCount = cashBalanceByMonth.length || 1;
  const avgMonthlyBurn = totalNetCash / monthCount;
  const endingBalance = cashBalanceByMonth.length > 0
    ? cashBalanceByMonth[cashBalanceByMonth.length - 1].balance
    : 0;
  const runwayMonths = avgMonthlyBurn < 0
    ? endingBalance / Math.abs(avgMonthlyBurn)
    : null; // cash positive

  // EBITDA contribution by company (for horizontal bar chart)
  const companyEbitdaData = data.pnl.map(c => {
    const yearVals = (c.metrics['EBITDA'] ?? []).filter(v => v.year === currentYear);
    const total = yearVals.reduce((s, v) => s + (v.value ?? 0), 0);
    return { name: c.name, value: total };
  }).sort((a, b) => b.value - a.value);

  // Revenue pie (excluding holdings)
  const revenuePieData = data.pnl
    .filter(c => !EXCLUDE_COMPANIES.includes(c.name))
    .map(c => {
      const yearVals = (c.metrics['Revenue'] ?? []).filter(v => v.year === currentYear);
      const total = yearVals.reduce((s, v) => s + (v.value ?? 0), 0);
      return { name: c.name, value: total, color: colorMap[c.name] };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // YoY comparison data
  const yoyData = hasPriorYear ? [
    { metric: 'Revenue', y2025: totalRevPrior, y2026: totalRevCurrent },
    { metric: 'EBITDA', y2025: totalEbitdaPrior, y2026: totalEbitdaCurrent },
  ] : [];

  // Company performance table rows
  const companyRows = data.pnl.map(c => {
    const revCurrent = (c.metrics['Revenue'] ?? []).filter(v => v.year === currentYear).reduce((s, v) => s + (v.value ?? 0), 0);
    const revPrior = (c.metrics['Revenue'] ?? []).filter(v => v.year === priorYear).reduce((s, v) => s + (v.value ?? 0), 0);
    const ebitda = (c.metrics['EBITDA'] ?? []).filter(v => v.year === currentYear).reduce((s, v) => s + (v.value ?? 0), 0);
    const gp = (c.metrics['Gross Profit'] ?? []).filter(v => v.year === currentYear).reduce((s, v) => s + (v.value ?? 0), 0);
    const grossMargin = revCurrent > 0 ? gp / revCurrent : null;
    const companyRevGrowth = hasPriorYear && revPrior > 0 ? (revCurrent - revPrior) / revPrior : null;
    return { name: c.name, rev: revCurrent, ebitda, grossMargin, revGrowth: companyRevGrowth, color: colorMap[c.name] };
  });

  // Totals row (excl holdings)
  const totalRowRev = companyRows.filter(c => !EXCLUDE_COMPANIES.includes(c.name)).reduce((s, c) => s + c.rev, 0);
  const totalRowEbitda = companyRows.reduce((s, c) => s + c.ebitda, 0);
  const totalRowGrossMargin = totalRowRev > 0 ? totalGrossProfitCurrent / totalRevCurrent : null;

  // Gross margin percentage by month
  const grossMarginPctByMonth = grossMarginByMonth.map(point => {
    const pctPoint = { month: point.month };
    for (const key of Object.keys(point)) {
      if (key === 'month') continue;
      pctPoint[key] = point[key] !== null ? point[key] * 100 : null;
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
      if (EXCLUDE_COMPANIES.includes(c.name)) continue;
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
  const insights = generateInsights(data);

  // Deploy handler
  async function handleDeploy() {
    setDeploying(true);
    try {
      const res = await fetch('/api/deploy', { method: 'POST' });
      const json = await res.json();
      setDeployMsg(res.ok ? 'Rebuild triggered!' : json.error || 'Deploy failed');
    } catch {
      setDeployMsg('Failed to trigger rebuild');
    }
    setDeploying(false);
    setTimeout(() => setDeployMsg(null), 3000);
  }
export default function InVitroDashboard({ liveData, fetchError }) {
  // Use live data if available, otherwise fall back to hardcoded
  const m2026 = liveData?.monthly2026 || monthly2026;
  const ann = liveData?.annual || annual;
  const cf2026 = liveData?.cashflow2026 || cashflow2026;
  const lastUpdated = liveData?.lastUpdated;

  // Recalculate derived data from potentially live values
  const _revenueByMonth = months.map((m, i) => ({
    month: m, AllRx: m2026.allrx.rev[i], AllCare: m2026.allcare.rev[i],
    Osta: m2026.osta.rev[i], Needles: m2026.needles.rev[i],
    Total: m2026.allrx.rev[i] + m2026.allcare.rev[i] + m2026.osta.rev[i] + m2026.needles.rev[i],
  }));
  const _ebitdaByMonth = months.map((m, i) => ({
    month: m, AllRx: m2026.allrx.ebitda[i], AllCare: m2026.allcare.ebitda[i],
    Osta: m2026.osta.ebitda[i], Needles: m2026.needles.ebitda[i],
    "InVitro Studio": m2026.invitro.ebitda[i],
    Total: m2026.allrx.ebitda[i] + m2026.allcare.ebitda[i] + m2026.osta.ebitda[i] + m2026.needles.ebitda[i] + m2026.invitro.ebitda[i],
  }));
  const _cashBalanceByMonth = months.map((m, i) => ({
    month: m, balance: cf2026.monthlyBalance[i],
    inflow: cf2026.monthlyInflow[i], outflow: Math.abs(cf2026.monthlyOutflow[i]),
  }));
  const _companyEbitda2026 = [
    { name: "AllRx", value: Math.round(ann[2026].allrx.ebitda) },
    { name: "InVitro Studio", value: Math.round(ann[2026].invitro.ebitda) },
    { name: "AllCare", value: Math.round(ann[2026].allcare.ebitda) },
    { name: "Needles", value: Math.round(ann[2026].needles.ebitda) },
    { name: "Osta", value: Math.round(ann[2026].osta.ebitda) },
  ];
  const _revenuePie = [
    { name: "AllRx", value: Math.round(ann[2026].allrx.rev), color: C.allrx },
    { name: "AllCare", value: Math.round(ann[2026].allcare.rev), color: C.allcare },
    { name: "Osta", value: Math.round(ann[2026].osta.rev), color: C.osta },
    { name: "Needles", value: Math.round(ann[2026].needles.rev), color: C.needles },
  ];
  const _yoyComparison = [
    { metric: "Revenue", y2025: ann[2025].consolidated.rev, y2026: ann[2026].consolidated.rev },
    { metric: "EBITDA", y2025: ann[2025].consolidated.ebitda, y2026: ann[2026].consolidated.ebitda },
  ];
  const _companies = [
    { name: "AllRx", rev: Math.round(ann[2026].allrx.rev), ebitda: Math.round(ann[2026].allrx.ebitda), grossMargin: ann[2026].consolidated.grossMargin || 0.72, color: C.allrx, revGrowth: ann[2025].allrx.rev > 0 ? (ann[2026].allrx.rev - ann[2025].allrx.rev) / ann[2025].allrx.rev : 0 },
    { name: "AllCare", rev: Math.round(ann[2026].allcare.rev), ebitda: Math.round(ann[2026].allcare.ebitda), grossMargin: ann[2026].allcare.rev > 0 ? ann[2026].allcare.grossProfit / ann[2026].allcare.rev : 0, color: C.allcare, revGrowth: ann[2025].allcare.rev > 0 ? (ann[2026].allcare.rev - ann[2025].allcare.rev) / ann[2025].allcare.rev : 0 },
    { name: "Osta", rev: Math.round(ann[2026].osta.rev), ebitda: Math.round(ann[2026].osta.ebitda), grossMargin: ann[2026].osta.rev > 0 ? ann[2026].osta.grossProfit / ann[2026].osta.rev : 0, color: C.osta, revGrowth: ann[2025].osta.rev > 0 ? (ann[2026].osta.rev - ann[2025].osta.rev) / ann[2025].osta.rev : 0 },
    { name: "Needles", rev: Math.round(ann[2026].needles.rev), ebitda: Math.round(ann[2026].needles.ebitda), grossMargin: 0, color: C.needles, revGrowth: ann[2025].needles.rev > 0 ? (ann[2026].needles.rev - ann[2025].needles.rev) / ann[2025].needles.rev : 0 },
    { name: "InVitro Studio", rev: Math.round(ann[2026].invitro.rev), ebitda: Math.round(ann[2026].invitro.ebitda), grossMargin: 1.0, color: C.invitro, revGrowth: ann[2025].invitro.rev > 0 ? (ann[2026].invitro.rev - ann[2025].invitro.rev) / ann[2025].invitro.rev : 0 },
  ];

  const consolidatedRevGrowth = ann[2025].consolidated.rev > 0 ? (ann[2026].consolidated.rev - ann[2025].consolidated.rev) / ann[2025].consolidated.rev : 0;
  const ebitdaSwing = ann[2026].consolidated.ebitda - ann[2025].consolidated.ebitda;
  const monthlyBurn = cf2026.netCashMovement / 12;
  const runwayMonths = Math.abs(monthlyBurn) > 0 ? cf2026.endingCashBalance / Math.abs(monthlyBurn) : 999;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-6">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-extrabold text-white">
                IV
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                InVitro Capital &mdash; Shareholder Dashboard
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Consolidated Financial Performance &mdash; FY {currentYear} (Actuals) &bull; Source: InVitro Capital Consolidated - Actual
            </p>
          </div>
          <Card className="py-2 px-4 gap-0.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Updated</p>
            <p className="text-sm font-semibold">{lastUpdated}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{lastUpdated ? "Live Data" : "Last Updated"}</p>
            <p className="text-sm font-semibold">{lastUpdated ? new Date(lastUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : "March 12, 2026"}</p>
            {lastUpdated && <p className="text-[9px] text-emerald-400 font-medium">● Auto-refreshing every 5 min</p>}
          </Card>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-8 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 flex-wrap bg-slate-800/80">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* ────── OVERVIEW ────── */}
          <TabsContent value="overview">
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title={`Total Revenue (${currentYear})`} value={fmt(totalRevCurrent)} trend={revGrowth !== null ? (revGrowth * 100).toFixed(0) + '% YoY' : 'N/A'} trendUp={revGrowth > 0} subtitle="excl. holdings" />
              <KPICard title={`Total EBITDA (${currentYear})`} value={fmt(totalEbitdaCurrent)} trend={ebitdaSwing !== null ? (ebitdaSwing >= 0 ? '+' : '') + fmt(ebitdaSwing) + ' swing' : null} trendUp={ebitdaSwing >= 0} subtitle={ebitdaMargin !== null ? (ebitdaMargin * 100).toFixed(0) + '% margin' : ''} />
              <KPICard title="Cash Balance" value={fmt(endingBalance)} trend={runwayMonths !== null ? '~' + runwayMonths.toFixed(1) + ' months' : 'Cash positive'} trendUp={runwayMonths === null || runwayMonths > 6} subtitle="runway at current burn" />
              <KPICard title="Gross Margin" value={pct(grossMarginCurrent)} trend={grossMarginChange !== null ? (grossMarginChange > 0 ? '+' : '') + (grossMarginChange * 100).toFixed(0) + 'pp YoY' : null} trendUp={grossMarginChange > 0} subtitle="portfolio weighted" />
              <KPICard title="Total Revenue (2026)" value={fmt(ann[2026].consolidated.rev)} trend={`${(consolidatedRevGrowth * 100).toFixed(0)}% YoY`} trendUp={true} subtitle="excl. InVitro Studio" />
              <KPICard title="Total EBITDA (2026)" value={fmt(ann[2026].consolidated.ebitda)} trend={`+${fmt(ebitdaSwing)} swing`} trendUp={true} subtitle="9% margin" />
              <KPICard title="Cash Balance" value={fmt(cf2026.endingCashBalance)} trend={`~${runwayMonths.toFixed(1)} months`} trendUp={runwayMonths > 6} subtitle="runway at current burn" />
              <KPICard title="Gross Margin" value={pct(ann[2026].consolidated.grossMargin)} trend="+5pp YoY" trendUp={true} subtitle="portfolio weighted" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Monthly Revenue Trend ({currentYear}) &mdash; excl. Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                      <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                      <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <AreaChart data={_revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <Tooltip content={<CustomTooltip />} />
                      {revenueCompanies.map(name => (
                        <Area key={name} type="monotone" dataKey={name} stackId="1"
                          stroke={colorMap[name]} fill={colorMap[name]} fillOpacity={0.6} />
                      ))}
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{currentYear} EBITDA Contribution by Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={companyEbitdaData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                      <XAxis type="number" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <YAxis type="category" dataKey="name" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="EBITDA" radius={[0, 4, 4, 0]}>
                        {companyEbitdaData.map((e, i) => (
                          <Cell key={i} fill={e.value >= 0 ? CHART_STYLE.positive : CHART_STYLE.negative} />
                    <BarChart data={_companyEbitda2026} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <YAxis type="category" dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="EBITDA" radius={[0, 4, 4, 0]}>
                        {_companyEbitda2026.map((e, i) => (
                          <Cell key={i} fill={e.value >= 0 ? C.positive : C.negative} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Company Performance Table */}
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-1">Company Performance Summary</h2>
              <p className="text-sm text-muted-foreground mb-4">All active portfolio companies &mdash; FY {currentYear}</p>
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
                  {_companies.map((co) => (
                    <TableRow key={co.name}>
                      <TableCell className="font-semibold">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: co.color }} />
                        {co.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">{fmt(co.rev)}</div>
                        {co.revGrowth !== null ? (
                          <div className={`text-[11px] ${co.revGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {co.revGrowth >= 0 ? "+" : ""}{(co.revGrowth * 100).toFixed(0)}% YoY
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">New</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-semibold ${co.ebitda >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(co.ebitda)}</div>
                        <div className="text-[11px] text-muted-foreground">{co.rev > 0 ? (co.ebitda / co.rev * 100).toFixed(1) + '% margin' : 'N/A'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {co.grossMargin !== null && co.grossMargin > 0 ? `${(co.grossMargin * 100).toFixed(0)}%` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-slate-800/80 hover:bg-slate-800/80">
                    <TableCell className="font-bold">TOTAL (excl. holdings)</TableCell>
                    <TableCell className="text-right font-bold">{fmt(totalRowRev)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">{fmt(totalRowEbitda)}</TableCell>
                    <TableCell className="text-right font-bold">{totalRowGrossMargin !== null ? (totalRowGrossMargin * 100).toFixed(0) + '%' : 'N/A'}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>
          </TabsContent>

          {/* ────── REVENUE ────── */}
          <TabsContent value="revenue">
            <div className="flex flex-wrap gap-4 mb-6">
              {revenueCompanies.map(name => {
                const co = companyRows.find(c => c.name === name);
                const share = totalRevCurrent > 0 ? (co.rev / totalRevCurrent * 100).toFixed(0) : 0;
                return (
                  <KPICard key={name} title={`${name} Revenue`}
                    value={fmt(co.rev)}
                    trend={co.revGrowth !== null ? `${co.revGrowth >= 0 ? '+' : ''}${(co.revGrowth * 100).toFixed(0)}% YoY` : 'New'}
                    trendUp={co.revGrowth === null || co.revGrowth >= 0}
                    subtitle={`${share}% of total`}
                  />
                );
              })}
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly Revenue by Company ({currentYear})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={revenueByMonthWithTotal}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                  <ComposedChart data={_revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {revenueCompanies.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="1" fill={colorMap[name]}
                        radius={i === revenueCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2} dot={false} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Revenue Mix ({currentYear}) &mdash; excl. Holdings</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={revenuePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {revenuePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      <Pie data={_revenuePie} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {_revenuePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {hasPriorYear ? (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Year-over-Year Comparison</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={yoyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="metric" tick={{ fill: CHART_STYLE.muted, fontSize: 12 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="y2025" name={String(priorYear)} fill="#475569" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="y2026" name={String(currentYear)} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Year-over-year comparison requires data from two years
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle className="text-sm">Year-over-Year Comparison</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={_yoyComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="metric" tick={{ fill: C.muted, fontSize: 12 }} />
                      <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="y2025" name="2025" fill="#475569" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="y2026" name="2026" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ────── PROFITABILITY ────── */}
          <TabsContent value="profitability">
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title="Consolidated EBITDA" value={fmt(totalEbitdaCurrent)} trend={ebitdaSwing !== null ? (ebitdaSwing >= 0 ? '+' : '') + fmt(ebitdaSwing) + ' swing' : null} trendUp={ebitdaSwing >= 0} />
              <KPICard title="EBITDA Margin" value={ebitdaMargin !== null ? (ebitdaMargin * 100).toFixed(0) + '%' : 'N/A'} />
              <KPICard title="Gross Margin" value={pct(grossMarginCurrent)} trend={grossMarginChange !== null ? (grossMarginChange > 0 ? '+' : '') + (grossMarginChange * 100).toFixed(0) + 'pp YoY' : null} trendUp={grossMarginChange > 0} />
              {breakevenCompany ? (
                <KPICard title={`${breakevenCompany} Breakeven`} value={`FY ${currentYear}`} trend="Reached EBITDA breakeven" trendUp={true} />
              ) : (
                <KPICard title="Portfolio Companies" value={String(revenueCompanies.length)} subtitle="active operating entities" />
              )}
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly EBITDA by Company ({currentYear})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={ebitdaByMonthWithTotal}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                  <ComposedChart data={_ebitdaByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {allCompanyNames.map(name => (
                      <Bar key={name} dataKey={name} fill={colorMap[name]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2.5} dot={{ fill: CHART_STYLE.totalLine, r: 3 }} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Gross Margin Trends by Company ({currentYear})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={grossMarginPctByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} domain={['auto', 'auto']} unit="%" />
                    <Tooltip />
                    {gmCompanies.map(name => (
                      <Line key={name} type="monotone" dataKey={name} stroke={colorMap[name]}
                        strokeWidth={2} dot={false} connectNulls={true} />
                    ))}
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────── CASH FLOW ────── */}
          <TabsContent value="cashflow">
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title="Ending Cash Balance" value={fmt(endingBalance)} trend={runwayMonths !== null ? runwayMonths.toFixed(1) + ' months runway' : 'Cash positive'} trendUp={runwayMonths === null || runwayMonths > 3} subtitle="at current burn rate" />
              <KPICard title="Total Cash Inflow" value={fmt(totalInflow)} subtitle="collections from all entities" />
              <KPICard title="Net Cash Movement" value={fmt(totalNetCash)} trend={totalNetCash < 0 ? 'Ops deficit' : 'Cash positive'} trendUp={totalNetCash >= 0} subtitle="all entities" />
              <KPICard title="Avg Monthly Burn" value={fmt(Math.abs(avgMonthlyBurn))} subtitle="average per month" />
              <KPICard title="Ending Cash Balance" value={fmt(cf2026.endingCashBalance)} trend={`${runwayMonths.toFixed(1)} months runway`} trendUp={runwayMonths > 3} subtitle="at current burn rate" />
              <KPICard title="Total Cash Inflow" value={fmt(cf2026.totalCashInflow)} subtitle="collections from all entities" />
              <KPICard title="Net Cash Movement" value={fmt(cf2026.netCashMovement)} trend="Ops deficit" trendUp={false} subtitle="before financing" />
              <KPICard title="Financing Raised" value={fmt(cf2026.financingEquity + cf2026.financingDebt)} subtitle="equity + debt in 2026" />
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly Cash Balance &amp; Flows</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={cashBalanceByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                  <ComposedChart data={_cashBalanceByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="inflow" name="Cash Inflow" fill="#22c55e" fillOpacity={0.4} />
                    <Bar yAxisId="left" dataKey="outflow" name="Cash Outflow" fill="#ef4444" fillOpacity={0.4} />
                    <Line yAxisId="right" type="monotone" dataKey="balance" name="Cash Balance" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {runwayMonths !== null && runwayMonths < 24 ? (
              <Card>
                <CardHeader><CardTitle className="text-sm">Cash Runway Forecast</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={(() => {
                      const forecast = [];
                      let bal = endingBalance;
                      const forecastMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
                      const nextYear = currentYear + 1;
                      forecastMonths.forEach(m => {
                        bal += avgMonthlyBurn;
                        forecast.push({ month: `${m}'${String(nextYear).slice(-2)}`, balance: Math.max(0, bal) });
                      });
                      return [{ month: `Dec'${String(currentYear).slice(-2)}`, balance: endingBalance }, ...forecast];
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                      <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                      <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="mt-3 text-xs italic text-muted-foreground">
                    Projection assumes constant monthly burn of ~{fmt(Math.abs(avgMonthlyBurn))} with no additional financing.
                  </p>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader><CardTitle className="text-sm">Cash Runway Forecast</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={(() => {
                    const forecast = []; let bal = cf2026.endingCashBalance;
                    const avgBurn = cf2026.netCashMovement / 12;
                    ["Jan'27","Feb'27","Mar'27","Apr'27","May'27","Jun'27"].forEach((m) => { bal += avgBurn; forecast.push({ month: m, balance: Math.max(0, bal) }); });
                    return [{ month: "Dec'26", balance: cf2026.endingCashBalance }, ...forecast];
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="mt-3 text-xs italic text-muted-foreground">
                  Projection assumes constant monthly burn of ~{fmt(Math.abs(cf2026.netCashMovement / 12))} with no additional financing.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────── INSIGHTS ────── */}
          <TabsContent value="insights">
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
            <InsightCard type="positive" icon={"\uD83D\uDFE2"} title="Portfolio EBITDA turned positive \u2014 a major milestone" body="Consolidated EBITDA swung from approximately -$993K in 2025 to +$1.66M in 2026, a ~$2.65M improvement. This was driven by AllRx's continued profitability ($2.81M EBITDA) and InVitro Studio ($1.11M EBITDA), which more than offset losses at AllCare, Osta, and Needles." />
            <InsightCard type="positive" icon={"\uD83D\uDCC8"} title="AllCare is the breakout growth story" body="AllCare revenue surged from ~$1.3M in 2025 to $4.9M in 2026 (+276%), representing the fastest growth in the portfolio. More importantly, AllCare turned EBITDA-positive in August 2026, reaching $50.9K/month by December. At this trajectory, AllCare could become the second largest EBITDA contributor by mid-2027." />
            <InsightCard type="positive" icon={"\uD83C\uDFC6"} title="AllRx remains the anchor \u2014 stable and profitable" body="AllRx continues as the portfolio's cash cow with $12.97M revenue (69% of total) and $2.81M EBITDA (21.6% margin). Revenue grew 5.5% YoY while maintaining 72% gross margins. This provides a stable foundation for the portfolio." />
            <InsightCard type="warning" icon={"\u26A0\uFE0F"} title="Osta's losses are persistent and need attention" body="Osta's EBITDA was -$1.29M in 2026 \u2014 unchanged from 2025 despite 78% revenue growth to $855K. The company's cost structure isn't scaling with revenue. At 48% gross margins and high SG&A + R&D ($789K), Osta needs either significantly higher revenue or cost restructuring to reach breakeven." />
            <InsightCard type="danger" icon={"\uD83D\uDD34"} title="Cash runway is critically tight" body={`The consolidated cash balance is ${fmt(cf2026.endingCashBalance)} as of December 2026, with a monthly net operational burn of ~${fmt(Math.abs(monthlyBurn))}. Without additional financing, runway is approximately ${runwayMonths.toFixed(1)} months. A new capital raise or credit facility will be needed in early 2027.`} />
            <InsightCard type="warning" icon={"\uD83C\uDF31"} title="Needles is pre-revenue but building momentum" body="Needles generated only $45K in 2026 revenue but showed exponential month-over-month growth from $1K in April to $10.7K in December. The EBITDA loss of -$504K is expected for this stage. Key watch: can Needles reach $30K+ MRR by mid-2027 to justify continued investment?" />
            <InsightCard type="info" icon={"\uD83D\uDCA1"} title="Revenue diversification is improving" body="AllRx's share of total revenue dropped from ~87% in 2025 to 69% in 2026 as AllCare scaled rapidly. This diversification reduces concentration risk. However, the portfolio still relies heavily on AllRx for positive EBITDA, so profitability diversification remains a 2027 priority." />
            <InsightCard type="info" icon={"\uD83D\uDCCA"} title="Cashflow forecast assumptions" body="The runway projection assumes no new financing and constant burn. In reality, AllCare's improving EBITDA trend (+$50K/mo in Dec) and Needles' revenue acceleration should improve the picture. However, the tight cash position suggests proactive fundraising is advisable." />

            <Card className="mt-5">
              <CardHeader><CardTitle className="text-sm">Key Metrics to Watch in 2027</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {watchMetrics.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-background px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.target}</p>
                      </div>
                      <Badge
                        variant={
                          item.status === "On track" ? "success"
                          : item.status === "Critical" ? "danger"
                          : item.status === "At risk" ? "warning"
                          : "default"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-10 border-t border-border/50 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            InVitro Capital &mdash; Confidential Shareholder Dashboard &bull;
            Data from &quot;InVitro Capital Consolidated - Actual&quot; &bull;
            Generated {lastUpdatedShort}
            InVitro Capital &mdash; Confidential Shareholder Dashboard &bull; Live data from &quot;InVitro Capital Consolidated - Actual&quot; &bull; Auto-refreshes every 5 minutes
          </p>
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying ? 'Triggering...' : 'Refresh Data'}
          </button>
          {deployMsg && (
            <p className="mt-1 text-xs text-emerald-400">{deployMsg}</p>
          )}
        </div>
      </main>
    </div>
  );
}
