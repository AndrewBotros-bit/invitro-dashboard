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

/* ── Formatters ── */
const fmt = (v) => {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtShort = (v) => {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

/* ── Colors ── */
const C = {
  allrx: "#3b82f6", allcare: "#8b5cf6", osta: "#f59e0b",
  needles: "#10b981", invitro: "#6366f1", positive: "#10b981",
  negative: "#ef4444", muted: "#94a3b8", border: "#334155",
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ── Financial Data ── */
const monthly2026 = {
  allrx:    { rev: [1056168,1032373,958120,993232,1027993,1061672,1093499,1122689,1148474,1164718,1159141,1156380], ebitda: [240345,329155,206776,211866,220841,229444,226882,232795,237538,229187,223154,218088], grossMargin: [0.77,0.82,0.76,0.74,0.74,0.72,0.72,0.70,0.69,0.69,0.69,0.69] },
  allcare:  { rev: [202868,228543,274252,315389,356390,399157,447056,478349,526184,551433,562462,562462], ebitda: [-149106,-159782,-137009,-86756,-62356,-38605,-13889,4735,33202,44364,50927,50927], grossMargin: [0.55,0.58,0.60,0.60,0.60,0.60,0.60,0.60,0.60,0.60,0.60,0.60] },
  osta:     { rev: [64344,44683,44683,58088,63316,68381,75219,79732,83671,87407,90956,94334], ebitda: [-114632,-111369,-111610,-107461,-106377,-105328,-107110,-106175,-105359,-105928,-105193,-104493], grossMargin: [0.45,0.48,0.48,0.48,0.48,0.48,0.48,0.48,0.48,0.48,0.48,0.48] },
  needles:  { rev: [0,0,0,1000,1500,2250,3375,4388,5704,7415,8898,10677], ebitda: [-41827,-46504,-44327,-45327,-44827,-44077,-42952,-41940,-40623,-38912,-37429,-35650], grossMargin: [0,0,0,0,0,0,0,0,0,0,0,0] },
  invitro:  { rev: [235601,240501,240501,233484,233484,235184,235184,235184,235184,235184,235184,235184], ebitda: [76754,85017,100017,93000,93000,94700,94700,94700,94700,94700,94700,94700], grossMargin: [1,1,1,1,1,1,1,1,1,1,1,1] },
};

const annual = {
  2025: {
    allrx:   { rev: 12299489, ebitda: 2515874, grossProfit: 8482844 },
    allcare: { rev: 1305945, ebitda: -1713766, grossProfit: 802527 },
    osta:    { rev: 479125, ebitda: -1291036, grossProfit: 169764 },
    needles: { rev: 10206, ebitda: -504395, grossProfit: 0 },
    invitro: { rev: 2283016, ebitda: 800000, grossProfit: 2283016 },
    consolidated: { rev: 14094765, ebitda: -993323, grossMargin: 0.67 },
  },
  2026: {
    allrx:   { rev: 12974460, ebitda: 2806072, grossProfit: 9382208 },
    allcare: { rev: 4904545, ebitda: -463349, grossProfit: 2904800 },
    osta:    { rev: 854815, ebitda: -1291036, grossProfit: 410311 },
    needles: { rev: 45206, ebitda: -504395, grossProfit: 0 },
    invitro: { rev: 2829859, ebitda: 1110691, grossProfit: 2829859 },
    consolidated: { rev: 18779026, ebitda: 1657983, grossMargin: 0.72 },
  },
};

const cashflow2026 = {
  totalCashInflow: 15962595, totalCashOutflow: -16915344,
  netCashMovement: -952749, financingEquity: 1110000, financingDebt: 148083,
  cashedOut: -400000, endingCashBalance: 240961,
  monthlyBalance: [142534,101646,74547,55130,67296,55130,94887,82171,274195,268279,240961,240961],
  monthlyInflow: [1239745,962590,1321448,1132397,1210280,1036965,1555999,1410419,1475897,1524952,1404648,1687255],
  monthlyOutflow: [-1398338,-1006478,-1261048,-1242329,-1298114,-1225699,-1516242,-1451852,-1497180,-1532927,-1560564,-1924573],
};

/* ── Derived Data ── */
const revenueByMonth = months.map((m, i) => ({
  month: m, AllRx: monthly2026.allrx.rev[i], AllCare: monthly2026.allcare.rev[i],
  Osta: monthly2026.osta.rev[i], Needles: monthly2026.needles.rev[i],
  Total: monthly2026.allrx.rev[i] + monthly2026.allcare.rev[i] + monthly2026.osta.rev[i] + monthly2026.needles.rev[i],
}));

const ebitdaByMonth = months.map((m, i) => ({
  month: m, AllRx: monthly2026.allrx.ebitda[i], AllCare: monthly2026.allcare.ebitda[i],
  Osta: monthly2026.osta.ebitda[i], Needles: monthly2026.needles.ebitda[i],
  "InVitro Studio": monthly2026.invitro.ebitda[i],
  Total: monthly2026.allrx.ebitda[i] + monthly2026.allcare.ebitda[i] + monthly2026.osta.ebitda[i] + monthly2026.needles.ebitda[i] + monthly2026.invitro.ebitda[i],
}));

const cashBalanceByMonth = months.map((m, i) => ({
  month: m, balance: cashflow2026.monthlyBalance[i],
  inflow: cashflow2026.monthlyInflow[i], outflow: Math.abs(cashflow2026.monthlyOutflow[i]),
}));

const companyEbitda2026 = [
  { name: "AllRx", value: 2806072 }, { name: "InVitro Studio", value: 1110691 },
  { name: "AllCare", value: -463349 }, { name: "Needles", value: -504395 }, { name: "Osta", value: -1291036 },
];

const revenuePie = [
  { name: "AllRx", value: 12974460, color: C.allrx }, { name: "AllCare", value: 4904545, color: C.allcare },
  { name: "Osta", value: 854815, color: C.osta }, { name: "Needles", value: 45206, color: C.needles },
];

const yoyComparison = [
  { metric: "Revenue", y2025: annual[2025].consolidated.rev, y2026: annual[2026].consolidated.rev },
  { metric: "EBITDA", y2025: annual[2025].consolidated.ebitda, y2026: annual[2026].consolidated.ebitda },
];

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

/* ── Company rows data ── */
const companies = [
  { name: "AllRx", rev: 12974460, ebitda: 2806072, grossMargin: 0.72, color: C.allrx, revGrowth: 0.055 },
  { name: "AllCare", rev: 4904545, ebitda: -463349, grossMargin: 0.59, color: C.allcare, revGrowth: 2.76 },
  { name: "Osta", rev: 854815, ebitda: -1291036, grossMargin: 0.48, color: C.osta, revGrowth: 0.78 },
  { name: "Needles", rev: 45206, ebitda: -504395, grossMargin: 0, color: C.needles, revGrowth: 3.43 },
  { name: "InVitro Studio", rev: 2829859, ebitda: 1110691, grossMargin: 1.0, color: C.invitro, revGrowth: 0.24 },
];

const watchMetrics = [
  { label: "AllCare monthly EBITDA", target: ">$100K/mo by Q2", status: "On track" },
  { label: "Osta path to breakeven", target: "Revenue >$150K/mo needed", status: "At risk" },
  { label: "Needles MRR", target: ">$30K by Jun 2027", status: "Early" },
  { label: "Cash runway", target: ">12 months secured", status: "Critical" },
  { label: "Consolidated EBITDA margin", target: ">15% target", status: "Improving" },
  { label: "Revenue diversification", target: "AllRx <60% of total", status: "On track" },
];

/* ── Main Dashboard ── */
export default function InVitroDashboard() {
  const consolidatedRevGrowth = (annual[2026].consolidated.rev - annual[2025].consolidated.rev) / annual[2025].consolidated.rev;
  const ebitdaSwing = annual[2026].consolidated.ebitda - annual[2025].consolidated.ebitda;
  const monthlyBurn = cashflow2026.netCashMovement / 12;
  const runwayMonths = cashflow2026.endingCashBalance / Math.abs(monthlyBurn);

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
              Consolidated Financial Performance &mdash; FY 2026 (Actuals) &bull; Source: InVitro Capital Consolidated - Actual
            </p>
          </div>
          <Card className="py-2 px-4 gap-0.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Updated</p>
            <p className="text-sm font-semibold">March 12, 2026</p>
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
              <KPICard title="Total Revenue (2026)" value={fmt(annual[2026].consolidated.rev)} trend={`${(consolidatedRevGrowth * 100).toFixed(0)}% YoY`} trendUp={true} subtitle="excl. InVitro Studio" />
              <KPICard title="Total EBITDA (2026)" value={fmt(annual[2026].consolidated.ebitda)} trend={`+${fmt(ebitdaSwing)} swing`} trendUp={true} subtitle="9% margin" />
              <KPICard title="Cash Balance" value={fmt(cashflow2026.endingCashBalance)} trend={`~${runwayMonths.toFixed(1)} months`} trendUp={runwayMonths > 6} subtitle="runway at current burn" />
              <KPICard title="Gross Margin" value={pct(annual[2026].consolidated.grossMargin)} trend="+5pp YoY" trendUp={true} subtitle="portfolio weighted" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Monthly Revenue Trend (2026) &mdash; excl. InVitro Studio</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="AllRx" stackId="1" stroke={C.allrx} fill={C.allrx} fillOpacity={0.6} />
                      <Area type="monotone" dataKey="AllCare" stackId="1" stroke={C.allcare} fill={C.allcare} fillOpacity={0.6} />
                      <Area type="monotone" dataKey="Osta" stackId="1" stroke={C.osta} fill={C.osta} fillOpacity={0.6} />
                      <Area type="monotone" dataKey="Needles" stackId="1" stroke={C.needles} fill={C.needles} fillOpacity={0.6} />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">2026 EBITDA Contribution by Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={companyEbitda2026} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                      <YAxis type="category" dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="EBITDA" radius={[0, 4, 4, 0]}>
                        {companyEbitda2026.map((e, i) => (
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
              <p className="text-sm text-muted-foreground mb-4">All active portfolio companies &mdash; FY 2026</p>
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
                  {companies.map((co) => (
                    <TableRow key={co.name}>
                      <TableCell className="font-semibold">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: co.color }} />
                        {co.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">{fmt(co.rev)}</div>
                        {co.revGrowth !== undefined && (
                          <div className={`text-[11px] ${co.revGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {co.revGrowth >= 0 ? "+" : ""}{(co.revGrowth * 100).toFixed(0)}% YoY
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-semibold ${co.ebitda >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(co.ebitda)}</div>
                        <div className="text-[11px] text-muted-foreground">{(co.ebitda / co.rev * 100).toFixed(1)}% margin</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {co.grossMargin > 0 ? `${(co.grossMargin * 100).toFixed(0)}%` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-slate-800/80 hover:bg-slate-800/80">
                    <TableCell className="font-bold">TOTAL (excl. InVitro Studio)</TableCell>
                    <TableCell className="text-right font-bold">{fmt(18779026)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-400">{fmt(1657983)}</TableCell>
                    <TableCell className="text-right font-bold">72%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>
          </TabsContent>

          {/* ────── REVENUE ────── */}
          <TabsContent value="revenue">
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title="AllRx Revenue" value={fmt(12974460)} trend="+5.5% YoY" trendUp={true} subtitle="69% of total" />
              <KPICard title="AllCare Revenue" value={fmt(4904545)} trend="+276% YoY" trendUp={true} subtitle="26% of total" />
              <KPICard title="Osta Revenue" value={fmt(854815)} trend="+78% YoY" trendUp={true} subtitle="5% of total" />
              <KPICard title="Needles Revenue" value={fmt(45206)} trend="Early stage" trendUp={true} subtitle="<1% of total" />
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly Revenue by Company (2026)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="AllRx" stackId="1" fill={C.allrx} />
                    <Bar dataKey="AllCare" stackId="1" fill={C.allcare} />
                    <Bar dataKey="Osta" stackId="1" fill={C.osta} />
                    <Bar dataKey="Needles" stackId="1" fill={C.needles} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="Total" stroke="#f1f5f9" strokeWidth={2} dot={false} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Revenue Mix (2026) &mdash; excl. InVitro Studio</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={revenuePie} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {revenuePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Year-over-Year Comparison</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={yoyComparison}>
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
              <KPICard title="Consolidated EBITDA" value={fmt(1657983)} trend="Turned positive" trendUp={true} subtitle="vs -$993K in 2025" />
              <KPICard title="EBITDA Margin" value="9%" trend="+16pp swing" trendUp={true} subtitle="from -7% in 2025" />
              <KPICard title="Gross Margin" value="72%" trend="+5pp YoY" trendUp={true} subtitle="portfolio weighted" />
              <KPICard title="AllCare Breakeven" value="Aug 2026" trend="First month positive" trendUp={true} subtitle="$4.7K EBITDA" />
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly EBITDA by Company (2026)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={ebitdaByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="AllRx" fill={C.allrx} />
                    <Bar dataKey="AllCare" fill={C.allcare} />
                    <Bar dataKey="Osta" fill={C.osta} />
                    <Bar dataKey="Needles" fill={C.needles} />
                    <Bar dataKey="InVitro Studio" fill={C.invitro} />
                    <Line type="monotone" dataKey="Total" stroke="#f1f5f9" strokeWidth={2.5} dot={{ fill: "#f1f5f9", r: 3 }} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Gross Margin Trends by Company (2026)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={months.map((m, i) => ({ month: m, AllRx: monthly2026.allrx.grossMargin[i] * 100, AllCare: monthly2026.allcare.grossMargin[i] * 100, Osta: monthly2026.osta.grossMargin[i] * 100 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} domain={[30, 90]} unit="%" />
                    <Tooltip />
                    <Line type="monotone" dataKey="AllRx" stroke={C.allrx} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="AllCare" stroke={C.allcare} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Osta" stroke={C.osta} strokeWidth={2} dot={false} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────── CASH FLOW ────── */}
          <TabsContent value="cashflow">
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title="Ending Cash Balance" value={fmt(cashflow2026.endingCashBalance)} trend={`${runwayMonths.toFixed(1)} months runway`} trendUp={runwayMonths > 3} subtitle="at current burn rate" />
              <KPICard title="Total Cash Inflow" value={fmt(cashflow2026.totalCashInflow)} subtitle="collections from all entities" />
              <KPICard title="Net Cash Movement" value={fmt(cashflow2026.netCashMovement)} trend="Ops deficit" trendUp={false} subtitle="before financing" />
              <KPICard title="Financing Raised" value={fmt(cashflow2026.financingEquity + cashflow2026.financingDebt)} subtitle="equity + debt in 2026" />
            </div>

            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Monthly Cash Balance &amp; Flows (2026)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={cashBalanceByMonth}>
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

            <Card>
              <CardHeader><CardTitle className="text-sm">Cash Runway Forecast</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={(() => {
                    const forecast = []; let bal = cashflow2026.endingCashBalance;
                    const avgBurn = cashflow2026.netCashMovement / 12;
                    ["Jan'27","Feb'27","Mar'27","Apr'27","May'27","Jun'27"].forEach((m) => { bal += avgBurn; forecast.push({ month: m, balance: Math.max(0, bal) }); });
                    return [{ month: "Dec'26", balance: cashflow2026.endingCashBalance }, ...forecast];
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="mt-3 text-xs italic text-muted-foreground">
                  Projection assumes constant monthly burn of ~{fmt(Math.abs(cashflow2026.netCashMovement / 12))} with no additional financing.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ────── INSIGHTS ────── */}
          <TabsContent value="insights">
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-1">Executive Insights &amp; Analysis</h2>
              <p className="text-sm text-muted-foreground mb-4">Key findings and strategic observations from the data</p>
            </div>

            <InsightCard type="positive" icon={"\uD83D\uDFE2"} title="Portfolio EBITDA turned positive \u2014 a major milestone" body="Consolidated EBITDA swung from approximately -$993K in 2025 to +$1.66M in 2026, a ~$2.65M improvement. This was driven by AllRx's continued profitability ($2.81M EBITDA) and InVitro Studio ($1.11M EBITDA), which more than offset losses at AllCare, Osta, and Needles." />
            <InsightCard type="positive" icon={"\uD83D\uDCC8"} title="AllCare is the breakout growth story" body="AllCare revenue surged from ~$1.3M in 2025 to $4.9M in 2026 (+276%), representing the fastest growth in the portfolio. More importantly, AllCare turned EBITDA-positive in August 2026, reaching $50.9K/month by December. At this trajectory, AllCare could become the second largest EBITDA contributor by mid-2027." />
            <InsightCard type="positive" icon={"\uD83C\uDFC6"} title="AllRx remains the anchor \u2014 stable and profitable" body="AllRx continues as the portfolio's cash cow with $12.97M revenue (69% of total) and $2.81M EBITDA (21.6% margin). Revenue grew 5.5% YoY while maintaining 72% gross margins. This provides a stable foundation for the portfolio." />
            <InsightCard type="warning" icon={"\u26A0\uFE0F"} title="Osta's losses are persistent and need attention" body="Osta's EBITDA was -$1.29M in 2026 \u2014 unchanged from 2025 despite 78% revenue growth to $855K. The company's cost structure isn't scaling with revenue. At 48% gross margins and high SG&A + R&D ($789K), Osta needs either significantly higher revenue or cost restructuring to reach breakeven." />
            <InsightCard type="danger" icon={"\uD83D\uDD34"} title="Cash runway is critically tight" body={`The consolidated cash balance is ${fmt(cashflow2026.endingCashBalance)} as of December 2026, with a monthly net operational burn of ~${fmt(Math.abs(monthlyBurn))}. Without additional financing, runway is approximately ${runwayMonths.toFixed(1)} months. A new capital raise or credit facility will be needed in early 2027.`} />
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
            InVitro Capital &mdash; Confidential Shareholder Dashboard &bull; Data from &quot;InVitro Capital Consolidated - Actual&quot; &bull; Generated March 2026
          </p>
        </div>
      </main>
    </div>
  );
}
