/**
 * Parser for the "IRR & Valuation" tab of the consolidated Google Sheet.
 *
 * Sheet layout (Sept 2026 update — now MIXED period grid):
 *  - Row 1: Actual/Forecast indicator per period column
 *  - Row 2: period labels — "FY 2021", "FY 2022", "FY 2023", "FY 2024"
 *           (annual) followed by "Q4 2025", "Q1 2026", ..., "Q4 2028"
 *           (quarterly). Data columns alternate with blank spacer columns
 *           (odd indexed), same convention as the old annual-only layout.
 *  - Row 3: quarter-end date labels (e.g. "Dec-21", "Mar-26") for humans.
 *  - Rows 4+: same structure as before — company blocks, then vehicle
 *           rollups, then LP rows — but every data cell now sits at a
 *           period column detected from row 2, not a hardcoded position.
 *
 * The previous parser hardcoded YEAR_COLS = { 2021:3, 2022:5, ..., 2027:15 }.
 * That silently misaligned once the CFO inserted the quarterly columns
 * (col 15 became Q2 2026, not FY 2027). Dynamic detection from row 2
 * eliminates that whole class of bug.
 *
 * Output shape: irrValuation.periods[] carries the full detail; the
 * legacy `years[]` array is derived (unique year integers) for backward
 * compatibility with anything that only cares about year granularity.
 *
 *   period = {
 *     colIndex,     // 0-indexed column in the sheet grid
 *     label,        // "FY 2021" | "Q4 2025" | "Q1 2026"
 *     year,         // 2021 | 2025 | 2026
 *     quarter,      // null (annual) | 1..4
 *     endDate,      // ISO "YYYY-MM-DD" — Dec 31 for annual, quarter end for quarters
 *     isAnnualEnd,  // true for FY rows and Q4 rows — these are the "annual snapshot" periods
 *     isActual,     // true = past/present (from row 1), false = forecast
 *   }
 *
 * Every per-vehicle / per-LP number array in the output is INDEXED BY
 * PERIOD ORDER — arr[i] corresponds to periods[i]. Consumers that used
 * to index by year index (0=2021, 1=2022, …) still work, they now
 * naturally step through quarters where the sheet has them.
 */

const VEHICLE_NAMES = ['Barsoum Brothers', 'Curenta Enterprise', 'InVitro Fund', 'InVitro Ventures'];
const SKIP_VEHICLES = new Set(['AllRx Holding']);

// Case-insensitive prefix-match a label against the canonical vehicle list.
function matchVehicle(label) {
  const lower = label.toLowerCase();
  return VEHICLE_NAMES.find(name => lower.startsWith(name.toLowerCase()));
}

const COMPANY_LABEL_MAP = {
  'AllRX': 'AllRx',
  'AllRx': 'AllRx',
  'AllCare + Curenta': 'AllCare + Curenta',
  'Osta': 'Osta',
  'Needles': 'Needles',
  'InVitro Studio': 'InVitro Studio',
};

/**
 * Detect the period grid from the header rows.
 * Row index 1 (sheet row 2) carries the labels; row index 0 optionally
 * carries the Actual/Forecast marker per column.
 */
function detectPeriods(rows) {
  const labelRow = rows[1] ?? [];
  const flagRow = rows[0] ?? [];
  const periods = [];
  for (let i = 0; i < labelRow.length; i++) {
    const raw = String(labelRow[i] ?? '').trim();
    const flag = String(flagRow[i] ?? '').trim().toLowerCase();
    const isActual = flag === 'actual';

    // "FY 2021" / "FY 2024" — annual snapshot period, dated Dec 31.
    let m = raw.match(/^FY\s+(\d{4})$/i);
    if (m) {
      const year = parseInt(m[1], 10);
      periods.push({
        colIndex: i,
        label: `FY ${year}`,
        year,
        quarter: null,
        endDate: `${year}-12-31`,
        isAnnualEnd: true,
        isActual,
      });
      continue;
    }

    // "Q1 2026" through "Q4 2028" — quarterly period.
    m = raw.match(/^Q([1-4])\s+(\d{4})$/i);
    if (m) {
      const quarter = parseInt(m[1], 10);
      const year = parseInt(m[2], 10);
      const endMonth = quarter * 3;                          // Q1=3, Q2=6, Q3=9, Q4=12
      const endDay = { 3: 31, 6: 30, 9: 30, 12: 31 }[endMonth];
      const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      periods.push({
        colIndex: i,
        label: `Q${quarter} ${year}`,
        year,
        quarter,
        endDate,
        isAnnualEnd: quarter === 4, // Q4 is also the annual snapshot for that year
        isActual,
      });
    }
    // Anything else in row 2 (blank spacers, "Quarter" heading, etc.) is
    // silently skipped — periods are only added for cells matching the
    // FY / Qx patterns above.
  }
  return periods;
}

/**
 * Parse a number from a cell value. Handles formatted strings like
 * "12,092,308", "  12,092,308 ", "79.7%", "  -   ", "$1,234".
 */
