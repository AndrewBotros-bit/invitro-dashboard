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
      // First occurrence wins. A company block can restate the same metric
      // further down — "AllCare P&L External" carries two presentations of
      // AllCare, the second folding Studio Expense into SG&A — and the
      // restatement is not always equivalent. Its margin row is the one
      // that differs: the first states the real net-basis margin (53% for
      // Oct-26), the second simply restates Gross Profit over gross revenue
      // (50%), which is the number the dashboard could already compute for
      // itself. Last-write-wins kept the redundant one and discarded the
      // only row that carried information.
      //
      // Verified across all three P&L tabs: this margin is the ONLY
      // duplicated metric whose values differ. Every other repeat —
      // Revenues, Cost of sales, Gross Profit, EBITDA — is identical in
      // both blocks, so preferring the first changes nothing else.
      if (!(metricName in currentCompany.metrics)) {
        currentCompany.metrics[metricName] = values;
      }
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
export const DERIVED_NET_REVENUE = 'Margin Revenue Base (derived)';

/**
 * Recover the revenue base the stated margin was struck against.
 *
 * AllCare's Gross Margin % does not equal Gross Profit over the Revenues
 * row, and the base it IS struck against appears nowhere in the sheet —
 * only the resulting percentage. Reproducing the CFO's number therefore
 * means reading his row, not recalculating it.
 *
 * Gross Profit and the margin are both present, so the base is GP / margin.
 * Deriving it lets a quarter or a year aggregate the way any other revenue
 * line does — sum the parts, then divide — instead of averaging percentages
 * across months of different weight.
 *
 * Validated against the sheet's own total columns for AllCare External:
 * summing GP over summing this base gives 23.0% for 2025 and 50.0% for
 * 2026, matching the stated totals exactly, where GP / gross revenue would
 * give 34.0% and 46.6%.
 *
 * Deliberately NOT called "net revenue". It is below gross revenue through
 * 2026 but ABOVE it through most of 2025 (Oct-25: 186,913 implied against
 * 133,957 gross), so whatever adjustment separates the two is not a simple
 * netting-down and reverses direction between the years. Treat this purely
 * as the denominator implied by the stated margin.
 *
 * Only companies that publish a margin row get one; for AllRx the stated
 * margin equals GP / Revenues to the cent, so the derived base equals the
 * stated one and nothing changes.
 *
 * Note the sheet rounds the margin to whole percentage points (0.53, not
 * 0.5312), so the recovered base carries up to ~1% of rounding error. It is
 * exact at monthly granularity — GP / (GP / m) collapses back to m — and
 * approximate once aggregated.
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
