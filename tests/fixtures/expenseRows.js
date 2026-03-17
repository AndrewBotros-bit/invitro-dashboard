// Column order from CONTEXT.md: Type, Category, Original Month, Transaction date,
// Original Amount, Posted Date, USD Equivalent Amount, Budget or Limit, User,
// Department, Merchant Name, GL, Account, Company, Year, Month, Month Order, Cashflow Amount, Cashflow Date
export const EXPENSE_HEADERS = [
  'Type', 'Category', 'Original Month', 'Transaction date',
  'Original Amount', 'Posted Date', 'USD Equivalent Amount', 'Budget or Limit',
  'User', 'Department', 'Merchant Name', 'GL', 'Account', 'Company',
  'Year', 'Month', 'Month Order', 'Cashflow Amount', 'Cashflow Date'
];

export const MOCK_EXPENSE_ROWS = [
  EXPENSE_HEADERS,
  ['Expense', 'HC', 'January', '2026-01-15', 5000, '2026-01-15', 5000, 6000, 'John Doe', 'R&D', 'ADP', 'Salaries', 'Operating', 'AllRX', 2026, 'January', 1, 5000, '2026-01-15'],
  ['Expense', 'NON-HC', 'January', '2026-01-20', 1200, '2026-01-20', 1200, 2000, 'Jane Smith', 'G&A', 'AWS', 'Cloud Services', 'Operating', 'Curenta Technology LLC', 2026, 'January', 1, 1200, '2026-01-20'],
  ['Expense', 'HC', 'February', '2026-02-15', 5200, '2026-02-15', 5200, 6000, 'John Doe', 'R&D', 'ADP', 'Salaries', 'Operating', 'AllRX', 2026, 'February', 2, 5200, '2026-02-15'],
  ['Expense', 'NON-HC', 'January', '2026-01-25', 800, '2026-01-25', 800, 1000, 'Bob', 'GTM', 'Google', 'Advertising', 'Operating', 'Osta LLC', 2026, 'January', 1, 800, '2026-01-25'],
  ['Expense', 'HC', 'February', '2026-02-15', 3000, '2026-02-15', 3000, 4000, 'Alice', 'Operations', 'ADP', 'Salaries', 'Operating', 'InVitro Studio, LLC', 2026, 'February', 2, 3000, '2026-02-15'],
  ['Expense', 'NON-HC', 'March', '2026-03-10', 950, '2026-03-10', 950, 1500, 'Carol', 'Direct Cost', 'Supplier', 'Materials', 'Operating', 'Needles', 2026, 'March', 3, 950, '2026-03-10'],
];
