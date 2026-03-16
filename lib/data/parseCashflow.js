/**
 * Cashflow tab parser with dynamic company discovery.
 * Reuses the same block-detection and month column logic as parsePnL.
 *
 * @typedef {import('./types').CompanyCashflow} CompanyCashflow
 */

import { detectMonthColumns } from './parsePnL.js';

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

/**
 * Parses Cashflow tab rows into structured CompanyCashflow objects.
 * Uses identical block-detection logic as parsePnL.
 * @param {any[][]} rows - Raw 2D array from Sheets API
 * @returns {CompanyCashflow[]}
 */
export function parseCashflow(rows) {
  if (!rows || rows.length === 0) return [];

  const monthColumns = detectMonthColumns(rows[0]);
  if (monthColumns.length === 0) return [];

  /** @type {CompanyCashflow[]} */
  const companies = [];
  /** @type {CompanyCashflow|null} */
  let currentCompany = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length === 0) {
      continue;
    }

    const colB = row[1];
    const colC = row[2];

    if (colB && !colC) {
      currentCompany = { name: String(colB).trim(), metrics: {} };
      companies.push(currentCompany);
      continue;
    }

    if (colC && currentCompany) {
      const metricName = String(colC).trim();
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
