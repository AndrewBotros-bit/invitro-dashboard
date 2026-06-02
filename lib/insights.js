/**
 * Comparative insights engine.
 *
 * Generates rank-ordered "what changed" insights across two time horizons:
 *   - MoM: last actual month vs the month before
 *   - QoQ: this calendar quarter (forecast-inclusive) vs the prior quarter
 *
 * Each insight is scored on |pct change| × KPI weight × scope weight, then
 * ranked. The CFO sees the biggest movers first — revenue swings, EBITDA
 * deterioration, cash-flow surprises — without having to scan dozens of
 * line items by hand.
 *
 * @typedef {import('@/lib/data/types').DashboardData} DashboardData
 * @typedef {import('@/lib/data/types').CompanyPnL} CompanyPnL
 * @typedef {import('@/lib/data/types').CompanyCashflow} CompanyCashflow
 */

import { EXCLUDE_ALWAYS } from '@/lib/chartHelpers';
import { fmt } from '@/lib/formatters';

/**
 * @typedef {Object} ChangeRecord
 * @property {string} kpi - Display label of the KPI (e.g. "Revenue")
 * @property {string} scope - "Consolidated" or a company name
 * @property {number} current - value for current period
 * @property {number} prior - value for prior period
 * @property {number} absDelta - current - prior
 * @property {number|null} pctDelta - relative change (null when prior=0)
 * @property {boolean} improved - true if change is directionally good
 * @property {number} score - ranking score (higher = bigger story)
 * @property {boolean} isMargin - true for percentage-based KPIs
 * @property {'positive'|'warning'|'danger'|'info'} tone
 */

/**
 * KPI catalog. Each entry knows where to find its data, how to interpret
 * direction (up=good or down=good), and its narrative weight.
 *
 * `derived` KPIs are computed from other metrics rather than read directly
 * (Gross Margin = Gross Profit / Revenue, EBITDA Margin = EBITDA / Revenue).
 *
 * `cashflowMetric` is per-company specific: InVitro Studio uses
 * "Direct Operational Cash Flow"; everyone else uses "Operational Cash Flow"
 * (consolidated rollup rule established with the CFO).
 */
const KPIS = [
  // ── P&L line items
  { id: 'revenue',  label: 'Revenue',          source: 'pnl', metric: 'Revenues',              goodWhen: 'up',   weight: 1.0 },
  { id: 'gp',       label: 'Gross Profit',     source: 'pnl', metric: 'Gross Profit',          goodWhen: 'up',   weight: 0.9 },
  { id: 'opex',     label: 'SG&A + R&D Opex',  source: 'pnl', metric: 'SG&A + R&D Expenses',   goodWhen: 'down', weight: 0.7 },
  { id: 'ebitda',   label: 'EBITDA',           source: 'pnl', metric: 'EBITDA',                goodWhen: 'up',   weight: 1.0 },
  // ── Derived margins (ratios)
  { id: 'gm',       label: 'Gross Margin %',   source: 'derived', formula: 'gm', goodWhen: 'up', weight: 0.75, isMargin: true },
  { id: 'em',       label: 'EBITDA Margin %',  source: 'derived', formula: 'em', goodWhen: 'up', weight: 0.75, isMargin: true },
  // ── Cashflow
  { id: 'opcf',     label: 'Operating Cash Flow', source: 'cashflow', goodWhen: 'up', weight: 0.95 },
];

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Get the consolidated company set after excluding holdings/pseudo entries. */
function getConsolidatedCompanies(pnl) {
  return pnl
    .filter(c => !EXCLUDE_ALWAYS.includes(c.name))
    .map(c => c.name);
}

/** Sum a P&L metric for a (company, period). Returns 0 if no data. */
function sumPnlMetricRange(company, metric, from, to) {
  const values = company?.metrics?.[metric];
  if (!values) return 0;
  const f = from.year * 100 + from.month;
  const t = to.year * 100 + to.month;
  return values.reduce((s, mv) => {
    const k = mv.year * 100 + mv.month;
    return (k >= f && k <= t) ? s + (mv.value ?? 0) : s;
  }, 0);
}

/** Sum a cashflow metric for (company, period). */
function sumCashflowMetricRange(cfData, name, metric, from, to) {
  const co = cfData.find(c => c.name === name);
  return sumPnlMetricRange(co, metric, from, to);
}

/** Pick the right ops cash flow metric for a given company. */
function opsCashflowMetricFor(name) {
  return name === 'InVitro Studio' ? 'Direct Operational Cash Flow' : 'Operational Cash Flow';
}

/**
 * Compute a KPI value for a (scope, period). Scope is either a single
 * company name or null for consolidated.
 */
