/**
 * Chart helper utilities for transforming DashboardData into Recharts-compatible structures.
 *
 * @typedef {import('@/lib/data/types').CompanyPnL} CompanyPnL
 * @typedef {import('@/lib/data/types').CompanyCashflow} CompanyCashflow
 * @typedef {import('@/lib/data/types').MonthlyValue} MonthlyValue
 * @typedef {import('@/lib/data/types').DashboardData} DashboardData
 */

/** Fixed color palette -- 12 visually distinct colors for dark theme */
export const PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#eab308', // yellow
];

/** Holding/parent entities excluded from revenue and portfolio breakdown charts */
export const EXCLUDE_COMPANIES = ['InVitro Holding', 'InVitro Studio', 'AllRX Holding'];

/**
 * Assign deterministic colors to companies sorted alphabetically.
 * @param {string[]} companies
 * @returns {Object<string, string>}
 */
export function buildColorMap(companies) {
  const sorted = [...companies].sort();
  const map = {};
  for (let i = 0; i < sorted.length; i++) {
    map[sorted[i]] = PALETTE[i % PALETTE.length];
  }
  return map;
}

/**
 * Format month/year into short label like "Jan 25".
 * @param {number} month - 1-12
 * @param {number} year
 * @returns {string}
 */
export function shortMonthLabel(month, year) {
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
  return `${monthName} ${String(year).slice(-2)}`;
}

/**
 * Transform CompanyPnL[] into Recharts-compatible flat array for a given metric.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName
 * @param {string[]} [excludeCompanies=[]]
 * @returns {Array<{month: string, [companyName: string]: number|null}>}
 */
export function buildMonthlySeries(pnlData, metricName, excludeCompanies = []) {
  const excludeSet = new Set(excludeCompanies);
  const companies = pnlData.filter((c) => !excludeSet.has(c.name));

  if (companies.length === 0) return [];

  // Get all unique month/year pairs from the first company's metric
  const firstCompanyMetric = companies[0].metrics[metricName];
  if (!firstCompanyMetric) return [];

  return firstCompanyMetric.map((mv) => {
    const entry = { month: shortMonthLabel(mv.month, mv.year) };
    for (const company of companies) {
      const metricValues = company.metrics[metricName];
      if (!metricValues) {
        entry[company.name] = null;
        continue;
      }
      const match = metricValues.find((v) => v.year === mv.year && v.month === mv.month);
      entry[company.name] = match?.value ?? null;
    }
    return entry;
  });
}

/**
 * Transform CompanyCashflow[] into aggregated cashflow series.
 * @param {CompanyCashflow[]} cashflowData
 * @returns {Array<{month: string, inflow: number, outflow: number, balance: number}>}
 */
export function buildCashflowSeries(cashflowData) {
  if (cashflowData.length === 0) return [];

  // Get month/year pairs from first company's 'Cash Inflow' metric
  const firstMetric = cashflowData[0].metrics['Cash Inflow'];
  if (!firstMetric) return [];

  let cumulativeBalance = 0;

  return firstMetric.map((mv) => {
    let inflow = 0;
    let outflow = 0;
    let netCashFlow = 0;

    for (const company of cashflowData) {
      const inflowValues = company.metrics['Cash Inflow'];
      const outflowValues = company.metrics['Cash Outflow'];
      const netValues = company.metrics['Net Cash Flow'];

      const inflowMatch = inflowValues?.find((v) => v.year === mv.year && v.month === mv.month);
      const outflowMatch = outflowValues?.find((v) => v.year === mv.year && v.month === mv.month);
      const netMatch = netValues?.find((v) => v.year === mv.year && v.month === mv.month);

      inflow += inflowMatch?.value ?? 0;
      outflow += outflowMatch?.value ?? 0;
      netCashFlow += netMatch?.value ?? 0;
    }

    cumulativeBalance += netCashFlow;

    return {
      month: shortMonthLabel(mv.month, mv.year),
      inflow,
      outflow: Math.abs(outflow),
      balance: cumulativeBalance,
    };
  });
}

/**
 * Compute yearly sum for a metric across non-excluded companies.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName
 * @param {number} year
 * @param {string[]} [excludeCompanies=[]]
 * @returns {number}
 */
export function annualTotal(pnlData, metricName, year, excludeCompanies = []) {
  const excludeSet = new Set(excludeCompanies);
  let total = 0;

  for (const company of pnlData) {
    if (excludeSet.has(company.name)) continue;
    const metricValues = company.metrics[metricName];
    if (!metricValues) continue;

    for (const mv of metricValues) {
      if (mv.year === year) {
        total += mv.value ?? 0;
      }
    }
  }

  return total;
}

/**
 * Return the last non-null MonthlyValue for a metric and company.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName
 * @param {string} companyName
 * @returns {MonthlyValue|null}
 */
export function latestMonthValue(pnlData, metricName, companyName) {
  const company = pnlData.find((c) => c.name === companyName);
  if (!company) return null;

  const metricValues = company.metrics[metricName];
  if (!metricValues || metricValues.length === 0) return null;

  // Walk backwards to find last non-null value
  for (let i = metricValues.length - 1; i >= 0; i--) {
    if (metricValues[i].value !== null) {
      return metricValues[i];
    }
  }

  return null;
}
