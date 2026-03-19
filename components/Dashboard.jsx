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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Trophy, Sprout, Info } from "lucide-react";
import { fmt, fmtShort, pct } from "@/lib/formatters";
import { buildColorMap, buildMonthlySeries, buildCashflowSeries, annualTotal, EXCLUDE_COMPANIES, PALETTE } from "@/lib/chartHelpers";
import { generateInsights } from "@/lib/insights";

/* -- Chart styling constants -- */
const CHART_STYLE = {
  positive: "#16a34a",
  negative: "#dc2626",
  muted: "#64748b",
  border: "#e2e8f0",
  totalLine: "#0f172a",
};

/* -- Icon lookup map for insights -- */
const INSIGHT_ICONS = {
  AlertTriangle, TrendingDown, TrendingUp, DollarSign, Trophy, Sprout, Info,
};

/* -- Sub-components -- */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-4 py-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-popover-foreground">{label}</p>
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
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">{title}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span className={`text-xs font-semibold ${trendUp ? "text-emerald-600" : "text-red-600"}`}>
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
  const borderMap = {
    positive: "border-emerald-300 bg-emerald-50",
    warning: "border-amber-300 bg-amber-50",
    danger: "border-red-300 bg-red-50",
    info: "border-blue-300 bg-blue-50",
  };
  const IconComponent = INSIGHT_ICONS[icon] || Info;
  return (
    <Alert className={`mb-3 ${borderMap[type] || borderMap.info}`}>
      <IconComponent className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  );
}

