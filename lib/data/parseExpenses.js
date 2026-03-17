/**
 * Expense transaction parser with header-based column detection.
 * Finds columns by header name, not position. Normalizes company names.
 *
 * @typedef {import('./types').ExpenseRow} ExpenseRow
 */

import { canonicalName } from '@/lib/data/companyMapping';

/**
 * Coerce a cell value to a number or null.
 * @param {any} val - Raw cell value from Sheets API
 * @returns {number|null}
 */
function toNumberOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

const MONTH_NAME_TO_NUMBER = {
  'January': 1, 'February': 2, 'March': 3, 'April': 4,
  'May': 5, 'June': 6, 'July': 7, 'August': 8,
  'September': 9, 'October': 10, 'November': 11, 'December': 12,
};

/**
 * Column names we need to find in the header row.
 * @type {string[]}
 */
const REQUIRED_COLUMNS = [
  'Company', 'Category', 'Department', 'GL',
  'USD Equivalent Amount', 'Year', 'Month', 'Merchant Name',
];

/**
 * Builds a map of column name -> index from the header row.
 * @param {any[]} headerRow
 * @returns {Object<string, number>}
 */
function buildColumnMap(headerRow) {
  /** @type {Object<string, number>} */
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (typeof cell === 'string' && REQUIRED_COLUMNS.includes(cell)) {
      map[cell] = i;
    }
  }
  return map;
}

/**
 * Parses expense rows into structured ExpenseRow objects.
 * Uses header-based column detection -- works regardless of column order.
 * @param {any[][]} rows - Raw 2D array from expense sheet (first row = headers)
 * @returns {ExpenseRow[]}
 */
export function parseExpenses(rows) {
  if (!rows || rows.length < 2) return [];

  const colMap = buildColumnMap(rows[0]);

  /** @type {ExpenseRow[]} */
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawCompany = row[colMap['Company']] || '';
    const monthStr = row[colMap['Month']] || '';
    const rawAmount = row[colMap['USD Equivalent Amount']];

    results.push({
      company: canonicalName(String(rawCompany)),
      category: String(row[colMap['Category']] || ''),
      department: String(row[colMap['Department']] || ''),
      gl: String(row[colMap['GL']] || ''),
      amount: toNumberOrNull(rawAmount),
      year: Number(row[colMap['Year']]) || 0,
      month: MONTH_NAME_TO_NUMBER[monthStr] || 0,
      merchant: String(row[colMap['Merchant Name']] || ''),
    });
  }

  return results;
}
