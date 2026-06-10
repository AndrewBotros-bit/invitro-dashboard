/**
 * Parser for "Total revenues, margins & KPOs" sheet.
 * Two tabs: AllCare (service lines) and AllRx (customer segments).
 *
 * Sheet structure:
 * - Row 1: date headers in "M/D/YYYY" format (e.g. "1/1/2026")
 * - Row 2: may be empty
 * - Data rows: col A = category label (only on first group), col B = service line/segment name (only on first metric row), col C = metric name
 * - Columns D onwards: monthly values aligned to row 1 dates
 */

function toNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  // Accounting parentheses → negation: "(185,965)" → -185965.
  // Also strips %, $, commas and surrounding whitespace.
  let s = String(val).trim();
  let negate = false;
  if (/^\(.*\)$/.test(s)) {
    negate = true;
    s = s.slice(1, -1).trim();
  }
  const clean = s.replace(/[,%$]/g, '');
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return negate ? -n : n;
}

/**
 * Detect month columns from header row.
 * Headers are date strings like "1/1/2026", "12/1/2025", etc.
 */
const MONTH_MAP = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12,
};

function detectMonthColumns(headerRow) {
  const cols = [];
  for (let i = 3; i < (headerRow?.length ?? 0); i++) {
    const h = String(headerRow[i] ?? '').trim();
    if (!h) continue;

    let month = null, year = null;

    // Format 1: "M/D/YYYY" or "M/D/YY" (e.g. "1/1/2026", "12/1/2025")
    const dateMatch = h.match(/^(\d{1,2})\/\d{1,2}\/(\d{2,4})$/);
    if (dateMatch) {
      month = parseInt(dateMatch[1]);
      year = parseInt(dateMatch[2]);
    }

    // Format 2: "Mon-YY" or "Mon-YYYY" (e.g. "Jan-26", "Dec-2025")
    if (!month) {
      const monMatch = h.match(/^([A-Za-z]+)[\s.\-\/]+(\d{2,4})$/);
      if (monMatch) {
        month = MONTH_MAP[monMatch[1]];
        year = parseInt(monMatch[2]);
      }
    }

    if (month && year) {
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && year >= 2024) {
        cols.push({ index: i, year, month });
      }
    }
  }
  return cols;
}

/**
 * Parse a single tab (AllCare or AllRx).
 * Groups are detected by non-empty column B values.
 */
function parseTab(rows) {
  if (!rows || rows.length < 2) return [];

  // Row 0 (or 1) should have the date headers
  let headerIdx = -1;
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const cols = detectMonthColumns(rows[i]);
    if (cols.length >= 3) { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    console.warn('[REVENUE_DETAILS] No header row with date columns found');
    return [];
  }

  const monthCols = detectMonthColumns(rows[headerIdx]);
  console.log(`[REVENUE_DETAILS] Found ${monthCols.length} month columns (header at row ${headerIdx})`);

  const groups = [];
  let currentGroup = null;
  let currentSection = ''; // column A section label (e.g. "Store", "RCM")
  // "Total" block accumulator — captures AllCare-wide totals (SUs, Active
  // Patients, Active Facilities, etc.) that appear under a colA="Total"
  // section. These don't belong to any single service line; they're
  // company-wide KPIs used by the KPIs & Unit Economics tab.
  const totalsMetrics = {};
  let inTotalsBlock = false;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const colA = String(row[0] ?? '').trim();
    const colB = String(row[1] ?? '').trim();
    const metricName = String(row[2] ?? '').trim();

    // Track section from column A (e.g. "Store", "RCM", "Visits", "Total Store")
    if (colA) currentSection = colA;

    // Detect "Total" section — the rows here are captured into a separate
    // totals bucket (Active Patients / Active Facilities etc.) instead of
    // bleeding into the last service line group. Subtotal blocks like
    // "Total Visits" / "Total Store" / "Total CM" are still skipped (they
    // double-count and aren't useful at the consumer layer). Only the
    // bare "Total" (whole-company totals) is captured.
    const isTotalSection = currentSection.toLowerCase().startsWith('total');
    inTotalsBlock = currentSection.toLowerCase().trim() === 'total';
    if (isTotalSection && !inTotalsBlock) { currentGroup = null; continue; }

    if (!metricName) continue;

    // New group starts when column B has a non-empty value (and we're not
    // in the totals block where colB is empty by design)
    if (colB && !inTotalsBlock) {
      // Use section prefix if there are multiple sections with same segment names
      const groupName = currentSection && colB !== currentSection ? `${colB} (${currentSection})` : colB;
      currentGroup = { name: groupName, section: currentSection, metrics: {} };
      groups.push(currentGroup);
    }

    // Extract monthly values (used for both groups and totals)
    const values = [];
    for (const col of monthCols) {
      const raw = row[col.index];
      const val = toNum(raw);
      if (val !== null) {
        values.push({ year: col.year, month: col.month, value: val });
      }
    }
    if (values.length === 0) continue;

    // Normalize metric names for consistent access. "Active Facilites"
    // (sheet typo, missing "i") is normalized to "Active Facilities" so
    // downstream code can read the corrected name.
    const normalized = metricName
      .replace(/^RX,\s*#$/i, 'RX Count')
      .replace(/^Gross Margin,?\s*%?$/i, 'Gross Margin %')
      .replace(/^Cost per SUs$/i, 'Cost per SU')
      .replace(/^Active Facilites$/i, 'Active Facilities');

    if (inTotalsBlock) {
      // Whole-company totals — keyed under company-wide names.
      totalsMetrics[normalized] = values;
      if (normalized !== metricName) totalsMetrics[metricName] = values;
      continue;
    }

    if (!currentGroup) continue;
    currentGroup.metrics[normalized] = values;
    if (normalized !== metricName) currentGroup.metrics[metricName] = values;
  }

  // Returns groups + totals. Caller decides where to attach totals (for
  // AllCare → data.revenueDetails.AllCare.totals).
  return { groups, totals: totalsMetrics };
}

/**
 * Parse both AllCare and AllRx tabs.
 * @param {any[][]} allCareRows
 * @param {any[][]} allRxRows
 * @returns {{ AllCare: { serviceLines: Array }, AllRx: { segments: Array } } | null}
 */
export function parseRevenueDetails(allCareRows, allRxRows) {
  const allCare = parseTab(allCareRows);
  const allRx = parseTab(allRxRows);

  if (allCare.groups.length === 0 && allRx.groups.length === 0) return null;

  console.log(`[REVENUE_DETAILS] AllCare: ${allCare.groups.length} service lines (${allCare.groups.map(s => s.name).join(', ')}), AllRx: ${allRx.groups.length} segments (${allRx.groups.map(s => s.name).join(', ')})`);
  console.log(`[REVENUE_DETAILS] AllCare totals: ${Object.keys(allCare.totals).length} metrics (${Object.keys(allCare.totals).join(', ')})`);
  return {
    AllCare: { serviceLines: allCare.groups, totals: allCare.totals },
    AllRx: { segments: allRx.groups, totals: allRx.totals },
  };
}
