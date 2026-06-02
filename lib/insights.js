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
function makeChange(kpi, scopeLabel, scope, data, currentPeriod, priorPeriod, periodKey) {
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
    periodKey,            // 'mom' or 'qoq' — used for sibling lookup
    current, prior, absDelta, pctDelta,
    improved,
    score,
    isMargin: !!kpi.isMargin,
    tone,
    narrative: '',        // filled in by annotateNarratives after all records built
  };
}

/**
 * Compose an interpretive narrative for a single ChangeRecord.
 *
 * Uses sibling KPIs in the same (scope, periodKey) bucket to give richer
 * context — e.g. when EBITDA drops, the narrative checks whether Revenue
 * also dropped (topline story) or stayed flat (margin story).
 *
 * Style guide for narratives:
 *   - Lead with what happened, in CFO vocabulary.
 *   - When relevant, point to the *driver* (which sibling KPI moved with it).
 *   - End with the implication or what to watch for.
 *   - Avoid restating numbers already visible in the card header.
 */
function buildNarrative(rec, getSibling) {
  const { kpiId, current, prior, absDelta, pctDelta, improved, isMargin } = rec;
  const sign = absDelta >= 0 ? 'up' : 'down';
  const absMag = Math.abs(absDelta);
  const pctMag = pctDelta != null ? Math.abs(pctDelta * 100) : null;

  // Magnitude descriptor (used in prose only, not redundant w/ the
  // headline number)
  const magnitude = (() => {
    if (pctMag == null) return 'first appearance';
    if (pctMag > 50) return 'a major swing';
    if (pctMag > 25) return 'a notable shift';
    if (pctMag > 10) return 'a meaningful change';
    return 'a modest move';
  })();

  // Helpers
  const rev = getSibling('revenue');
  const ebitda = getSibling('ebitda');
  const opex = getSibling('opex');
  const gp = getSibling('gp');
  const opcf = getSibling('opcf');
  const ppStr = (pp) => `${Math.abs(pp).toFixed(1)} pp`;

  switch (kpiId) {
    case 'revenue': {
      if (sign === 'up') {
        // If EBITDA also moved, frame it as flow-through
        if (ebitda && ebitda.absDelta > 0) {
          return `Topline growth (${magnitude}) flowing to the bottom line — EBITDA also improved this period. Healthy operating leverage.`;
        }
        if (ebitda && ebitda.absDelta < 0) {
          return `Topline grew but EBITDA fell — operating costs outpaced revenue. Check whether the cost build is investment (R&D, GTM scaling) or efficiency drift.`;
        }
        return `Topline growth (${magnitude}). Watch for downstream EBITDA impact once costs settle.`;
      }
      // Down
      if (ebitda && ebitda.absDelta < 0) {
        return `Topline contraction (${magnitude}) dragging EBITDA with it. Investigate root cause: customer churn, pricing, or seasonality.`;
      }
      return `Topline contraction (${magnitude}). If costs are sticky, expect margin compression next period.`;
    }

    case 'gp': {
      if (sign === 'up') {
        if (rev && rev.absDelta > 0 && pctMag != null && rev.pctDelta != null && pctMag > Math.abs(rev.pctDelta * 100) + 2) {
          return `Gross profit outpaced revenue — gross-margin tailwind on top of volume.`;
        }
        return `Gross profit improving — combination of higher volume and/or better unit economics.`;
      }
      if (rev && rev.absDelta < 0) {
        return `Gross profit down with revenue. Margin direction is the key question — check Gross Margin % below.`;
      }
      return `Gross profit eroded despite stable revenue — points to COGS pressure or product mix shift.`;
    }

    case 'opex': {
      if (sign === 'up') {
        if (rev && rev.absDelta > 0 && pctMag != null && rev.pctDelta != null && pctMag < Math.abs(rev.pctDelta * 100)) {
          return `Opex growing slower than revenue — operating leverage working in your favor.`;
        }
        if (rev && rev.absDelta < 0) {
          return `Opex up while revenue down — fastest path to margin compression. Watch closely.`;
        }
        return `SG&A + R&D building. Verify the investment thesis (talent ramp, GTM scaling) vs unmanaged drift.`;
      }
      return `Cost discipline showing up — opex down. If revenue is stable or growing, this lands directly in EBITDA next period.`;
    }

    case 'ebitda': {
      if (sign === 'up') {
        if (rev && rev.absDelta < 0) {
          return `EBITDA improved despite softer revenue — cost discipline and/or margin expansion driving it. Sustainable if operating efficiency holds.`;
        }
        if (rev && rev.absDelta > 0) {
          return `EBITDA improvement coming alongside revenue growth — operating leverage as expected. Best-quality earnings improvement.`;
        }
        return `Operating profit improvement (${magnitude}). Source likely cost-side given flat revenue.`;
      }
      // Down
      if (rev && rev.absDelta > 0) {
        return `EBITDA dropped even as revenue grew — margin compression, not topline. Most likely culprit is opex (see SG&A + R&D row); could also be COGS — check Gross Margin %.`;
      }
      if (rev && rev.absDelta < 0) {
        return `EBITDA fell with revenue — operating leverage in reverse. The topline contraction is amplifying through fixed cost absorption.`;
      }
      if (opex && opex.absDelta > 0) {
        return `EBITDA down driven by opex build despite stable revenue. Verify spend is intentional growth investment vs unmanaged.`;
      }
      return `Operating profit deteriorated (${magnitude}). Cross-check revenue and opex rows to localize the driver.`;
    }

    case 'gm': {
      if (sign === 'up') {
        return `Gross margin expanded by ${ppStr(absDelta * 100)} — pricing power, lower COGS, or favorable product mix shift.`;
      }
      return `Gross margin compressed by ${ppStr(absDelta * 100)} — pricing pressure, COGS inflation, or unfavorable mix. Each pp of GM on this revenue base is meaningful $.`;
    }

    case 'em': {
      if (sign === 'up') {
        return `EBITDA margin expanded by ${ppStr(absDelta * 100)}. Operating efficiency improving — costs growing slower than revenue.`;
      }
      return `EBITDA margin compressed by ${ppStr(absDelta * 100)}. Costs outgrowing revenue — verify whether investment-led (planned) or drift.`;
    }

    case 'opcf': {
      if (sign === 'up') {
        if (ebitda && ebitda.absDelta > 0) {
          return `Operating cash generation up alongside EBITDA — quality earnings converting to cash. Builds runway and reduces financing pressure.`;
        }
        return `Cash generation improving — could be operating gains or working-capital tailwind. Verify with Net Cash Flow trend.`;
      }
      if (ebitda && ebitda.absDelta > 0) {
        return `Cash flow declined while EBITDA improved — likely working-capital absorption (receivables building, inventory build, or supplier timing).`;
      }
      return `Cash burn accelerating — reduces runway. Cross-check with monthly cash-burn chart and runway widget.`;
    }

    default:
      return '';
  }
}

