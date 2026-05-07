/**
 * Parser for the "IRR & Valuation" tab of the consolidated Google Sheet.
 *
 * Sheet layout (verified from `'IRR & Valuation'!A1:O180`):
 *  - Row 2 has years across columns D=2021, F=2022, H=2023, J=2024, L=2025, N=2026.
 *    Odd indexed columns (E, G, I, K, M) are spacers/markers and intentionally skipped.
 *  - Rows 3-92: per-company blocks with FY revenues, ARR, gross margin, growth, KPI,
 *    multiples, valuation, then 4 vehicle Investment $ rows + 4 vehicle Ownership % rows.
 *  - Row 94 is a Total rollup.
 *  - Rows 101-139: vehicle rollup blocks (Barsoum Brothers, Curenta Enterprise,
 *    AllRx Holding [SKIPPED per user], InVitro Fund, InVitro Ventures). Each block:
 *    Shareholders ownership $, Shareholders ownership %, blank, Hold Period (years),
 *    Investment $, IRR %, MOIC x.
 *  - Rows 141-174: LP/Shareholder rows. Vehicle name in col A on the FIRST row of
 *    each group (carry-forward to subsequent rows). LP name in col B. Ownership %
 *    per year in the year columns.
 */

const YEAR_COLS = { 2021: 3, 2022: 5, 2023: 7, 2024: 9, 2025: 11, 2026: 13 };
const YEARS = Object.keys(YEAR_COLS).map(Number).sort();

const VEHICLE_NAMES = ['Barsoum Brothers', 'Curenta Enterprise', 'InVitro Fund', 'InVitro Ventures'];
const SKIP_VEHICLES = new Set(['AllRx Holding']);

// Case-insensitive prefix-match a label against the canonical vehicle list.
// Returns the canonical name (so downstream maps stay keyed consistently)
// or undefined if no vehicle matches. Used by parseCompanyBlock to bind
// "Investment, $" and "Ownership, %" rows to vehicles even when the sheet
// has typos like "Invitro Ventures" (lowercase v).
function matchVehicle(label) {
  const lower = label.toLowerCase();
  return VEHICLE_NAMES.find(name => lower.startsWith(name.toLowerCase()));
}

// Sheet uses some inconsistent capitalization; normalize for cross-sheet matching.
const COMPANY_LABEL_MAP = {
  'AllRX': 'AllRx',
  'AllRx': 'AllRx',
  'AllCare + Curenta': 'AllCare + Curenta',
  'Osta': 'Osta',
  'Needles': 'Needles',
  'InVitro Studio': 'InVitro Studio',
};

/**
 * Parse a number from a cell value. Handles formatted strings like
 * "12,092,308", "  12,092,308 ", "79.7%", "  -   ", "$1,234".
 * @returns {number|null} number or null when not parseable
 */
