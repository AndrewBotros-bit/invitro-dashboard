// Test fixtures for validation module -- invalid/edge-case sheet data

// P&L: completely empty tab
export const EMPTY_PNL_ROWS = [];

// P&L: header row with no "Mon YYYY" columns
export const NO_MONTH_PNL_ROWS = [
  [null, null, 'Metric', null, 'Not a month'],
];

// P&L: valid month headers but no company blocks (only metric rows without a preceding company header)
export const NO_COMPANY_PNL_ROWS = [
  [null, null, null, null, 'Jan 2025', 'Feb 2025'],
  [null, null, 'Revenue', null, 100, 200],  // metric row without company above
];

// Expenses: header missing 'Company' and 'GL' columns
export const MISSING_HEADER_EXPENSE_ROWS = [
  ['Type', 'Category', 'Original Month', 'Transaction date',
   'Original Amount', 'Posted Date', 'USD Equivalent Amount', 'Budget or Limit',
   'User', 'Department', 'Merchant Name', /* 'GL' missing */ 'Account', /* 'Company' missing */
   'Year', 'Month', 'Month Order', 'Cashflow Amount', 'Cashflow Date'],
  ['Expense', 'HC', 'January', '2026-01-15', 5000, '2026-01-15', 5000, 6000, 'John', 'R&D', 'ADP', 'Operating', 2026, 'January', 1, 5000, '2026-01-15'],
];

// P&L: valid structure but with non-numeric values in numeric cells
export const NON_NUMERIC_PNL_ROWS = [
  [null, null, null, null, 'Jan 2025', 'Feb 2025', 'Mar 2025'],
  [null, 'TestCo', null, null],
  [null, null, 'Revenue', null, 'N/A', '', undefined],
];

// Minimal valid P&L: 1 company, 1 metric, 1 month
export const VALID_MINIMAL_PNL_ROWS = [
  [null, null, null, null, 'Jan 2025'],
  [null, 'TestCo', null, null],
  [null, null, 'Revenue', null, 100],
];

// Minimal valid Cashflow: 1 company, 1 metric, 1 month
export const VALID_MINIMAL_CASHFLOW_ROWS = [
  [null, null, null, null, 'Jan 2025'],
  [null, 'TestCo', null, null],
  [null, null, 'Cash Inflow', null, 50000],
];

// Minimal valid Expenses: header + 1 data row with all required columns
export const VALID_MINIMAL_EXPENSE_ROWS = [
  ['Type', 'Category', 'Original Month', 'Transaction date',
   'Original Amount', 'Posted Date', 'USD Equivalent Amount', 'Budget or Limit',
   'User', 'Department', 'Merchant Name', 'GL', 'Account', 'Company',
   'Year', 'Month', 'Month Order', 'Cashflow Amount', 'Cashflow Date'],
  ['Expense', 'HC', 'January', '2026-01-15', 5000, '2026-01-15', 5000, 6000, 'John', 'R&D', 'ADP', 'Salaries', 'Operating', 'TestCo', 2026, 'January', 1, 5000, '2026-01-15'],
];
