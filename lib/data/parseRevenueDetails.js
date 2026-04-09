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
  const clean = typeof val === 'string' ? val.replace(/[,%$]/g, '').trim() : val;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
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

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const colA = String(row[0] ?? '').trim();
    const colB = String(row[1] ?? '').trim();
    const metricName = String(row[2] ?? '').trim();

    // Track section from column A (e.g. "Store", "RCM", "Visits", "Total Store")
    if (colA) currentSection = colA;

    // Skip "Total" summary rows
    if (currentSection.toLowerCase().startsWith('total')) { currentGroup = null; continue; }

    if (!metricName) continue;

    // New group starts when column B has a non-empty value
    if (colB) {
      // Use section prefix if there are multiple sections with same segment names
      const groupName = currentSection && colB !== currentSection ? `${colB} (${currentSection})` : colB;
      currentGroup = { name: groupName, section: currentSection, metrics: {} };
      groups.push(currentGroup);
    }

    if (!currentGroup) continue;

    // Extract monthly values
    const values = [];
    for (const col of monthCols) {
      const raw = row[col.index];
      const val = toNum(raw);
      if (val !== null) {
        values.push({ year: col.year, month: col.month, value: val });
      }
    }

    if (values.length > 0) {
      // Normalize metric names for consistent access
      const normalized = metricName
        .replace(/^RX,\s*#$/i, 'RX Count')
        .replace(/^Gross Margin,?\s*%?$/i, 'Gross Margin %')
        .replace(/^Cost per SUs$/i, 'Cost per SU');
      currentGroup.metrics[normalized] = values;
      // Also store original name if different
      if (normalized !== metricName) currentGroup.metrics[metricName] = values;
    }
  }

  return groups;
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

  if (allCare.length === 0 && allRx.length === 0) return null;

  console.log(`[REVENUE_DETAILS] AllCare: ${allCare.length} service lines (${allCare.map(s => s.name).join(', ')}), AllRx: ${allRx.length} segments (${allRx.map(s => s.name).join(', ')})`);
  return {
    AllCare: { serviceLines: allCare },
    AllRx: { segments: allRx },
  };
}