function toNum(val) {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const str = String(val).trim();
  if (!str || str === '-' || str === '—') return null;
  const cleaned = str.replace(/[,$%\s]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Build a year-indexed array from a row, returning numbers (or null per cell). */
function rowToYearValues(row) {
  return YEARS.map(y => (row && row[YEAR_COLS[y]] !== undefined ? toNum(row[YEAR_COLS[y]]) : null));
}

/** Look up the value at a specific year column. */
function colC(row) { return row && row[2] ? String(row[2]).trim() : ''; }
function colA(row) { return row && row[0] ? String(row[0]).trim() : ''; }
function colB(row) { return row && row[1] ? String(row[1]).trim() : ''; }

/**
 * Find the boundaries of company blocks (rows 3-92).
 * A new company starts at any row where col B has a known company label
 * AND col C is "FY Revenues" (the canonical first metric for a company block).
 */
function findCompanyBlocks(rows) {
  const blocks = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const b = colB(r);
    const c = colC(r);
    if (b && c === 'FY Revenues' && COMPANY_LABEL_MAP[b]) {
      blocks.push({ name: COMPANY_LABEL_MAP[b], startRow: i });
    }
    // Special case: InVitro Studio at row 83 doesn't have FY Revenues — it goes straight to Investment rows.
    if (b === 'InVitro Studio' && c !== 'FY Revenues') {
      // Only register if not already registered above
      if (!blocks.some(blk => blk.name === 'InVitro Studio')) {
        blocks.push({ name: 'InVitro Studio', startRow: i });
      }
    }
  }
  return blocks;
}

/**
 * Parse a company block starting at index `start`. Reads forward until the
 * next company anchor or until hitting structural boundaries (vehicle rollup, etc).
 * @returns object with financials, investments (per-vehicle), ownership (per-vehicle).
 */
function parseCompanyBlock(rows, start, end) {
  const financials = {
    revenue: null, arr: null, grossMargin: null, revGrowth: null,
    kpi: null, multiple: null, valuation: null,
  };
  const investments = {};
  const ownership = {};
  for (const v of VEHICLE_NAMES) { investments[v] = null; ownership[v] = null; }

  for (let i = start; i < end && i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const c = colC(r);
    if (!c) continue;
    const vals = rowToYearValues(r);

    if (c === 'FY Revenues') financials.revenue = vals;
    else if (c === 'ARR as of December') financials.arr = vals;
    else if (c === 'Annual Gross Margin, %') financials.grossMargin = vals;
    else if (c.startsWith('Annual Revenues Growth Rate')) financials.revGrowth = vals;
    else if (c.startsWith('KPI:')) financials.kpi = { name: c.replace(/^KPI:\s*/, '').trim(), values: vals };
    else if (c === 'Multiples, X' || c === 'AllCare Multiples, X') financials.multiple = vals;
    else if (c === 'Company valuation') financials.valuation = vals;
    // Vehicle name match is case-insensitive — the sheet has occasional
    // capitalization drift (e.g. row 43: "Invitro Ventures ownerhsip, %"
    // vs the canonical "InVitro Ventures Ownership, %"). Normalizing both
    // sides defends against future drift without requiring a typo list.
    else if (c.toLowerCase().endsWith('investment, $')) {
      const v = matchVehicle(c);
      if (v) investments[v] = vals;
    }
    else if (c.toLowerCase().endsWith('ownership, %') || c.toLowerCase().endsWith('ownerhsip, %')) {
      const v = matchVehicle(c);
      if (v) ownership[v] = vals;
    }
  }
  return { financials, investments, ownership };
}

/**
 * Parse a vehicle rollup block. Each vehicle starts at a row where col B has the
 * vehicle name AND col C is "Shareholders ownerhsip, $" (note typo preserved).
 */
function parseVehicleBlock(rows, start) {
  const vehicle = {
    ownershipValue: null, ownershipPct: null, holdPeriod: null,
    investment: null, irr: null, moic: null,
  };
  // Read forward until the NEXT vehicle anchor (any name in VEHICLE_NAMES or
  // SKIP_VEHICLES). Only the first row of each vehicle block has col B set;
  // continuation rows leave col B empty. Using this as the stop condition is
  // robust to gap-row count, skipped vehicles like AllRx Holding sitting
  // between two real vehicles, and any future row insertions in the sheet.
  // Without this bound, Barsoum Brothers' "Shareholders ownerhsip, $" cell
  // gets overwritten by Curenta's first row (next block over), which is
  // exactly the bug that caused N101 ($31.5M) to render as $4.7M.
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const b = colB(r);
    if (i > start && b && (VEHICLE_NAMES.includes(b) || SKIP_VEHICLES.has(b))) break;

    const c = colC(r);
    const vals = rowToYearValues(r);
    if (c === 'Shareholders ownerhsip, $' || c === 'Shareholders ownership, $') vehicle.ownershipValue = vals;
    else if (c.startsWith('Shareholders ownerhsip, %') || c.startsWith('Shareholders ownership, %')) vehicle.ownershipPct = vals;
    else if (c === 'Hold Period (years)') vehicle.holdPeriod = vals;
    else if (c === 'Investment, $') vehicle.investment = vals;
    else if (c === 'IRR, %') vehicle.irr = vals;
    else if (c === 'MOIC, x') vehicle.moic = vals;
  }
  return vehicle;
}

