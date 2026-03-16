import { batchGetSheetValues, getExpenseSheetValues } from '@/lib/googleSheets';
import { parsePnL } from '@/lib/data/parsePnL';
import { parseCashflow } from '@/lib/data/parseCashflow';
import { parseExpenses } from '@/lib/data/parseExpenses';

/** @typedef {import('./types').DashboardData} DashboardData */

const MAIN_SHEET_ID_VAR = 'INVITRO_MAIN_CONSOLIDATED_SHEET_ID';

/**
 * Fetch all financial data from Google Sheets and parse into structured format.
 * Called at build time from the async server component in app/page.jsx.
 *
 * Fails hard if any API call fails -- no fallback to stale/cached data.
 *
 * @returns {Promise<DashboardData>}
 */
export async function fetchAllData() {
  const mainSheetId = process.env[MAIN_SHEET_ID_VAR];
  if (!mainSheetId) {
    throw new Error(`Missing required environment variable: ${MAIN_SHEET_ID_VAR}`);
  }

  // Fetch P&L + Cashflow in single batchGet call (efficiency)
  // Tab names with special characters (& in P&L) must be single-quoted
  const [mainRanges, expenseRows] = await Promise.all([
    batchGetSheetValues({
      spreadsheetId: mainSheetId,
      ranges: ["'P&L'!A1:ZZ", "'Cashflow'!A1:ZZ"],
    }),
    getExpenseSheetValues("'Row Data (2026)'!A1:S"),
  ]);

  const pnlRows = mainRanges[0]?.values ?? [];
  const cashflowRows = mainRanges[1]?.values ?? [];

  const pnl = parsePnL(pnlRows);
  const cashflow = parseCashflow(cashflowRows);
  const expenses = parseExpenses(expenseRows);

  // Build sorted unique union of all company names
  const companySet = new Set();
  pnl.forEach(c => companySet.add(c.name));
  cashflow.forEach(c => companySet.add(c.name));
  expenses.forEach(r => companySet.add(r.company));
  const companies = [...companySet].sort();

  return {
    pnl,
    cashflow,
    expenses,
    companies,
    fetchedAt: new Date().toISOString(),
  };
}