function computeKpi(kpi, scope, data, from, to) {
  const { pnl, cashflow } = data;
  const consolidatedCos = getConsolidatedCompanies(pnl);
  const names = scope === null ? consolidatedCos : [scope];

  if (kpi.source === 'pnl') {
    let total = 0;
    for (const name of names) {
      const co = pnl.find(c => c.name === name);
      if (co) total += sumPnlMetricRange(co, kpi.metric, from, to);
    }
    return total;
  }

  if (kpi.source === 'cashflow') {
    let total = 0;
    for (const name of names) {
      total += sumCashflowMetricRange(cashflow, name, opsCashflowMetricFor(name), from, to);
    }
    return total;
  }

  if (kpi.source === 'derived') {
    if (kpi.formula === 'gm') {
      const rev = computeKpi(KPIS.find(k => k.id === 'revenue'), scope, data, from, to);
      const gp = computeKpi(KPIS.find(k => k.id === 'gp'), scope, data, from, to);
      return rev > 0 ? gp / rev : null;
    }
    if (kpi.formula === 'em') {
      const rev = computeKpi(KPIS.find(k => k.id === 'revenue'), scope, data, from, to);
      const ebitda = computeKpi(KPIS.find(k => k.id === 'ebitda'), scope, data, from, to);
      return rev > 0 ? ebitda / rev : null;
    }
  }
  return null;
}

/**
 * Build a ChangeRecord for one (kpi, scope, currentPeriod, priorPeriod).
 * Returns null when the data is uninteresting (both periods zero/empty).
 */
function makeChange(kpi, scopeLabel, scope, data, currentPeriod, priorPeriod) {
  const current = computeKpi(kpi, scope, data, currentPeriod.from, currentPeriod.to);
  const prior = computeKpi(kpi, scope, data, priorPeriod.from, priorPeriod.to);
  if (current == null || prior == null) return null;
  if (Math.abs(current) < 0.01 && Math.abs(prior) < 0.01) return null;

  const absDelta = current - prior;
  // Percent change: standard signed ratio; null when prior is exactly 0
  // (avoids infinity; ranking uses an absolute fallback in that case).
  const pctDelta = Math.abs(prior) > 0.01 ? (current - prior) / Math.abs(prior) : null;
  const improved = kpi.goodWhen === 'up' ? absDelta > 0 : absDelta < 0;

  // Scoring:
  //   - When we have a clean pctDelta, score = |pct| × kpi.weight × scopeWeight
  //   - When prior is ~0, fall back to absolute magnitude (normalized) so
  //     a brand-new line item still surfaces if it's large enough.
  // Scope weight: consolidated changes outweigh per-company by 1.4× (bigger
  // signals for the CFO). Per-company changes still surface if large.
  const scopeWeight = scope === null ? 1.4 : 1.0;
  let score;
  if (pctDelta != null) {
    score = Math.min(Math.abs(pctDelta), 10) * (kpi.weight ?? 1) * scopeWeight;
  } else {
    score = Math.min(Math.abs(current) / 100_000, 5) * (kpi.weight ?? 1) * scopeWeight;
  }
  // Margins are bounded [−∞, 1] but typical swings are within ±0.5; amplify
  // absolute swing in absolute pp rather than relative pct to surface a
  // 5pp margin change as significant.
  if (kpi.isMargin) {
    score = Math.min(Math.abs(absDelta) * 10, 5) * (kpi.weight ?? 1) * scopeWeight;
  }

  const tone = (() => {
    if (Math.abs(absDelta) < 0.01) return 'info';
    if (improved) return 'positive';
    // Large adverse moves get danger; smaller adverse moves get warning
    if (pctDelta != null && Math.abs(pctDelta) > 0.3) return 'danger';
    if (kpi.isMargin && Math.abs(absDelta) > 0.1) return 'danger';
    return 'warning';
  })();

  return {
    kpi: kpi.label,
    kpiId: kpi.id,
    scope: scopeLabel,
    isConsolidated: scope === null,
    current, prior, absDelta, pctDelta,
    improved,
    score,
    isMargin: !!kpi.isMargin,
    tone,
  };
}

/**
 * Compute MoM period descriptors given the last actual month.
 * Handles year boundary (Jan 2026 prior → Dec 2025).
 */
function computeMoMPeriods(lastActual) {
  if (!lastActual) return null;
  const current = { from: { year: lastActual.year, month: lastActual.month },
                    to:   { year: lastActual.year, month: lastActual.month },
                    label: `${MONTHS[lastActual.month]} ${lastActual.year}` };
  const priorM = lastActual.month === 1 ? 12 : lastActual.month - 1;
  const priorY = lastActual.month === 1 ? lastActual.year - 1 : lastActual.year;
  const prior = { from: { year: priorY, month: priorM },
                  to:   { year: priorY, month: priorM },
                  label: `${MONTHS[priorM]} ${priorY}` };
  return { current, prior };
}