/**
 * Find vehicle rollup block start rows. Vehicle anchor: col B in VEHICLE_NAMES set
 * AND col C is "Shareholders ownerhsip, $" (sheet's canonical first row of the block).
 */
function findVehicleBlocks(rows) {
  const blocks = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const b = colB(r);
    const c = colC(r);
    if (!b || !c) continue;
    if (SKIP_VEHICLES.has(b)) continue;
    if (!VEHICLE_NAMES.includes(b)) continue;
    if (c === 'Shareholders ownerhsip, $' || c === 'Shareholders ownership, $') {
      blocks.push({ name: b, startRow: i });
    }
  }
  return blocks;
}

/**
 * Parse LP/Shareholder rows (typically rows 141-174).
 * Returns a map from vehicle name to LP array.
 * Vehicle name in col A is an anchor that carries forward.
 */
function parseLpRows(rows, startSearchFrom = 140) {
  const byVehicle = {};
  for (const v of VEHICLE_NAMES) byVehicle[v] = [];
  let currentVehicle = null;

  for (let i = startSearchFrom; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const a = colA(r);
    const b = colB(r);
    const c = colC(r);

    // Skip blank rows but don't reset carry-forward
    if (!a && !b && !c) continue;

    // New vehicle anchor in col A (only on first LP row of each group)
    if (a && (VEHICLE_NAMES.includes(a) || SKIP_VEHICLES.has(a))) {
      currentVehicle = SKIP_VEHICLES.has(a) ? null : a;
    }

    // LP row: col B has LP name, col C is "Shareholders ownerhsip, %"
    if (currentVehicle && b && (c.startsWith('Shareholders ownerhsip,') || c.startsWith('Shareholders ownership,'))) {
      // Skip the vehicle rollup rows themselves (col B equals a vehicle name)
      if (VEHICLE_NAMES.includes(b) || SKIP_VEHICLES.has(b)) continue;
      byVehicle[currentVehicle].push({
        name: b,
        ownership: rowToYearValues(r),
      });
    }
  }
  return byVehicle;
}

/**
 * Main parser entry point.
 * @param {any[][]} rows - Raw 2D row array from the IRR & Valuation tab.
 * @returns {object|null}
 */
export function parseIRRValuation(rows) {
  if (!rows || rows.length < 50) return null;

  // 1. Companies
  const companyBlocks = findCompanyBlocks(rows);
  const companies = [];
  for (let i = 0; i < companyBlocks.length; i++) {
    const block = companyBlocks[i];
    const end = (companyBlocks[i + 1]?.startRow) ?? 100; // Don't bleed into vehicle rollups (row 101+)
    const data = parseCompanyBlock(rows, block.startRow, end);
    companies.push({ name: block.name, ...data });
  }

  // 2. Vehicles
  const vehicleBlocks = findVehicleBlocks(rows);
  const lpsByVehicle = parseLpRows(rows);
  const vehicles = vehicleBlocks.map(({ name, startRow }) => ({
    name,
    ...parseVehicleBlock(rows, startRow),
    lps: lpsByVehicle[name] || [],
  }));

  // 3. All LP names (deduplicated, sorted)
  const lpNamesSet = new Set();
  for (const v of vehicles) for (const lp of v.lps) lpNamesSet.add(lp.name);
  const allLpNames = [...lpNamesSet].sort();

  console.log(`[IRR] Parsed ${companies.length} companies, ${vehicles.length} vehicles, ${allLpNames.length} unique LPs`);

  return { years: YEARS, companies, vehicles, allLpNames };
}
