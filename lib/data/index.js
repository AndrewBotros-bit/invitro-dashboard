import { batchGetSheetValues, getExpenseSheetValues, getHeadcountSheetValues } from '@/lib/googleSheets';
import { parsePnL, detectMonthColumns } from '@/lib/data/parsePnL';
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
  const [mainRanges, expenseRows, headcountRows] = await Promise.all([
    batchGetSheetValues({
      spreadsheetId: mainSheetId,
      ranges: ["'P&L'!A1:ZZ", "'Cashflow'!A1:ZZ"],
    }),
    getExpenseSheetValues("'Row Data (2026)'!A1:S"),
    getHeadcountSheetValues("'Employees List'!A1:AZ"),
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
  const headcount = parseHeadcount(headcountRows);

  // Extract "Cash runway" row (row 180 in sheet, standalone row outside company blocks)
  const cashRunwayRow = extractCashRunwayRow(cashflowRows);

  // Build sorted unique union of all company names
  const companySet = new Set();
  pnl.forEach(c => companySet.add(c.name));
  cashflow.forEach(c => companySet.add(c.name));
  expenses.forEach(r => companySet.add(r.company));
  const companies = [...companySet].sort();

  // Extract last "Actual" month from row 2 of P&L (Actual/Forecast indicator row)
  const lastActualMonth = extractLastActualMonth(pnlRows);

  const data = { pnl, cashflow, expenses, headcount, companies, cashRunwayRow, lastActualMonth, fetchedAt: new Date().toISOString() };
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

/**
 * Extract the "Cash runway" row from cashflow tab (row 180 in sheet).
 * Returns array of {year, month, value} matching month columns from header.
 * @param {any[][]} rows
 * @returns {Array<{year: number, month: number, value: number|null}>}
 */
function extractCashRunwayRow(rows) {
  if (!rows || rows.length === 0) return [];

  // detectMonthColumns imported at top
  const monthColumns = detectMonthColumns(rows[0]);

  // Find the row where column B = "Cash runway"
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const colB = String(row[1] ?? '').trim();
    if (colB === 'Cash runway') {
      return monthColumns.map(col => ({
        year: col.year,
        month: col.month,
        value: toNum(row[col.index]),
      }));
    }
  }
  return [];
}

/**
 * Extract the last "Actual" month from P&L row 2 (Actual/Forecast indicator).
 * Row 1 has month headers like "Jan 2026", row 2 has "Actual" or "Forecast".
 * Returns { month: "Feb", year: 2026 } or null.
 */
function extractLastActualMonth(pnlRows) {
  if (!pnlRows || pnlRows.length < 2) return null;
  const headerRow = pnlRows[0]; // Month names
  const actualRow = pnlRows[1]; // "Actual" / "Forecast"
  const MONTH_MAP = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  let lastActual = null;
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] ?? '').trim();
    const a = String(actualRow[i] ?? '').trim();
    if (a !== 'Actual') continue;
    // Parse "Jan 2026" or "Feb 2025" from header
    const m = h.match(/^(\w{3})\s+(\d{4})$/);
    if (m && MONTH_MAP[m[1]]) {
      lastActual = { month: MONTH_MAP[m[1]], year: parseInt(m[2]), label: `${m[1]} ${m[2]}` };
    }
  }
  if (lastActual) console.log(`[DATA] Last actual month: ${lastActual.label}`);
  return lastActual;
}

/**
 * Parse headcount from "Employees List" tab.
 * Headers (B2 row): Emp. ID, Employee Name, Company, Indirect/Direct Cost, Fixed/Variable, Department, Division, [gap], Position/Job, Country, ...
 * Salary columns start at index 14 (col P in sheet) with headers like "25.Jan.26", "26.Feb.26"
 * Filters to Indirect cost only.
 * @param {any[][]} rows - includes header row
 */
function parseHeadcount(rows) {
  if (!rows || rows.length < 3) return [];
  // Row 1 (index 0) may be empty; find the header row dynamically
  const headerIdx = rows.findIndex(r => r && r.some(c => String(c).includes('Employee')));
  if (headerIdx === -1) { console.warn('[HEADCOUNT] No header row found'); return []; }
  const header = rows[headerIdx];

  // Detect salary month columns — headers like "25.Jan.26", "09. Sept.24"
  const MONTH_MAP = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };
  const salaryColumns = [];
  for (let i = 14; i < header.length; i++) {
    const h = String(header[i] ?? '').trim();
    // Match "09. Sept.24", "25.Jan.26" — optional space after first dot
    const m = h.match(/\d+\.\s*(\w+)\.(\d+)/);
    if (m) {
      const monthNum = MONTH_MAP[m[1]];
      const year = 2000 + parseInt(m[2]);
      if (monthNum && year) salaryColumns.push({ index: i, year, month: monthNum });
    }
  }
  console.log(`[HEADCOUNT] Found ${salaryColumns.length} salary columns`);

  // Verified column mapping from sheet:
  // [0]=Emp.ID, [1]=Employee Name, [2]=Company, [3]=Indirect/Direct Cost,
  // [4]=Fixed/Variable, [5]=Department, [6]=Division, [7]=empty, [8]=Position, [9]=Country
  console.log(`[HEADCOUNT] Header at row ${headerIdx}, data starts at row ${headerIdx + 1}`);
  return rows.slice(headerIdx + 1)
    .filter(r => r && r.length > 6 && String(r[4] ?? '').trim() === 'Indirect')
    .map(r => {
      const salary = {};
      for (const col of salaryColumns) {
        const raw = r[col.index];
        const val = toNum(typeof raw === 'string' ? raw.trim() : raw);
        if (val !== null) {
          const key = `${col.year}-${col.month}`;
          salary[key] = val;
        }
      }
      return {
        name: String(r[2] ?? '').trim(),       // C = Employee Name
        company: String(r[3] ?? '').trim(),     // D = Company
        department: String(r[6] ?? '').trim(),  // G = Department
        division: String(r[7] ?? '').trim(),    // H = Division
        position: String(r[9] ?? '').trim(),    // J = Position
        country: String(r[10] ?? '').trim(),    // K = Country
        salary,
      };
    });
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const clean = typeof val === 'string' ? val.replace(/,/g, '') : val;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}