/** Compute QoQ period descriptors based on "today" / last actual month. */
function computeQoQPeriods(refMonth, refYear) {
  // Quarter the reference month falls in
  const q = Math.ceil(refMonth / 3); // 1..4
  const qStart = (q - 1) * 3 + 1;
  const qEnd = q * 3;
  const current = {
    from: { year: refYear, month: qStart },
    to:   { year: refYear, month: qEnd },
    label: `Q${q} ${refYear}`,
  };
  // Prior quarter
  const priorQ = q === 1 ? 4 : q - 1;
  const priorY = q === 1 ? refYear - 1 : refYear;
  const priorStart = (priorQ - 1) * 3 + 1;
  const priorEnd = priorQ * 3;
  const prior = {
    from: { year: priorY, month: priorStart },
    to:   { year: priorY, month: priorEnd },
    label: `Q${priorQ} ${priorY}`,
  };
  return { current, prior };
}

/**
 * Generate ranked comparative insights.
 *
 * @param {DashboardData} data
 * @param {string|null} selectedCompany - if set, scopes everything to one
 *   company (no consolidated rollup, no per-company comparisons except this one)
 * @returns {{
 *   mom: { current: object, prior: object, changes: ChangeRecord[] }|null,
 *   qoq: { current: object, prior: object, changes: ChangeRecord[] }|null,
 *   alerts: Array<{type:string,icon:string,title:string,body:string}>
 * }}
 */
export function generateInsights(data, selectedCompany = null) {
  const { pnl, cashflow, lastActualMonth } = data;
  if (!pnl || pnl.length === 0) return { mom: null, qoq: null, alerts: [] };

  // Scopes to evaluate. Consolidated + each portco gives the CFO both
  // a top-level signal AND per-company drilldown signals — the ranking
  // sorts them so the biggest story bubbles to the top regardless.
  const consolidatedCos = getConsolidatedCompanies(pnl);
  const scopes = selectedCompany
    ? [{ label: selectedCompany, value: selectedCompany }]
    : [
        { label: 'Consolidated', value: null },
        ...consolidatedCos.map(name => ({ label: name, value: name })),
      ];

  // Build MoM changes
  const momPeriods = computeMoMPeriods(lastActualMonth);
  /** @type {ChangeRecord[]} */
  const momChanges = [];
  if (momPeriods) {
    for (const scope of scopes) {
      for (const kpi of KPIS) {
        const ch = makeChange(kpi, scope.label, scope.value, data, momPeriods.current, momPeriods.prior);
        if (ch && ch.score > 0.05) momChanges.push(ch);
      }
    }
    momChanges.sort((a, b) => b.score - a.score);
  }

  // Build QoQ changes — anchored on lastActual or today, whichever is later
  // ('today' lets us see Q-in-progress vs last full Q early in the quarter)
  let qoqRefMonth, qoqRefYear;
  if (lastActualMonth) {
    qoqRefMonth = lastActualMonth.month;
    qoqRefYear = lastActualMonth.year;
  }
  const qoqPeriods = (qoqRefMonth && qoqRefYear) ? computeQoQPeriods(qoqRefMonth, qoqRefYear) : null;
  /** @type {ChangeRecord[]} */
  const qoqChanges = [];
  if (qoqPeriods) {
    for (const scope of scopes) {
      for (const kpi of KPIS) {
        const ch = makeChange(kpi, scope.label, scope.value, data, qoqPeriods.current, qoqPeriods.prior);
        if (ch && ch.score > 0.05) qoqChanges.push(ch);
      }
    }
    qoqChanges.sort((a, b) => b.score - a.score);
  }

  // Static alerts retained for items not naturally surfaced by ranking
  // (e.g. cash runway thresholds are absolute, not comparative).
  const alerts = [];
  if (!selectedCompany && data.cashRunwayRow && data.cashRunwayRow.length > 0) {
    const recent = data.cashRunwayRow
      .filter(v => v.value !== null && v.value !== 0)
      .slice(-3);
    if (recent.length > 0) {
      const avg = recent.reduce((s, v) => s + v.value, 0) / recent.length;
      let type = 'info';
      if (avg < 6) type = 'danger';
      else if (avg < 12) type = 'warning';
      alerts.push({
        type,
        icon: '💰',
        title: `Cash runway: ~${avg.toFixed(1)} months`,
        body: `Three-month average runway is ${avg.toFixed(1)} months. ${
          avg < 6 ? 'Critical — fundraise / cost-cut runway extension needed.' :
          avg < 12 ? 'Watchlist — under 1-year runway.' :
          'Healthy runway position.'
        }`,
      });
    }
  }

  return {
    mom: momPeriods ? { ...momPeriods, changes: momChanges } : null,
    qoq: qoqPeriods ? { ...qoqPeriods, changes: qoqChanges } : null,
    alerts,
  };
}
