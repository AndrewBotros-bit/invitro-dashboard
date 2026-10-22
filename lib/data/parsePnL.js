/**
 * P&L tab parser with dynamic company discovery.
 * Discovers companies and metrics from row structure, not hardcoded names.
 * Finds month columns by header name, not column index.
 *
 * @typedef {import('./types').MonthlyValue} MonthlyValue
 * @typedef {import('./types').CompanyPnL} CompanyPnL
 * @typedef {import('./types').MonthColumn} MonthColumn
 */

/**
 * Coerce a cell value to a number or null.
 * @param {any} val - Raw cell value from Sheets API
 * @returns {number|null}
 */
function toNumberOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  // String cleanup: handle accounting parentheses as negation.
  // "(185,965)" / " ( 185,965 ) " → -185965 (accounting convention).
  // Then strip commas, $, and surrounding whitespace before Number()
  // parse. Bare "-185,965" still parses correctly via the comma strip.
  let s = String(val).trim();
  let negate = false;
  if (/^\(.*\)$/.test(s)) {
    negate = true;
    s = s.slice(1, -1).trim();
  }
  // Percentages arrive formatted ("38%", "-6927%") because the P&L tabs are
  // fetched as FORMATTED_VALUE. Number("38%") is NaN, so every margin row in
  // the sheet silently parsed to null and the metric was unusable. Return
  // the fraction, matching how the same cell reads unformatted (0.38).
  //
  // Strictly additive: before this, any value carrying a % became null, so
  // the only values this can change are ones that used to be missing.
  const isPercent = s.endsWith('%');
  const clean = (isPercent ? s.slice(0, -1) : s).replace(/[,$\s]/g, '');
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  const scaled = isPercent ? n / 100 : n;
  return negate ? -scaled : scaled;
}

const MONTH_NAMES = {
  'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
  'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
};

const MONTH_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/;

/**
 * Detects month columns from a header row by matching "Mon YYYY" patterns.
 * Filters to year >= 2025 only.
 * @param {any[]} headerRow
 * @returns {MonthColumn[]}
 */
export function detectMonthColumns(headerRow) {
  if (!headerRow || headerRow.length === 0) return [];

  /** @type {MonthColumn[]} */
  const columns = [];

  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (typeof cell !== 'string') continue;

    const match = cell.match(MONTH_PATTERN);
    if (!match) continue;

    const month = MONTH_NAMES[match[1]];
    const year = parseInt(match[2], 10);

    if (year >= 2025) {
      columns.push({ index: i, year, month });
    }
  }

  // Sort chronologically
  columns.sort((a, b) => a.year - b.year || a.month - b.month);
  return columns;
}

/**
 * Parses P&L tab rows into structured CompanyPnL objects.
 * Discovers companies from column B (index 1) where column C (index 2) is empty.
 * Collects metrics from column C within each company block.
 * @param {any[][]} rows - Raw 2D array from Sheets API
 * @returns {CompanyPnL[]}
 */
export function parsePnL(rows) {
  if (!rows || rows.length === 0) return [];

  const monthColumns = detectMonthColumns(rows[0]);
  if (monthColumns.length === 0) return [];

  /** @type {CompanyPnL[]} */
  const companies = [];
  /** @type {CompanyPnL|null} */
  let currentCompany = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip blank rows
    if (!row || row.length === 0) {
      continue;
    }

    const colB = row[1];
    const colC = row[2];

    // New company: column B is non-empty (may appear on same row as first metric)
    if (colB && String(colB).trim()) {
      currentCompany = { name: String(colB).trim(), metrics: {} };
      companies.push(currentCompany);
    }

    // Metric row: column C has value and we're inside a company block
    if (colC && currentCompany) {
      const metricName = String(colC).trim();
      /** @type {MonthlyValue[]} */
      const values = monthColumns.map(col => ({
        year: col.year,
        month: col.month,
        value: toNumberOrNull(row[col.index]),
      }));
      currentCompany.metrics[metricName] = values;
    }
  }

  deriveNetRevenue(companies);
  return companies;
}

/** Margin row labels seen in the sheet. "Gorss" is the sheet's own typo. */
const MARGIN_METRIC_KEYS = ['Gorss Margin, %', 'Gross Margin, %'];

/**
 * Metric name for the revenue base implied by the sheet's own margin row.
 * @see deriveNetRevenue
 */
export const DERIVED_NET_REVENUE = 'Net Revenue (derived)';

/**
 * Recover the revenue base the CFO actually divided by.
 *
 * AllCare's margin is struck against NET revenue — gross revenue less
 * payer adjustments — and that net figure appears nowhere in the P&L tab.
 * Only the result does. So dividing the sheet's Gross Profit by the
 * sheet's Revenues reproduces a different number: 31.7% against a stated
 * 38% for Nov-25, and 2-6pp adrift across recent months.
 *
 * Gross Profit and the margin are both present, so the base is simply
 * GP / margin. Deriving it lets a quarter or a year aggregate the way any
 * other revenue line does — sum the parts, then divide — instead of
 * averaging percentages, which would be wrong whenever the months carry
 * different weight.
 *
 * Only companies whose margin genuinely disagrees with GP / Revenues need
 * this; for AllRx the two agree to the cent across all 65 months, so the
 * derived base equals the stated one and nothing changes.
 *
 * Note the sheet rounds the margin to whole percentage points (0.38, not
 * 0.3842), so the recovered base carries up to ~1% of rounding error. It
 * is exact at monthly granularity — GP / (GP / m) collapses back to m —
 * and approximate once aggregated. Publishing a Net Revenues row in the
 * sheet would remove that caveat entirely.
 */
function deriveNetRevenue(companies) {
  for (const company of companies) {
    const gp = company.metrics['Gross Profit'];
    const marginKey = MARGIN_METRIC_KEYS.find(k => company.metrics[k]);
    if (!gp || !marginKey) continue;
    const margin = company.metrics[marginKey];

    company.metrics[DERIVED_NET_REVENUE] = gp.map((point, i) => {
      const m = margin[i]?.value;
      const g = point.value;
      // A zero or absent margin cannot imply a base; leave the month null
      // so it drops out of a sum rather than poisoning it with Infinity.
      const value = (g != null && m != null && m !== 0) ? g / m : null;
      return { year: point.year, month: point.month, value };
    });
  }
}
