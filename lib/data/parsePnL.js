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
  const clean = typeof val === 'string' ? val.replace(/,/g, '') : val;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
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

  return companies;
}
