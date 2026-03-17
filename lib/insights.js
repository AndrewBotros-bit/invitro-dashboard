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
 * @returns {Insight[]}
 */
export function generateInsights(data) {
  const insights = [];
  const excludeSet = new Set(EXCLUDE_COMPANIES);

  const { pnl, cashflow } = data;

  if (pnl.length === 0 && cashflow.length === 0) {
    return [];
  }

  const currentYear = getMaxYear(pnl);
  const minYear = getMinYear(pnl);
  const hasMultipleYears = currentYear !== null && minYear !== null && currentYear > minYear;
  const priorYear = currentYear !== null ? currentYear - 1 : null;

  // Only run YoY insights if we have multiple years of data
  if (hasMultipleYears && currentYear !== null && priorYear !== null) {
    for (const company of pnl) {
      if (excludeSet.has(company.name)) continue;

      const currentRevenue = sumMetricForYear(company, 'Revenue', currentYear);
      const priorRevenue = sumMetricForYear(company, 'Revenue', priorYear);
      const currentEbitda = sumMetricForYear(company, 'EBITDA', currentYear);
      const priorEbitda = sumMetricForYear(company, 'EBITDA', priorYear);

      // Growth highlights
      if (priorRevenue > 0) {
        const growthPct = ((currentRevenue - priorRevenue) / priorRevenue) * 100;
        if (growthPct > 50) {
          insights.push({
            type: 'positive',
            icon: '\uD83D\uDCC8',
            title: `${company.name} revenue grew ${growthPct.toFixed(0)}% YoY`,
            body: `Revenue increased from ${fmt(priorRevenue)} to ${fmt(currentRevenue)}.`,
          });
        }
      } else if (priorRevenue === 0 && currentRevenue > 0) {
        insights.push({
          type: 'info',
          icon: '\uD83C\uDF31',
          title: `${company.name} started generating revenue`,
          body: `New revenue of ${fmt(currentRevenue)} in ${currentYear}.`,
        });
      }

      // Profitability milestones
      if (priorEbitda < 0 && currentEbitda >= 0) {
        insights.push({
          type: 'positive',
          icon: '\uD83C\uDFC6',
          title: `${company.name} reached EBITDA breakeven`,
          body: `EBITDA improved from ${fmt(priorEbitda)} to ${fmt(currentEbitda)}.`,
        });
      }

      // Risk flags: negative EBITDA despite >20% revenue growth
      if (currentEbitda < 0 && priorRevenue > 0) {
        const growthPct = ((currentRevenue - priorRevenue) / priorRevenue) * 100;
        if (growthPct > 20) {
          insights.push({
            type: 'warning',
            icon: '\u26A0\uFE0F',
            title: `${company.name} losses persist despite revenue growth`,
            body: `Revenue grew ${growthPct.toFixed(0)}% but EBITDA remains ${fmt(currentEbitda)}. Cost structure may need attention.`,
          });
        }
      }

      // Significant losses flag
      if (currentEbitda < -1000000) {
        insights.push({
          type: 'danger',
          icon: '\uD83D\uDD34',
          title: `${company.name} has significant losses`,
          body: `EBITDA of ${fmt(currentEbitda)} in ${currentYear} represents losses exceeding $1M.`,
        });
      }
    }
  }

  // Cash runway
  if (cashflow.length > 0) {
    let totalNetMovement = 0;
    let monthCount = 0;

    // Collect all distinct months and sum net cash flow
    const monthSet = new Set();
    for (const company of cashflow) {
      const netValues = company.metrics['Net Cash Flow'];
      if (!netValues) continue;
      for (const mv of netValues) {
        const key = `${mv.year}-${mv.month}`;
        if (!monthSet.has(key)) {
          monthSet.add(key);
        }
      }
    }
    monthCount = monthSet.size;

    // Sum all net cash flow values across all companies
    for (const company of cashflow) {
      const netValues = company.metrics['Net Cash Flow'];
      if (!netValues) continue;
      for (const mv of netValues) {
        totalNetMovement += mv.value ?? 0;
      }
    }

    // Ending balance = cumulative net movement (from start)
    const endingBalance = totalNetMovement;
    const avgMonthlyBurn = monthCount > 0 ? totalNetMovement / monthCount : 0;

    if (avgMonthlyBurn < 0) {
      const runwayMonths = endingBalance / Math.abs(avgMonthlyBurn);
      let type = 'info';
      if (runwayMonths < 6) type = 'danger';
      else if (runwayMonths < 12) type = 'warning';

      insights.push({
        type,
        icon: '\uD83D\uDCB0',
        title: `Cash runway: ~${runwayMonths.toFixed(0)} months`,
        body: `Ending cash balance of ${fmt(endingBalance)} with average monthly burn of ${fmt(avgMonthlyBurn)}.`,
      });
    } else if (avgMonthlyBurn >= 0 && monthCount > 0) {
      insights.push({
        type: 'info',
        icon: '\uD83D\uDCB0',
        title: 'Cash flow positive',
        body: `Average monthly net cash flow of ${fmt(avgMonthlyBurn)} across ${monthCount} months.`,
      });
    }
  }

  return insights;
}