/**
 * Annotate a list of ChangeRecords with cross-referenced narratives.
 * Groups records by (scope, periodKey) so each record's narrative can
 * reference siblings in the same group.
 */
function annotateNarratives(records) {
  const groupKey = (r) => `${r.scope}::${r.periodKey}`;
  const groups = new Map();
  for (const r of records) {
    const k = groupKey(r);
    if (!groups.has(k)) groups.set(k, new Map());
    groups.get(k).set(r.kpiId, r);
  }
  for (const r of records) {
    const g = groups.get(groupKey(r));
    const getSibling = (kpiId) => g.get(kpiId) || null;
    r.narrative = buildNarrative(r, getSibling);
  }
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

  // Build MoM changes. Note: we run makeChange for ALL KPIs first
  // (including low-score ones), THEN annotate narratives so siblings
  // are always available for cross-reference. Filtering by score
  // happens after annotation.
  const momPeriods = computeMoMPeriods(lastActualMonth);
  /** @type {ChangeRecord[]} */
  let momChanges = [];
  if (momPeriods) {
    for (const scope of scopes) {
      for (const kpi of KPIS) {
        const ch = makeChange(kpi, scope.label, scope.value, data, momPeriods.current, momPeriods.prior, 'mom');
        if (ch) momChanges.push(ch);
      }
    }
    annotateNarratives(momChanges);
    momChanges = momChanges.filter(c => c.score > 0.05);
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
  let qoqChanges = [];
  if (qoqPeriods) {
    for (const scope of scopes) {
      for (const kpi of KPIS) {
        const ch = makeChange(kpi, scope.label, scope.value, data, qoqPeriods.current, qoqPeriods.prior, 'qoq');
        if (ch) qoqChanges.push(ch);
      }
    }
    annotateNarratives(qoqChanges);
    qoqChanges = qoqChanges.filter(c => c.score > 0.05);
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
