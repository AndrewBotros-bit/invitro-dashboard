/**
 * Auto-generated insight cards from DashboardData patterns.
 *
 * @typedef {import('@/lib/data/types').DashboardData} DashboardData
 * @typedef {import('@/lib/data/types').CompanyPnL} CompanyPnL
 * @typedef {import('@/lib/data/types').CompanyCashflow} CompanyCashflow
 * @typedef {import('@/lib/data/types').MonthlyValue} MonthlyValue
 */

import { fmt } from '@/lib/formatters';
import { EXCLUDE_COMPANIES } from '@/lib/chartHelpers';

/**
 * @typedef {Object} Insight
 * @property {'positive'|'warning'|'danger'|'info'} type
 * @property {string} icon
 * @property {string} title
 * @property {string} body
 */

/**
 * Sum a metric's values for a given year for a single company.
 * @param {CompanyPnL} company
 * @param {string} metricName
 * @param {number} year
 * @returns {number}
 */
function sumMetricForYear(company, metricName, year) {
  const values = company.metrics[metricName];
  if (!values) return 0;
  return values.reduce((sum, mv) => {
    if (mv.year === year) return sum + (mv.value ?? 0);
    return sum;
  }, 0);
}

/**
 * Sum a metric's values within a date range for a single company.
 * @param {CompanyPnL} company
 * @param {string} metricName
 * @param {{year: number, month: number}} from
 * @param {{year: number, month: number}} to
 * @returns {number}
 */
function sumMetricForRange(company, metricName, from, to) {
  const values = company.metrics[metricName];
  if (!values) return 0;
  const fromVal = from.year * 100 + from.month;
  const toVal = to.year * 100 + to.month;
  return values.reduce((sum, mv) => {
    const pv = mv.year * 100 + mv.month;
    if (pv >= fromVal && pv <= toVal) return sum + (mv.value ?? 0);
    return sum;
  }, 0);
}

/**
 * Determine the max year present across all pnl data.
 * @param {CompanyPnL[]} pnl
 * @returns {number|null}
 */
function getMaxYear(pnl) {
  let maxYear = null;
  for (const company of pnl) {
    for (const metricValues of Object.values(company.metrics)) {
      for (const mv of metricValues) {
        if (maxYear === null || mv.year > maxYear) {
          maxYear = mv.year;
        }
      }
    }
  }
  return maxYear;
}

/**
 * Determine the min year present across all pnl data.
 * @param {CompanyPnL[]} pnl
 * @returns {number|null}
 */
function getMinYear(pnl) {
  let minYear = null;
  for (const company of pnl) {
    for (const metricValues of Object.values(company.metrics)) {
      for (const mv of metricValues) {
        if (minYear === null || mv.year < minYear) {
          minYear = mv.year;
        }
      }
    }
  }
  return minYear;
}

/**
 * Generate dynamic insight cards from DashboardData patterns.
 * @param {DashboardData} data
 * @param {{year: number, month: number}} [rangeFrom] - optional range start
 * @param {{year: number, month: number}} [rangeTo] - optional range end
 * @returns {Insight[]}
 */