function toNum(val) {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const str = String(val).trim();
  if (!str || str === '-' || str === '—') return null;
  // The IRR sheet is fetched with FORMATTED_VALUE, so multiples arrive as
  // "9.5x" / "96.4x". Strip a trailing multiplier suffix as well as the
  // currency/percent decoration — without it Number("9.5x") is NaN and
  // every MOIC and company Multiple silently parses to null.
  const cleaned = str.replace(/[,$%\s]/g, '').replace(/x$/i, '');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Build a period-indexed array of numbers from a row. */
function rowToPeriodValues(row, periods) {
  return periods.map(p =>
    row && row[p.colIndex] !== undefined ? toNum(row[p.colIndex]) : null
  );
}

function colC(row) { return row && row[2] ? String(row[2]).trim() : ''; }
function colA(row) { return row && row[0] ? String(row[0]).trim() : ''; }
function colB(row) { return row && row[1] ? String(row[1]).trim() : ''; }

/** Find company block boundaries (col B = known company name, col C = "FY Revenues"). */
function findCompanyBlocks(rows) {
  const blocks = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const b = colB(r);
    const c = colC(r);
    // Company anchor: col B has a known company name AND col C starts with "FY Revenues"
    // (updated: the CFO now labels this row "Revenues, $ (FY for 2021-24 | quarterly from Q4-25)"
    // — so match on prefix rather than exact string).
    if (b && COMPANY_LABEL_MAP[b] && (c === 'FY Revenues' || c.startsWith('Revenues, $') || c.startsWith('FY Revenues'))) {
      blocks.push({ name: COMPANY_LABEL_MAP[b], startRow: i });
    }
    if (b === 'InVitro Studio' && c && !c.startsWith('FY Revenues') && !c.startsWith('Revenues, $')) {
      if (!blocks.some(blk => blk.name === 'InVitro Studio')) {
        blocks.push({ name: 'InVitro Studio', startRow: i });
      }
    }
  }
  return blocks;
}

function parseCompanyBlock(rows, start, end, periods) {
  const financials = {
    revenue: null, arr: null, grossMargin: null, revGrowth: null,
    kpi: null, multiple: null, valuation: null,
  };
  const investments = {};
  const ownership = {};
  for (const v of VEHICLE_NAMES) { investments[v] = null; ownership[v] = null; }
  const directShareholders = {};
  const upsertDirect = (name, field, vals) => {
    if (!directShareholders[name]) directShareholders[name] = { investment: null, ownership: null };
    directShareholders[name][field] = vals;
  };

  for (let i = start; i < end && i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const c = colC(r);
    if (!c) continue;
    const vals = rowToPeriodValues(r, periods);

    // Revenue row now uses the mixed FY / quarterly label — match on
    // either the old "FY Revenues" exact string or the new "Revenues, $"
    // prefix, so this parser still reads older sheets during rollback.
    if (c === 'FY Revenues' || c.startsWith('Revenues, $') || c.startsWith('FY Revenues')) financials.revenue = vals;
    else if (c === 'ARR as of December') financials.arr = vals;
    else if (c === 'Annual Gross Margin, %' || c.startsWith('Gross Margin')) financials.grossMargin = vals;
    else if (c.startsWith('Annual Revenues Growth Rate') || c.startsWith('Revenue Growth')) financials.revGrowth = vals;
    else if (c.startsWith('KPI:')) financials.kpi = { name: c.replace(/^KPI:\s*/, '').trim(), values: vals };
    else if (c === 'Multiples, X' || c === 'AllCare Multiples, X') financials.multiple = vals;
    else if (c === 'Company valuation') financials.valuation = vals;
    else if (/\(\s*individual\s*\)\s*$/i.test(c)) {
      const invM = c.match(/^(.+?)\s+Investment,\s*\$\s*\(\s*Individual\s*\)\s*$/i);
      const ownM = c.match(/^(.+?)\s+Ownership,?\s*%?\s*\(\s*Individual\s*\)\s*$/i);
      if (invM) upsertDirect(invM[1].trim(), 'investment', vals);
      else if (ownM) upsertDirect(ownM[1].trim(), 'ownership', vals);
    }
    else if (c.toLowerCase().endsWith('investment, $')) {
      const v = matchVehicle(c);
      if (v) investments[v] = vals;
    }
    else if (c.toLowerCase().endsWith('ownership, %') || c.toLowerCase().endsWith('ownerhsip, %')) {
      const v = matchVehicle(c);
      if (v) ownership[v] = vals;
    }
    else if (/,\s*\$\s*$/.test(c)) {
      const name = c.replace(/\s*,\s*\$\s*$/, '').trim();
      if (name) upsertDirect(name, 'investment', vals);
    }
    else if (/,\s*%\s*$/.test(c)) {
      const name = c.replace(/\s*,\s*%\s*$/, '').trim();
      if (name) upsertDirect(name, 'ownership', vals);
    }
  }
  return { financials, investments, ownership, directShareholders };
}

