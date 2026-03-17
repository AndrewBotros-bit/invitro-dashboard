import { batchGetSheetValues, getExpenseSheetValues } from '@/lib/googleSheets';
import { parsePnL } from '@/lib/data/parsePnL';
import { parseCashflow } from '@/lib/data/parseCashflow';
import { parseExpenses } from '@/lib/data/parseExpenses';
import { validateSheetData } from '@/lib/data/validate';

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

  // Validate structure before parsing (fail fast, collect all errors)
  const { errors, warnings } = validateSheetData({ pnlRows, cashflowRows, expenseRows });

  // Log warnings (non-fatal)
  for (const w of warnings) {
    console.warn(`[DATA WARNING] ${w.tab}: ${w.message}`);
  }

  // Throw on errors (fatal -- fails the build)
  if (errors.length > 0) {
    const msg = errors.map(e => `[DATA VALIDATION] ${e.tab}: ${e.message}`).join('\n');
    throw new Error(`Sheet validation failed:\n${msg}`);
  }

  const pnl = parsePnL(pnlRows);
  const cashflow = parseCashflow(cashflowRows);
  const expenses = parseExpenses(expenseRows);

  // Build sorted unique union of all company names
  const companySet = new Set();
  pnl.forEach(c => companySet.add(c.name));
  cashflow.forEach(c => companySet.add(c.name));
  expenses.forEach(r => companySet.add(r.company));
  const companies = [...companySet].sort();

  const data = { pnl, cashflow, expenses, companies, fetchedAt: new Date().toISOString() };
  logBuildManifest(data);
  return data;
}

/**
 * Logs a structured build manifest to console after successful parse.
 * Helps the CFO verify what data was discovered during build.
 * @param {DashboardData} data
 */
function logBuildManifest({ pnl, cashflow, expenses, companies, fetchedAt }) {
  console.log('\n=== Build Manifest ===');
  console.log(`Tabs: P&L, Cashflow, Expenses`);
  console.log(`Companies: ${companies.join(', ')}`);
  console.log(`Fetched at: ${fetchedAt}`);
  console.log('');
  for (const company of companies) {
    const pnlCo = pnl.find(c => c.name === company);
    const cfCo = cashflow.find(c => c.name === company);
    const expCount = expenses.filter(e => e.company === company).length;
    const pnlMetrics = pnlCo ? Object.keys(pnlCo.metrics).length : 0;
    const cfMetrics = cfCo ? Object.keys(cfCo.metrics).length : 0;
    const months = pnlCo?.metrics?.[Object.keys(pnlCo?.metrics ?? {})[0]]?.length ?? 0;
    console.log(`  ${company}: ${months} months, ${pnlMetrics} P&L metrics, ${cfMetrics} cashflow metrics, ${expCount} expense rows`);
  }
  console.log('=== End Manifest ===\n');
}