export function generateInsights(data, rangeFrom, rangeTo, selectedCompany = null) {
  const insights = [];
  const excludeSet = selectedCompany
    ? new Set(data.pnl.map(c => c.name).filter(n => n !== selectedCompany))
    : new Set(EXCLUDE_COMPANIES);

  const { pnl, cashflow } = data;

  if (pnl.length === 0 && cashflow.length === 0) {
    return [];
  }

  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Build a human-readable period label from the range
  let periodLabel = 'the selected period';
  if (rangeFrom && rangeTo) {
    if (rangeFrom.year === rangeTo.year && rangeFrom.month === rangeTo.month) {
      periodLabel = `${MONTHS[rangeFrom.month]} ${rangeFrom.year}`;
    } else if (rangeFrom.year === rangeTo.year && rangeFrom.month === 1 && rangeTo.month === 12) {
      periodLabel = String(rangeFrom.year);
    } else {
      periodLabel = `${MONTHS[rangeFrom.month]} ${rangeFrom.year}–${MONTHS[rangeTo.month]} ${rangeTo.year}`;
    }
  }

  const fromVal = rangeFrom ? rangeFrom.year * 100 + rangeFrom.month : 0;
  const toVal = rangeTo ? rangeTo.year * 100 + rangeTo.month : 999999;
  const inRange = (mv) => {
    const pv = mv.year * 100 + mv.month;
    return pv >= fromVal && pv <= toVal;
  };

  for (const company of pnl) {
    if (excludeSet.has(company.name)) continue;

    const revenue = sumMetricForRange(company, 'Revenues', rangeFrom || { year: 0, month: 1 }, rangeTo || { year: 9999, month: 12 });
    const ebitda = sumMetricForRange(company, 'EBITDA', rangeFrom || { year: 0, month: 1 }, rangeTo || { year: 9999, month: 12 });
    const grossProfit = sumMetricForRange(company, 'Gross Profit', rangeFrom || { year: 0, month: 1 }, rangeTo || { year: 9999, month: 12 });
    const grossMargin = revenue > 0 ? grossProfit / revenue : null;

    // Revenue highlights
    if (revenue > 0) {
      // Top earner flag (>$5M in range)
      if (revenue > 5000000) {
        insights.push({
          type: 'positive',
          icon: '\uD83D\uDCC8',
          title: `${company.name} is a top revenue driver`,
          body: `Generated ${fmt(revenue)} in ${periodLabel}.`,
        });
      }
    } else if (revenue === 0) {
      insights.push({
        type: 'info',
        icon: '\uD83C\uDF31',
        title: `${company.name} has no revenue in this period`,
        body: `No revenue recorded for ${periodLabel}.`,
      });
    }

    // Profitability
    if (ebitda >= 0 && revenue > 0) {
      const margin = (ebitda / revenue * 100);
      if (margin > 20) {
        insights.push({
          type: 'positive',
          icon: '\uD83C\uDFC6',
          title: `${company.name} is highly profitable`,
          body: `EBITDA margin of ${margin.toFixed(0)}% (${fmt(ebitda)}) in ${periodLabel}.`,
        });
      }
    }

    // Risk flags: negative EBITDA
    if (ebitda < 0 && revenue > 0) {
      insights.push({
        type: 'warning',
        icon: '\u26A0\uFE0F',
        title: `${company.name} is operating at a loss`,
        body: `EBITDA of ${fmt(ebitda)} despite ${fmt(revenue)} revenue in ${periodLabel}.`,
      });
    }

    // Significant losses flag
    if (ebitda < -1000000) {
      insights.push({
        type: 'danger',
        icon: '\uD83D\uDD34',
        title: `${company.name} has significant losses`,
        body: `EBITDA of ${fmt(ebitda)} in ${periodLabel} — losses exceeding $1M.`,
      });
    }

    // Low gross margin warning
    if (grossMargin !== null && grossMargin < 0.4 && grossMargin > 0 && revenue > 100000) {
      insights.push({
        type: 'warning',
        icon: '\uD83D\uDCCA',
        title: `${company.name} has thin gross margins`,
        body: `Gross margin of ${(grossMargin * 100).toFixed(0)}% in ${periodLabel} — below 40% threshold.`,
      });
    }
  }

  // Cash runway from sheet row 180 (consolidated only)
  const cashRunwayValues = !selectedCompany ? (data.cashRunwayRow ?? []).filter(inRange) : [];
  if (cashRunwayValues.length > 0) {
    const avgRunway = cashRunwayValues.reduce((s, v) => s + (v.value ?? 0), 0) / cashRunwayValues.length;
    let type = 'info';
    if (avgRunway < 6) type = 'danger';
    else if (avgRunway < 12) type = 'warning';

    insights.push({
      type,
      icon: '\uD83D\uDCB0',
      title: `Cash runway: ~${avgRunway.toFixed(0)} months`,
      body: `Average runway of ${avgRunway.toFixed(1)} months across ${periodLabel}.`,
    });
  }

  return insights;
}
