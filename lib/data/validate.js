/**
 * Sheet data validation module.
 * Validates P&L, Cashflow, and Expense tab structure before parsing.
 * Collects all errors before returning (never throws).
 *
 * @typedef {import('./types').ValidationError} ValidationError
 * @typedef {import('./types').ValidationResult} ValidationResult
 */

import { detectMonthColumns } from './parsePnL.js';

/**
 * Optional P&L metrics that produce warnings (not errors) when absent from a company block.
 * Note: 'Gorss Margin, %' matches the actual typo in the sheet data.
 * @type {string[]}
 */
const OPTIONAL_PNL_METRICS = ['Cost of Sales', 'Gross Profit', 'Gorss Margin, %'];

/**
 * Required columns for the Expense tab header row.
 * @type {string[]}
 */
const REQUIRED_EXPENSE_COLUMNS = [
  'Company', 'Category', 'Department', 'GL',
  'USD Equivalent Amount', 'Year', 'Month', 'Merchant Name',
];

/**
 * Validates P&L tab structure.
 * @param {any[][]} rows
 * @param {ValidationError[]} errors
 * @param {ValidationError[]} warnings
 */
function validatePnLStructure(rows, errors, warnings) {
  if (!rows || rows.length === 0) {
    errors.push({ severity: 'error', tab: 'P&L', message: 'Tab is empty or missing' });
    return;
  }

  const monthColumns = detectMonthColumns(rows[0]);
  if (monthColumns.length === 0) {
    errors.push({ severity: 'error', tab: 'P&L', message: 'No month columns found in header row' });
    return;
  }

  // Check for at least one company block (col B non-empty identifies a company)
  let hasCompanyBlock = false;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (row[1] && String(row[1]).trim()) {
      hasCompanyBlock = true;
      break;
    }
  }

  if (!hasCompanyBlock) {
    errors.push({ severity: 'error', tab: 'P&L', message: 'No company blocks found' });
    return;
  }

  // Check for optional metrics missing from each company block
  let currentCompany = null;
  let currentMetrics = [];

  const checkOptionalMetrics = (companyName, metrics) => {
    for (const metric of OPTIONAL_PNL_METRICS) {
      if (!metrics.includes(metric)) {
        warnings.push({
          severity: 'warning',
          tab: 'P&L',
          message: `Company '${companyName}' is missing optional metric '${metric}'`,
        });
      }
    }
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) {
      // Blank row ends a company block
      if (currentCompany) {
        checkOptionalMetrics(currentCompany, currentMetrics);
        currentCompany = null;
        currentMetrics = [];
      }
      continue;
    }
    if (row[1] && String(row[1]).trim()) {
      // New company -- flush previous block if any
      if (currentCompany) {
        checkOptionalMetrics(currentCompany, currentMetrics);
      }
      currentCompany = row[1];
      currentMetrics = [];
    }
    if (row[2] && currentCompany) {
      // Metric row within a company block
      currentMetrics.push(row[2]);
    }
  }

  // Flush last company block if file doesn't end with blank row
  if (currentCompany) {
    checkOptionalMetrics(currentCompany, currentMetrics);
  }
}

/**
 * Validates Cashflow tab structure.
 * Same structure as P&L (company blocks with month columns).
 * @param {any[][]} rows
 * @param {ValidationError[]} errors
 * @param {ValidationError[]} warnings
 */
function validateCashflowStructure(rows, errors, warnings) {
  if (!rows || rows.length === 0) {
    errors.push({ severity: 'error', tab: 'Cashflow', message: 'Tab is empty or missing' });
    return;
  }

  const monthColumns = detectMonthColumns(rows[0]);
  if (monthColumns.length === 0) {
    errors.push({ severity: 'error', tab: 'Cashflow', message: 'No month columns found in header row' });
    return;
  }

  let hasCompanyBlock = false;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (row[1] && !row[2]) {
      hasCompanyBlock = true;
      break;
    }
  }

  if (!hasCompanyBlock) {
    errors.push({ severity: 'error', tab: 'Cashflow', message: 'No company blocks found' });
  }
}

/**
 * Validates Expense tab structure.
 * Checks that the header row contains all required columns.
 * @param {any[][]} rows
 * @param {ValidationError[]} errors
 * @param {ValidationError[]} warnings
 */
function validateExpenseStructure(rows, errors, warnings) {
  if (!rows || rows.length < 2) {
    errors.push({ severity: 'error', tab: 'Expenses', message: 'Tab is empty or missing (need header + data rows)' });
    return;
  }

  const headerRow = rows[0];
  const headerSet = new Set(
    headerRow.filter(cell => typeof cell === 'string').map(cell => cell),
  );

  for (const col of REQUIRED_EXPENSE_COLUMNS) {
    if (!headerSet.has(col)) {
      errors.push({ severity: 'error', tab: 'Expenses', message: `Missing required header column '${col}'` });
    }
  }
}

/**
 * Validates all sheet data tabs before parsing.
 * Collects all errors across all tabs before returning.
 *
 * @param {Object} data
 * @param {any[][]} data.pnlRows - Raw P&L tab rows
 * @param {any[][]} data.cashflowRows - Raw Cashflow tab rows
 * @param {any[][]} data.expenseRows - Raw Expense tab rows
 * @returns {ValidationResult}
 */
export function validateSheetData({ pnlRows, cashflowRows, expenseRows }) {
  /** @type {ValidationError[]} */
  const errors = [];
  /** @type {ValidationError[]} */
  const warnings = [];

  validatePnLStructure(pnlRows, errors, warnings);
  validateCashflowStructure(cashflowRows, errors, warnings);
  validateExpenseStructure(expenseRows, errors, warnings);

  return { errors, warnings };
}
