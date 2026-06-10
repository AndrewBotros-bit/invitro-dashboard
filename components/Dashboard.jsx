"use client";
import { useState, Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart,
  ReferenceArea, ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { fmt, fmtShort, pct } from "@/lib/formatters";
import { buildColorMap, buildMonthlySeries, buildCashflowSeries, annualTotal, monthlyTotal, getAvailableMonths, filterSeriesToRange, buildYearlySeries, buildQuarterlySeries, rangeTotal, EXCLUDE_REVENUE, EXCLUDE_EBITDA, EXCLUDE_ALWAYS, PALETTE } from "@/lib/chartHelpers";
import { Button } from "@/components/ui/button";
import { generateInsights } from "@/lib/insights";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import DashboardSidebar from "@/components/DashboardSidebar";
import { CompanyAboutPanel } from "@/components/CompanyAboutPanel";
import IRRValuation from "@/components/IRRValuation";

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

function ComparisonBadge({ current, compValue, compLabel, invertColor = false }) {
  if (!compValue || compValue === 0 || current == null) return null;
  const pct = ((current - compValue) / Math.abs(compValue) * 100).toFixed(1);
  const up = Number(pct) >= 0;
  // For metrics where "up" is bad (expenses, burn rate), flip the color sense:
  // an increase renders red, a decrease renders green. Arrow direction stays
  // semantic (▲ still means "went up"); only the color flips.
  const isGood = invertColor ? !up : up;
  return (
    <div className="mt-1">
      <span className={`text-[10px] font-medium ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
        {up ? '▲' : '▼'} {Math.abs(Number(pct))}% vs {compLabel}
      </span>
    </div>
  );
}

/**
 * ComparisonBarChart — one grouped bar chart with two bars per company
 * (current period + comparison period), touching, color-coded by company
 * brand. Lets the eye compare current-vs-prior *per company* directly —
 * which is more useful than two-panel layouts for "where did the change
 * actually come from?" questions.
 *
 * Visual encoding:
 *   - Color per company (AllRx blue, AllCare green, etc.) for both bars
 *   - Current period: full opacity
 *   - Comparison period: 0.4 opacity (same color, "ghosted" look)
 *   - barGap={0}: the two bars touch — visually emphasizes that they belong
 *     to one company, not separate categories
 *
 * Header keeps the consolidated total + delta so the top-line story is
 * still legible at a glance.
 */
function ComparisonBarChart({ title, companies, currentData, currentLabel, compData, compLabel, colorMap, formatter = fmt, compIsOlder = true }) {
  // Merge per-company data into wide rows for Recharts: each row holds both
  // periods, which Recharts uses to render side-by-side bars within a group.
  const data = companies.map(name => ({
    name,
    current: currentData.find(d => d.name === name)?.value ?? 0,
    comp: compData.find(d => d.name === name)?.value ?? 0,
  }));

  const curTotal = currentData.reduce((s, d) => s + (d.value ?? 0), 0);
  const compTotal = compData.reduce((s, d) => s + (d.value ?? 0), 0);
  const totalPct = compTotal !== 0 ? ((curTotal - compTotal) / Math.abs(compTotal) * 100).toFixed(1) : null;
  const totalUp = totalPct !== null && Number(totalPct) >= 0;

  // Bar definitions, then ordered chronologically. The OLDER period is
  // always rendered first (left), the NEWER period second (right). Newer
  // gets full opacity (it's the focus); older is muted (baseline).
  const currentBar = {
    key: 'current',
    label: currentLabel,
    total: curTotal,
    fillOpacity: compIsOlder ? 1 : 0.4,
    cellKey: 'cur',
  };
  const compBar = {
    key: 'comp',
    label: compLabel,
    total: compTotal,
    fillOpacity: compIsOlder ? 0.4 : 1,
    cellKey: 'comp',
  };
  const bars = compIsOlder ? [compBar, currentBar] : [currentBar, compBar];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        {totalPct !== null && (
          <span className={`text-xs font-semibold ${totalUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {totalUp ? '▲' : '▼'} {Math.abs(Number(totalPct))}%
          </span>
        )}
      </CardHeader>
      <CardContent>
        {/* Period totals — chronological order matches the bar order
            below. Older period uses muted text, newer uses full foreground
            so the eye reads left-to-right as "where we were → where we are". */}
        <div className="flex items-center gap-6 mb-3 text-[11px]">
          {bars.map((b, i) => (
            <div className="flex flex-col" key={b.key}>
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">{b.label}</span>
              <span className={`text-base font-bold tabular-nums ${i === bars.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                {formatter(b.total)}
              </span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={0} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} interval={0} />
            <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              formatter={(v) => formatter(v)}
              labelStyle={{ fontSize: 11, color: '#475569', fontWeight: 600 }}
              contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0', padding: '6px 8px' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
            {bars.map(b => (
              <Bar key={b.key} dataKey={b.key} name={b.label} radius={[3, 3, 0, 0]} maxBarSize={36}>
                {data.map(d => (
                  <Cell key={`${b.cellKey}-${d.name}`} fill={colorMap[d.name] || '#94a3b8'} fillOpacity={b.fillOpacity} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function KPICard({ title, value, subtitle, trend, trendUp, comparison }) {
  // Compact KPI card. Sized for 5+ cards per row on desktop (min-w-[170px])
  // and wraps gracefully on narrower viewports. Each size knob is balanced:
  // tighter width \u2192 smaller value text \u2192 tighter padding.
  return (
    <Card className="flex-1 min-w-[170px] gap-1 py-3 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="space-y-1 px-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{title}</p>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {trend && (
            <span className={`text-[10px] font-semibold ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
              {trendUp ? "\u25B2" : "\u25BC"} {trend}
            </span>
          )}
          {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
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

/**
 * ChangeCard — renders one comparative insight (a ChangeRecord from
 * lib/insights.js). Shows the KPI label, the scope (Consolidated or
 * company name), and the actual numbers in both periods plus the delta.
 *
 * Tone color comes from the record (positive/warning/danger/info). The
 * arrow direction maps to whether the change is directionally good for
 * that KPI — "EBITDA went up" is positive, "Opex went up" is warning.
 */
function ChangeCard({ rec, rankBadge }) {
  const styles = {
    positive: { border: 'border-emerald-200', bg: 'bg-emerald-50/50', text: 'text-emerald-900', accent: 'text-emerald-700' },
    warning:  { border: 'border-amber-200',   bg: 'bg-amber-50/50',   text: 'text-amber-900',   accent: 'text-amber-700' },
    danger:   { border: 'border-red-200',     bg: 'bg-red-50/50',     text: 'text-red-900',     accent: 'text-red-700' },
    info:     { border: 'border-slate-200',   bg: 'bg-slate-50/50',   text: 'text-slate-900',   accent: 'text-slate-700' },
  };
  const s = styles[rec.tone] || styles.info;
  const arrow = rec.absDelta > 0 ? '▲' : rec.absDelta < 0 ? '▼' : '–';
  const formatVal = (v) =>
    rec.isMargin
      ? (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
      : fmt(v);
  const deltaPctStr = rec.pctDelta != null
    ? `${rec.pctDelta >= 0 ? '+' : ''}${(rec.pctDelta * 100).toFixed(1)}%`
    : 'new';
  const deltaAbsStr = rec.isMargin
    ? `${rec.absDelta >= 0 ? '+' : ''}${(rec.absDelta * 100).toFixed(1)} pp`
    : `${rec.absDelta >= 0 ? '+' : ''}${fmt(Math.abs(rec.absDelta)).replace(/^-/, '')}`;
  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} p-3 mb-2`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {rankBadge !== undefined && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-foreground/10 text-[10px] font-bold text-foreground/70">
              {rankBadge}
            </span>
          )}
          <span className={`text-base ${s.accent}`}>{arrow}</span>
          <span className={`text-sm font-semibold ${s.text}`}>{rec.kpi}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded ${rec.isConsolidated ? 'bg-primary text-primary-foreground' : 'bg-foreground/5 text-foreground/70'} truncate`}>
            {rec.scope}
          </span>
        </div>
        <div className={`text-xs font-bold tabular-nums ${s.accent} whitespace-nowrap`}>
          {deltaPctStr}
          {rec.pctDelta != null && <span className="text-[10px] opacity-70 ml-1">({deltaAbsStr})</span>}
        </div>
      </div>
      <div className={`text-xs ${s.accent} tabular-nums flex items-center gap-2 flex-wrap`}>
        <span className="text-muted-foreground">prior:</span>
        <span className="font-medium">{formatVal(rec.prior)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">current:</span>
        <span className={`font-bold ${s.text}`}>{formatVal(rec.current)}</span>
      </div>
      {/* Narrative / interpretation text. Generated in lib/insights.js
          buildNarrative() with cross-references to sibling KPIs (e.g.
          when EBITDA drops, the narrative checks whether Revenue moved
          with it to identify topline vs margin as the driver). */}
      {rec.narrative && (
        <p className={`mt-2 pt-2 border-t ${s.border}/60 text-[11px] leading-relaxed ${s.text}/90 italic`}>
          {rec.narrative}
        </p>
      )}
    </div>
  );
}

/**
 * Per-user view substitution for an external (public-target) company tab.
 *
 * Generalized form of the original applyExternalAllRxView — takes the
 * internal/external pair as parameters so the same logic powers both
 * AllRx-External and AllCare-External (and any future "X External"
 * companies). Three cases, decided by what's in `permissions.companies`:
 *  A. External-only — has '{X} External' but NOT '{X}':
 *     Drop internal {X} from data; rename external→"{X}". The user sees
 *     external numbers under the regular "{X}" label and has no idea an
 *     alternate view exists. Their perms.companies is also rewritten so
 *     the existing canSeeCompany('{X}') check passes naturally.
 *  B. No external access — drop the external rows entirely so they never
 *     leak into the user's view (they never had access to begin with).
 *  C. Both — admin/insider view. Keep both as separate company entities.
 *     Consolidated still uses internal only because '{X} External' is in
 *     EXCLUDE_ALWAYS (lib/chartHelpers.js).
 *
 * Note: '*' (all-access admin) lands in case C — both kept, separate sidebar
 * entries. Operates on a shallow copy; downstream code can treat result as
 * immutable.
 */
function applyExternalCompanyView(data, perms, internalName, externalName, opts = {}) {
  // opts.relabel (default true): when an LP has only the External variant,
  // rename it to the internal name so they don't know an alternate view
  // exists. AllRx External uses this (legacy behavior — LPs see "AllRx").
  // AllCare External opts OUT (relabel=false) — CFO direction is to keep
  // the explicit "AllCare External" label visible to LP-grantees.
  const relabel = opts.relabel !== false;
  const compList = Array.isArray(perms.companies) ? perms.companies : null;
  const hasExternal = perms.companies === '*' || compList?.includes(externalName) === true;
  const hasInternal = perms.companies === '*' || compList?.includes(internalName) === true;

  if (hasExternal && !hasInternal && relabel) {
    const transform = (arr) => (arr || [])
      .filter(c => c.name !== internalName)
      .map(c => c.name === externalName ? { ...c, name: internalName } : c);
    return {
      data: { ...data, pnl: transform(data.pnl), cashflow: transform(data.cashflow) },
      perms: {
        ...perms,
        companies: compList ? compList.map(c => c === externalName ? internalName : c) : perms.companies,
      },
    };
  }
  if (!hasExternal) {
    const stripExt = (arr) => (arr || []).filter(c => c.name !== externalName);
    return {
      data: { ...data, pnl: stripExt(data.pnl), cashflow: stripExt(data.cashflow) },
      perms,
    };
  }
  return { data, perms };
}

/* ── Main Dashboard ── */
export default function InVitroDashboard({ data: rawData, user }) {
  // Permission helpers
  const rawPerms = user?.permissions || { companies: '*', tabs: '*', breakdowns: '*' };
  // Apply external view substitutions *before* anything else reads
  // `data` or `perms` — keeps every downstream chart helper agnostic to
  // which internal/external variant is being shown. Run once per
  // (internal, external) pair; each call returns transformed { data, perms }
  // that the next call layers on top of.
  // Both External pairs use the relabel convention: LPs (and any user with
  // external-only access) see the entry under the regular internal name —
  // they don't know an alternate view exists. "AllRx External" → "AllRx",
  // "AllCare External" → "AllCare". Admin/internal users with both
  // permissions see the two as separate sidebar entries.
  const allRxApplied = applyExternalCompanyView(rawData, rawPerms, 'AllRx', 'AllRx External');
  const { data, perms } = applyExternalCompanyView(allRxApplied.data, allRxApplied.perms, 'AllCare', 'AllCare External');

  // LP auto-derived company set: when the user has an lpName, their visible
  // portfolio companies *include* the companies their vehicle(s) invested
  // in — auto-discovered from the IRR sheet so admin doesn't have to keep
  // company lists in sync with vehicle investments.
  //
  // IRR sheet uses combined block names (e.g. "AllCare + Curenta" because
  // Curenta acquired AllCare); the P&L and sidebar use plain "AllCare". We
  // normalize IRR names → P&L names through this alias map so the
  // auto-derive picks the same string the rest of the app uses.
  const IRR_TO_PNL_ALIAS = { 'AllCare + Curenta': 'AllCare' };
  const lpName = perms.lpName || null;
  const lpAutoCompanies = (() => {
    if (!lpName) return null;
    const vehicles = (data?.irrValuation?.vehicles || []).filter(v =>
      v.lps?.some(lp => lp.name === lpName)
    );
    const allowed = new Set();
    for (const v of vehicles) {
      for (const co of (data?.irrValuation?.companies || [])) {
        const series = co.investments?.[v.name] || [];
        if (series.some(x => x != null && x > 0)) {
          allowed.add(IRR_TO_PNL_ALIAS[co.name] || co.name);
        }
      }
    }
    return [...allowed];
  })();

  // canSeeCompany — admin's explicit grant (or '*') always allows; LP
  // auto-derive *adds* the companies they're invested in on top. So an LP
  // who admin also grants "AllCare" gets the union — their invested
  // companies + AllCare. Previously the auto-derive was authoritative for
  // LPs and silently dropped admin grants, which surprised Andrew when he
  // added AllCare to an LP and the LP didn't see it.
  const canSeeCompany = (name) => {
    if (perms.companies === '*') return true;
    if (Array.isArray(perms.companies) && perms.companies.includes(name)) return true;
    if (lpName && lpAutoCompanies && lpAutoCompanies.includes(name)) return true;
    return false;
  };
  // canSeeConsolidated — granted via '*' OR the literal 'Consolidated'
  // entry in perms.companies. Same data shape Andrew asked for: treat
  // Consolidated as a selectable item in the admin's company list.
  const canSeeConsolidated = () => {
    return perms.companies === '*' || (Array.isArray(perms.companies) && perms.companies.includes('Consolidated'));
  };

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

  // Sidebar & navigation state.
  // Default landing page depends on user role:
  //   - LP / shareholder (lpName set): IRR & Valuation tab. Their
  //     primary view is the look-through across vehicles/portcos.
  //   - Everyone else (admin, board members, operators): Portfolio
  //     Performance → Overview. Their primary view is operating
  //     financials of the portfolio companies.
  // Honors permissions: an LP without IRR tab access falls back to
  // 'overview' so they don't land on a forbidden section.
  const [activeSection, setActiveSection] = useState(() => {
    if (perms.lpName && canSeeTab('irr')) return 'irr';
    return 'overview';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Company selector state. 'AllRx External' is a parallel sidebar entry
  // that only materializes for users with explicit access to both AllRx
  // variants (admin/superuser); external-only users have already had the
  // entry renamed to "AllRx" upstream (applyExternalAllRxView).
  const ALL_COMPANIES = ['AllRx', 'AllRx External', 'AllCare', 'AllCare External', 'Osta', 'Needles', 'InVitro Studio'];
  // DISPLAY_COMPANIES drives sidebar order. Two rules:
  //   - Admin (companies === '*'): use the canonical ALL_COMPANIES order.
  //   - Viewer with an explicit array: use that array's order verbatim,
  //     filtered to companies that actually exist in ALL_COMPANIES.
  // This lets admins personalize the sidebar for individual users (e.g.
  // surface their primary portco first) just by reordering the array.
  const DISPLAY_COMPANIES = perms.companies === '*'
    ? ALL_COMPANIES.filter(canSeeCompany)
    : (Array.isArray(perms.companies) ? perms.companies : []).filter(c => ALL_COMPANIES.includes(c));
  // Initial selectedCompany — admin-customizable per user.
  //
  // Rule:
  //   - Admin (companies === '*'): AllCare is the headline portco by CFO
  //     direction; falls back to the canonical first company otherwise.
  //   - Viewer with explicit array: use the FIRST entry in their array.
  //     The array order is admin-set in /admin/users, so position 1
  //     IS the intended landing portco. Reordering the array reorders
  //     both the sidebar AND the landing page in one move.
  //   - Empty / no companies: null (Consolidated view).
  //
  // Per-user examples:
  //   Andrew (admin '*')              → AllCare
  //   Ayman ['InVitro Studio', ...]   → InVitro Studio
  //   LP user ['AllRx External', ...] → AllRx External
  const [selectedCompany, setSelectedCompany] = useState(() => {
    if (perms.companies === '*') {
      if (DISPLAY_COMPANIES.includes('AllCare')) return 'AllCare';
      return DISPLAY_COMPANIES[0] ?? null;
    }
    return DISPLAY_COMPANIES[0] ?? null;
  });
  const [expenseDrilldown, setExpenseDrilldown] = useState(null); // { year, month } or null
  const [revenueDrilldown, setRevenueDrilldown] = useState(null); // { year, month } or null
  const [gpDrilldown, setGpDrilldown] = useState(null); // { year, month } or null — AllCare service-line GP drilldown
  const [cfDrilldown, setCfDrilldown] = useState(null); // { kind: 'investing'|'financing', year, month } or null — Studio Indirect CF drill
  const [expandedDept, setExpandedDept] = useState(null); // 'G&A' | 'GTM' | etc. or null
  const [expandedGL, setExpandedGL] = useState(null); // GL name string or null
  const [expandedHCDivision, setExpandedHCDivision] = useState(null); // 'G&A:Executive' (dept:division) or null

  // View mode & date range state
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'quarterly' | 'yearly'

  // IRR & Valuation has different time semantics than the other tabs (point-
  // in-time per year, not a range), so it keeps its own state. Initial year
  // is 2026 per CFO direction — current year is the most actionable
  // reference for an LP arriving on the page. Fallback chain:
  //   1. 2026 if it's in the IRR years AND has data
  //   2. Most recent year with vehicle ownership data
  //   3. Last year in the IRR years array (no-data fallback)
  const irrYearsAvailable = data?.irrValuation?.years ?? [];
  const [irrYear, setIrrYear] = useState(() => {
    const irr = data?.irrValuation;
    if (!irr || !irr.years?.length) return null;
    const PREFERRED = 2026;
    const prefIdx = irr.years.indexOf(PREFERRED);
    if (prefIdx >= 0) {
      const hasData = irr.vehicles.some(v => v.ownershipValue?.[prefIdx] != null && v.ownershipValue[prefIdx] > 0);
      if (hasData) return PREFERRED;
    }
    // Fallback: most recent year with data
    for (let i = irr.years.length - 1; i >= 0; i--) {
      const hasData = irr.vehicles.some(v => v.ownershipValue?.[i] != null && v.ownershipValue[i] > 0);
      if (hasData) return irr.years[i];
    }
    return irr.years[irr.years.length - 1];
  });
  const [irrCompareEnabled, setIrrCompareEnabled] = useState(false);
  const [irrCompYear, setIrrCompYear] = useState(() => {
    // Default comparison: the year directly before the default current
    // year (2026 → 2025). Falls back to second-to-last in the array if
    // 2025 isn't present.
    const years = data?.irrValuation?.years ?? [];
    if (years.includes(2025)) return 2025;
    return years.length >= 2 ? years[years.length - 2] : null;
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareFromKey, setCompareFromKey] = useState(null); // null = auto-compute
  const [compareToKey, setCompareToKey] = useState(null);
  // IRR Look-Through view mode — lifted from IRRValuation to Dashboard so
  // the sidebar can drive it via the IRR & Valuation sub-nav. Values:
  // 'by-company' | 'by-source'. LP users land on 'by-source' (their
  // primary view); non-LP users default to 'by-company' (the cleaner
  // look-through summary). User can switch via sidebar sub-nav.
  const [irrView, setIrrView] = useState(() => perms.lpName ? 'by-source' : 'by-company');
  const availableMonths = getAvailableMonths(data.pnl);
  // Available years (unique, sorted)
  const availableYears = [...new Set(availableMonths.map(m => m.year))].sort();
  // Available quarters (unique, sorted by year then quarter). Each quarter
  // entry carries fromMonth/toMonth so the picker can translate a quarter
  // selection back into the month-keyed range state (rangeFromKey is always
  // a "YYYY-M" string under the hood — only the picker UI is quarter-aware).
  const availableQuarters = (() => {
    const seen = new Set();
    const result = [];
    for (const m of availableMonths) {
      const q = Math.ceil(m.month / 3);
      const key = `${m.year}-Q${q}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        key,
        year: m.year,
        quarter: q,
        fromMonth: (q - 1) * 3 + 1,
        toMonth: q * 3,
        label: `Q${q} ${String(m.year).slice(-2)}`,
      });
    }
    return result.sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter);
  })();
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
  // Chronological ordering for comparison views. Default convention is
  // "comp = older baseline, current = newer focus" — but the user can
  // pick any compRange, so detect explicitly. Used by ComparisonBarChart
  // to render bars in left=older, right=newer order.
  const compIsOlder = compareEnabled
    ? (compRange.from.year * 100 + compRange.from.month) < (rangeFrom.year * 100 + rangeFrom.month)
    : true;

  // Color map from dynamic company list
  const colorMap = buildColorMap(data.companies);

  // Per-company gross profit metric routing.
  // Osta uses "Gross Profit 2" (after marketing exp) because marketing is a structural
  // cost of revenue acquisition for marketplace-style companies. Other companies use
  // standard "Gross Profit" (= Revenue - COGS).
  const getGPMetric = (companyName) => companyName === 'Osta' ? 'Gross Profit 2' : 'Gross Profit';

  // Consolidated GP helpers — sum each company's GP using the routed metric.
  // These replace direct calls to rangeTotal/annualTotal/monthlyTotal on 'Gross Profit'.
  const consolidatedGPRange = (from, to, exclude = []) => {
    const fromVal = from.year * 100 + from.month;
    const toVal = to.year * 100 + to.month;
    return data.pnl
      .filter(c => !exclude.includes(c.name))
      .reduce((sum, c) => {
        const metric = c.metrics[getGPMetric(c.name)] ?? [];
        const total = metric
          .filter(v => { const vi = v.year * 100 + v.month; return vi >= fromVal && vi <= toVal; })
          .reduce((s, v) => s + (v.value ?? 0), 0);
        return sum + total;
      }, 0);
  };
  const consolidatedGPMonth = (year, month, exclude = []) =>
    consolidatedGPRange({ year, month }, { year, month }, exclude);
  const consolidatedGPYear = (year, exclude = []) =>
    consolidatedGPRange({ year, month: 1 }, { year, month: 12 }, exclude);

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

  // Forecast-shading boundary: any data point AFTER the last-actuals month
  // is forecast and should render with a translucent overlay so viewers
  // can instantly see "this is actuals" vs "this is projection."
  // Returns null when all data is actuals (no forecast region to shade).
  const MONTHS_SHORT_PARSE = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
  const getForecastBoundary = (dataArr) => {
    if (!Array.isArray(dataArr) || dataArr.length === 0) return null;
    const isYearly = viewMode === 'yearly';
    const isQuarterly = viewMode === 'quarterly';
    const isForecast = (point) => {
      const label = String(point.month ?? '');
      if (isYearly) {
        const y = Number(label);
        return y > prevMonthYear;
      }
      if (isQuarterly) {
        // Quarterly labels: "Q1 26" or "Q1 '26"
        const parts = label.split(' ');
        const qPart = parts[0] || '';
        const q = Number(qPart.replace(/^Q/, ''));
        const yearStr = (parts[1] || '').replace(/^'/, '');
        const y = 2000 + Number(yearStr);
        if (!q || isNaN(y)) return false;
        const prevQuarter = Math.ceil(prevMonth / 3);
        return y > prevMonthYear || (y === prevMonthYear && q > prevQuarter);
      }
      // Month labels in this codebase come in two flavors:
      //   "Jan 26"  (some helpers)
      //   "Jan '26" (cashflow + runway helpers, with apostrophe)
      // Strip a leading apostrophe from the year token before parsing
      // so both formats work uniformly.
      const parts = label.split(' ');
      const m = MONTHS_SHORT_PARSE[parts[0]] || 0;
      const yearStr = (parts[1] || '').replace(/^'/, '');
      const y = 2000 + Number(yearStr);
      if (!m || isNaN(y)) return false;
      return y > prevMonthYear || (y === prevMonthYear && m > prevMonth);
    };
    const firstIdx = dataArr.findIndex(isForecast);
    if (firstIdx === -1) return null;
    return { x1: dataArr[firstIdx].month, x2: dataArr[dataArr.length - 1].month };
  };

  // Returns a <Fragment> with a shaded forecast area + a dashed boundary
  // line at the actuals/forecast cutoff. Two encodings (color shift +
  // line) make the boundary visible even when the chart has lots of bars
  // or competing visual elements.
  //
  // Drop into any time-series ComposedChart with monthly/yearly categorical
  // X-axis. For SINGLE-axis charts: {forecastOverlay(dataArr)}. For MULTI-
  // yAxis charts: pass the primary axis id as the second arg, e.g.
  // {forecastOverlay(dataArr, 'gp')} — without it, Recharts defaults to
  // yAxisId=0 and silently drops the element if no such axis exists.
  const forecastOverlay = (dataArr, yAxisId) => {
    const b = getForecastBoundary(dataArr);
    if (!b) return null;
    const axisProps = yAxisId !== undefined ? { yAxisId } : {};
    return (
      <Fragment>
        <ReferenceArea
          {...axisProps}
          x1={b.x1}
          x2={b.x2}
          fill="#94a3b8"
          fillOpacity={0.25}
          stroke="none"
          ifOverflow="visible"
          label={{ value: 'Forecast', position: 'insideTopRight', fontSize: 10, fill: '#475569', fontWeight: 600, dy: 6, dx: -6 }}
        />
        <ReferenceLine
          {...axisProps}
          x={b.x1}
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeOpacity={0.7}
          ifOverflow="visible"
        />
      </Fragment>
    );
  };

  // Previous month actuals
  const prevRevenue = monthlyTotal(data.pnl, 'Revenues', prevMonthYear, prevMonth, dynExcludeRevenue);
  const currRevenue = monthlyTotal(data.pnl, 'Revenues', currentYear, currentMonth, dynExcludeRevenue);
  const prevEbitda = monthlyTotal(data.pnl, 'EBITDA', prevMonthYear, prevMonth, dynExcludeEbitda);
  const currEbitda = monthlyTotal(data.pnl, 'EBITDA', currentYear, currentMonth, dynExcludeEbitda);
  const prevGrossProfit = consolidatedGPMonth(prevMonthYear, prevMonth, dynExcludeRevenue);
  const prevGrossMargin = prevRevenue > 0 ? prevGrossProfit / prevRevenue : null;
  const currGrossProfit = consolidatedGPMonth(currentYear, currentMonth, dynExcludeRevenue);
  const currGrossMargin = currRevenue > 0 ? currGrossProfit / currRevenue : null;

  // Range-based KPI totals (used when viewMode === 'yearly')
  const rangeRevenue = rangeTotal(data.pnl, 'Revenues', rangeFrom, rangeTo, dynExcludeRevenue);
  const rangeEbitda = rangeTotal(data.pnl, 'EBITDA', rangeFrom, rangeTo, dynExcludeEbitda);
  const rangeGrossProfit = consolidatedGPRange(rangeFrom, rangeTo, dynExcludeRevenue);
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
    : viewMode === 'quarterly'
    ? buildQuarterlySeries(data.pnl, 'Revenues', dynExcludeRevenue, rangeFrom, rangeTo)
    : filterSeriesToRange(rawRevenueByMonth, rangeFrom, rangeTo, availableMonths);
  const ebitdaByMonth = viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, yearFrom, yearTo)
    : viewMode === 'quarterly'
    ? buildQuarterlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, rangeFrom, rangeTo)
    : filterSeriesToRange(rawEbitdaByMonth, rangeFrom, rangeTo, availableMonths);
  // ── Comparison ghost series (dashed overlay) ──
  // Build comparison series aligned to current period months
  const compRevenueByMonth = compareEnabled ? (viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'Revenues', dynExcludeRevenue, compRange.from.year, compRange.to.year)
    : viewMode === 'quarterly'
    ? buildQuarterlySeries(data.pnl, 'Revenues', dynExcludeRevenue, compRange.from, compRange.to)
    : filterSeriesToRange(rawRevenueByMonth, compRange.from, compRange.to, availableMonths)
  ) : [];
  const compEbitdaByMonth = compareEnabled ? (viewMode === 'yearly'
    ? buildYearlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, compRange.from.year, compRange.to.year)
    : viewMode === 'quarterly'
    ? buildQuarterlySeries(data.pnl, 'EBITDA', dynExcludeEbitda, compRange.from, compRange.to)
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

  // Yearly rollup of cashBalanceByMonth for viewMode='yearly'. All four
  // tracked metrics (inflow/outflow/opsCashFlow/net) are FLOW metrics so
  // the yearly value = sum of the monthly values for that year. (If a
  // stock metric like cash balance is ever added to this series, it
  // needs end-of-year semantics, not sum.) x-axis label collapses to
  // just the year string.
  const cashBalanceByYear = (() => {
    if (cashBalanceByMonth.length === 0) return [];
    const byYear = {};
    for (const p of cashBalanceByMonth) {
      const y = p._year;
      if (!byYear[y]) {
        byYear[y] = { month: String(y), inflow: 0, outflow: 0, opsCashFlow: 0, net: 0, _year: y, _month: 12 };
      }
      byYear[y].inflow += p.inflow;
      byYear[y].outflow += p.outflow;
      byYear[y].opsCashFlow += p.opsCashFlow;
      byYear[y].net += p.net;
    }
    return Object.values(byYear).sort((a, b) => a._year - b._year);
  })();

  // Quarterly rollup of cashBalanceByMonth for viewMode='quarterly'. Same
  // FLOW-metric assumption as cashBalanceByYear (sum of months in quarter).
  const cashBalanceByQuarter = (() => {
    if (cashBalanceByMonth.length === 0) return [];
    const byBucket = {};
    for (const p of cashBalanceByMonth) {
      const q = Math.ceil(p._month / 3);
      const key = `${p._year}-${q}`;
      if (!byBucket[key]) {
        byBucket[key] = { month: `Q${q} '${String(p._year).slice(-2)}`, inflow: 0, outflow: 0, opsCashFlow: 0, net: 0, _year: p._year, _quarter: q, _month: q * 3 };
      }
      byBucket[key].inflow += p.inflow;
      byBucket[key].outflow += p.outflow;
      byBucket[key].opsCashFlow += p.opsCashFlow;
      byBucket[key].net += p.net;
    }
    return Object.values(byBucket).sort((a, b) => a._year !== b._year ? a._year - b._year : a._quarter - b._quarter);
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
  // Merge an arbitrary list of monthly-value arrays into a single
  // by-month series. Used to combine multiple metrics for a company.
  const mergeMonthlyValues = (...lists) => {
    const byKey = {};
    for (const list of lists) {
      for (const v of (list || [])) {
        const k = `${v.year}-${v.month}`;
        byKey[k] = byKey[k] || { year: v.year, month: v.month, value: 0 };
        byKey[k].value += v.value ?? 0;
      }
    }
    return Object.values(byKey);
  };

  // Per-company expense values on the company's *own books*: SG&A + R&D
  // for portfolio companies, Fixed + Direct for the studio. Does NOT
  // include the 'Studio Expense' allocation line — that's an
  // intercompany allocation and including it here would double-count
  // when consolidating (sum-of-portcos + studio's own = 2× studio cost).
  // For "attributable cost of running a portfolio company" (incl.
  // allocated overhead), use getCompanyAttributableExpenses below.
  const getCompanyExpenseValues = (co) => {
    if (!co) return [];
    if (co.name === 'InVitro Studio') {
      return mergeMonthlyValues(co.metrics['Fixed Expenses'], co.metrics['Direct Expenses']);
    }
    return co.metrics['SG&A + R&D Expenses'] ?? [];
  };

  // Per-company expense values INCLUDING the allocated 'Studio Expense'
  // overhead share. Used by the Overview KPI badge and the per-company
  // row in the Company Performance table — places where the user wants
  // to see "what does it really cost to run this business?"
  //
  // Don't use this for distribution pies or consolidated totals — those
  // need to avoid double-counting against the studio's own Fixed/Direct.
  const getCompanyAttributableExpenses = (co) => {
    if (!co) return [];
    if (co.name === 'InVitro Studio') {
      // Studio has no allocation TO itself; just its own costs.
      return mergeMonthlyValues(co.metrics['Fixed Expenses'], co.metrics['Direct Expenses']);
    }
    return mergeMonthlyValues(co.metrics['SG&A + R&D Expenses'], co.metrics['Studio Expense']);
  };

  const getExpenseLabel = () => {
    if (!selectedCompany) return 'Total Expenses';
    if (selectedCompany === 'InVitro Studio') return 'Fixed + Direct Expenses';
    // Per CFO direction: the Expenses tab shows opex WITHOUT the Studio
    // cross-charge allocation. The label is explicit so users understand
    // the number isn't fully-loaded — the Overview KPI cards still show
    // the fully-loaded view.
    return 'SG&A + R&D (excl. Studio)';
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
      if (viewMode === 'quarterly') {
        const byBucket = {};
        for (const v of vals) {
          if (v.year < rangeFrom.year || v.year > rangeTo.year) continue;
          const q = Math.ceil(v.month / 3);
          const key = `${v.year}-${q}`;
          byBucket[key] = byBucket[key] || { month: `Q${q} ${String(v.year).slice(-2)}`, _year: v.year, _quarter: q, _month: q * 3, 'InVitro Studio': 0 };
          byBucket[key]['InVitro Studio'] += v.value ?? 0;
        }
        return Object.values(byBucket).sort((a, b) => a._year !== b._year ? a._year - b._year : a._quarter - b._quarter);
      }
      return vals
        .filter(v => { const pv = v.year * 100 + v.month; return pv >= fromVal && pv <= toVal; })
        .map(v => ({ month: `${MONTHS[v.month]} ${String(v.year).slice(-2)}`, 'InVitro Studio': v.value ?? 0 }));
    }
    // Standard: use SG&A + R&D Expenses, then merge InVitro Studio
    const rawSgna = buildMonthlySeries(data.pnl, 'SG&A + R&D Expenses', dynExcludeEbitda, null);
    const base = viewMode === 'yearly'
      ? buildYearlySeries(data.pnl, 'SG&A + R&D Expenses', dynExcludeEbitda, yearFrom, yearTo)
      : viewMode === 'quarterly'
      ? buildQuarterlySeries(data.pnl, 'SG&A + R&D Expenses', dynExcludeEbitda, rangeFrom, rangeTo)
      : filterSeriesToRange(rawSgna, rangeFrom, rangeTo, availableMonths);
    // Merge InVitro Studio's Fixed+Direct into the consolidated series
    const studio = data.pnl.find(c => c.name === 'InVitro Studio');
    if (studio && !dynExcludeEbitda.includes('InVitro Studio')) {
      const studioVals = getCompanyExpenseValues(studio);
      for (const point of base) {
        if (viewMode === 'yearly') {
          const match = studioVals.find(v => String(v.year) === point.month);
          if (match) point['InVitro Studio'] = match.value;
        } else if (viewMode === 'quarterly') {
          // Sum all months in the quarter
          const matches = studioVals.filter(v => v.year === point._year && Math.ceil(v.month / 3) === point._quarter);
          if (matches.length > 0) {
            point['InVitro Studio'] = matches.reduce((s, v) => s + (v.value ?? 0), 0);
          }
        } else {
          const match = studioVals.find(v => `${MONTHS[v.month]} ${String(v.year).slice(-2)}` === point.month);
          if (match) point['InVitro Studio'] = match.value;
        }
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
      : viewMode === 'quarterly'
      ? buildQuarterlySeries(data.pnl, selectedCompany ? 'SG&A + R&D Expenses' : 'Total Expenses', dynExcludeEbitda, compRange.from, compRange.to)
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

  const totalGrossProfitCurrent = consolidatedGPYear(currentYear, dynExcludeRevenue);
  const grossMarginCurrent = totalRevCurrent > 0 ? totalGrossProfitCurrent / totalRevCurrent : null;
  const totalGrossProfitPrior = consolidatedGPYear(priorYear, dynExcludeRevenue);
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

  // Window-filter helper for arbitrary [from, to] ranges. Used to build
  // comparison-period pie data using the SAME shape/filter logic as the
  // current-period pies above — keeps the mix calculations symmetric.
  const inWindowFn = (from, to) => (v) => {
    const vi = v.year * 100 + v.month;
    return vi >= from.year * 100 + from.month && vi <= to.year * 100 + to.month;
  };

  // Comparison-period pies (only built when Compare is enabled). Same shape
  // as revenuePieData/expensePieData so the JSX can render them identically.
  const compRevenuePieData = compareEnabled ? data.pnl
    .filter(c => !dynExcludeRevenue.includes(c.name))
    .map(c => {
      const vals = (c.metrics['Revenues'] ?? []).filter(inWindowFn(compRange.from, compRange.to));
      const total = vals.reduce((s, v) => s + (v.value ?? 0), 0);
      return { name: c.name, value: total, color: colorMap[c.name] };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value) : [];

  // AllCare product-mix data for the comparison range (when compareEnabled
  // and the user is drilled into AllCare). Mirrors revenuePieData's
  // selectAllCareProductMixPie gate so the compare pie also swaps to the
  // product-mix decomposition.
  const compAllCareProductMixPieData = (() => {
    if (!compareEnabled) return [];
    const slArr = data.revenueDetails?.AllCare?.serviceLines || [];
    if (slArr.length === 0) return [];
    const stripSuffix = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim();
    const inComp = inWindowFn(compRange.from, compRange.to);
    const ALLCARE_PRODUCT_GROUPS_COMP = [
      { name: 'Primary Care + CCM', members: ['Primary Care', 'CCM'], color: '#16a34a' },
      { name: 'Podiatry + PCM',     members: ['Podiatry', 'PCM'],     color: '#0ea5e9' },
      { name: 'Psych',              members: ['Psych'],               color: '#f59e0b' },
      { name: 'Diagnostics',        members: ['Diagnostics'],         color: '#8b5cf6' },
      { name: 'RPM',                members: ['RPM'],                 color: '#ef4444' },
    ];
    return ALLCARE_PRODUCT_GROUPS_COMP.map(group => {
      let total = 0;
      for (const sl of slArr) {
        if (group.members.includes(stripSuffix(sl.name))) {
          total += (sl.metrics?.['Revenues'] ?? []).filter(inComp).reduce((s, v) => s + (v.value ?? 0), 0);
        }
      }
      return { name: group.name, value: total, color: group.color };
    }).filter(g => g.value > 0);
  })();

  const compExpensePieData = compareEnabled ? data.pnl
    .filter(c => !dynExcludeEbitda.includes(c.name))
    .map(c => {
      const vals = getCompanyExpenseValues(c).filter(inWindowFn(compRange.from, compRange.to));
      const total = vals.reduce((s, v) => s + Math.abs(v.value ?? 0), 0);
      return { name: c.name, value: total, color: colorMap[c.name] };
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value) : [];

  // Expense total for an arbitrary [from, to] window. Same source as the
  // current-period rangeExpenses below, so current and comparison values
  // are computed by the SAME logic — avoiding the asymmetric-sourcing bug
  // where rangeTotal() on 'Total Expenses' returns 0 because it skips the
  // 'ALL Holdings' aggregate entity (which is the only entity carrying
  // that metric). Always returns a signed value (negative on the P&L);
  // callers Math.abs() when they want magnitude.
  const expensesInRange = (from, to) => {
    const inWindow = (v) => {
      const vi = v.year * 100 + v.month;
      return vi >= from.year * 100 + from.month && vi <= to.year * 100 + to.month;
    };
    if (selectedCompany) {
      // Per-company view: include the 'Studio Expense' allocation so the
      // KPI reflects the *attributable* cost of running this business,
      // not just its direct opex line.
      const co = data.pnl.find(c => c.name === selectedCompany);
      return getCompanyAttributableExpenses(co).filter(inWindow).reduce((s, v) => s + (v.value ?? 0), 0);
    }
    const allH = data.pnl.find(c => c.name === 'ALL Holdings');
    return (allH?.metrics['Total Expenses'] ?? []).filter(inWindow).reduce((s, v) => s + (v.value ?? 0), 0);
  };
  const rangeExpenses = expensesInRange(rangeFrom, rangeTo);
  const avgMonthlyExpense = monthCount > 0 ? rangeExpenses / monthCount : 0;

  // Same shape as expensesInRange, but EXCLUDES the 'Studio Expense'
  // allocation for non-Studio companies. The Expenses tab (per CFO
  // direction) wants to show only the company's own SG&A + R&D opex —
  // the Studio allocation is a cross-charge that lives in its own
  // accounting layer, not the per-department GL ledger. Per-company:
  //   InVitro Studio → Fixed + Direct (its OWN costs; no allocation
  //                    to itself, so identical to expensesInRange)
  //   Other portcos  → SG&A + R&D Expenses only (no Studio cross-charge)
  // Consolidated uses 'Total Expenses' minus a 'Studio Expense' sum
  // across all portcos, computed inline below.
  const expensesInRangeExclStudio = (from, to) => {
    const inWindow = (v) => {
      const vi = v.year * 100 + v.month;
      return vi >= from.year * 100 + from.month && vi <= to.year * 100 + to.month;
    };
    if (selectedCompany) {
      const co = data.pnl.find(c => c.name === selectedCompany);
      if (!co) return 0;
      if (co.name === 'InVitro Studio') {
        return mergeMonthlyValues(co.metrics['Fixed Expenses'], co.metrics['Direct Expenses'])
          .filter(inWindow).reduce((s, v) => s + (v.value ?? 0), 0);
      }
      return (co.metrics['SG&A + R&D Expenses'] ?? [])
        .filter(inWindow).reduce((s, v) => s + (v.value ?? 0), 0);
    }
    // Consolidated: Total Expenses minus the Studio Expense allocation
    // (which is BAKED INTO each portco's Total Expenses on the ALL
    // Holdings rollup). Subtract Σ(Studio Expense) across all portcos
    // to net it out.
    const allH = data.pnl.find(c => c.name === 'ALL Holdings');
    const total = (allH?.metrics['Total Expenses'] ?? []).filter(inWindow).reduce((s, v) => s + (v.value ?? 0), 0);
    const studioAllocSum = data.pnl
      .filter(c => c.name !== 'InVitro Studio' && c.name !== 'ALL Holdings')
      .reduce((s, c) => s + ((c.metrics?.['Studio Expense'] ?? [])
        .filter(inWindow).reduce((a, v) => a + (v.value ?? 0), 0)), 0);
    return total - studioAllocSum;
  };
  const rangeExpensesExclStudio = expensesInRangeExclStudio(rangeFrom, rangeTo);

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
  // AllCare product-mix pie. Per CFO direction, AllCare's 7 service
  // lines collapse into 5 groupings that make business sense (paired
  // visit + care-management lines as one product family):
  //   1. Primary Care + CCM
  //   2. Podiatry + PCM
  //   3. Psych
  //   4. Diagnostics
  //   5. RPM
  // Sourced from data.revenueDetails.AllCare.serviceLines (the
  // separate "AllCare" sheet tab, granular by service line). Each
  // group sums its members' 'Revenues' metric over the in-range months.
  const ALLCARE_PRODUCT_GROUPS = [
    { name: 'Primary Care + CCM',  members: ['Primary Care', 'CCM'],  color: '#16a34a' /* emerald-600 */ },
    { name: 'Podiatry + PCM',      members: ['Podiatry', 'PCM'],      color: '#0ea5e9' /* sky-500 */ },
    { name: 'Psych',               members: ['Psych'],                color: '#f59e0b' /* amber-500 */ },
    { name: 'Diagnostics',         members: ['Diagnostics'],          color: '#8b5cf6' /* violet-500 */ },
    { name: 'RPM',                 members: ['RPM'],                  color: '#ef4444' /* red-500 */ },
  ];
  const allCareProductMixPieData = (() => {
    const slArr = data.revenueDetails?.AllCare?.serviceLines || [];
    if (slArr.length === 0) return [];
    // Match the service line's name prefix against a group member. The
    // sheet labels service lines as e.g. "Primary Care (Visits)" or
    // "CCM (CM-Based SU)" — we strip the parenthetical suffix when
    // matching so future label tweaks (e.g. "Visit" vs "Visits") don't
    // silently drop revenue from the chart.
    const stripSuffix = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim();
    return ALLCARE_PRODUCT_GROUPS.map(group => {
      let total = 0;
      for (const sl of slArr) {
        const slName = stripSuffix(sl.name);
        if (group.members.includes(slName)) {
          total += (sl.metrics?.['Revenues'] ?? []).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
        }
      }
      return { name: group.name, value: total, color: group.color };
    }).filter(g => g.value > 0);
  })();

  // AllCare per-service-line Gross Profit aggregator. Reuses the same
  // ALLCARE_PRODUCT_GROUPS grouping as the pie chart so all AllCare
  // service-line views stay consistent (Primary Care + CCM merged,
  // Podiatry + PCM merged, etc.). Factored to accept a predicate so the
  // same reducer powers both the range-total table AND the per-month
  // drilldown drawer below.
  //
  // CFO direction: combine revenues and costs of the member service lines
  // first, THEN compute the margin on the combined totals. This is
  // mathematically equivalent to weighted-average margin and matches the
  // sheet's own "Total" row exactly.
  //
  // Why we derive GP = sum_rev − sum_cos instead of summing each line's
  // explicit GP cell: the sheet labels GP inconsistently — visit-based
  // service lines (Primary Care, Podiatry, Psych, Diagnostics) use
  // "Gross Profit", while CM-based lines (CCM, PCM) use "Gross Margin"
  // for the same concept. Summing only "Gross Profit" cells would drop
  // CCM/PCM contributions and produce an artificially low GM% (the
  // 51% vs canonical 58% bug). Subtracting summed costs from summed
  // revenue sidesteps the label inconsistency entirely.
  const computeAllCareGroupedGP = (predicate) => {
    const slArr = data.revenueDetails?.AllCare?.serviceLines || [];
    if (slArr.length === 0) return [];
    const stripSuffix = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim();
    const sumOver = (metrics, key) => (metrics?.[key] ?? []).filter(predicate).reduce((s, v) => s + (v.value ?? 0), 0);
    return ALLCARE_PRODUCT_GROUPS.map(group => {
      let rev = 0, cos = 0;
      for (const sl of slArr) {
        if (!group.members.includes(stripSuffix(sl.name))) continue;
        rev += sumOver(sl.metrics, 'Revenues');
        cos += sumOver(sl.metrics, 'Cost of Sales');
      }
      const gp = rev - cos;
      const gm = rev > 0 ? (gp / rev * 100) : 0;
      return { name: group.name, color: group.color, rev, cos, gp, gm };
    }).filter(g => g.rev > 0);
  };

  // AllRx per-segment Gross Profit aggregator. Sibling of
  // computeAllCareGroupedGP, but flatter — AllRx segments are individual
  // customer segments (CLHF, ALF, IL, MEM, etc.) with no grouping rule.
  // Each segment in data.revenueDetails.AllRx.segments has its OWN
  // Revenues, Cost of Sales, Gross Profit, Gross Margin % metrics — we
  // derive GP from rev−cos to match the same formula AllCare uses (and
  // sidestep any inconsistent labeling between segments).
  //
  // Shared by AllRx and AllRx External drilldowns: the segment-level tab
  // is the single granular source for both views. External's P&L roll-up
  // differs (it's a separate tab with its own adjustments), so the
  // drawer's Total may not reconcile perfectly to the External chart —
  // that's expected; segments show the operational view.
  const ALLRX_SEGMENT_COLORS = [
    '#0ea5e9', /* sky-500 */
    '#10b981', /* emerald-500 */
    '#f59e0b', /* amber-500 */
    '#8b5cf6', /* violet-500 */
    '#ef4444', /* red-500 */
    '#ec4899', /* pink-500 */
    '#14b8a6', /* teal-500 */
    '#84cc16', /* lime-500 */
    '#a855f7', /* purple-500 */
    '#f43f5e', /* rose-500 */
  ];
  const computeAllRxSegmentGP = (predicate) => {
    const segs = data.revenueDetails?.AllRx?.segments || [];
    if (segs.length === 0) return [];
    const sumOver = (metrics, key) => (metrics?.[key] ?? []).filter(predicate).reduce((s, v) => s + (v.value ?? 0), 0);
    return segs.map((seg, i) => {
      const rev = sumOver(seg.metrics, 'Revenues');
      const cos = sumOver(seg.metrics, 'Cost of Sales');
      const gp = rev - cos;
      const gm = rev > 0 ? (gp / rev * 100) : 0;
      return {
        name: seg.name,
        color: ALLRX_SEGMENT_COLORS[i % ALLRX_SEGMENT_COLORS.length],
        rev, cos, gp, gm,
      };
    }).filter(s => s.rev > 0);
  };

  // Decide which pie to show. When the user is drilled into AllCare,
  // showing "AllCare = 100%" of a portfolio-by-company pie tells them
  // nothing — replace with the product-mix breakdown. For Consolidated
  // and other companies, keep the by-company pie.
  const showAllCareProductMixPie = selectedCompany === 'AllCare' && allCareProductMixPieData.length > 0;
  const revenuePieData = showAllCareProductMixPie
    ? allCareProductMixPieData
    : data.pnl
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
    const gp = (c.metrics[getGPMetric(c.name)] ?? []).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0);
    // Per-company expenses for the range, INCLUDING the allocated
    // 'Studio Expense' overhead share (getCompanyAttributableExpenses).
    // This is the "true cost of running this business" view Andrew wants
    // in the per-row table. The totals row separately uses ALL Holdings'
    // Total Expenses (pre-aggregated, avoids the intercompany
    // double-count), so sum-of-rows may not equal totals.
    const expenses = Math.abs(getCompanyAttributableExpenses(c).filter(inRange).reduce((s, v) => s + (v.value ?? 0), 0));
    const grossMargin = revCurrent > 0 ? gp / revCurrent : null;
    const companyRevGrowth = revPrior > 0 ? (revCurrent - revPrior) / revPrior : null;
    return { name: c.name, rev: revCurrent, ebitda, grossProfit: gp, expenses, grossMargin, revGrowth: companyRevGrowth, color: colorMap[c.name] };
  });

  // Totals row (excl holdings) — uses range-filtered data to match individual rows
  const totalRowRev = companyRows.filter(c => !dynExcludeRevenue.includes(c.name)).reduce((s, c) => s + c.rev, 0);
  const totalRowEbitda = companyRows.reduce((s, c) => s + c.ebitda, 0);
  const totalRowGP = companyRows.filter(c => !dynExcludeRevenue.includes(c.name)).reduce((s, c) => {
    const gp = (data.pnl.find(p => p.name === c.name)?.metrics[getGPMetric(c.name)] ?? [])
      .filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0);
    return s + gp;
  }, 0);
  const totalRowGrossMargin = totalRowRev > 0 ? totalRowGP / totalRowRev : null;

  // Gross margin percentage by month — computed from Revenue & Gross Profit
  // For Osta, swap in "Gross Profit 2" (after marketing exp) so the chart reflects
  // the after-marketing margin that's relevant for marketplace economics.
  // NOTE: We can't use buildMonthlySeries(data.pnl, 'Gross Profit 2', ...) because
  // that helper uses the first company's metric as the timeline source — and only
  // Osta has 'Gross Profit 2', so it would return an empty array. We build Osta's
  // GP2 lookups directly from its metric array.
  const rawGpByMonth = buildMonthlySeries(data.pnl, 'Gross Profit', dynExcludeRevenue, null);
  const ostaCompanyForGP = data.pnl.find(c => c.name === 'Osta');
  const ostaGP2Values = ostaCompanyForGP?.metrics['Gross Profit 2'] ?? [];
  const MONTHS_SHORT = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Monthly lookup: { 'Mar 26' -> -3000 }
  const ostaGP2ByMonthLabel = {};
  for (const mv of ostaGP2Values) {
    if (mv.value == null) continue;
    const label = `${MONTHS_SHORT[mv.month]} ${String(mv.year).slice(-2)}`;
    ostaGP2ByMonthLabel[label] = mv.value;
  }
  // Yearly lookup: { '2026' -> sum(...) }
  const ostaGP2ByYearLabel = {};
  for (const mv of ostaGP2Values) {
    if (mv.value == null) continue;
    const label = String(mv.year);
    ostaGP2ByYearLabel[label] = (ostaGP2ByYearLabel[label] ?? 0) + mv.value;
  }
  // Quarterly lookup: { 'Q1 26' -> sum(...) }
  const ostaGP2ByQuarterLabel = {};
  for (const mv of ostaGP2Values) {
    if (mv.value == null) continue;
    const q = Math.ceil(mv.month / 3);
    const label = `Q${q} ${String(mv.year).slice(-2)}`;
    ostaGP2ByQuarterLabel[label] = (ostaGP2ByQuarterLabel[label] ?? 0) + mv.value;
  }
  const patchOstaInRows = (rows, lookup) => rows.map(row => {
    const v = lookup[row.month];
    return v != null ? { ...row, Osta: v } : row;
  });
  const patchedGpByMonth = patchOstaInRows(rawGpByMonth, ostaGP2ByMonthLabel);
  const gpByMonth = viewMode === 'yearly'
    ? patchOstaInRows(
        buildYearlySeries(data.pnl, 'Gross Profit', dynExcludeRevenue, yearFrom, yearTo),
        ostaGP2ByYearLabel
      )
    : viewMode === 'quarterly'
    ? patchOstaInRows(
        buildQuarterlySeries(data.pnl, 'Gross Profit', dynExcludeRevenue, rangeFrom, rangeTo),
        ostaGP2ByQuarterLabel
      )
    : filterSeriesToRange(patchedGpByMonth, rangeFrom, rangeTo, availableMonths);
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

  // Comparative insights: rank-ordered MoM & QoQ change records.
  // generateInsights() now derives its own periods (last-actual month and
  // surrounding quarter), so it ignores rangeFrom/rangeTo. The CFO wants
  // a fixed comparison baseline ("what changed since last close"), not
  // something dependent on whatever date filter the user has selected.
  const insightsResult = generateInsights(data, selectedCompany);

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
        showConsolidated={canSeeConsolidated()}
        colorMap={colorMap}
        lastActualLabel={`Actuals till ${prevMonthLabel} ${prevMonthYear}`}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        canSeeTab={canSeeTab}
        canBreakdown={canBreakdown}
        userName={user?.name}
        userRole={user?.role}
        irrView={irrView}
        setIrrView={setIrrView}
        showIrrSubNav={!!perms.lpName}
      />

      {/* Main content area — offset by sidebar width */}
      <div className="md:ml-64">
      {/* Header */}
      {/* Sticky header — stays pinned at top as the user scrolls any tab.
          `sticky top-0` keeps it in document flow (no overlap-and-pad hack),
          `bg-white` is essential so scrolling content reads UNDER it cleanly,
          `z-30` layers it above Card components and chart shadows. Drawers
          use a higher z-index so modal overlays still cover the header. */}
      <header className="sticky top-0 z-30 border-b border-border bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeSection === 'irr' ? (
              // IRR & Valuation: yearly-only view with a single year selector
              // + optional compare-to-year. Different semantics from the other
              // tabs (point-in-time per year, not a range).
              <>
                <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Year</span>
                  <select
                    value={irrYear ?? ''}
                    onChange={e => setIrrYear(Number(e.target.value))}
                    className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    {irrYearsAvailable.map(y => (<option key={y} value={y}>{y}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2 py-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={irrCompareEnabled}
                      onChange={e => {
                        setIrrCompareEnabled(e.target.checked);
                        // Default comparison year on enable: the year right
                        // before the currently-selected one.
                        if (e.target.checked && irrYear != null) {
                          const idx = irrYearsAvailable.indexOf(irrYear);
                          if (idx > 0) setIrrCompYear(irrYearsAvailable[idx - 1]);
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">Compare</span>
                  </label>
                  {irrCompareEnabled && (
                    <select
                      value={irrCompYear ?? ''}
                      onChange={e => setIrrCompYear(Number(e.target.value))}
                      className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      {irrYearsAvailable
                        .filter(y => y !== irrYear /* can't compare a year to itself */)
                        .map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                  )}
                </div>
              </>
            ) : (
              <>
            {/* Monthly / Quarterly / Yearly toggle */}
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => { setViewMode('monthly'); setExpenseDrilldown(null); if (compareEnabled) { setCompareFromKey(`${rangeFrom.year - 1}-${rangeFrom.month}`); setCompareToKey(`${rangeTo.year - 1}-${rangeTo.month}`); } }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => {
                  setViewMode('quarterly');
                  setExpenseDrilldown(null);
                  // Snap range to quarter boundaries: rangeFromKey moves to
                  // start of its containing quarter; rangeToKey to end of its
                  // containing quarter. Mirrors the yearly button's Jan/Dec
                  // snap so the picker dropdowns show the matching values.
                  const [fY, fM] = rangeFromKey.split('-').map(Number);
                  const [tY, tM] = rangeToKey.split('-').map(Number);
                  const fQ = Math.ceil(fM / 3);
                  const tQ = Math.ceil(tM / 3);
                  setRangeFromKey(`${fY}-${(fQ - 1) * 3 + 1}`);
                  setRangeToKey(`${tY}-${tQ * 3}`);
                  if (compareEnabled) {
                    setCompareFromKey(`${fY - 1}-${(fQ - 1) * 3 + 1}`);
                    setCompareToKey(`${tY - 1}-${tQ * 3}`);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'quarterly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Quarterly
              </button>
              <button
                onClick={() => { setViewMode('yearly'); setExpenseDrilldown(null); if (compareEnabled) { setCompareFromKey(`${yearFrom - 1}-1`); setCompareToKey(`${yearTo - 1}-12`); } }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'yearly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly
              </button>
            </div>

            {/* Date range selectors — three variants per viewMode:
                  monthly:   month dropdowns (Jan 25 → Dec 28)
                  quarterly: quarter dropdowns (Q1 25 → Q4 28)
                  yearly:    year dropdowns (2025 → 2028)
                Underlying state stays month-granularity (rangeFromKey is
                always "YYYY-M") — only the picker UI varies. Quarterly
                picker translates a quarter selection back into the
                first-or-last month of that quarter for storage. */}
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
              ) : viewMode === 'quarterly' ? (
                (() => {
                  // Derive currently-displayed quarter from the month-keyed state.
                  const [fY, fM] = rangeFromKey.split('-').map(Number);
                  const [tY, tM] = rangeToKey.split('-').map(Number);
                  const curFromQuarterKey = `${fY}-Q${Math.ceil(fM / 3)}`;
                  const curToQuarterKey   = `${tY}-Q${Math.ceil(tM / 3)}`;
                  return (
                    <>
                      <select value={curFromQuarterKey}
                        onChange={e => {
                          // "from" picker: snap to FIRST month of selected quarter
                          const q = availableQuarters.find(x => x.key === e.target.value);
                          if (q) { setRangeFromKey(`${q.year}-${q.fromMonth}`); setExpenseDrilldown(null); }
                        }}
                        className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                        {availableQuarters.map(q => (<option key={q.key} value={q.key}>{q.label}</option>))}
                      </select>
                      <span className="text-[10px] text-muted-foreground font-medium">to</span>
                      <select value={curToQuarterKey}
                        onChange={e => {
                          // "to" picker: snap to LAST month of selected quarter
                          const q = availableQuarters.find(x => x.key === e.target.value);
                          if (q) { setRangeToKey(`${q.year}-${q.toMonth}`); setExpenseDrilldown(null); }
                        }}
                        className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                        {availableQuarters.map(q => (<option key={q.key} value={q.key}>{q.label}</option>))}
                      </select>
                    </>
                  );
                })()
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
                ) : viewMode === 'quarterly' ? (
                  (() => {
                    // Mirror the main quarterly picker for the comp range.
                    const fromQ = compareFromKey ? (() => { const [y, m] = compareFromKey.split('-').map(Number); return `${y}-Q${Math.ceil(m / 3)}`; })() : '';
                    const toQ   = compareToKey   ? (() => { const [y, m] = compareToKey.split('-').map(Number);   return `${y}-Q${Math.ceil(m / 3)}`; })() : '';
                    return (
                      <>
                        <select value={fromQ}
                          onChange={e => { const q = availableQuarters.find(x => x.key === e.target.value); if (q) setCompareFromKey(`${q.year}-${q.fromMonth}`); }}
                          className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                          {availableQuarters.map(q => (<option key={q.key} value={q.key}>{q.label}</option>))}
                        </select>
                        <span className="text-[10px] text-muted-foreground font-medium">to</span>
                        <select value={toQ}
                          onChange={e => { const q = availableQuarters.find(x => x.key === e.target.value); if (q) setCompareToKey(`${q.year}-${q.toMonth}`); }}
                          className="h-7 rounded-md bg-white border border-border/60 px-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                          {availableQuarters.map(q => (<option key={q.key} value={q.key}>{q.label}</option>))}
                        </select>
                      </>
                    );
                  })()
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
              </>
            )}
          </div>

          {/* Last Updated — kept in all header variants */}
          <div className="text-right pl-2 border-l border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Updated</p>
            <p className="text-xs font-semibold text-foreground">{lastUpdated}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">

          {/* ────── OVERVIEW ────── */}
          {activeSection === 'overview' && (<>
            {/* About panel — appears only when drilled into a specific
                company. Collapsed by default; click to expand the full
                business-model description. Edit content in
                lib/companyProfiles.js. */}
            {selectedCompany && (
              <CompanyAboutPanel companyName={selectedCompany} accentColor={colorMap[selectedCompany]} />
            )}
            {/* KPI strip — ordered left-to-right to narrate the P&L:
                Revenue → Gross Profit → Expenses → EBITDA → Operational Cash Flow.
                Each card pairs $ value (primary) with a context line below
                (margin %, % of revenue, runway months — whatever's most
                informative for that metric). */}
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title={`Revenue — ${rangeLabel}`} value={fmt(rangeRevenue)} subtitle="excl. holdings"
                comparison={compareEnabled && <ComparisonBadge current={rangeRevenue} compValue={rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue)} compLabel={compLabel} />} />

              {/* Gross Profit + Gross Margin — folded into one card.
                  Mirrors the Company Performance table treatment:
                  $ value primary, % derivation as subtitle.
                  NOTE: rangeGrossMargin is a *fraction* (e.g. 0.7276); the
                  pct() helper would multiply, but we want "X.X% margin" with
                  custom formatting, so we * 100 explicitly here. */}
              <KPICard title={`Gross Profit — ${rangeLabel}`} value={fmt(rangeGrossProfit)}
                subtitle={rangeGrossMargin !== null && rangeRevenue > 0 ? `${(rangeGrossMargin * 100).toFixed(1)}% margin` : ''}
                comparison={compareEnabled && (() => {
                  const compGP = consolidatedGPRange(compRange.from, compRange.to, dynExcludeRevenue);
                  return <ComparisonBadge current={rangeGrossProfit} compValue={compGP} compLabel={compLabel} />;
                })()} />

              {/* Expenses: total opex for the range, shown as a positive
                  magnitude (rangeExpenses is stored negative on the P&L).
                  Subtitle = cost intensity as % of revenue. invertColor on
                  the comparison badge so "up vs prior" renders red.
                  Compare value uses expensesInRange() — same source as
                  rangeExpenses — so the periods are symmetrically sourced
                  (rangeTotal would return 0 for the consolidated case
                  because ALL Holdings is excluded from its scan). */}
              <KPICard title={`Expenses — ${rangeLabel}`} value={fmt(Math.abs(rangeExpenses))}
                subtitle={rangeRevenue > 0 ? `${(Math.abs(rangeExpenses) / rangeRevenue * 100).toFixed(0)}% of revenue` : ''}
                comparison={compareEnabled && <ComparisonBadge
                  current={Math.abs(rangeExpenses)}
                  compValue={Math.abs(expensesInRange(compRange.from, compRange.to))}
                  compLabel={compLabel}
                  invertColor
                />} />

              <KPICard title={`EBITDA — ${rangeLabel}`} value={fmt(rangeEbitda)} subtitle={rangeRevenue > 0 ? (rangeEbitda / rangeRevenue * 100).toFixed(0) + '% margin' : ''}
                comparison={compareEnabled && <ComparisonBadge current={rangeEbitda} compValue={rangeTotal(data.pnl, 'EBITDA', compRange.from, compRange.to, dynExcludeEbitda)} compLabel={compLabel} />} />

              <KPICard title="Operational Cash Flow" value={fmt(totalOpsCF)} trend={runwayMonths !== null ? '~' + runwayMonths.toFixed(1) + ' months' : (totalOpsCF >= 0 ? 'Cash positive' : 'Cash negative')} trendUp={totalOpsCF >= 0} subtitle="at current burn rate"
                comparison={compareEnabled && <ComparisonBadge current={totalOpsCF} compValue={(() => { const cfKey = selectedCompany ? 'Operational Cash Flow' : 'Holdings net cash movement'; for (const co of (data.cashflow||[])) { const m = co.metrics?.[cfKey]; if (m) { return m.filter(v => { const vi = v.year*100+v.month; return vi >= compRange.from.year*100+compRange.from.month && vi <= compRange.to.year*100+compRange.to.month; }).reduce((s,v) => s+(v.value??0), 0); } } return 0; })()} compLabel={compLabel} />} />
            </div>

            {/* Compare mode: side-by-side bar charts per period (works for
                both single-month and multi-month — aggregates the comparison
                period's $ per company). Andrew prefers the bar form over the
                horizontal scorecard or the stacked-monthly-trend chart.
                When compare is OFF and the range is multi-month, we keep
                the monthly trend chart below (still useful for showing the
                shape of revenue over time). */}
            {compareEnabled ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                <ComparisonBarChart
                  title={`Revenue Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={revenueCompanies}
                  currentData={revenueCompanies.map(name => ({
                    name,
                    value: revenueByMonthWithTotal.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  currentLabel={rangeLabel}
                  compData={revenueCompanies.map(name => ({
                    name,
                    value: compRevenueByMonth.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  compLabel={compLabel}
                  colorMap={colorMap}
                  compIsOlder={compIsOlder}
                />
                <ComparisonBarChart
                  title={`EBITDA Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={allCompanyNames}
                  currentData={allCompanyNames.map(name => ({
                    name,
                    value: ebitdaByMonthWithTotal.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  currentLabel={rangeLabel}
                  compData={allCompanyNames.map(name => ({
                    name,
                    value: compEbitdaByMonth.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  compLabel={compLabel}
                  colorMap={colorMap}
                  compIsOlder={compIsOlder}
                />
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} Revenue Trend ({rangeLabel}) &mdash; excl. Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    {revenueByMonthWithTotal.length < 3 ? (
                      <ComposedChart data={revenueByMonthWithTotal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                    {forecastOverlay(revenueByMonthWithTotal)}
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
                    {forecastOverlay(revenueByMonthWithTotal)}
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
                  <CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} EBITDA by Company ({rangeLabel})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    {ebitdaByMonthWithTotal.length < 3 ? (
                      <ComposedChart data={ebitdaByMonthWithTotal}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                    {forecastOverlay(ebitdaByMonthWithTotal)}
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
                    {forecastOverlay(ebitdaByMonthWithTotal)}
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

            {/* Company Performance Table — transposed CFO-style summary.
                Rows = line items (Revenue → GP → Expenses → EBITDA →
                Operating CF). Columns = periods (month/quarter/year based
                on viewMode) + Total. Same idiom as the Indirect CF
                Build-up table; sub-metric (margin/ratio) appears as a 9px
                muted line below each $ value. */}
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-1">Company Performance Summary</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} build-up across active portfolio companies &mdash; {rangeLabel}
              </p>
            </div>
            <Card className="mb-5 overflow-hidden">
              <CardContent className="overflow-auto px-0">
                {(() => {
                  // Period buckets matching the current viewMode. Same
                  // logic as the Indirect CF builder: yearly → one entry
                  // per year; quarterly → one per (year, quarter);
                  // monthly → one per (year, month).
                  const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const monthLabel = (y, m) => `${ML[m]} '${String(y).slice(-2)}`;
                  const periods = (() => {
                    const result = [];
                    if (viewMode === 'yearly') {
                      for (let y = rangeFrom.year; y <= rangeTo.year; y++) result.push({ year: y, label: String(y), key: `y-${y}` });
                    } else if (viewMode === 'quarterly') {
                      const startQ = Math.ceil(rangeFrom.month / 3);
                      const endQ = Math.ceil(rangeTo.month / 3);
                      const startYQ = rangeFrom.year * 4 + startQ;
                      const endYQ = rangeTo.year * 4 + endQ;
                      for (let yq = startYQ; yq <= endYQ; yq++) {
                        const y = Math.floor((yq - 1) / 4);
                        const q = ((yq - 1) % 4) + 1;
                        result.push({ year: y, quarter: q, label: `Q${q} '${String(y).slice(-2)}`, key: `q-${y}-${q}` });
                      }
                    } else {
                      const start = rangeFrom.year * 12 + rangeFrom.month;
                      const end = rangeTo.year * 12 + rangeTo.month;
                      for (let mi = start; mi <= end; mi++) {
                        const y = Math.floor((mi - 1) / 12);
                        const m = ((mi - 1) % 12) + 1;
                        result.push({ year: y, month: m, label: monthLabel(y, m), key: `m-${y}-${m}` });
                      }
                    }
                    return result;
                  })();

                  // Predicate: is a monthly value within the given period bucket?
                  const inPeriod = (v, p) => {
                    if (viewMode === 'yearly') return v.year === p.year;
                    if (viewMode === 'quarterly') return v.year === p.year && Math.ceil(v.month / 3) === p.quarter;
                    return v.year === p.year && v.month === p.month;
                  };

                  // Aggregators — sum a metric across all relevant companies
                  // for a given period. Routes Studio to its Direct OpCF (the
                  // same convention used elsewhere; the consolidated OpCF
                  // double-counts portco roll-ups).
                  const opCFKey = (name) => name === 'InVitro Studio' ? 'Direct Operational Cash Flow' : 'Operational Cash Flow';
                  const sumPnlInPeriod = (metricKey, p, excludes) => data.pnl
                    .filter(c => !excludes.includes(c.name))
                    .reduce((s, c) => s + ((c.metrics?.[metricKey] ?? [])
                      .filter(v => inPeriod(v, p))
                      .reduce((a, v) => a + (v.value ?? 0), 0)), 0);
                  const sumGPInPeriod = (p, excludes) => data.pnl
                    .filter(c => !excludes.includes(c.name))
                    .reduce((s, c) => s + ((c.metrics?.[getGPMetric(c.name)] ?? [])
                      .filter(v => inPeriod(v, p))
                      .reduce((a, v) => a + (v.value ?? 0), 0)), 0);
                  // Per-company expense routing for the Overview build-up:
                  //   InVitro Studio → 'Fixed Expenses' + 'Direct Expenses'
                  //     (rows 41 + 42 of the P&L tab — Studio doesn't publish
                  //     a single Total Expenses or SG&A+R&D roll-up line).
                  //   Other portco (per-company view): 'SG&A + R&D Expenses' +
                  //     'Studio Expense' — fully-loaded cost including the
                  //     Studio cross-charge allocated to this portco.
                  //   Other portco (Consolidated view): 'SG&A + R&D Expenses'
                  //     ONLY — Studio's own Fixed+Direct row already captures
                  //     the total Studio cost, and adding allocations here
                  //     would double-count by accounting identity
                  //     (Σ portco.studio_expense ≡ Studio.fixed+direct).
                  const expMetricsFor = (name) => {
                    if (name === 'InVitro Studio') return ['Fixed Expenses', 'Direct Expenses'];
                    if (selectedCompany) return ['SG&A + R&D Expenses', 'Studio Expense'];
                    return ['SG&A + R&D Expenses'];
                  };
                  const sumExpInPeriod = (p, excludes) => Math.abs(data.pnl
                    .filter(c => !excludes.includes(c.name))
                    .reduce((s, c) => {
                      const keys = expMetricsFor(c.name);
                      return s + keys.reduce((ks, key) => ks + ((c.metrics?.[key] ?? [])
                        .filter(v => inPeriod(v, p))
                        .reduce((a, v) => a + (v.value ?? 0), 0)), 0);
                    }, 0));
                  const sumOpCFInPeriod = (p) => {
                    const targets = selectedCompany
                      ? [selectedCompany]
                      : DISPLAY_COMPANIES.filter(n => !EXCLUDE_ALWAYS.includes(n));
                    return targets.reduce((s, name) => {
                      const co = data.cashflow?.find(c => c.name === name);
                      if (!co) return s;
                      const arr = co.metrics?.[opCFKey(name)] ?? [];
                      return s + arr.filter(v => inPeriod(v, p)).reduce((a, v) => a + (v.value ?? 0), 0);
                    }, 0);
                  };

                  // Build per-period totals for each line item, plus the
                  // grand Total column (sum across all periods in range).
                  const perPeriod = periods.map(p => {
                    const rev = sumPnlInPeriod('Revenues', p, dynExcludeRevenue);
                    const gp = sumGPInPeriod(p, dynExcludeRevenue);
                    const exp = sumExpInPeriod(p, dynExcludeEbitda);
                    const ebitda = sumPnlInPeriod('EBITDA', p, dynExcludeEbitda);
                    const opCF = sumOpCFInPeriod(p);
                    return { ...p, rev, gp, exp, ebitda, opCF };
                  });
                  const totals = perPeriod.reduce(
                    (acc, p) => ({ rev: acc.rev + p.rev, gp: acc.gp + p.gp, exp: acc.exp + p.exp, ebitda: acc.ebitda + p.ebitda, opCF: acc.opCF + p.opCF }),
                    { rev: 0, gp: 0, exp: 0, ebitda: 0, opCF: 0 }
                  );

                  // Sub-metric formatters: returns null when undefined (e.g.
                  // GM% when revenue is zero); rendering will fall back to —.
                  const pct = (num, denom) => denom > 0 ? (num / denom * 100) : null;
                  const fmtPct = (v) => v == null ? '—' : `${v.toFixed(1)}%`;
                  // Line item config: key, label, color rule, sub-metric extractor.
                  const LINE_ITEMS = [
                    { key: 'rev',    label: 'Revenue',                bold: false, color: () => 'text-foreground', sub: null },
                    { key: 'gp',     label: 'Gross Profit',           bold: false, color: (v) => v >= 0 ? 'text-emerald-600' : 'text-red-500',
                      sub: (row) => ({ label: 'margin', value: fmtPct(pct(row.gp, row.rev)) }) },
                    { key: 'exp',    label: selectedCompany === 'InVitro Studio'
                                          ? 'Expenses (Fixed + Direct)'
                                          : selectedCompany
                                            ? 'Expenses (SG&A + R&D + Studio)'
                                            : 'Expenses (SG&A + R&D)',
                                     bold: false, color: () => 'text-foreground',
                      sub: (row) => ({ label: '% of rev', value: fmtPct(pct(row.exp, row.rev)) }) },
                    { key: 'ebitda', label: 'EBITDA',                 bold: true,  color: (v) => v >= 0 ? 'text-emerald-600' : 'text-red-500',
                      sub: (row) => ({ label: 'margin', value: fmtPct(pct(row.ebitda, row.rev)) }) },
                    { key: 'opCF',   label: 'Operating Cash Flow',    bold: true,  color: (v) => v >= 0 ? 'text-emerald-600' : 'text-red-500', sub: null },
                  ];

                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-card z-10">Line Item</TableHead>
                          {periods.map(p => (
                            <TableHead key={p.key} className="text-right whitespace-nowrap">{p.label}</TableHead>
                          ))}
                          <TableHead className="text-right font-bold whitespace-nowrap">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {LINE_ITEMS.map(item => {
                          const totalVal = totals[item.key];
                          const totalSub = item.sub ? item.sub(totals) : null;
                          return (
                            <TableRow key={item.key} className={item.bold ? 'bg-muted/30' : ''}>
                              <TableCell className={`sticky left-0 bg-card z-10 ${item.bold ? 'font-bold' : 'font-medium'}`}>
                                {item.label}
                              </TableCell>
                              {perPeriod.map(row => {
                                const val = row[item.key];
                                const sub = item.sub ? item.sub(row) : null;
                                return (
                                  <TableCell key={row.key} className={`text-right tabular-nums whitespace-nowrap ${item.bold ? 'font-bold' : ''}`}>
                                    <div className={item.color(val)}>{fmt(val)}</div>
                                    {sub && (
                                      <div className="text-[9px] text-muted-foreground font-normal mt-0.5">{sub.value} {sub.label}</div>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className={`text-right tabular-nums whitespace-nowrap font-bold border-l border-border/60`}>
                                <div className={item.color(totalVal)}>{fmt(totalVal)}</div>
                                {totalSub && (
                                  <div className="text-[9px] text-muted-foreground font-normal mt-0.5">{totalSub.value} {totalSub.label}</div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
              </CardContent>
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
                // KPI badges — each metric (RX/SUs, ARPU, ARR) gets its own
                // pill so the eye can pick them up independently. Separator
                // "|" removed; whitespace + rounded backgrounds carry the
                // visual separation now.
                const badgePill = (color, label, value) => (
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    color === 'blue' && "bg-blue-50 text-blue-700 border border-blue-200/70",
                    color === 'emerald' && "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
                    color === 'neutral' && "bg-muted text-foreground/70 border border-border",
                  )}>
                    <span className="opacity-70">{label}</span>
                    <span className="font-semibold tabular-nums">{value}</span>
                  </span>
                );
                if (rd && name === 'AllRx' && rd.AllRx?.segments) {
                  const totalRx = rd.AllRx.segments.reduce((s, seg) => s + (seg.metrics['RX Count'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const totalSegRev = rd.AllRx.segments.reduce((s, seg) => s + (seg.metrics['Total Revenues'] ?? seg.metrics['Revenues'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const arpu = totalRx > 0 ? totalSegRev / totalRx : 0;
                  kpiBadge = <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {badgePill('blue', 'RX', totalRx.toLocaleString())}
                    {badgePill('blue', 'ARPU', `$${arpu.toFixed(2)}`)}
                    {arr > 0 && badgePill('blue', 'ARR', fmt(arr))}
                  </div>;
                } else if (rd && name === 'AllCare' && rd.AllCare?.serviceLines) {
                  // ─── AllCare gets three separate white KPI cards instead of
                  // one card with pill badges. Lets the eye lock onto Revenue,
                  // SUs, and ARR independently — CFO-preferred layout for the
                  // dashboard's largest portco. ───
                  const totalSUs = rd.AllCare.serviceLines.reduce((s, sl) => s + (sl.metrics['SUs'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const totalSlRev = rd.AllCare.serviceLines.reduce((s, sl) => s + (sl.metrics['Revenues'] ?? []).filter(inRange).reduce((a, v) => a + (v.value ?? 0), 0), 0);
                  const arpu = totalSUs > 0 ? totalSlRev / totalSUs : 0;
                  const pctOfTotal = rangeRevenue > 0 ? `${(coRev / rangeRevenue * 100).toFixed(0)}% of total` : '';
                  const revSubtitle = [pctOfTotal, `Avg ARPU $${arpu.toFixed(2)}`].filter(Boolean).join(' · ');
                  return (
                    <Fragment key={name}>
                      <KPICard
                        title={`AllCare Revenue — ${rangeLabel}`}
                        value={fmt(coRev)}
                        subtitle={revSubtitle}
                        comparison={compareEnabled && <ComparisonBadge
                          current={coRev}
                          compValue={(data.pnl.find(c => c.name === name)?.metrics['Revenues'] ?? []).filter(v => { const vi = v.year * 100 + v.month; return vi >= compRange.from.year * 100 + compRange.from.month && vi <= compRange.to.year * 100 + compRange.to.month; }).reduce((s, v) => s + (v.value ?? 0), 0)}
                          compLabel={compLabel} />}
                      />
                      <KPICard
                        title={`AllCare SUs — ${rangeLabel}`}
                        value={totalSUs.toLocaleString()}
                        subtitle="Service Units"
                      />
                      <KPICard
                        title={`AllCare ARR — ${rangeLabel}`}
                        value={fmt(arr)}
                        subtitle="Annualized"
                      />
                    </Fragment>
                  );
                } else if (arr > 0) {
                  // Other companies (Osta, Needles, InVitro Studio) — just show ARR
                  kpiBadge = <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {badgePill('neutral', 'ARR', fmt(arr))}
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

            {/* When Compare is on: side-by-side bar charts per period
                (aggregated $ per company per period). Otherwise: monthly
                stacked-bar trend chart (good for shape-over-time view). */}
            {compareEnabled ? (
              <div className="mb-5">
                <ComparisonBarChart
                  title={`Revenue Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={revenueCompanies}
                  currentData={revenueCompanies.map(name => ({
                    name,
                    value: revenueByMonthWithTotal.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  currentLabel={rangeLabel}
                  compData={revenueCompanies.map(name => ({
                    name,
                    value: compRevenueByMonth.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  compLabel={compLabel}
                  colorMap={colorMap}
                  compIsOlder={compIsOlder}
                />
              </div>
            ) : (
            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} Revenue by Company ({rangeLabel}){data.revenueDetails && selectedCompany && canBreakdown('revenueDrilldown', selectedCompany) ? ' — click a bar for breakdown' : ''}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={revenueByMonthWithTotal} onClick={(e) => {
                    // Drill-down requires: single-company view + revenue-details data + permission.
                    // All three must hold or the click is a no-op (and the title strips the
                    // "click for breakdown" affordance to match).
                    if (!selectedCompany) return;
                    if (!data.revenueDetails || !e?.activePayload?.[0]) return;
                    if (!canBreakdown('revenueDrilldown', selectedCompany)) return;
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
                    {forecastOverlay(revenueByMonthWithTotal)}
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
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {showAllCareProductMixPie ? 'AllCare Product Mix' : 'Revenue Mix'} {compareEnabled ? `— ${rangeLabel} vs ${compLabel}` : `(${rangeLabel})`}
                  {!showAllCareProductMixPie && <> &mdash; excl. Holdings</>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {compareEnabled ? (
                  // Two pies side-by-side: current vs comparison. Each pie
                  // labels by company % share of its own period total, so
                  // the comparison answers "did the mix shift?"
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center mb-1">{rangeLabel}</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={revenuePieData} cx="50%" cy="50%" outerRadius={70} innerRadius={38} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ stroke: '#cbd5e1', strokeWidth: 0.8 }}>
                            {revenuePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center mb-1">{compLabel}</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={showAllCareProductMixPie ? compAllCareProductMixPieData : compRevenuePieData} cx="50%" cy="50%" outerRadius={70} innerRadius={38} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ stroke: '#cbd5e1', strokeWidth: 0.8 }}>
                            {(showAllCareProductMixPie ? compAllCareProductMixPieData : compRevenuePieData).map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={revenuePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {revenuePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
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
                  // Prior-month math: only meaningful for monthly drills.
                  // Jan rolls back to Dec of the previous year (drillM === 1 case).
                  const drillM = revenueDrilldown.month;
                  const drillY = revenueDrilldown.year;
                  const priorMonth = drillM === 1 ? 12 : drillM - 1;
                  const priorYear = drillM === 1 ? drillY - 1 : drillY;
                  const priorMonthLabel = ML[priorMonth];
                  const inPriorMonth = (v) => v.year === priorYear && v.month === priorMonth;
                  const sumPriorMetric = (metrics, name) => (metrics?.[name] ?? []).filter(inPriorMonth).reduce((s, v) => s + (v.value ?? 0), 0);

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
                        <DrawerDescription>Revenue by sub-product</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-4 pb-6 overflow-auto space-y-6">
                        {sections.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No sub-product data available for this company/period.</p>
                        ) : sections.map(sec => {
                          // CFO direction: breakdown drawer shows ONLY revenue
                          // per sub-product (service line / segment), with two
                          // contextual badges under each value — MoM change
                          // vs the previous month, and contribution % of the
                          // section's total revenue.
                          let totalRev = 0;
                          let totalPriorRev = 0;
                          const rows = sec.items.map(item => {
                            const rev = sumMetric(item.metrics, sec.revKey) || sumMetric(item.metrics, 'Revenues');
                            const priorRev = !isYearDrill
                              ? (sumPriorMetric(item.metrics, sec.revKey) || sumPriorMetric(item.metrics, 'Revenues'))
                              : 0;
                            totalRev += rev;
                            totalPriorRev += priorRev;
                            return { name: item.name, rev, priorRev };
                          });

                          // Reusable badge block: MoM delta on top, contribution % below.
                          // Direction-of-good FLIPS for revenue vs the expense drawer:
                          // here ▲ up is emerald (revenue growth = good) and ▼ down is
                          // red. The expense drawer uses the opposite mapping.
                          const revCellBadges = (curr, prior, denom) => {
                            const pctChg = !isYearDrill && prior > 0 ? ((curr - prior) / prior * 100) : null;
                            const contribPct = denom > 0 ? (curr / denom * 100) : null;
                            if (pctChg === null && contribPct === null) return null;
                            return (
                              <div className="flex items-center justify-end gap-2 mt-0.5">
                                {pctChg !== null && (
                                  <span className={`text-[10px] font-medium ${pctChg > 0 ? 'text-emerald-600' : pctChg < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}% vs {priorMonthLabel}
                                  </span>
                                )}
                                {contribPct !== null && (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    {contribPct.toFixed(1)}% of total
                                  </span>
                                )}
                              </div>
                            );
                          };

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
                                    <TableHead className="text-right">Revenue</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map(r => (
                                    <TableRow key={r.name}>
                                      <TableCell className="font-medium">{r.name}</TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        <div>{fmt(r.rev)}</div>
                                        {revCellBadges(r.rev, r.priorRev, totalRev)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                                <TableFooter>
                                  <TableRow>
                                    <TableCell className="font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">
                                      <div>{fmt(totalRev)}</div>
                                      {/* Footer shows only MoM (contribution would be 100%). */}
                                      {!isYearDrill && totalPriorRev > 0 && (() => {
                                        const pctChg = ((totalRev - totalPriorRev) / totalPriorRev * 100);
                                        return (
                                          <div className={`text-[10px] font-medium mt-0.5 ${pctChg > 0 ? 'text-emerald-600' : pctChg < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                            {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}% vs {priorMonthLabel}
                                          </div>
                                        );
                                      })()}
                                    </TableCell>
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
                comparison={compareEnabled && (() => { const cRev = rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue); const cGP = consolidatedGPRange(compRange.from, compRange.to, dynExcludeRevenue); return <ComparisonBadge current={rangeGrossMargin} compValue={cRev > 0 ? cGP/cRev*100 : 0} compLabel={compLabel} />; })()} />
              {breakevenCompany ? (
                <KPICard title={`${breakevenCompany} Breakeven`} value={`FY ${currentYear}`} trend="Reached EBITDA breakeven" trendUp={true} />
              ) : !selectedCompany ? (
                // "Portfolio Companies" count is only meaningful for the
                // Consolidated view — when a single portco is drilled into,
                // "1 active operating entity" is a tautology that adds no
                // information, so we drop the card entirely in that case.
                <KPICard title="Portfolio Companies" value={String(revenueCompanies.length)} subtitle="active operating entities" />
              ) : null}
            </div>

            {/* When Compare is on: swap both charts (EBITDA & GP) to
                side-by-side ComparisonBarCharts — same pattern as Revenue
                and Expenses sections. The monthly trend chart + overlaid
                dashed comp line works fine for a single metric but gets
                noisy across two stacked profitability charts; twin bar
                panels let the eye scan current-vs-comp at matching axes. */}
            {compareEnabled ? (
              <div className="mb-5 space-y-4">
                {/* GP comparison rendered FIRST per CFO preference — gross
                    margin is the headline operational metric; EBITDA sits
                    below as the downstream profitability view. Hidden when
                    no companies have GP data (e.g. InVitro Studio drilled
                    in — a holding entity with no Gross Profit line). */}
                {gmCompanies.length > 0 && (
                  <ComparisonBarChart
                    title={`Gross Profit Comparison — ${rangeLabel} vs ${compLabel}`}
                    companies={gmCompanies}
                    currentData={gmCompanies.map(name => ({
                      name,
                      value: gpByMonth.reduce((s, p) => s + (p[name] ?? 0), 0),
                    }))}
                    currentLabel={rangeLabel}
                    compData={gmCompanies.map(name => {
                      // Comp range: read each company's routed GP metric
                      // (Osta → 'Gross Profit 2', others → 'Gross Profit')
                      // directly from data.pnl since there's no pre-built
                      // compGpByMonth in scope.
                      const metric = data.pnl.find(c => c.name === name)?.metrics[getGPMetric(name)] ?? [];
                      const fromVal = compRange.from.year * 100 + compRange.from.month;
                      const toVal = compRange.to.year * 100 + compRange.to.month;
                      const total = metric
                        .filter(v => { const vi = v.year * 100 + v.month; return vi >= fromVal && vi <= toVal; })
                        .reduce((s, v) => s + (v.value ?? 0), 0);
                      return { name, value: total };
                    })}
                    compLabel={compLabel}
                    colorMap={colorMap}
                    compIsOlder={compIsOlder}
                  />
                )}
                <ComparisonBarChart
                  title={`EBITDA Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={allCompanyNames}
                  currentData={allCompanyNames.map(name => ({
                    name,
                    value: ebitdaByMonthWithTotal.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  currentLabel={rangeLabel}
                  compData={allCompanyNames.map(name => ({
                    name,
                    value: compEbitdaByMonth.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  compLabel={compLabel}
                  colorMap={colorMap}
                  compIsOlder={compIsOlder}
                />
              </div>
            ) : (<>
            {/* GP & Margin rendered FIRST per CFO preference — gross
                margin is the headline operational metric; EBITDA sits
                below as the downstream profitability view. The `mb-5`
                margin lives on whichever card is on top so the gap
                between the two stays consistent across the swap.
                Hidden entirely when no companies have GP data (e.g.
                InVitro Studio drilled in — holding entity with no
                Gross Profit line in its P&L). */}
            {gmCompanies.length > 0 && (
            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">Gross Profit & Margin ({rangeLabel}){(selectedCompany === 'AllCare' || selectedCompany === 'AllRx' || selectedCompany === 'AllRx External') && viewMode === 'monthly' && canBreakdown('gpDrilldown', selectedCompany) ? ' — click a bar for breakdown' : ''}</CardTitle></CardHeader>
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
                  // Drill-down click: enabled when ALL THREE pass:
                  //   1. Data exists for the selected company (AllCare
                  //      service lines OR AllRx segments — AllRx External
                  //      shares the AllRx segment tab).
                  //   2. We're in monthly view (yearly drill TBD).
                  //   3. User has 'gpDrilldown' permission for this
                  //      company. Admin can grant per-company, e.g. an
                  //      operator who runs AllRx can drill into AllRx
                  //      but not AllCare.
                  const hasGranularData = selectedCompany === 'AllCare' || selectedCompany === 'AllRx' || selectedCompany === 'AllRx External';
                  const canDrill = hasGranularData && viewMode === 'monthly' && canBreakdown('gpDrilldown', selectedCompany);
                  const handleBarClick = canDrill ? (e) => {
                    if (!e?.activePayload?.[0]) return;
                    const label = e.activePayload[0].payload.month;
                    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const parts = String(label).match(/(\w+)\s*'?(\d+)/);
                    if (parts) {
                      const m = MONTHS_SHORT.indexOf(parts[1]) + 1;
                      const y = 2000 + Number(parts[2]);
                      if (m > 0) setGpDrilldown({ year: y, month: m });
                    }
                  } : undefined;
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={combinedGM} onClick={handleBarClick} style={canDrill ? { cursor: 'pointer' } : undefined}>
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
                        {forecastOverlay(combinedGM, 'gp')}
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
            )}

            <Card>
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} EBITDA by Company ({rangeLabel})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={ebitdaByMonthWithTotal}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {forecastOverlay(ebitdaByMonthWithTotal)}
                    {allCompanyNames.map(name => (
                      <Bar key={name} dataKey={name} fill={colorMap[name]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2.5} dot={{ fill: CHART_STYLE.totalLine, r: 3 }} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </>)}

            {/* GP Drill-Down Drawer — opens when a month bar in the
                Gross Profit & Margin chart is clicked. Routes to the
                right granular source based on the selected company:
                  AllCare           → 5-group product mix (service lines)
                  AllRx / AllRx Ext → customer segments (CLHF, ALF, etc.)
                Same row shape, same color thresholds, same totals math
                (sum_rev − sum_cos). Only the per-row grouping rule and
                the first column label change between sources. */}
            <Drawer open={!!gpDrilldown && canBreakdown('gpDrilldown', selectedCompany)} onOpenChange={(open) => { if (!open) setGpDrilldown(null); }}>
              <DrawerContent>
                {gpDrilldown && canBreakdown('gpDrilldown', selectedCompany) && (() => {
                  const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const drillLabel = `${ML[gpDrilldown.month]} ${gpDrilldown.year}`;
                  const inDrillMonth = (v) => v.year === gpDrilldown.year && v.month === gpDrilldown.month;
                  // Route to the correct granular source. AllRx External
                  // shares the AllRx segment tab (there's only one segment
                  // tab for the AllRx franchise).
                  const isAllCare = selectedCompany === 'AllCare';
                  const isAllRx = selectedCompany === 'AllRx' || selectedCompany === 'AllRx External';
                  const monthGroups = isAllCare
                    ? computeAllCareGroupedGP(inDrillMonth)
                    : isAllRx
                      ? computeAllRxSegmentGP(inDrillMonth)
                      : [];
                  // Sum the (already-combined) groups for the Total row.
                  // Because we derive GP from sum_rev − sum_cos per row,
                  // the row sums reconcile exactly to the granular tab's
                  // own Total row (and the chart, for AllCare and the
                  // regular AllRx view).
                  const totals = monthGroups.reduce(
                    (acc, g) => ({ rev: acc.rev + g.rev, cos: acc.cos + g.cos, gp: acc.gp + g.gp }),
                    { rev: 0, cos: 0, gp: 0 }
                  );
                  const totalGM = totals.rev > 0 ? (totals.gp / totals.rev * 100) : 0;
                  const gmColor = (pct) => pct >= 40 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-red-500';
                  // Drawer copy varies with source.
                  const drillSubject = selectedCompany || 'GP';
                  const subjectLabel = isAllCare ? 'service-line group' : isAllRx ? 'customer segment' : 'category';
                  const firstColHeader = isAllCare ? 'Service Line' : isAllRx ? 'Customer Segment' : 'Category';
                  const emptyMessage = isAllCare
                    ? 'No service-line data available for this month.'
                    : isAllRx
                      ? 'No segment-level data available for this month.'
                      : 'No data available for this month.';
                  return (
                    <>
                      <DrawerHeader>
                        <DrawerTitle>{drillSubject} GP Breakdown &mdash; {drillLabel}</DrawerTitle>
                        <DrawerDescription>Gross Profit & Margin by {subjectLabel}</DrawerDescription>
                      </DrawerHeader>
                      <div className="px-4 pb-6 overflow-auto">
                        {monthGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{firstColHeader}</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Gross Profit</TableHead>
                                <TableHead className="text-right">GM %</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthGroups.map(g => (
                                <TableRow key={g.name}>
                                  <TableCell className="font-medium">
                                    <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: g.color }} />
                                    {g.name}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{fmt(g.rev)}</TableCell>
                                  <TableCell className={`text-right tabular-nums font-semibold ${g.gp >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(g.gp)}</TableCell>
                                  <TableCell className={`text-right font-semibold tabular-nums ${gmColor(g.gm)}`}>{g.gm.toFixed(1)}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            <TableFooter>
                              <TableRow>
                                <TableCell className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold tabular-nums">{fmt(totals.rev)}</TableCell>
                                <TableCell className={`text-right font-bold tabular-nums ${totals.gp >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(totals.gp)}</TableCell>
                                <TableCell className={`text-right font-bold tabular-nums ${gmColor(totalGM)}`}>{totalGM.toFixed(1)}%</TableCell>
                              </TableRow>
                            </TableFooter>
                          </Table>
                        )}
                      </div>
                    </>
                  );
                })()}
              </DrawerContent>
            </Drawer>
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

            {/* When Compare is on: swap the monthly trend chart for two
                side-by-side ComparisonBarChart panels (per-company OpCF +
                per-company NetCF current vs comp). Same pattern used in
                Revenue/Expenses/Profitability tabs — KPI cards above show
                the period totals as ComparisonBadges; these bars show the
                per-company breakdown so the user can spot which entity
                drove the period change. */}
            {compareEnabled ? (
              <div className="mb-5 space-y-4">
                {(() => {
                  // Routing helper: Studio uses 'Direct Operational Cash
                  // Flow' (its 'Operational Cash Flow' double-counts portco
                  // rollups). Same convention as elsewhere in this file.
                  const opsKeyFor = (name) => name === 'InVitro Studio' ? 'Direct Operational Cash Flow' : 'Operational Cash Flow';
                  // Which companies appear as bars. When a single company is
                  // selected, only that one (so the chart shows ONE company
                  // with two bars — current vs comp). When Consolidated,
                  // all portcos minus the always-hidden pseudo entities.
                  const cfCompanies = selectedCompany
                    ? [selectedCompany]
                    : DISPLAY_COMPANIES.filter(n => !EXCLUDE_ALWAYS.includes(n));
                  // Sum a company's metric over a range predicate.
                  const sumCF = (name, metricKey, predicate) => {
                    const co = data.cashflow?.find(c => c.name === name);
                    if (!co) return 0;
                    const arr = co.metrics?.[metricKey] ?? [];
                    return arr.filter(predicate).reduce((s, v) => s + (v.value ?? 0), 0);
                  };
                  const inCurrent = (v) => {
                    const vi = v.year * 100 + v.month;
                    return vi >= rangeFrom.year * 100 + rangeFrom.month
                        && vi <= rangeTo.year * 100 + rangeTo.month;
                  };
                  const inComp = (v) => {
                    const vi = v.year * 100 + v.month;
                    return vi >= compRange.from.year * 100 + compRange.from.month
                        && vi <= compRange.to.year * 100 + compRange.to.month;
                  };
                  return (
                    <>
                      <ComparisonBarChart
                        title={`Operating Cash Flow Comparison — ${rangeLabel} vs ${compLabel}`}
                        companies={cfCompanies}
                        currentData={cfCompanies.map(name => ({ name, value: sumCF(name, opsKeyFor(name), inCurrent) }))}
                        currentLabel={rangeLabel}
                        compData={cfCompanies.map(name => ({ name, value: sumCF(name, opsKeyFor(name), inComp) }))}
                        compLabel={compLabel}
                        colorMap={colorMap}
                        compIsOlder={compIsOlder}
                      />
                      <ComparisonBarChart
                        title={`Net Cash Flow Comparison — ${rangeLabel} vs ${compLabel}`}
                        companies={cfCompanies}
                        currentData={cfCompanies.map(name => ({ name, value: sumCF(name, 'Net Cash Flow', inCurrent) }))}
                        currentLabel={rangeLabel}
                        compData={cfCompanies.map(name => ({ name, value: sumCF(name, 'Net Cash Flow', inComp) }))}
                        compLabel={compLabel}
                        colorMap={colorMap}
                        compIsOlder={compIsOlder}
                      />
                    </>
                  );
                })()}
              </div>
            ) : (
            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} Cash Flows &amp; Operational CF</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  // Pick the right pre-built series for the current view
                  // mode. Both series have the same shape ({ month, inflow,
                  // outflow, opsCashFlow, net, ... }) so the chart body
                  // doesn't need to branch — only the data source does.
                  const cfData = viewMode === 'yearly' ? cashBalanceByYear : viewMode === 'quarterly' ? cashBalanceByQuarter : cashBalanceByMonth;
                  return (
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={cfData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                        <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                        <Tooltip content={<CustomTooltip />} />
                        {forecastOverlay(cfData, 'left')}
                        <Bar yAxisId="left" dataKey="inflow" name="Cash Inflow" fill="#22c55e" fillOpacity={0.4} />
                        <Bar yAxisId="left" dataKey="outflow" name="Cash Outflow" fill="#ef4444" fillOpacity={0.4} />
                        <Line yAxisId="right" type="monotone" dataKey="opsCashFlow" name="Ops Cash Flow" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                        <Legend />
                      </ComposedChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>
            )}

            {/* Combined: Normal Cash Burn (bars) + Cash Runway (line) — consolidated only shows burn */}
            {(() => {
              const MONTHS_L = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              // Build runway data
              const runwayData = cashRunwayValues.map(v => ({
                month: viewMode === 'yearly' ? String(v.year)
                  : viewMode === 'quarterly' ? `Q${Math.ceil(v.month/3)} '${String(v.year).slice(-2)}`
                  : `${MONTHS_L[v.month]} '${String(v.year).slice(-2)}`,
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
                    const key = viewMode === 'yearly' ? String(v.year)
                      : viewMode === 'quarterly' ? `Q${Math.ceil(v.month/3)} '${String(v.year).slice(-2)}`
                      : `${MONTHS_L[v.month]} '${String(v.year).slice(-2)}`;
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
                        {forecastOverlay(combined, hasBurn ? 'burn' : 'runway')}
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

            {/* ─── Indirect Cash Flow Statement ───
                CFO-style build-up: EBITDA → ± Working Capital Δ → Operating
                Cash Flow → ± Investing → ± Financing → Net Cash Change →
                Cash Balance. Three layers:
                  Layer 1 — monthly stacked bar chart (components) +
                           cash balance line overlay.
                  Layer 2 — per-month build-up table (rows = line items,
                           columns = months in range + Total).
                  Layer 3 — per-company comparison table (Consolidated
                           view only). Each row = one portco.
                Working Capital Δ is derived (Op CF − EBITDA) — the sheet
                doesn't publish it directly but it's the implicit plug. */}
            {(() => {
              const ML_S = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const monthLabel = (y, m) => viewMode === 'yearly' ? String(y)
                : viewMode === 'quarterly' ? `Q${Math.ceil(m/3)} '${String(y).slice(-2)}`
                : `${ML_S[m]} '${String(y).slice(-2)}`;

              // Metric routing — Studio uses 'Direct Operational Cash Flow'
              // because its 'Operational Cash Flow' double-counts portco
              // rollups. Same convention as the existing OpCF chart.
              const opCFKey = (name) => name === 'InVitro Studio' ? 'Direct Operational Cash Flow' : 'Operational Cash Flow';
              const investCFKey = 'Investment Cash Flow';
              const finCFKey = 'Financing Cash Flow';
              const balanceKey = 'Cash Balance';

              const getValue = (companyData, metricName, year, month) => {
                if (!companyData) return 0;
                const arr = companyData.metrics?.[metricName] || [];
                const match = arr.find(v => v.year === year && v.month === month);
                return match?.value ?? 0;
              };

              // Months in the currently-selected range (chronological list).
              // Yearly view collapses to whole years; quarterly view collapses
              // to (year, quarter) buckets; monthly view lists each month.
              const monthsInRange = (() => {
                const result = [];
                if (viewMode === 'yearly') {
                  for (let y = rangeFrom.year; y <= rangeTo.year; y++) {
                    result.push({ year: y, month: 0, label: String(y) });
                  }
                } else if (viewMode === 'quarterly') {
                  // Enumerate quarters in range. Each quarter is keyed by (year, lastMonthOfQuarter).
                  const startQ = Math.ceil(rangeFrom.month / 3);
                  const endQ = Math.ceil(rangeTo.month / 3);
                  const startYQ = rangeFrom.year * 4 + startQ;
                  const endYQ = rangeTo.year * 4 + endQ;
                  for (let yq = startYQ; yq <= endYQ; yq++) {
                    const y = Math.floor((yq - 1) / 4);
                    const q = ((yq - 1) % 4) + 1;
                    result.push({ year: y, month: q * 3, quarter: q, label: `Q${q} '${String(y).slice(-2)}` });
                  }
                } else {
                  const start = rangeFrom.year * 12 + rangeFrom.month;
                  const end = rangeTo.year * 12 + rangeTo.month;
                  for (let mi = start; mi <= end; mi++) {
                    const y = Math.floor((mi - 1) / 12);
                    const m = ((mi - 1) % 12) + 1;
                    result.push({ year: y, month: m, label: monthLabel(y, m) });
                  }
                }
                return result;
              })();

              // For yearly view, sum monthly values within each year.
              const sumYearMetric = (companyData, metricName, year) => {
                if (!companyData) return 0;
                const arr = companyData.metrics?.[metricName] || [];
                return arr.filter(v => v.year === year).reduce((s, v) => s + (v.value ?? 0), 0);
              };
              // For quarterly view, sum monthly values within (year, quarter).
              const sumQuarterMetric = (companyData, metricName, year, quarter) => {
                if (!companyData) return 0;
                const arr = companyData.metrics?.[metricName] || [];
                const fromMonth = (quarter - 1) * 3 + 1;
                const toMonth = quarter * 3;
                return arr
                  .filter(v => v.year === year && v.month >= fromMonth && v.month <= toMonth)
                  .reduce((s, v) => s + (v.value ?? 0), 0);
              };
              // Cash balance for a year = December's balance (end-of-year).
              const getYearEndBalance = (companyData, year) => {
                if (!companyData) return 0;
                const arr = companyData.metrics?.[balanceKey] || [];
                const yearVals = arr.filter(v => v.year === year);
                if (yearVals.length === 0) return 0;
                const sorted = [...yearVals].sort((a, b) => b.month - a.month);
                return sorted[0]?.value ?? 0;
              };
              // Cash balance for a quarter = balance of the LAST month of the quarter present in data.
              const getQuarterEndBalance = (companyData, year, quarter) => {
                if (!companyData) return 0;
                const arr = companyData.metrics?.[balanceKey] || [];
                const fromMonth = (quarter - 1) * 3 + 1;
                const toMonth = quarter * 3;
                const qVals = arr.filter(v => v.year === year && v.month >= fromMonth && v.month <= toMonth);
                if (qVals.length === 0) return 0;
                const sorted = [...qVals].sort((a, b) => b.month - a.month);
                return sorted[0]?.value ?? 0;
              };

              // Which companies roll into the view. Same exclusion rules as
              // the existing OpCF chart so the consolidated totals reconcile.
              const companies = selectedCompany
                ? [selectedCompany]
                : DISPLAY_COMPANIES.filter(n => !EXCLUDE_ALWAYS.includes(n));

              // Per-period build (monthly OR quarterly OR yearly bucket → one chart point).
              const chartData = monthsInRange.map(({ year, month, quarter, label }) => {
                let ebitda = 0, opCF = 0, invCF = 0, finCF = 0, balance = 0;
                for (const name of companies) {
                  const pnl = data.pnl?.find(c => c.name === name);
                  const cf  = data.cashflow?.find(c => c.name === name);
                  if (viewMode === 'yearly') {
                    ebitda  += sumYearMetric(pnl, 'EBITDA', year);
                    opCF    += sumYearMetric(cf, opCFKey(name), year);
                    invCF   += sumYearMetric(cf, investCFKey, year);
                    finCF   += sumYearMetric(cf, finCFKey, year);
                    balance += getYearEndBalance(cf, year);
                  } else if (viewMode === 'quarterly') {
                    ebitda  += sumQuarterMetric(pnl, 'EBITDA', year, quarter);
                    opCF    += sumQuarterMetric(cf, opCFKey(name), year, quarter);
                    invCF   += sumQuarterMetric(cf, investCFKey, year, quarter);
                    finCF   += sumQuarterMetric(cf, finCFKey, year, quarter);
                    balance += getQuarterEndBalance(cf, year, quarter);
                  } else {
                    ebitda  += getValue(pnl, 'EBITDA', year, month);
                    opCF    += getValue(cf, opCFKey(name), year, month);
                    invCF   += getValue(cf, investCFKey, year, month);
                    finCF   += getValue(cf, finCFKey, year, month);
                    balance += getValue(cf, balanceKey, year, month);
                  }
                }
                const wcDelta = opCF - ebitda;
                const netCash = opCF + invCF + finCF;
                return { month: label, year, m: month, ebitda, wcDelta, opCF, invCF, finCF, netCash, balance };
              });

              // Comp-range months (when Compare is on). Empty otherwise.
              const monthsInCompRange = (() => {
                if (!compareEnabled) return [];
                const result = [];
                if (viewMode === 'yearly') {
                  for (let y = compRange.from.year; y <= compRange.to.year; y++) {
                    result.push({ year: y, month: 0 });
                  }
                } else if (viewMode === 'quarterly') {
                  const startQ = Math.ceil(compRange.from.month / 3);
                  const endQ = Math.ceil(compRange.to.month / 3);
                  const startYQ = compRange.from.year * 4 + startQ;
                  const endYQ = compRange.to.year * 4 + endQ;
                  for (let yq = startYQ; yq <= endYQ; yq++) {
                    const y = Math.floor((yq - 1) / 4);
                    const q = ((yq - 1) % 4) + 1;
                    result.push({ year: y, month: q * 3, quarter: q });
                  }
                } else {
                  const start = compRange.from.year * 12 + compRange.from.month;
                  const end = compRange.to.year * 12 + compRange.to.month;
                  for (let mi = start; mi <= end; mi++) {
                    const y = Math.floor((mi - 1) / 12);
                    const m = ((mi - 1) % 12) + 1;
                    result.push({ year: y, month: m });
                  }
                }
                return result;
              })();

              // Per-company stmts for a given period (list of months).
              // Parameterized so the same reducer powers both the CURRENT
              // range (totalStmt / perCompanyStmts) and the COMP range
              // (compStmt) when Compare is on.
              const buildCompanyStmt = (name, months) => {
                const pnl = data.pnl?.find(c => c.name === name);
                const cf  = data.cashflow?.find(c => c.name === name);
                let ebitda = 0, opCF = 0, invCF = 0, finCF = 0;
                for (const { year, month, quarter } of months) {
                  if (viewMode === 'yearly') {
                    ebitda += sumYearMetric(pnl, 'EBITDA', year);
                    opCF   += sumYearMetric(cf, opCFKey(name), year);
                    invCF  += sumYearMetric(cf, investCFKey, year);
                    finCF  += sumYearMetric(cf, finCFKey, year);
                  } else if (viewMode === 'quarterly') {
                    ebitda += sumQuarterMetric(pnl, 'EBITDA', year, quarter);
                    opCF   += sumQuarterMetric(cf, opCFKey(name), year, quarter);
                    invCF  += sumQuarterMetric(cf, investCFKey, year, quarter);
                    finCF  += sumQuarterMetric(cf, finCFKey, year, quarter);
                  } else {
                    ebitda += getValue(pnl, 'EBITDA', year, month);
                    opCF   += getValue(cf, opCFKey(name), year, month);
                    invCF  += getValue(cf, investCFKey, year, month);
                    finCF  += getValue(cf, finCFKey, year, month);
                  }
                }
                // End balance is point-in-time — use the LAST period's value.
                const last = months[months.length - 1];
                const endBalance = !last ? 0 : (viewMode === 'yearly'
                  ? getYearEndBalance(cf, last.year)
                  : viewMode === 'quarterly'
                  ? getQuarterEndBalance(cf, last.year, last.quarter)
                  : getValue(cf, balanceKey, last.year, last.month));
                const wcDelta = opCF - ebitda;
                const netCash = opCF + invCF + finCF;
                return { name, ebitda, wcDelta, opCF, invCF, finCF, netCash, endBalance };
              };
              const perCompanyStmts = companies.map(name => buildCompanyStmt(name, monthsInRange));
              // Comp totals only computed when Compare is on. Used to
              // render the 4-column Build-up comparison table below.
              const compPerCompanyStmts = compareEnabled
                ? companies.map(name => buildCompanyStmt(name, monthsInCompRange))
                : [];
              const totalStmt = perCompanyStmts.reduce(
                (acc, s) => ({
                  ebitda: acc.ebitda + s.ebitda,
                  wcDelta: acc.wcDelta + s.wcDelta,
                  opCF: acc.opCF + s.opCF,
                  invCF: acc.invCF + s.invCF,
                  finCF: acc.finCF + s.finCF,
                  netCash: acc.netCash + s.netCash,
                  endBalance: acc.endBalance + s.endBalance,
                }),
                { ebitda: 0, wcDelta: 0, opCF: 0, invCF: 0, finCF: 0, netCash: 0, endBalance: 0 }
              );
              // Compute the comparable totals for compRange (Compare ON).
              // Same reducer shape as totalStmt — fed by compPerCompanyStmts.
              const compStmt = compareEnabled
                ? compPerCompanyStmts.reduce(
                    (acc, s) => ({
                      ebitda: acc.ebitda + s.ebitda,
                      wcDelta: acc.wcDelta + s.wcDelta,
                      opCF: acc.opCF + s.opCF,
                      invCF: acc.invCF + s.invCF,
                      finCF: acc.finCF + s.finCF,
                      netCash: acc.netCash + s.netCash,
                      endBalance: acc.endBalance + s.endBalance,
                    }),
                    { ebitda: 0, wcDelta: 0, opCF: 0, invCF: 0, finCF: 0, netCash: 0, endBalance: 0 }
                  )
                : null;

              // Skip entirely if there's no data at all
              if (chartData.length === 0) return null;
              const hasAnyData = chartData.some(p =>
                p.ebitda !== 0 || p.opCF !== 0 || p.invCF !== 0 || p.finCF !== 0
              );
              if (!hasAnyData) return null;

              // Build-up table line config. Indent helps the eye see that
              // WC Δ is a "modifier" of EBITDA, not a peer line.
              const LINE_ITEMS = [
                { key: 'ebitda',  label: 'EBITDA',                  bold: false, indent: 0 },
                { key: 'wcDelta', label: '± Working Capital Δ',      bold: false, indent: 1 },
                { key: 'opCF',    label: '= Operating Cash Flow',    bold: true,  indent: 0 },
                { key: 'invCF',   label: '± Investing Cash Flow',    bold: false, indent: 0 },
                { key: 'finCF',   label: '± Financing Cash Flow',    bold: false, indent: 0 },
                { key: 'netCash', label: '= Net Cash Change',        bold: true,  indent: 0 },
                { key: 'balance', label: 'Ending Cash Balance',      bold: true,  indent: 0 },
              ];

              // Color rule: green for cash-positive, red for cash-negative.
              // Same convention as Op CF / EBITDA cells elsewhere.
              const cashColor = (val) => {
                if (val === 0 || val === null) return 'text-muted-foreground';
                return val > 0 ? 'text-emerald-600' : 'text-red-500';
              };

              return (
                <>
                  <div className="mt-8 mb-4">
                    <h2 className="text-lg font-bold mb-1">Indirect Cash Flow Statement</h2>
                    <p className="text-sm text-muted-foreground">
                      EBITDA → ± Working Capital → Operating CF → Investing → Financing → Ending Balance
                      {selectedCompany ? ` · ${selectedCompany}` : ' · Consolidated'}
                    </p>
                  </div>

                  {/* Layer 1 — Monthly chart: components stacked, balance line overlay.
                      Investing/Financing CF bars are click-to-drill for ANY
                      selected company when the user has 'cashflowDrilldown'
                      permission. The breakdown lines are detected dynamically
                      from each company's metrics (see detectCashflowBreakdown
                      below) — no per-company hardcoded lists. */}
                  {(() => {
                    // Drill gate: any selected portco in monthly view, AND
                    // user has the cashflowDrilldown permission. Otherwise
                    // bars are static. Consolidated (no selectedCompany)
                    // can't drill — aggregation across companies has no
                    // single sheet block to read line-level detail from.
                    const canDrillCf = !!selectedCompany
                      && viewMode === 'monthly'
                      && canBreakdown('cashflowDrilldown', selectedCompany);
                    const handleInvClick = canDrillCf
                      ? (data) => setCfDrilldown({ kind: 'investing', scope: 'month', year: data.year, month: data.m })
                      : undefined;
                    const handleFinClick = canDrillCf
                      ? (data) => setCfDrilldown({ kind: 'financing', scope: 'month', year: data.year, month: data.m })
                      : undefined;
                    return (
                      <Card className="mb-5">
                        <CardHeader>
                          <CardTitle className="text-sm">Cash Flow Components ({rangeLabel}){canDrillCf ? ' — click Investing or Financing bar for breakdown' : ''}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={320}>
                            <ComposedChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                              <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                              <YAxis yAxisId="bars" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                              <YAxis yAxisId="balance" orientation="right" tick={{ fill: '#1e40af', fontSize: 11 }} tickFormatter={fmtShort} />
                              <Tooltip content={<CustomTooltip />} />
                              {forecastOverlay(chartData, 'bars')}
                              {/* Stacked bars: components that sum to Net Cash Change */}
                              <Bar yAxisId="bars" dataKey="ebitda"  stackId="cf" fill="#10b981" name="EBITDA" />
                              <Bar yAxisId="bars" dataKey="wcDelta" stackId="cf" fill="#f59e0b" name="WC Δ" />
                              <Bar yAxisId="bars" dataKey="invCF"   stackId="cf" fill="#8b5cf6" name="Investing CF"
                                onClick={handleInvClick}
                                style={canDrillCf ? { cursor: 'pointer' } : undefined} />
                              <Bar yAxisId="bars" dataKey="finCF"   stackId="cf" fill="#3b82f6" name="Financing CF"
                                onClick={handleFinClick}
                                style={canDrillCf ? { cursor: 'pointer' } : undefined} />
                              <Line yAxisId="balance" type="monotone" dataKey="balance" stroke="#1e40af" strokeWidth={2.5}
                                dot={{ r: 3, fill: '#1e40af' }} name="Cash Balance" />
                              <Legend />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Layer 2 — Build-up table.
                      Compare OFF: rows = line items, columns = months + Total.
                      Compare ON:  rows = line items, 4 columns —
                                   Comp Total · Current Total · Δ $ · Δ %.
                      Swapping to 4 columns in compare mode keeps the table
                      scannable instead of doubling the width. KPI cards
                      above show period totals via ComparisonBadge; this
                      table shows the line-by-line delta. */}
                  <Card className="mb-5 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {compareEnabled
                          ? `Build-up Comparison — ${rangeLabel} vs ${compLabel} (${selectedCompany || 'Consolidated'})`
                          : `Build-up by ${viewMode === 'yearly' ? 'Year' : viewMode === 'quarterly' ? 'Quarter' : 'Month'} (${selectedCompany || 'Consolidated'})`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-auto px-0">
                      {compareEnabled ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Line Item</TableHead>
                              <TableHead className="text-right whitespace-nowrap">{compLabel}</TableHead>
                              <TableHead className="text-right whitespace-nowrap">{rangeLabel}</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Δ $</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Δ %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {LINE_ITEMS.map(item => {
                              const curVal = item.key === 'balance'
                                ? (chartData[chartData.length - 1]?.balance ?? 0)
                                : (totalStmt[item.key] ?? 0);
                              const cmpVal = item.key === 'balance'
                                ? (compPerCompanyStmts.reduce((s, x) => s + x.endBalance, 0))
                                : (compStmt?.[item.key] ?? 0);
                              const delta = curVal - cmpVal;
                              // % change: only meaningful when cmpVal != 0;
                              // sign is direction of CURRENT vs COMP.
                              const pctChg = cmpVal !== 0 ? (delta / Math.abs(cmpVal) * 100) : null;
                              // For directionally-good metrics (EBITDA, Op CF,
                              // Net Cash, Balance), up is green. For neutral
                              // mods (WC Δ, Inv CF, Fin CF), let the cashColor
                              // rule (sign-based) do the work on raw values.
                              const deltaColor = delta === 0 ? 'text-muted-foreground' : delta > 0 ? 'text-emerald-600' : 'text-red-500';
                              return (
                                <TableRow key={item.key} className={item.bold ? 'bg-muted/30' : ''}>
                                  <TableCell
                                    className={`${item.bold ? 'font-bold' : ''}`}
                                    style={{ paddingLeft: `${1 + item.indent}rem` }}
                                  >
                                    {item.label}
                                  </TableCell>
                                  <TableCell className={`text-right tabular-nums whitespace-nowrap ${item.bold ? 'font-bold' : ''} ${cashColor(cmpVal)}`}>{fmt(cmpVal)}</TableCell>
                                  <TableCell className={`text-right tabular-nums whitespace-nowrap ${item.bold ? 'font-bold' : ''} ${cashColor(curVal)}`}>{fmt(curVal)}</TableCell>
                                  <TableCell className={`text-right tabular-nums whitespace-nowrap font-medium ${deltaColor}`}>
                                    {delta > 0 ? '+' : ''}{fmt(delta)}
                                  </TableCell>
                                  <TableCell className={`text-right tabular-nums whitespace-nowrap font-medium ${deltaColor}`}>
                                    {pctChg === null ? '—' : `${pctChg > 0 ? '+' : ''}${pctChg.toFixed(1)}%`}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card z-10">Line Item</TableHead>
                            {monthsInRange.map(({ label }) => (
                              <TableHead key={label} className="text-right whitespace-nowrap">{label}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold whitespace-nowrap">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {LINE_ITEMS.map(item => {
                            // Ending Balance is point-in-time, not summed — use the
                            // last period's balance for the Total column.
                            const totalVal = item.key === 'balance'
                              ? (chartData[chartData.length - 1]?.balance ?? 0)
                              : (totalStmt[item.key] ?? 0);
                            // Cashflow drilldown: month cells AND the Total cell
                            // on Investing/Financing rows are clickable for ANY
                            // selected company when user has cashflowDrilldown
                            // permission. Clicking dispatches the same setCfDrilldown
                            // state the chart bars use — single state, multiple
                            // entry points. Month cells use scope='month';
                            // Total cell uses scope='range' (aggregates over
                            // the full date range).
                            const drillKind = item.key === 'invCF' ? 'investing'
                              : item.key === 'finCF' ? 'financing'
                              : null;
                            // Drillable in ALL view modes (monthly, quarterly,
                            // yearly). The click dispatches a scope matching
                            // the current view — drawer aggregates accordingly.
                            const cellDrillable = drillKind
                              && !!selectedCompany
                              && canBreakdown('cashflowDrilldown', selectedCompany);
                            return (
                              <TableRow key={item.key} className={item.bold ? 'bg-muted/30' : ''}>
                                <TableCell
                                  className={`sticky left-0 bg-card z-10 ${item.bold ? 'font-bold' : ''}`}
                                  style={{ paddingLeft: `${1 + item.indent}rem` }}
                                  title={cellDrillable ? `Click any ${viewMode === 'yearly' ? 'year' : viewMode === 'quarterly' ? 'quarter' : 'month'} or the Total cell to see breakdown` : undefined}
                                >
                                  {item.label}
                                  {cellDrillable && (
                                    <span className="ml-2 text-[10px] font-medium text-primary uppercase tracking-wide">click ↗</span>
                                  )}
                                </TableCell>
                                {monthsInRange.map((bucket, i) => {
                                  const { label, year, month } = bucket;
                                  const val = chartData[i]?.[item.key] ?? 0;
                                  // Dispatch shape varies by view mode:
                                  //   monthly   → { scope:'month',   year, month }
                                  //   quarterly → { scope:'quarter', year, quarter }
                                  //   yearly    → { scope:'year',    year }
                                  // Drawer routes the aggregation predicate
                                  // off the scope field.
                                  const buildDrillPayload = () => {
                                    if (viewMode === 'quarterly') {
                                      return { kind: drillKind, scope: 'quarter', year, quarter: bucket.quarter };
                                    }
                                    if (viewMode === 'yearly') {
                                      return { kind: drillKind, scope: 'year', year };
                                    }
                                    return { kind: drillKind, scope: 'month', year, month };
                                  };
                                  const onClick = cellDrillable ? () => setCfDrilldown(buildDrillPayload()) : undefined;
                                  return (
                                    <TableCell
                                      key={label}
                                      onClick={onClick}
                                      className={`text-right tabular-nums whitespace-nowrap ${item.bold ? 'font-bold' : ''} ${cashColor(val)} ${cellDrillable ? 'cursor-pointer hover:bg-primary/10 hover:underline underline-offset-2 transition-colors' : ''}`}
                                    >
                                      {fmt(val)}
                                    </TableCell>
                                  );
                                })}
                                <TableCell
                                  onClick={cellDrillable ? () => setCfDrilldown({ kind: drillKind, scope: 'range' }) : undefined}
                                  className={`text-right tabular-nums font-bold whitespace-nowrap ${cashColor(totalVal)} ${cellDrillable ? 'cursor-pointer hover:bg-primary/10 hover:underline underline-offset-2 transition-colors' : ''}`}
                                  title={cellDrillable ? 'Click for range-total breakdown' : undefined}
                                >
                                  {fmt(totalVal)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Layer 3 — Per-company comparison (only when Consolidated and multiple companies) */}
                  {!selectedCompany && perCompanyStmts.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Per-Company Cash Flow ({rangeLabel})</CardTitle>
                      </CardHeader>
                      <CardContent className="overflow-auto px-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Company</TableHead>
                              <TableHead className="text-right">EBITDA</TableHead>
                              <TableHead className="text-right">WC Δ</TableHead>
                              <TableHead className="text-right">Op CF</TableHead>
                              <TableHead className="text-right">Inv CF</TableHead>
                              <TableHead className="text-right">Fin CF</TableHead>
                              <TableHead className="text-right">Net Cash Δ</TableHead>
                              <TableHead className="text-right">End Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {perCompanyStmts.map(s => (
                              <TableRow key={s.name}>
                                <TableCell className="font-medium whitespace-nowrap">
                                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: colorMap[s.name] }} />
                                  {s.name}
                                </TableCell>
                                <TableCell className={`text-right tabular-nums ${cashColor(s.ebitda)}`}>{fmt(s.ebitda)}</TableCell>
                                <TableCell className={`text-right tabular-nums ${cashColor(s.wcDelta)}`}>{fmt(s.wcDelta)}</TableCell>
                                <TableCell className={`text-right font-semibold tabular-nums ${cashColor(s.opCF)}`}>{fmt(s.opCF)}</TableCell>
                                <TableCell className={`text-right tabular-nums ${cashColor(s.invCF)}`}>{fmt(s.invCF)}</TableCell>
                                <TableCell className={`text-right tabular-nums ${cashColor(s.finCF)}`}>{fmt(s.finCF)}</TableCell>
                                <TableCell className={`text-right font-semibold tabular-nums ${cashColor(s.netCash)}`}>{fmt(s.netCash)}</TableCell>
                                <TableCell className={`text-right tabular-nums ${cashColor(s.endBalance)}`}>{fmt(s.endBalance)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell className="font-bold">Total</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.ebitda)}`}>{fmt(totalStmt.ebitda)}</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.wcDelta)}`}>{fmt(totalStmt.wcDelta)}</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.opCF)}`}>{fmt(totalStmt.opCF)}</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.invCF)}`}>{fmt(totalStmt.invCF)}</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.finCF)}`}>{fmt(totalStmt.finCF)}</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.netCash)}`}>{fmt(totalStmt.netCash)}</TableCell>
                              <TableCell className={`text-right font-bold tabular-nums ${cashColor(totalStmt.endBalance)}`}>{fmt(totalStmt.endBalance)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}

            {/* Cashflow Drill-Down Drawer — opens when a user clicks an
                Investing/Financing CF entry point (chart bar, table month
                cell, or table Total cell) for ANY selected company. The
                breakdown lines are detected dynamically from each company's
                metrics — no hardcoded company-specific lists. Two scopes:
                  scope='month': single-month breakdown (year+month required)
                  scope='range': aggregate over the full rangeFrom..rangeTo
                Two kinds:
                  kind='investing' → recipients of investment outflows
                  kind='financing' → sources of financing inflows
                If sheet author adds new line items to any company's block,
                they appear automatically because of the dynamic detection. */}
            {(() => {
              // Dynamically detect each company's Investing + Financing
              // breakdown lines by walking metric keys in sheet order.
              // Lines BETWEEN known aggregate names (Cash Inflow, Operational
              // Cash Flow, Investment Cash Flow, etc.) get bucketed by which
              // aggregate they precede. Returns { investing: [...], financing: [...] }.
              const AGGREGATE_KEYS = new Set([
                'Cash Inflow', 'Cash Outflow',
                'Direct Operational Cash Flow', 'Direct Operational Cash flow',
                'Operational Cash Flow', 'Operational Cash Flow (Internal budget)',
                'Studio Cashout',
                'Investment Cash Flow', 'Financing Cash Flow',
                'Net Cash Flow', 'Cash Balance',
              ]);
              const KPI_PATTERNS = [/% of collection/i, /Collection %/i];
              const detectCashflowBreakdown = (companyName) => {
                const company = data.cashflow?.find(c => c.name === companyName);
                if (!company) return { investing: [], financing: [] };
                const investing = [];
                const financing = [];
                let buffer = [];
                for (const key of Object.keys(company.metrics)) {
                  if (KPI_PATTERNS.some(p => p.test(key))) continue;
                  if (key === 'Investment Cash Flow') {
                    investing.push(...buffer); buffer = [];
                  } else if (key === 'Financing Cash Flow') {
                    financing.push(...buffer); buffer = [];
                  } else if (AGGREGATE_KEYS.has(key)) {
                    buffer = []; // reset on any other aggregate
                  } else {
                    buffer.push(key);
                  }
                }
                return { investing, financing };
              };
              const company = selectedCompany ? data.cashflow?.find(c => c.name === selectedCompany) : null;
              const open = !!cfDrilldown && canBreakdown('cashflowDrilldown', selectedCompany);
              return (
                <Drawer open={open} onOpenChange={(o) => { if (!o) setCfDrilldown(null); }}>
                  <DrawerContent>
                    {cfDrilldown && company && canBreakdown('cashflowDrilldown', selectedCompany) && (() => {
                      const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const isInvesting = cfDrilldown.kind === 'investing';
                      const scope = cfDrilldown.scope;
                      const isRange = scope === 'range';
                      // Drawer title adapts to scope:
                      //   range   → full date range label
                      //   month   → "Apr 26"
                      //   quarter → "Q2 26"
                      //   year    → "2026"
                      const drillLabel = scope === 'range'   ? rangeLabel
                                       : scope === 'year'    ? String(cfDrilldown.year)
                                       : scope === 'quarter' ? `Q${cfDrilldown.quarter} ${String(cfDrilldown.year).slice(-2)}`
                                       :                       `${ML[cfDrilldown.month]} ${cfDrilldown.year}`;
                      const aggKey = isInvesting ? 'Investment Cash Flow' : 'Financing Cash Flow';
                      const subjectLabel = isInvesting ? 'Per-line investment outflows' : 'Per-line financing inflows';
                      const firstColHeader = isInvesting ? 'Investment Target' : 'Funding Source';
                      const { investing, financing } = detectCashflowBreakdown(selectedCompany);
                      const lines = isInvesting ? investing : financing;
                      // Aggregation predicate picks which monthly values to
                      // sum based on scope. Single shared codepath via
                      // .filter(matchesScope) — only the predicate changes.
                      const matchesScope = (v) => {
                        if (scope === 'range') {
                          const vi = v.year * 100 + v.month;
                          return vi >= rangeFrom.year * 100 + rangeFrom.month
                              && vi <= rangeTo.year * 100 + rangeTo.month;
                        }
                        if (scope === 'year') {
                          return v.year === cfDrilldown.year;
                        }
                        if (scope === 'quarter') {
                          if (v.year !== cfDrilldown.year) return false;
                          return Math.ceil(v.month / 3) === cfDrilldown.quarter;
                        }
                        // month (default)
                        return v.year === cfDrilldown.year && v.month === cfDrilldown.month;
                      };
                      const getVal = (metricName) => {
                        const arr = company.metrics?.[metricName] || [];
                        return arr.filter(matchesScope).reduce((s, v) => s + (v.value ?? 0), 0);
                      };
                      const rows = lines.map(name => ({ name, value: getVal(name) }))
                        .filter(r => r.value !== 0);
                      const directTotal = rows.reduce((s, r) => s + r.value, 0);
                      // Canonical total from the aggregate row. If per-line
                      // sum diverges, surface the gap as Other/Unallocated.
                      const canonicalTotal = getVal(aggKey);
                      const unallocated = canonicalTotal - directTotal;
                      const hasUnallocated = Math.abs(unallocated) >= 1;
                      // Cashflow color: positive = emerald (inflow), negative
                      // = red (outflow). Sign carries direction.
                      const cashColor = (v) => v === 0 ? 'text-muted-foreground' : v > 0 ? 'text-emerald-600' : 'text-red-500';
                      return (
                        <>
                          <DrawerHeader>
                            <DrawerTitle>{isInvesting ? 'Investing' : 'Financing'} Cash Flow — {drillLabel}</DrawerTitle>
                            <DrawerDescription>{selectedCompany} · {subjectLabel}{isRange ? ' (range total)' : ''}</DrawerDescription>
                          </DrawerHeader>
                          <div className="px-4 pb-6 overflow-auto">
                            {rows.length === 0 && !hasUnallocated ? (
                              <p className="text-sm text-muted-foreground">No {isInvesting ? 'investment' : 'financing'} activity recorded for this {scope === 'range' ? 'range' : scope === 'year' ? 'year' : scope === 'quarter' ? 'quarter' : 'month'}.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{firstColHeader}</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map(r => (
                                    <TableRow key={r.name}>
                                      <TableCell className="font-medium">{r.name}</TableCell>
                                      <TableCell className={`text-right tabular-nums font-semibold ${cashColor(r.value)}`}>{fmt(r.value)}</TableCell>
                                    </TableRow>
                                  ))}
                                  {hasUnallocated && (
                                    <TableRow className="bg-muted/40">
                                      <TableCell className="font-medium text-muted-foreground italic" title="Activity in the consolidated total not attributed to a specific line in the granular block.">
                                        Other / Unallocated
                                      </TableCell>
                                      <TableCell className={`text-right tabular-nums ${cashColor(unallocated)}`}>{fmt(unallocated)}</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                                <TableFooter>
                                  <TableRow>
                                    <TableCell className="font-bold">Total {aggKey}</TableCell>
                                    <TableCell className={`text-right font-bold tabular-nums ${cashColor(canonicalTotal)}`}>{fmt(canonicalTotal)}</TableCell>
                                  </TableRow>
                                </TableFooter>
                              </Table>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </DrawerContent>
                </Drawer>
              );
            })()}
          </>)}

          {/* ────── KPIs & UNIT ECONOMICS ──────
              AllCare-only (initially). Two surfaces:
                1. KPI ratio tiles — Visits/Patient, Patients/Facility, CAC
                2. Service-line × period pivot matrix — service lines as
                   parent rows, ARPU/COS/Unit/GP/Unit/GM% as sub-rows,
                   columns adapt to viewMode (Monthly/Quarterly/Yearly).
              Active Patients + Active Facilities are AllCare-wide; SUs
              are summed and ratios computed on the range. Per-service-line
              metrics use the existing ALLCARE_PRODUCT_GROUPS so the
              groupings stay consistent with the Revenue Mix pie and the
              Profitability GP drilldown. */}
          {activeSection === 'kpis' && (<>
            {(() => {
              // KPIs & Unit Economics is AllCare-only at this point. If the
              // user lands on this section while another company is selected
              // (stale URL, direct state, etc.), show a polite redirect note.
              if (selectedCompany !== 'AllCare') {
                return (
                  <p className="text-sm text-muted-foreground">
                    KPIs &amp; Unit Economics is available for <strong>AllCare</strong> only at this time. Switch to AllCare from the sidebar to view this section.
                  </p>
                );
              }
              const allCare = data.revenueDetails?.AllCare;
              if (!allCare?.serviceLines?.length) {
                return <p className="text-sm text-muted-foreground">No AllCare service-line data available.</p>;
              }
              const totals = allCare.totals || {};
              const slArr = allCare.serviceLines;

              // ─── Period buckets (same builder as Indirect CF / Overview) ───
              const ML = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const monthLabel = (y, m) => `${ML[m]} '${String(y).slice(-2)}`;
              const periods = (() => {
                const result = [];
                if (viewMode === 'yearly') {
                  for (let y = rangeFrom.year; y <= rangeTo.year; y++) result.push({ year: y, label: String(y), key: `y-${y}` });
                } else if (viewMode === 'quarterly') {
                  const startQ = Math.ceil(rangeFrom.month / 3);
                  const endQ = Math.ceil(rangeTo.month / 3);
                  const startYQ = rangeFrom.year * 4 + startQ;
                  const endYQ = rangeTo.year * 4 + endQ;
                  for (let yq = startYQ; yq <= endYQ; yq++) {
                    const y = Math.floor((yq - 1) / 4);
                    const q = ((yq - 1) % 4) + 1;
                    result.push({ year: y, quarter: q, label: `Q${q} '${String(y).slice(-2)}`, key: `q-${y}-${q}` });
                  }
                } else {
                  const start = rangeFrom.year * 12 + rangeFrom.month;
                  const end = rangeTo.year * 12 + rangeTo.month;
                  for (let mi = start; mi <= end; mi++) {
                    const y = Math.floor((mi - 1) / 12);
                    const m = ((mi - 1) % 12) + 1;
                    result.push({ year: y, month: m, label: monthLabel(y, m), key: `m-${y}-${m}` });
                  }
                }
                return result;
              })();
              const inPeriod = (v, p) => {
                if (viewMode === 'yearly') return v.year === p.year;
                if (viewMode === 'quarterly') return v.year === p.year && Math.ceil(v.month / 3) === p.quarter;
                return v.year === p.year && v.month === p.month;
              };

              // Helper: sum a metric array filtered to a period predicate
              const sumIn = (arr, pred) => (arr || []).filter(pred).reduce((s, v) => s + (v.value ?? 0), 0);
              // Last in-range value for stock metrics (Active Patients/Facilities)
              const lastInRange = (arr) => {
                if (!arr || arr.length === 0) return null;
                const inR = arr.filter(v => {
                  const vi = v.year * 100 + v.month;
                  return vi >= rangeFrom.year * 100 + rangeFrom.month
                      && vi <= rangeTo.year * 100 + rangeTo.month;
                });
                if (inR.length === 0) return null;
                const sorted = [...inR].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
                return sorted[0]?.value ?? null;
              };
              // Stock metric value WITHIN a period bucket — last month in the bucket
              const lastInBucket = (arr, p) => {
                const inB = (arr || []).filter(v => inPeriod(v, p));
                if (inB.length === 0) return null;
                const sorted = [...inB].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
                return sorted[0]?.value ?? null;
              };

              // ─── Whole-AllCare KPI tiles (range totals) ───
              const stripSuffix = (s) => String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim();
              const inRangeAllCare = (v) => {
                const vi = v.year * 100 + v.month;
                return vi >= rangeFrom.year * 100 + rangeFrom.month
                    && vi <= rangeTo.year * 100 + rangeTo.month;
              };
              const totalSUs = slArr.reduce((s, sl) => s + sumIn(sl.metrics?.['SUs'], inRangeAllCare), 0);
              const totalRev = slArr.reduce((s, sl) => s + sumIn(sl.metrics?.['Revenues'], inRangeAllCare), 0);
              const totalCOS = slArr.reduce((s, sl) => s + sumIn(sl.metrics?.['Cost of Sales'], inRangeAllCare), 0);
              const totalGP = totalRev - totalCOS;
              const activePatientsLatest = lastInRange(totals['Active Patients']);
              const activeFacilitiesLatest = lastInRange(totals['Active Facilities']);
              // For "new patients acquired" — compare last in-range value vs
              // last value BEFORE the range start. If no prior, fallback to 0.
              const activePatientsPrior = (() => {
                const arr = totals['Active Patients'] || [];
                const beforeRange = arr.filter(v => {
                  const vi = v.year * 100 + v.month;
                  return vi < rangeFrom.year * 100 + rangeFrom.month;
                });
                if (beforeRange.length === 0) return null;
                const sorted = [...beforeRange].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
                return sorted[0]?.value ?? null;
              })();
              // Ratios
              const visitsPerPatient = (totalSUs > 0 && activePatientsLatest > 0) ? totalSUs / activePatientsLatest : null;
              const patientsPerFacility = (activePatientsLatest > 0 && activeFacilitiesLatest > 0) ? activePatientsLatest / activeFacilitiesLatest : null;

              const fmtRatio = (v, suffix = '', digits = 1) => v == null ? '—' : `${v.toFixed(digits)}${suffix}`;
              const fmtInt = (v) => v == null ? '—' : Math.round(v).toLocaleString();

              // ─── Per-service-line groups (matches ALLCARE_PRODUCT_GROUPS used elsewhere) ───
              const computeGroupMetrics = (group, p) => {
                let su = 0, rev = 0, cos = 0;
                for (const sl of slArr) {
                  if (!group.members.includes(stripSuffix(sl.name))) continue;
                  su += sumIn(sl.metrics?.['SUs'], v => inPeriod(v, p));
                  rev += sumIn(sl.metrics?.['Revenues'], v => inPeriod(v, p));
                  cos += sumIn(sl.metrics?.['Cost of Sales'], v => inPeriod(v, p));
                }
                const gp = rev - cos;
                return {
                  su, rev, cos, gp,
                  arpu: su > 0 ? rev / su : null,
                  cosPerUnit: su > 0 ? cos / su : null,
                  gpPerUnit: su > 0 ? gp / su : null,
                  gmPct: rev > 0 ? (gp / rev) * 100 : null,
                };
              };
              const groupRows = ALLCARE_PRODUCT_GROUPS.map(group => {
                const perPeriod = periods.map(p => ({ ...p, ...computeGroupMetrics(group, p) }));
                // Range totals (same math as period buckets but over the whole range)
                let su = 0, rev = 0, cos = 0;
                for (const sl of slArr) {
                  if (!group.members.includes(stripSuffix(sl.name))) continue;
                  su += sumIn(sl.metrics?.['SUs'], inRangeAllCare);
                  rev += sumIn(sl.metrics?.['Revenues'], inRangeAllCare);
                  cos += sumIn(sl.metrics?.['Cost of Sales'], inRangeAllCare);
                }
                const gp = rev - cos;
                const total = {
                  su, rev, cos, gp,
                  arpu: su > 0 ? rev / su : null,
                  cosPerUnit: su > 0 ? cos / su : null,
                  gpPerUnit: su > 0 ? gp / su : null,
                  gmPct: rev > 0 ? (gp / rev) * 100 : null,
                };
                return { name: group.name, color: group.color, perPeriod, total };
              }).filter(g => g.total.su > 0);

              // Sub-row config for the pivot matrix
              const SUB_ROWS = [
                { key: 'arpu',       label: 'ARPU',        fmt: (v) => v == null ? '—' : `$${v.toFixed(2)}` },
                { key: 'cosPerUnit', label: 'COS / Unit',  fmt: (v) => v == null ? '—' : `$${v.toFixed(2)}` },
                { key: 'gpPerUnit',  label: 'GP / Unit',   fmt: (v) => v == null ? '—' : `$${v.toFixed(2)}`, color: (v) => v == null ? '' : v >= 0 ? 'text-emerald-600' : 'text-red-500' },
                { key: 'gmPct',      label: 'GM %',        fmt: (v) => v == null ? '—' : `${v.toFixed(1)}%`, color: (v) => v == null ? '' : v >= 40 ? 'text-emerald-600' : v >= 20 ? 'text-amber-600' : 'text-red-500' },
              ];

              return (
                <>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold mb-1">AllCare KPIs & Unit Economics</h2>
                    <p className="text-sm text-muted-foreground">
                      {viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} unit economics by service line &mdash; {rangeLabel}
                    </p>
                  </div>

                  {/* AllCare-wide KPI tiles */}
                  <div className="flex flex-wrap gap-4 mb-6">
                    <KPICard title={`Active Patients — ${rangeLabel}`} value={fmtInt(activePatientsLatest)} subtitle="latest in range" />
                    <KPICard title={`Active Facilities — ${rangeLabel}`} value={fmtInt(activeFacilitiesLatest)} subtitle="latest in range" />
                    <KPICard title="SUs / Patient" value={fmtRatio(visitsPerPatient, '×', 2)} subtitle="engagement (SUs ÷ active patients)" />
                    <KPICard title="Patients / Facility" value={fmtRatio(patientsPerFacility, '×', 1)} subtitle="penetration (patients ÷ facilities)" />
                  </div>

                  {/* AllCare Totals by Period — sits above the per-service-
                      line pivot. Same column shape (periods + Total). Rows
                      include both FLOW metrics (SUs, Revenue, COS, GP, GTM
                      Expenses) summed per bucket and STOCK metrics (Active
                      Patients, Active Facilities) read as the LAST value in
                      each bucket. "New Patients" is the delta of Active
                      Patients between the bucket and the prior one — first
                      bucket shows '—' (no prior). Ratios (ARPU, COS/Unit,
                      GM%, CAC, etc.) are recomputed per bucket from the
                      summed numerator/denominator. */}
                  {(() => {
                    // Whole-AllCare per-period totals
                    const sumAllCareIn = (metricName, pred) =>
                      slArr.reduce((s, sl) => s + sumIn(sl.metrics?.[metricName], pred), 0);

                    // Per-period bucket values
                    const buckets = periods.map((p, idx) => {
                      const su = sumAllCareIn('SUs', v => inPeriod(v, p));
                      const rev = sumAllCareIn('Revenues', v => inPeriod(v, p));
                      const cos = sumAllCareIn('Cost of Sales', v => inPeriod(v, p));
                      const gp = rev - cos;
                      const apEnd = lastInBucket(totals['Active Patients'], p);
                      const afEnd = lastInBucket(totals['Active Facilities'], p);
                      return { ...p, su, rev, cos, gp, apEnd, afEnd };
                    });
                    // Second pass: compute "new patients" delta per bucket
                    // using prior bucket's apEnd. First bucket uses
                    // activePatientsPrior (last value before range start) if
                    // available so the user gets a useful number for the
                    // first period rather than '—'.
                    buckets.forEach((b, i) => {
                      const priorEnd = i === 0 ? activePatientsPrior : buckets[i - 1].apEnd;
                      b.newPatients = (b.apEnd != null && priorEnd != null) ? b.apEnd - priorEnd : null;
                      b.arpu = b.su > 0 ? b.rev / b.su : null;
                      b.cosPerUnit = b.su > 0 ? b.cos / b.su : null;
                      b.gpPerUnit = b.su > 0 ? b.gp / b.su : null;
                      b.gmPct = b.rev > 0 ? (b.gp / b.rev) * 100 : null;
                      b.suPerPatient = (b.su > 0 && b.apEnd > 0) ? b.su / b.apEnd : null;
                      b.patientPerFacility = (b.apEnd > 0 && b.afEnd > 0) ? b.apEnd / b.afEnd : null;
                    });
                    // Range total (last column) — flow metrics sum, stock
                    // metrics use end-of-range value, ratios recompute on
                    // aggregates. Reuses the same in-range numbers already
                    // computed for the KPI tiles above.
                    const grandRev = totalRev;
                    const grandCOS = totalCOS;
                    const grandGP = totalGP;
                    const grandSU = totalSUs;
                    // Range-total New Patients = active_patients(end) - active_patients(prior-to-range)
                    const totalNewPatients = (activePatientsLatest != null && activePatientsPrior != null)
                      ? activePatientsLatest - activePatientsPrior
                      : null;
                    const totalRow = {
                      su: grandSU,
                      rev: grandRev,
                      cos: grandCOS,
                      gp: grandGP,
                      apEnd: activePatientsLatest,
                      afEnd: activeFacilitiesLatest,
                      newPatients: totalNewPatients,
                      arpu: grandSU > 0 ? grandRev / grandSU : null,
                      cosPerUnit: grandSU > 0 ? grandCOS / grandSU : null,
                      gpPerUnit: grandSU > 0 ? grandGP / grandSU : null,
                      gmPct: grandRev > 0 ? (grandGP / grandRev) * 100 : null,
                      suPerPatient: visitsPerPatient,
                      patientPerFacility: patientsPerFacility,
                    };

                    // Row config: label, key, formatter, optional color rule.
                    // section: 'flow' / 'stock' / 'ratio' — drives faint
                    // grouping background to help the eye chunk the table.
                    const fmtDollar = (v) => v == null ? '—' : fmt(v);
                    const fmtRatio$ = (v) => v == null ? '—' : `$${v.toFixed(2)}`;
                    const fmtPctR = (v) => v == null ? '—' : `${v.toFixed(1)}%`;
                    const fmtX = (v, d = 1) => v == null ? '—' : `${v.toFixed(d)}×`;
                    const ROWS = [
                      // Volume + presence
                      { key: 'su',          label: 'SUs',                       fmt: fmtInt },
                      { key: 'apEnd',       label: 'Active Patients',           fmt: fmtInt },
                      { key: 'afEnd',       label: 'Active Facilities',         fmt: fmtInt },
                      { key: 'newPatients', label: 'New Patients (Δ vs prior)', fmt: fmtInt,
                        color: (v) => v == null ? '' : v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : '' },
                      // Money flows
                      { key: 'rev', label: 'Revenue',       fmt: fmtDollar },
                      { key: 'cos', label: 'Cost of Sales', fmt: fmtDollar },
                      { key: 'gp',  label: 'Gross Profit',  fmt: fmtDollar,
                        color: (v) => v == null ? '' : v >= 0 ? 'text-emerald-600' : 'text-red-500' },
                      // Unit economics + ratios
                      { key: 'arpu',              label: 'ARPU',                fmt: fmtRatio$ },
                      { key: 'cosPerUnit',        label: 'COS / Unit',          fmt: fmtRatio$ },
                      { key: 'gpPerUnit',         label: 'GP / Unit',           fmt: fmtRatio$,
                        color: (v) => v == null ? '' : v >= 0 ? 'text-emerald-600' : 'text-red-500' },
                      { key: 'gmPct',             label: 'GM %',                fmt: fmtPctR,
                        color: (v) => v == null ? '' : v >= 40 ? 'text-emerald-600' : v >= 20 ? 'text-amber-600' : 'text-red-500' },
                      { key: 'suPerPatient',      label: 'SUs / Patient',       fmt: (v) => fmtX(v, 2) },
                      { key: 'patientPerFacility', label: 'Patients / Facility', fmt: (v) => fmtX(v, 1) },
                    ];

                    return (
                      <Card className="mb-5 overflow-hidden">
                        <CardHeader>
                          <CardTitle className="text-sm">AllCare Totals by {viewMode === 'yearly' ? 'Year' : viewMode === 'quarterly' ? 'Quarter' : 'Month'}</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-auto px-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="sticky left-0 bg-card z-10">KPI</TableHead>
                                {periods.map(p => (
                                  <TableHead key={p.key} className="text-right whitespace-nowrap">{p.label}</TableHead>
                                ))}
                                <TableHead className="text-right font-bold whitespace-nowrap">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ROWS.map(item => (
                                <TableRow key={item.key}>
                                  <TableCell className="sticky left-0 bg-card z-10 font-medium">{item.label}</TableCell>
                                  {buckets.map(b => {
                                    const v = b[item.key];
                                    return (
                                      <TableCell key={b.key} className={`text-right tabular-nums whitespace-nowrap ${item.color ? item.color(v) : ''}`}>
                                        {item.fmt(v)}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className={`text-right tabular-nums whitespace-nowrap font-bold border-l border-border/60 ${item.color ? item.color(totalRow[item.key]) : ''}`}>
                                    {item.fmt(totalRow[item.key])}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Per-service-line pivot matrix — Option B layout */}
                  <Card className="mb-5 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-sm">Service-Line Unit Economics</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-auto px-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card z-10">Service Line / KPI</TableHead>
                            {periods.map(p => (
                              <TableHead key={p.key} className="text-right whitespace-nowrap">{p.label}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold whitespace-nowrap">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupRows.map(g => (
                            <Fragment key={g.name}>
                              {/* Parent row — service line label with color dot */}
                              <TableRow className="bg-muted/30">
                                <TableCell className="sticky left-0 bg-muted/30 z-10 font-bold">
                                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: g.color }} />
                                  {g.name}
                                </TableCell>
                                {periods.map(p => null).map((_, i) => <TableCell key={i} />)}
                                <TableCell />
                              </TableRow>
                              {/* Sub-rows — one per KPI metric */}
                              {SUB_ROWS.map(sub => (
                                <TableRow key={`${g.name}-${sub.key}`}>
                                  <TableCell className="sticky left-0 bg-card z-10 text-muted-foreground" style={{ paddingLeft: '2rem' }}>
                                    {sub.label}
                                  </TableCell>
                                  {g.perPeriod.map(row => (
                                    <TableCell key={row.key} className={`text-right tabular-nums whitespace-nowrap ${sub.color ? sub.color(row[sub.key]) : ''}`}>
                                      {sub.fmt(row[sub.key])}
                                    </TableCell>
                                  ))}
                                  <TableCell className={`text-right tabular-nums whitespace-nowrap font-semibold border-l border-border/60 ${sub.color ? sub.color(g.total[sub.key]) : ''}`}>
                                    {sub.fmt(g.total[sub.key])}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </>)}

          {/* ────── INSIGHTS ────── */}
          {/* ────── EXPENSES ────── */}
          {activeSection === 'expenses' && (<>
            <div className="flex flex-wrap gap-4 mb-6">
              <KPICard title={`${getExpenseLabel()} — ${rangeLabel}`}
                value={fmt(Math.abs(rangeExpensesExclStudio))}
                subtitle={(() => {
                  // Studio cross-charge is excluded from this view; the
                  // subtitle prefixes "Excluding Studio Expenses" for
                  // non-Studio companies so the user sees the policy
                  // explicitly. Studio's own view is unaffected (its
                  // costs aren't allocated to itself).
                  const studioNote = selectedCompany === 'InVitro Studio' ? null : 'Excluding Studio Expenses';
                  if (selectedCompany) return [studioNote, selectedCompany].filter(Boolean).join(' · ');
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
                  const exclAdHoc = Math.abs(rangeExpensesExclStudio) - adHocVal;
                  const adHocPart = adHocVal > 0 ? `Incl. ${fmt(adHocVal)} ad hocs · Excl: ${fmt(exclAdHoc)}` : 'all entities';
                  return [studioNote, adHocPart].filter(Boolean).join(' · ');
                })()}
                comparison={compareEnabled && <ComparisonBadge current={Math.abs(rangeExpensesExclStudio)}
                  compValue={Math.abs(expensesInRangeExclStudio(compRange.from, compRange.to))}
                  compLabel={compLabel} invertColor />}
              />
              <KPICard title={`Avg Monthly Expense`}
                value={fmt(Math.abs(avgMonthlyExpense))}
                subtitle="average per month"
                comparison={compareEnabled && (() => {
                  const compExp = Math.abs(expensesInRange(compRange.from, compRange.to));
                  const compMo = (compRange.to.year*12 + compRange.to.month) - (compRange.from.year*12 + compRange.from.month) + 1;
                  return <ComparisonBadge current={Math.abs(avgMonthlyExpense)} compValue={compMo > 0 ? compExp/compMo : 0} compLabel={compLabel} invertColor />;
                })()}
              />
              {rangeRevenue > 0 && (
                <KPICard title={`Expense Ratio — ${rangeLabel}`}
                  value={`${(Math.abs(rangeExpenses) / rangeRevenue * 100).toFixed(1)}%`}
                  subtitle="expenses / revenue"
                  comparison={compareEnabled && (() => {
                    const cExp = Math.abs(expensesInRange(compRange.from, compRange.to));
                    const cRev = rangeTotal(data.pnl, 'Revenues', compRange.from, compRange.to, dynExcludeRevenue);
                    const cur = rangeRevenue > 0 ? Math.abs(rangeExpenses)/rangeRevenue*100 : 0;
                    const comp = cRev > 0 ? cExp/cRev*100 : 0;
                    return <ComparisonBadge current={cur} compValue={comp} compLabel={compLabel} invertColor />;
                  })()}
                />
              )}
            </div>

            {/* Chart: when Compare is on, swap to side-by-side panels per
                period (same pattern as Overview/Revenue). Otherwise keep
                the monthly stacked-bar with click-to-drill behavior. */}
            {compareEnabled ? (
              <div className="mb-5">
                <ComparisonBarChart
                  title={`Expenses Comparison — ${rangeLabel} vs ${compLabel}`}
                  companies={expenseChartCompanies}
                  currentData={expenseChartCompanies.map(name => ({
                    name,
                    value: expenseByMonthWithTotal.reduce((s, p) => s + (p[name] ?? 0), 0),
                  }))}
                  currentLabel={rangeLabel}
                  compData={expenseChartCompanies.map(name => ({
                    name,
                    value: compExpenseByMonth.reduce((s, p) => s + Math.abs(p[name] ?? 0), 0),
                  }))}
                  compLabel={compLabel}
                  colorMap={colorMap}
                  compIsOlder={compIsOlder}
                />
              </div>
            ) : (() => {
              // Compute once: the user's drilldown permission for this chart.
              // Drives the title affordance text, the bar cursor style, and
              // the onClick guard — all should agree, otherwise the UI lies.
              const canDrill = canBreakdown('expenseDrilldown', selectedCompany);
              return (
            <Card className="mb-5">
              <CardHeader><CardTitle className="text-sm">{viewMode === 'yearly' ? 'Yearly' : viewMode === 'quarterly' ? 'Quarterly' : 'Monthly'} Expenses ({rangeLabel}){canDrill ? ' — click a bar for breakdown' : ''}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={expenseByMonthWithTotal} onClick={canDrill ? (e) => {
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
                  } : undefined}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.border} />
                    <XAxis dataKey="month" tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: CHART_STYLE.muted, fontSize: 11 }} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    {forecastOverlay(expenseByMonthWithTotal)}
                    {expenseChartCompanies.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="1" fill={colorMap[name]} cursor={canDrill ? "pointer" : "default"}
                        radius={i === expenseChartCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                    <Line type="monotone" dataKey="Total" stroke={CHART_STYLE.totalLine} strokeWidth={2} dot={false} />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
              );
            })()}

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
                    // Split NON-HC into two buckets:
                    //   - nonHc: recurring/monthly/etc. (excluding ad-hoc)
                    //   - adhocks: ad-hoc only (Frequency='Ad-hoc'/'Ad-Hoc')
                    // Sum of the two equals the legacy "Non-HC" total so
                    // Total = HC + nonHc + adhocks stays unchanged.
                    const nonHc = deptRows.filter(e => e.category === 'NON-HC' && !e.isAdhock).reduce((s, e) => s + (e.amount ?? 0), 0);
                    const adhocks = deptRows.filter(e => e.category === 'NON-HC' && e.isAdhock).reduce((s, e) => s + (e.amount ?? 0), 0);
                    return { department: dept, hc, nonHc, adhocks, total: hc + nonHc + adhocks };
                  }).filter(r => r.total !== 0);
                  const totalHc = breakdown.reduce((s, r) => s + r.hc, 0);
                  const totalNonHc = breakdown.reduce((s, r) => s + r.nonHc, 0);
                  const totalAdhocks = breakdown.reduce((s, r) => s + r.adhocks, 0);
                  const totalAll = totalHc + totalNonHc + totalAdhocks;
                  // Prior-month totals (across all departments) for the footer badges
                  const totalDrillM = expenseDrilldown?.month;
                  const totalDrillY = expenseDrilldown?.year;
                  const totalPriorM = totalDrillM === 1 ? 12 : totalDrillM - 1;
                  const totalPriorY = totalDrillM === 1 ? totalDrillY - 1 : totalDrillY;
                  const totalPriorMatch = (e) =>
                    e.year === totalPriorY && e.month === totalPriorM &&
                    e.department !== 'Direct Cost' &&
                    !EXCLUDED_GL.includes(e.gl) &&
                    (selectedCompany ? e.company === selectedCompany : DISPLAY_COMPANIES.includes(e.company));
                  const priorTotalHc = totalDrillM ? (data.expenses ?? []).filter(totalPriorMatch).filter(e => e.category === 'HC').reduce((s, e) => s + Math.abs(e.amount ?? 0), 0) : 0;
                  const priorTotalNonHc = totalDrillM ? (data.expenses ?? []).filter(totalPriorMatch).filter(e => e.category === 'NON-HC' && !e.isAdhock).reduce((s, e) => s + Math.abs(e.amount ?? 0), 0) : 0;
                  const priorTotalAdhocks = totalDrillM ? (data.expenses ?? []).filter(totalPriorMatch).filter(e => e.category === 'NON-HC' && e.isAdhock).reduce((s, e) => s + Math.abs(e.amount ?? 0), 0) : 0;
                  const priorTotalAll = priorTotalHc + priorTotalNonHc + priorTotalAdhocks;
                  // Drill-month revenue across all included companies (for % of rev)
                  const totalDrillRevenue = totalDrillM && totalDrillY ? (selectedCompany
                    ? (data.pnl.find(c => c.name === selectedCompany)?.metrics['Revenues'] ?? [])
                        .filter(v => v.year === totalDrillY && v.month === totalDrillM)
                        .reduce((s, v) => s + (v.value ?? 0), 0)
                    : rangeTotal(data.pnl, 'Revenues', { year: totalDrillY, month: totalDrillM }, { year: totalDrillY, month: totalDrillM }, dynExcludeRevenue)
                  ) : 0;
                  const totalCellBadges = (curr, prior) => {
                    if (!totalDrillM) return null;
                    const pctChg = prior > 0 ? ((curr - prior) / prior * 100) : null;
                    const costRevPct = totalDrillRevenue > 0 ? (curr / totalDrillRevenue * 100) : null;
                    if (pctChg === null && costRevPct === null) return null;
                    return (
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        {pctChg !== null && (
                          <span className={`text-[9px] font-medium ${pctChg > 0 ? 'text-red-500' : pctChg < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}%
                          </span>
                        )}
                        {costRevPct !== null && (
                          <span className="text-[9px] text-muted-foreground/70">
                            {costRevPct.toFixed(1)}% of rev
                          </span>
                        )}
                      </div>
                    );
                  };
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
                                <TableHead className="text-right" title="Ad-hoc / one-off Non-HC expenses (Frequency='Ad-hoc' in the source sheet). Kept in its own column so recurring opex can be analyzed independently.">Adhocks (Non-HC)</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {breakdown.map(r => {
                                const isExpanded = expandedDept === r.department;
                                // GL sub-breakdown when expanded — split into
                                // recurring Non-HC and Adhocks so each appears
                                // in its own card. Adhocks were previously
                                // mixed into Non-HC, which obscured one-off
                                // spend (e.g. consulting projects, M&A fees).
                                const glRows = isExpanded ? (() => {
                                  const byGL = {};
                                  filtered.filter(e => e.department === r.department && e.category === 'NON-HC' && !e.isAdhock)
                                    .forEach(e => { byGL[e.gl || 'Other'] = (byGL[e.gl || 'Other'] || 0) + (e.amount ?? 0); });
                                  return Object.entries(byGL).sort((a, b) => b[1] - a[1]).map(([gl, amt]) => ({ gl, amount: amt }));
                                })() : [];
                                const adhockRows = isExpanded ? (() => {
                                  const byGL = {};
                                  filtered.filter(e => e.department === r.department && e.category === 'NON-HC' && e.isAdhock)
                                    .forEach(e => { byGL[e.gl || 'Other'] = (byGL[e.gl || 'Other'] || 0) + (e.amount ?? 0); });
                                  return Object.entries(byGL).sort((a, b) => b[1] - a[1]).map(([gl, amt]) => ({ gl, amount: amt }));
                                })() : [];
                                // Prior-month GL totals for "% vs last month" badges (only for monthly drills)
                                const drillM = expenseDrilldown?.month;
                                const drillY = expenseDrilldown?.year;
                                const priorMonthIdx = drillM === 1 ? 12 : drillM - 1;
                                const priorYearIdx = drillM === 1 ? drillY - 1 : drillY;
                                const priorGLTotals = isExpanded && drillM ? (() => {
                                  const byGL = {};
                                  (data.expenses ?? [])
                                    .filter(e => e.year === priorYearIdx && e.month === priorMonthIdx)
                                    .filter(e => e.department === r.department && e.category === 'NON-HC' && !e.isAdhock)
                                    .filter(e => e.department !== 'Direct Cost' && !EXCLUDED_GL.includes(e.gl))
                                    .filter(e => selectedCompany ? e.company === selectedCompany : DISPLAY_COMPANIES.includes(e.company))
                                    .forEach(e => { byGL[e.gl || 'Other'] = (byGL[e.gl || 'Other'] || 0) + Math.abs(e.amount ?? 0); });
                                  return byGL;
                                })() : {};
                                // Prior-month GL totals for adhocks (separate from recurring)
                                const priorAdhockGLTotals = isExpanded && drillM ? (() => {
                                  const byGL = {};
                                  (data.expenses ?? [])
                                    .filter(e => e.year === priorYearIdx && e.month === priorMonthIdx)
                                    .filter(e => e.department === r.department && e.category === 'NON-HC' && e.isAdhock)
                                    .filter(e => e.department !== 'Direct Cost' && !EXCLUDED_GL.includes(e.gl))
                                    .filter(e => selectedCompany ? e.company === selectedCompany : DISPLAY_COMPANIES.includes(e.company))
                                    .forEach(e => { byGL[e.gl || 'Other'] = (byGL[e.gl || 'Other'] || 0) + Math.abs(e.amount ?? 0); });
                                  return byGL;
                                })() : {};
                                // Revenue for cost/rev ratio (computed once, used by HC and Non-HC sections)
                                const deptDrillRevenue = drillM && drillY ? (selectedCompany
                                  ? (data.pnl.find(c => c.name === selectedCompany)?.metrics['Revenues'] ?? [])
                                      .filter(v => v.year === drillY && v.month === drillM)
                                      .reduce((s, v) => s + (v.value ?? 0), 0)
                                  : rangeTotal(data.pnl, 'Revenues', { year: drillY, month: drillM }, { year: drillY, month: drillM }, dynExcludeRevenue)
                                ) : 0;
                                // Prior-month department totals (HC, Non-HC, Total) for row-level badges
                                const priorMonthMatch = (e) =>
                                  e.year === priorYearIdx && e.month === priorMonthIdx &&
                                  e.department === r.department &&
                                  e.department !== 'Direct Cost' &&
                                  !EXCLUDED_GL.includes(e.gl) &&
                                  (selectedCompany ? e.company === selectedCompany : DISPLAY_COMPANIES.includes(e.company));
                                const priorHc = drillM ? (data.expenses ?? []).filter(priorMonthMatch).filter(e => e.category === 'HC').reduce((s, e) => s + Math.abs(e.amount ?? 0), 0) : 0;
                                const priorNonHc = drillM ? (data.expenses ?? []).filter(priorMonthMatch).filter(e => e.category === 'NON-HC' && !e.isAdhock).reduce((s, e) => s + Math.abs(e.amount ?? 0), 0) : 0;
                                const priorAdhocks = drillM ? (data.expenses ?? []).filter(priorMonthMatch).filter(e => e.category === 'NON-HC' && e.isAdhock).reduce((s, e) => s + Math.abs(e.amount ?? 0), 0) : 0;
                                const priorTotal = priorHc + priorNonHc + priorAdhocks;
                                // Helper to render the badge stack under a cell value
                                const cellBadges = (curr, prior) => {
                                  if (!drillM) return null;
                                  const pctChg = prior > 0 ? ((curr - prior) / prior * 100) : null;
                                  const costRevPct = deptDrillRevenue > 0 ? (curr / deptDrillRevenue * 100) : null;
                                  if (pctChg === null && costRevPct === null) return null;
                                  return (
                                    <div className="flex items-center justify-end gap-2 mt-0.5">
                                      {pctChg !== null && (
                                        <span className={`text-[9px] font-medium ${pctChg > 0 ? 'text-red-500' : pctChg < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                          {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}%
                                        </span>
                                      )}
                                      {costRevPct !== null && (
                                        <span className="text-[9px] text-muted-foreground/70">
                                          {costRevPct.toFixed(1)}% of rev
                                        </span>
                                      )}
                                    </div>
                                  );
                                };
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
                                      <TableCell className="text-right font-medium text-blue-600">
                                        <div>{fmt(r.hc)}</div>
                                        {cellBadges(r.hc, priorHc)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-amber-600">
                                        <div>{fmt(r.nonHc)}</div>
                                        {cellBadges(r.nonHc, priorNonHc)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-rose-600">
                                        <div>{r.adhocks !== 0 ? fmt(r.adhocks) : '—'}</div>
                                        {r.adhocks !== 0 && cellBadges(r.adhocks, priorAdhocks)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        <div>{fmt(r.total)}</div>
                                        {cellBadges(r.total, priorTotal)}
                                      </TableCell>
                                    </TableRow>
                                    {/* ── Expanded: HC + Non-HC + Adhocks card sections ── */}
                                    {isExpanded && (
                                      <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={5} className="p-0 pt-1 pb-3">
                                          <div className="mx-2 grid gap-3" style={{ gridTemplateColumns: r.adhocks !== 0 ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                                            {/* ── BLUE: HC Section (col 2, under HC column) ──
                                                Gated by canBreakdown('hcDetails', ...): admin can
                                                grant expense-drilldown access without revealing
                                                individual salary detail. */}
                                            {canBreakdown('hcDetails', selectedCompany) && (() => {
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
                                                      const divKey = `${r.department}:${div}`;
                                                      const isDivExpanded = expandedHCDivision === divKey;
                                                      // Build employee list for the drilled month under this dept+division
                                                      const employees = isDivExpanded
                                                        ? hcPeople
                                                            .filter(h => (h.division || 'Other') === div)
                                                            .map(h => {
                                                              const key = `${drillYear}-${drillMonth}`;
                                                              const sal = h.salary?.[key] ?? 0;
                                                              return { name: h.name || 'Unknown', position: h.position || '', salary: sal };
                                                            })
                                                            .filter(e => e.salary > 0)
                                                            .sort((a, b) => b.salary - a.salary)
                                                        : [];
                                                      return (
                                                        <div key={div}>
                                                          <div
                                                            className="px-4 py-2 text-xs hover:bg-blue-50/50 rounded mx-1 cursor-pointer"
                                                            onClick={() => setExpandedHCDivision(isDivExpanded ? null : divKey)}
                                                          >
                                                            <div className="flex items-center justify-between">
                                                              <span className="text-foreground/80 flex items-center gap-1">
                                                                <span className="text-[10px] text-blue-500/60">{isDivExpanded ? '▾' : '▸'}</span>
                                                                {div} <span className="ml-1 text-muted-foreground/50">({bydivCount[div]})</span>
                                                              </span>
                                                              <span className="font-medium text-foreground/70 tabular-nums">{fmt(cost)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-0.5 ml-3">
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
                                                          {isDivExpanded && employees.length > 0 && (
                                                            <div className="mx-3 mb-1 border-l-2 border-blue-200/50 pl-3 py-1">
                                                              {employees.map(emp => (
                                                                <div key={emp.name} className="flex items-center justify-between text-[11px] py-1 px-2 hover:bg-blue-50/40 rounded">
                                                                  <span className="text-foreground/70">
                                                                    {emp.name}
                                                                    {emp.position && <span className="text-muted-foreground/60 ml-1">— {emp.position}</span>}
                                                                  </span>
                                                                  <span className="text-foreground/60 tabular-nums">{fmt(emp.salary)}</span>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
                                                          {isDivExpanded && employees.length === 0 && (
                                                            <p className="mx-5 my-1 text-[11px] text-muted-foreground italic">No employees with salary in this month</p>
                                                          )}
                                                        </div>
                                                      );
                                                    }) : (
                                                      <p className="px-4 py-2 text-xs text-muted-foreground italic">No HC salary data for this month</p>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                            {/* ── AMBER: Non-HC Section (excludes adhocks) ──
                                                Gated by canBreakdown('expenseGLDetail', ...):
                                                Layer 2 of the expense breakdown. Admin can
                                                grant expense-drilldown access (Layer 1, dept
                                                totals) without revealing GL-level detail. */}
                                            {r.nonHc !== 0 && canBreakdown('expenseGLDetail', selectedCompany) && (
                                              <div className="rounded-lg border border-amber-200/60 bg-amber-50/20 overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 border-b border-amber-200/40">
                                                  <div className="flex items-center gap-2">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Non-Headcount</span>
                                                    <span className="text-[9px] text-amber-600/70">(excl. adhocks)</span>
                                                  </div>
                                                  <span className="text-xs font-bold text-amber-700 tabular-nums">{fmt(r.nonHc)}</span>
                                                </div>
                                                <div className="py-1">
                                                  {glRows.map(g => {
                                                    const glExpanded = expandedGL === g.gl;
                                                    const merchantRows = glExpanded ? (() => {
                                                      const byMerchant = {};
                                                      // Non-HC merchant drill — excludes adhock transactions
                                                      // so the merchant totals reconcile to the Non-HC card
                                                      // total (which itself excludes adhocks).
                                                      filtered.filter(e => e.department === r.department && e.category === 'NON-HC' && !e.isAdhock && e.gl === g.gl)
                                                        .forEach(e => { const m = e.merchant?.trim() || 'Unknown'; byMerchant[m] = (byMerchant[m] || 0) + (e.amount ?? 0); });
                                                      return Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).map(([name, amt]) => ({ name, amount: amt }));
                                                    })() : [];
                                                    // Comparison badges: % vs prior month, % of revenue
                                                    const priorAmt = priorGLTotals[g.gl] || 0;
                                                    const pctChg = priorAmt > 0 ? ((g.amount - priorAmt) / priorAmt * 100) : null;
                                                    const costRevPct = deptDrillRevenue > 0 ? (g.amount / deptDrillRevenue * 100) : null;
                                                    return (
                                                      <div key={g.gl}>
                                                        <div
                                                          className="px-4 py-2 text-xs cursor-pointer hover:bg-amber-50/50 rounded mx-1"
                                                          onClick={() => setExpandedGL(glExpanded ? null : g.gl)}
                                                        >
                                                          <div className="flex items-center justify-between">
                                                            <span className="font-medium text-foreground/80">
                                                              <span className="inline-block w-3 mr-1 text-muted-foreground">{glExpanded ? '▾' : '›'}</span>
                                                              {g.gl}
                                                            </span>
                                                            <span className="font-medium text-foreground/70 tabular-nums">{fmt(g.amount)}</span>
                                                          </div>
                                                          {(pctChg !== null || costRevPct !== null) && (
                                                            <div className="flex items-center gap-3 mt-0.5 ml-4">
                                                              {pctChg !== null && (
                                                                <span className={`text-[10px] font-medium ${pctChg > 0 ? 'text-red-500' : pctChg < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                                  {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}% vs {MONTHS_S[priorMonthIdx]} {String(priorYearIdx).slice(-2)}
                                                                </span>
                                                              )}
                                                              {costRevPct !== null && (
                                                                <span className="text-[10px] text-muted-foreground/70">
                                                                  {costRevPct.toFixed(1)}% of rev
                                                                </span>
                                                              )}
                                                            </div>
                                                          )}
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
                                            {/* ── ROSE: Adhocks (Non-HC) Section ──
                                                Same shape as the Non-HC card but
                                                rose-tinted to signal "one-off /
                                                non-recurring" at a glance. Only
                                                renders when this department has
                                                ad-hoc expenses in the drill period.
                                                Gated alongside Non-HC by
                                                'expenseGLDetail' since both expose
                                                GL-level cost lines (Layer 2). */}
                                            {r.adhocks !== 0 && canBreakdown('expenseGLDetail', selectedCompany) && (
                                              <div className="rounded-lg border border-rose-200/60 bg-rose-50/20 overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 border-b border-rose-200/40">
                                                  <div className="flex items-center gap-2">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">Adhocks (Non-HC)</span>
                                                  </div>
                                                  <span className="text-xs font-bold text-rose-700 tabular-nums">{fmt(r.adhocks)}</span>
                                                </div>
                                                <div className="py-1">
                                                  {adhockRows.map(g => {
                                                    const glExpanded = expandedGL === `adhock:${g.gl}`;
                                                    const merchantRows = glExpanded ? (() => {
                                                      const byMerchant = {};
                                                      filtered.filter(e => e.department === r.department && e.category === 'NON-HC' && e.isAdhock && e.gl === g.gl)
                                                        .forEach(e => { const m = e.merchant?.trim() || 'Unknown'; byMerchant[m] = (byMerchant[m] || 0) + (e.amount ?? 0); });
                                                      return Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).map(([name, amt]) => ({ name, amount: amt }));
                                                    })() : [];
                                                    const priorAmt = priorAdhockGLTotals[g.gl] || 0;
                                                    const pctChg = priorAmt > 0 ? ((g.amount - priorAmt) / priorAmt * 100) : null;
                                                    const costRevPct = deptDrillRevenue > 0 ? (g.amount / deptDrillRevenue * 100) : null;
                                                    return (
                                                      <div key={g.gl}>
                                                        <div
                                                          className="px-4 py-2 text-xs cursor-pointer hover:bg-rose-50/50 rounded mx-1"
                                                          onClick={() => setExpandedGL(glExpanded ? null : `adhock:${g.gl}`)}
                                                        >
                                                          <div className="flex items-center justify-between">
                                                            <span className="font-medium text-foreground/80">
                                                              <span className="inline-block w-3 mr-1 text-muted-foreground">{glExpanded ? '▾' : '›'}</span>
                                                              {g.gl}
                                                            </span>
                                                            <span className="font-medium text-foreground/70 tabular-nums">{fmt(g.amount)}</span>
                                                          </div>
                                                          {(pctChg !== null || costRevPct !== null) && (
                                                            <div className="flex items-center gap-3 mt-0.5 ml-4">
                                                              {pctChg !== null && (
                                                                <span className={`text-[10px] font-medium ${pctChg > 0 ? 'text-red-500' : pctChg < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                                  {pctChg > 0 ? '▲' : pctChg < 0 ? '▼' : '—'} {Math.abs(pctChg).toFixed(1)}% vs {MONTHS_S[priorMonthIdx]} {String(priorYearIdx).slice(-2)}
                                                                </span>
                                                              )}
                                                              {costRevPct !== null && (
                                                                <span className="text-[10px] text-muted-foreground/70">
                                                                  {costRevPct.toFixed(1)}% of rev
                                                                </span>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                        {glExpanded && (
                                                          <div className="ml-7 mb-1 border-l-2 border-rose-200/40 pl-3">
                                                            {merchantRows.map(mr => (
                                                              <div key={mr.name} className="flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
                                                                <span>
                                                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-300/50 mr-2 align-middle"></span>
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
                                <TableCell className="text-right font-bold">
                                  <div>{fmt(totalHc)}</div>
                                  {totalCellBadges(totalHc, priorTotalHc)}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  <div>{fmt(totalNonHc)}</div>
                                  {totalCellBadges(totalNonHc, priorTotalNonHc)}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  <div>{totalAdhocks !== 0 ? fmt(totalAdhocks) : '—'}</div>
                                  {totalAdhocks !== 0 && totalCellBadges(totalAdhocks, priorTotalAdhocks)}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  <div>{fmt(totalAll)}</div>
                                  {totalCellBadges(totalAll, priorTotalAll)}
                                </TableCell>
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
                <CardHeader>
                  <CardTitle className="text-sm">
                    Expense Distribution by Company {compareEnabled ? `— ${rangeLabel} vs ${compLabel}` : `(${rangeLabel})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {compareEnabled ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center mb-1">{rangeLabel}</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={70} innerRadius={38} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={{ stroke: '#cbd5e1', strokeWidth: 0.8 }}>
                              {expensePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center mb-1">{compLabel}</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={compExpensePieData} cx="50%" cy="50%" outerRadius={70} innerRadius={38} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={{ stroke: '#cbd5e1', strokeWidth: 0.8 }}>
                              {compExpensePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {expensePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </>)}

          {activeSection === 'irr' && (
            <IRRValuation
              data={data}
              user={user}
              selectedYear={irrYear}
              compareYear={irrCompareEnabled ? irrCompYear : null}
              viewMode={irrView}
              /* Cross-section navigation: clicking a company name in
                 the IRR view jumps to that company's Overview in the
                 Portfolio Performance section. The callback maps the
                 IRR sheet's "AllCare + Curenta" combined block back
                 to the sidebar's "AllCare" portfolio key. */
              onNavigateToCompany={(portcoName) => {
                const target = portcoName === 'AllCare + Curenta' ? 'AllCare' : portcoName;
                if (!DISPLAY_COMPANIES.includes(target)) return;
                setSelectedCompany(target);
                setActiveSection('overview');
                setExpenseDrilldown(null);
              }}
            />
          )}

          {activeSection === 'insights' && (() => {
            const { mom, qoq, alerts } = insightsResult;
            const TOP_N_MOM = 10;
            const TOP_N_QOQ = 10;
            const momChanges = mom?.changes ?? [];
            const qoqChanges = qoq?.changes ?? [];
            // Group MoM top changes by Consolidated vs per-company so the
            // CFO can read "what shifted at the portfolio level" first,
            // then drill into "and at which portco specifically".
            const momTop = momChanges.slice(0, TOP_N_MOM);
            const qoqTop = qoqChanges.slice(0, TOP_N_QOQ);

            return (<>
              <div className="mb-4">
                <h2 className="text-lg font-bold mb-1">Executive Insights &amp; Analysis</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  Ranked by magnitude of change. Each card shows what moved, by how much, and whether it&apos;s a good or bad direction for that metric.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />Positive change</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" />Watch</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />Adverse / large drop</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-semibold">Consolidated</span>=portfolio total</span>
                </div>
              </div>

              {/* High-priority alerts (cash runway, etc.) always at top */}
              {alerts.length > 0 && (
                <div className="mb-6">
                  {alerts.map((a, i) => (
                    <InsightCard key={i} type={a.type} icon={a.icon} title={a.title} body={a.body} />
                  ))}
                </div>
              )}

              {/* MoM section */}
              {mom && (
                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-sm font-bold text-foreground">
                      Month-over-Month
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {mom.current.label} vs {mom.prior.label}
                      </span>
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      Top {Math.min(momTop.length, TOP_N_MOM)} of {momChanges.length} ranked changes
                    </span>
                  </div>
                  {momTop.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No notable month-over-month changes detected.</p>
                  ) : (
                    momTop.map((rec, i) => (
                      <ChangeCard key={`mom-${i}`} rec={rec} rankBadge={i + 1} />
                    ))
                  )}
                </div>
              )}

              {/* QoQ section */}
              {qoq && (
                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-sm font-bold text-foreground">
                      Quarter-over-Quarter
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {qoq.current.label} (forecast-inclusive) vs {qoq.prior.label}
                      </span>
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      Top {Math.min(qoqTop.length, TOP_N_QOQ)} of {qoqChanges.length} ranked changes
                    </span>
                  </div>
                  {qoqTop.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No notable quarter-over-quarter changes detected.</p>
                  ) : (
                    qoqTop.map((rec, i) => (
                      <ChangeCard key={`qoq-${i}`} rec={rec} rankBadge={i + 1} />
                    ))
                  )}
                </div>
              )}

              {!mom && !qoq && alerts.length === 0 && (
                <p className="text-sm text-muted-foreground">No insights available — data may not have a last-actual month identified.</p>
              )}
            </>);
          })()}
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