function parseVehicleBlock(rows, start, periods) {
  const vehicle = {
    ownershipValue: null, ownershipPct: null, holdPeriod: null,
    investment: null, irr: null, moic: null,
  };
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const b = colB(r);
    const c = colC(r);
    const isNewVehicleAnchor = i > start && b && (c === 'Shareholders ownerhsip, $' || c === 'Shareholders ownership, $');
    if (isNewVehicleAnchor) break;

    const vals = rowToPeriodValues(r, periods);
    if (c === 'Shareholders ownerhsip, $' || c === 'Shareholders ownership, $') vehicle.ownershipValue = vals;
    else if (c.startsWith('Shareholders ownerhsip, %') || c.startsWith('Shareholders ownership, %')) vehicle.ownershipPct = vals;
    else if (c === 'Hold Period (years)') vehicle.holdPeriod = vals;
    // Prefix-matched, not equality-matched: the sheet labels these
    // "Cumulative Investment, $" and "IRR, % (annualized)", so exact
    // comparison missed both and left the vehicle tiles blank. Matching
    // on the stem keeps working if the CFO adds another qualifier.
    else if (/^(cumulative\s+)?investment,\s*\$/i.test(c)) vehicle.investment = vals;
    else if (/^irr,\s*%/i.test(c)) vehicle.irr = vals;
    else if (/^moic,\s*x/i.test(c)) vehicle.moic = vals;
  }
  return vehicle;
}

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

function parseLpRows(rows, periods, startSearchFrom = 140) {
  const byVehicle = {};
  for (const v of VEHICLE_NAMES) byVehicle[v] = [];
  let currentVehicle = null;
  let pendingLp = null;

  const isOwnershipLabel = (c) => {
    const lower = (c || '').toLowerCase();
    return lower.startsWith('shareholders ownerhsip,') || lower.startsWith('shareholders ownership,');
  };
  const isInvestmentLabel = (c) => (c || '').trim().toLowerCase() === 'investment';

  for (let i = startSearchFrom; i < rows.length; i++) {
    const r = rows[i];

    if (!r || r.length === 0) {
      pendingLp = null;
      continue;
    }

    const a = colA(r);
    const b = colB(r);
    const c = colC(r);

    if (!a && !b && !c) {
      pendingLp = null;
      continue;
    }

    if (a && (VEHICLE_NAMES.includes(a) || SKIP_VEHICLES.has(a))) {
      currentVehicle = SKIP_VEHICLES.has(a) ? null : a;
    }

    if (!currentVehicle) continue;
    if (b && (VEHICLE_NAMES.includes(b) || SKIP_VEHICLES.has(b))) continue;

    if (b && isInvestmentLabel(c)) {
      pendingLp = {
        name: b,
        investment: rowToPeriodValues(r, periods),
      };
      continue;
    }

    if (isOwnershipLabel(c)) {
      if (pendingLp) {
        byVehicle[currentVehicle].push({
          name: pendingLp.name,
          investment: pendingLp.investment,
          ownership: rowToPeriodValues(r, periods),
        });
        pendingLp = null;
      } else if (b) {
        byVehicle[currentVehicle].push({
          name: b,
          investment: [],
          ownership: rowToPeriodValues(r, periods),
        });
      }
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

  const periods = detectPeriods(rows);
  if (periods.length === 0) {
    console.warn('[IRR] No period columns detected — header row 2 empty?');
    return null;
  }

  const companyBlocks = findCompanyBlocks(rows);
  const companies = [];
  for (let i = 0; i < companyBlocks.length; i++) {
    const block = companyBlocks[i];
    const end = (companyBlocks[i + 1]?.startRow) ?? 100;
    const data = parseCompanyBlock(rows, block.startRow, end, periods);
    companies.push({ name: block.name, ...data });
  }

  const vehicleBlocks = findVehicleBlocks(rows);
  const lpsByVehicle = parseLpRows(rows, periods);
  const vehicles = vehicleBlocks.map(({ name, startRow }) => ({
    name,
    ...parseVehicleBlock(rows, startRow, periods),
    lps: lpsByVehicle[name] || [],
  }));

  const lpNamesSet = new Set();
  for (const v of vehicles) for (const lp of v.lps) lpNamesSet.add(lp.name);
  const allLpNames = [...lpNamesSet].sort();

  // Legacy `years` field: unique year integers in period order. Anything
  // that only needs annual-granularity picking (Dashboard header default,
  // for example) still works via this list; period-precise consumers use
  // `periods[]` directly.
  const years = [...new Set(periods.map(p => p.year))].sort();

  console.log(`[IRR] Parsed ${periods.length} periods (${periods.filter(p=>p.isActual).length} actual), ${companies.length} companies, ${vehicles.length} vehicles, ${allLpNames.length} unique LPs`);

  return { periods, years, companies, vehicles, allLpNames };
}