/* -- Main Dashboard -- */
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
  const currentYear = 2026;
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card px-8 py-6">
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
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last Updated</p>
            <Badge variant="secondary">{lastUpdated}</Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-8 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* ---- OVERVIEW ---- */}
          <TabsContent value="overview">
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title={`Total Revenue (${currentYear})`} value={fmt(totalRevCurrent)} trend={revGrowth !== null ? (revGrowth * 100).toFixed(0) + '% YoY' : 'N/A'} trendUp={revGrowth > 0} subtitle="excl. holdings" />
                <KPICard title={`Total EBITDA (${currentYear})`} value={fmt(totalEbitdaCurrent)} trend={ebitdaSwing !== null ? (ebitdaSwing >= 0 ? '+' : '') + fmt(ebitdaSwing) + ' swing' : null} trendUp={ebitdaSwing >= 0} subtitle={ebitdaMargin !== null ? (ebitdaMargin * 100).toFixed(0) + '% margin' : ''} />
                <KPICard title="Cash Balance" value={fmt(endingBalance)} trend={runwayMonths !== null ? (runwayMonths < 0 ? 'N/A' : '~' + runwayMonths.toFixed(1) + ' months') : 'Cash positive'} trendUp={runwayMonths === null || runwayMonths > 6} subtitle="runway at current burn" />
                <KPICard title="Gross Margin" value={pct(grossMarginCurrent)} trend={grossMarginChange !== null ? (grossMarginChange > 0 ? '+' : '') + (grossMarginChange * 100).toFixed(0) + 'pp YoY' : null} trendUp={grossMarginChange > 0} subtitle="portfolio weighted" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Revenue Trend ({currentYear}) &mdash; excl. Holdings</CardTitle>
                    <CardDescription>Excl. holdings entities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={revenueByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
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
                    <CardTitle>{currentYear} EBITDA Contribution by Company</CardTitle>
                    <CardDescription>All entities, current year</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={companyEbitdaData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis type="number" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <YAxis type="category" dataKey="name" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} width={120} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="EBITDA" radius={[0, 4, 4, 0]}>
                          {companyEbitdaData.map((e, i) => (
                            <Cell key={i} fill={e.value >= 0 ? CHART_STYLE.positive : CHART_STYLE.negative} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Company Performance Table */}
              <div>
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Company Performance Summary</CardTitle>
                    <CardDescription>All active portfolio companies &mdash; FY {currentYear}</CardDescription>
                  </CardHeader>
                </Card>
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
                            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: co.color }} />
                            {co.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold">{fmt(co.rev)}</div>
                            {co.revGrowth !== null ? (
                              <div className={`text-[11px] ${co.revGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {co.revGrowth >= 0 ? "+" : ""}{(co.revGrowth * 100).toFixed(0)}% YoY
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">New</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={`font-semibold ${co.ebitda >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(co.ebitda)}</div>
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
              </div>
            </div>
          </TabsContent>

          {/* ---- REVENUE ---- */}
          <TabsContent value="revenue">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Company ({currentYear})</CardTitle>
                  <CardDescription>Excluding holdings entities</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">YoY %</TableHead>
                        <TableHead className="text-right">Share %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueCompanies.map(name => {
                        const co = companyRows.find(c => c.name === name);
                        const share = totalRevCurrent > 0 ? (co.rev / totalRevCurrent * 100).toFixed(0) : 0;
                        return (
                          <TableRow key={name}>
                            <TableCell className="font-semibold">
                              <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: co.color }} />
                              {name}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{fmt(co.rev)}</TableCell>
                            <TableCell className="text-right">
                              {co.revGrowth !== null ? (
                                <span className={co.revGrowth >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {co.revGrowth >= 0 ? "+" : ""}{(co.revGrowth * 100).toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">New</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{share}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue by Company ({currentYear})</CardTitle>
                  <CardDescription>Stacked with total trend line</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={revenueByMonthWithTotal}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                      <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                      <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
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
                  <CardHeader>
                    <CardTitle>Revenue Mix ({currentYear}) &mdash; excl. Holdings</CardTitle>
                    <CardDescription>Excl. holdings entities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={revenuePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {revenuePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {hasPriorYear ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Year-over-Year Comparison</CardTitle>
                      <CardDescription>Revenue and EBITDA</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={yoyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                          <XAxis dataKey="metric" tick={{ fill: CHART_STYLE.muted, fontSize: 12 }} />
                          <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="y2025" name={String(priorYear)} fill="oklch(var(--chart-1))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="y2026" name={String(currentYear)} fill="oklch(var(--chart-2))" radius={[4, 4, 0, 0]} />
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
              </div>
            </div>
          </TabsContent>

          {/* ---- PROFITABILITY ---- */}
          <TabsContent value="profitability">
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Consolidated EBITDA" value={fmt(totalEbitdaCurrent)} trend={ebitdaSwing !== null ? (ebitdaSwing >= 0 ? '+' : '') + fmt(ebitdaSwing) + ' swing' : null} trendUp={ebitdaSwing >= 0} />
                <KPICard title="EBITDA Margin" value={ebitdaMargin !== null ? (ebitdaMargin * 100).toFixed(0) + '%' : 'N/A'} />
                <KPICard title="Gross Margin" value={pct(grossMarginCurrent)} trend={grossMarginChange !== null ? (grossMarginChange > 0 ? '+' : '') + (grossMarginChange * 100).toFixed(0) + 'pp YoY' : null} trendUp={grossMarginChange > 0} />
                {breakevenCompany ? (
                  <KPICard title={`${breakevenCompany} Breakeven`} value={`FY ${currentYear}`} trend="Reached EBITDA breakeven" trendUp={true} />
                ) : (
                  <KPICard title="Portfolio Companies" value={String(revenueCompanies.length)} subtitle="active operating entities" />
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly EBITDA by Company ({currentYear})</CardTitle>
                  <CardDescription>All entities with total trend</CardDescription>
                </CardHeader>
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
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gross Margin Trends by Company ({currentYear})</CardTitle>
                  <CardDescription>Excl. holdings entities</CardDescription>
                </CardHeader>
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
            </div>
          </TabsContent>

          {/* ---- CASH FLOW ---- */}
          <TabsContent value="cashflow">
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Ending Cash Balance" value={fmt(endingBalance)} trend={runwayMonths !== null ? (runwayMonths < 0 ? 'N/A' : runwayMonths.toFixed(1) + ' months runway') : 'Cash positive'} trendUp={runwayMonths === null || runwayMonths > 3} subtitle="at current burn rate" />
                <KPICard title="Total Cash Inflow" value={fmt(totalInflow)} subtitle="collections from all entities" />
                <KPICard title="Net Cash Movement" value={fmt(totalNetCash)} trend={totalNetCash < 0 ? 'Ops deficit' : 'Cash positive'} trendUp={totalNetCash >= 0} subtitle="all entities" />
                <KPICard title="Avg Monthly Burn" value={fmt(Math.abs(avgMonthlyBurn))} subtitle="average per month" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Cash Balance &amp; Flows</CardTitle>
                  <CardDescription>Inflows, outflows, and running balance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={cashBalanceByMonth} margin={{ right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                      <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar yAxisId="left" dataKey="inflow" name="Cash Inflow" fill="#22c55e" fillOpacity={0.6} />
                      <Bar yAxisId="left" dataKey="outflow" name="Cash Outflow" fill="#ef4444" fillOpacity={0.6} />
                      <Line yAxisId="right" type="monotone" dataKey="balance" name="Cash Balance" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {runwayMonths !== null && runwayMonths < 24 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Cash Runway Forecast</CardTitle>
                    <CardDescription>Projection at current burn rate</CardDescription>
                  </CardHeader>
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
            </div>
          </TabsContent>

          {/* ---- INSIGHTS ---- */}
          <TabsContent value="insights">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Executive Insights &amp; Analysis</CardTitle>
                  <CardDescription>Auto-generated findings from the latest financial data</CardDescription>
                </CardHeader>
              </Card>

              {insights.length > 0 ? (
                insights.map((insight, i) => (
                  <InsightCard key={i} type={insight.type} icon={insight.icon}
                    title={insight.title} body={insight.body} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No notable insights detected in current data.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-10 border-t border-border/50 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            InVitro Capital &mdash; Confidential Shareholder Dashboard &bull;
            Data from &quot;InVitro Capital Consolidated - Actual&quot; &bull;
            Generated {lastUpdatedShort}
          </p>
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="mt-2 text-xs text-blue-600 hover:text-blue-500 underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying ? 'Triggering...' : 'Refresh Data'}
          </button>
          {deployMsg && (
            <p className="mt-1 text-xs text-emerald-600">{deployMsg}</p>
          )}
        </div>
      </main>
    </div>
  );
}
