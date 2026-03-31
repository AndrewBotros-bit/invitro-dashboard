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

/** Always-hidden companies (holdings, inactive, etc.) */
export const EXCLUDE_ALWAYS = ['InVitro Holding', 'AllRX Holding', 'Confider', 'Yalent', 'Curenta', 'ALL Holdings', 'Add hocks'];

/** Excluded from revenue reports (EXCLUDE_ALWAYS + InVitro Studio) */
export const EXCLUDE_REVENUE = [...EXCLUDE_ALWAYS, 'InVitro Studio'];

/** Excluded from EBITDA/cashflow reports (InVitro Studio is included) */
export const EXCLUDE_EBITDA = [...EXCLUDE_ALWAYS];

/** @deprecated Use EXCLUDE_REVENUE or EXCLUDE_EBITDA instead */
export const EXCLUDE_COMPANIES = EXCLUDE_REVENUE;

/** Fixed brand colors per company */
const COMPANY_COLORS = {
  'Osta': '#F7941D',
  'AllCare': '#00A651',
  'AllRx': '#00AEEF',
  'InVitro Studio': '#003087',
  'Needles': '#ef4444',
};

/**
 * Assign colors to companies — uses brand colors first, then palette fallback.
 * @param {string[]} companies
 * @returns {Object<string, string>}
 */
export function buildColorMap(companies) {
  const sorted = [...companies].sort();
  const map = {};
  let paletteIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (COMPANY_COLORS[sorted[i]]) {
      map[sorted[i]] = COMPANY_COLORS[sorted[i]];
    } else {
      map[sorted[i]] = PALETTE[paletteIdx % PALETTE.length];
      paletteIdx++;
    }
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
export function buildMonthlySeries(pnlData, metricName, excludeCompanies = [], filterYear = null) {
  const excludeSet = new Set(excludeCompanies);
  const companies = pnlData.filter((c) => !excludeSet.has(c.name));

  if (companies.length === 0) return [];

  // Get all unique month/year pairs from the first company's metric
  let firstCompanyMetric = companies[0].metrics[metricName];
  if (!firstCompanyMetric) return [];

  // Filter to specific year if provided
  if (filterYear) {
    firstCompanyMetric = firstCompanyMetric.filter(mv => mv.year === filterYear);
  }

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
export function buildCashflowSeries(cashflowData, filterYear = null) {
  if (cashflowData.length === 0) return [];

  // Get month/year pairs from first company's 'Cash Inflow' metric
  let firstMetric = cashflowData[0].metrics['Cash Inflow'];
  if (!firstMetric) return [];

  // Filter to specific year if provided
  if (filterYear) {
    firstMetric = firstMetric.filter(mv => mv.year === filterYear);
  }

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
 * Compute total for a single month across non-excluded companies.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName
 * @param {number} year
 * @param {number} month - 1-12
 * @param {string[]} [excludeCompanies=[]]
 * @returns {number}
 */
export function monthlyTotal(pnlData, metricName, year, month, excludeCompanies = []) {
  const excludeSet = new Set(excludeCompanies);
  let total = 0;

  for (const company of pnlData) {
    if (excludeSet.has(company.name)) continue;
    const metricValues = company.metrics[metricName];
    if (!metricValues) continue;

    const mv = metricValues.find(v => v.year === year && v.month === month);
    if (mv) total += mv.value ?? 0;
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

/**
 * Extract all available month/year pairs from P&L data, sorted chronologically.
 * @param {CompanyPnL[]} pnlData
 * @returns {Array<{label: string, year: number, month: number, key: string}>}
 */
export function getAvailableMonths(pnlData) {
  const seen = new Set();
  const result = [];

  for (const company of pnlData) {
    for (const metricValues of Object.values(company.metrics)) {
      if (!Array.isArray(metricValues)) continue;
      for (const mv of metricValues) {
        const key = `${mv.year}-${mv.month}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            label: shortMonthLabel(mv.month, mv.year),
            year: mv.year,
            month: mv.month,
            key,
          });
        }
      }
    }
  }

  return result.sort((a, b) => a.year - b.year || a.month - b.month);
}

/**
 * Filter a monthly series array to only include entries within [from, to] range.
 * @param {Array<{month: string}>} series - Output of buildMonthlySeries
 * @param {{year: number, month: number}} from
 * @param {{year: number, month: number}} to
 * @param {Array<{label: string, year: number, month: number}>} availableMonths - reference for label→date mapping
 * @returns {Array<{month: string}>}
 */
export function filterSeriesToRange(series, from, to, availableMonths) {
  const labelToDate = {};
  for (const m of availableMonths) {
    labelToDate[m.label] = { year: m.year, month: m.month };
  }

  return series.filter(point => {
    const d = labelToDate[point.month];
    if (!d) return false;
    const fromVal = from.year * 100 + from.month;
    const toVal = to.year * 100 + to.month;
    const pointVal = d.year * 100 + d.month;
    return pointVal >= fromVal && pointVal <= toVal;
  });
}

/**
 * Build yearly aggregated series from P&L data.
 * Returns one entry per year with totals per company.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName
 * @param {string[]} excludeCompanies
 * @returns {Array<{year: string, [companyName: string]: number}>}
 */
export function buildYearlySeries(pnlData, metricName, excludeCompanies = [], fromYear = null, toYear = null) {
  const excludeSet = new Set(excludeCompanies);
  const companies = pnlData.filter(c => !excludeSet.has(c.name));
  if (companies.length === 0) return [];

  // Collect all years
  const yearsSet = new Set();
  for (const company of companies) {
    const vals = company.metrics[metricName];
    if (!vals) continue;
    for (const mv of vals) yearsSet.add(mv.year);
  }
  const years = [...yearsSet].sort().filter(y =>
    (fromYear === null || y >= fromYear) && (toYear === null || y <= toYear)
  );

  return years.map(year => {
    const entry = { month: String(year) };
    for (const company of companies) {
      const vals = (company.metrics[metricName] ?? []).filter(v => v.year === year);
      entry[company.name] = vals.reduce((s, v) => s + (v.value ?? 0), 0);
    }
    return entry;
  });
}

/**
 * Compute total for a metric across a date range (inclusive) for non-excluded companies.
 * @param {CompanyPnL[]} pnlData
 * @param {string} metricName
 * @param {{year: number, month: number}} from
 * @param {{year: number, month: number}} to
 * @param {string[]} excludeCompanies
 * @returns {number}
 */
export function rangeTotal(pnlData, metricName, from, to, excludeCompanies = []) {
  const excludeSet = new Set(excludeCompanies);
  const fromVal = from.year * 100 + from.month;
  const toVal = to.year * 100 + to.month;
  let total = 0;

  for (const company of pnlData) {
    if (excludeSet.has(company.name)) continue;
    const metricValues = company.metrics[metricName];
    if (!metricValues) continue;
    for (const mv of metricValues) {
      const pointVal = mv.year * 100 + mv.month;
      if (pointVal >= fromVal && pointVal <= toVal) {
        total += mv.value ?? 0;
      }
    }
  }
  return total;
}
