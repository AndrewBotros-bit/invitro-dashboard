/**
 * Fund Timeline parser — per-LP monthly capital calls + fund deployment.
 *
 * Source: a separate spreadsheet the fund admin maintains, containing two
 * tabs we care about:
 *
 *   1. 'Cash Flow Timeline'  — one row per (LP, bank account) with a
 *      "Total Commitment" column and one column per calendar month
 *      (headers like "9/1/2024", "10/1/2024", …). Some LPs have multiple
 *      rows for multiple accounts (Fr. Botros had JPM USD + QNB EGP);
 *      we consolidate those into a single per-LP series.
 *
 *   2. 'Ownerhsip %'  — [SIC — typo in source tab name is intentional]
 *      per-LP × per-year: "Total collected in YYYY", "Mang. fees",
 *      "{YYYY}" (net after fees), "{YYYY} ownership %". Two columns per
 *      year (amount + %). Used to derive management fees for the
 *      net-of-fees ownership%.
 *
 * We do NOT use the "Ownership %" tab's ownership figures directly —
 * we recompute from per-LP net-called totals so the derivation is
 * transparent and produces monthly-precise numbers.
 *
 * Returns null if the Timeline tab is empty (env var missing / sheet
 * unreachable). Callers should treat null as "fall back to annual XIRR
 * from the IRR sheet".
 */

/**
 * Coerce a formatted-value cell to a number.
 * Handles: "50,000", "$ 1,712,500", "-50,000", "(50,000)", "", null.
 */
function toNumberOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  let s = String(val).trim();
  if (!s) return null;
  let negate = false;
  if (/^\(.*\)$/.test(s)) {
    negate = true;
    s = s.slice(1, -1).trim();
  }
  const clean = s.replace(/[,$\s]/g, '');
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return negate ? -n : n;
}

/**
 * Parse a "M/D/YYYY" header cell into { year, month, day }.
 * Timeline uses first-of-month dates ("9/1/2024"); day is preserved
 * verbatim so callers see the exact date the CFO entered.
 * Returns null for non-date cells (like "Total Commitment", "Sanity Check").
 */
function parseDateHeader(cell) {
  if (typeof cell !== 'string') return null;
  const m = cell.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Detect the column indices that carry date headers.
 * Returns [{ index, year, month, day }] in the order they appear.
 */
function detectDateColumns(headerRow) {
  const cols = [];
  for (let i = 0; i < headerRow.length; i++) {
    const parsed = parseDateHeader(headerRow[i]);
    if (parsed) cols.push({ index: i, ...parsed });
  }
  return cols;
}

/**
 * Parse the 'Cash Flow Timeline' tab.
 *
 * Structure (0-indexed):
 *   row 0: header (col 0=LP Name, 1=Bank, 2=Currency, 3=Total Commitment,
 *          4+=date columns, last=Sanity Check)
 *   rows 1..N: LP rows (one per bank account)
 *   row N+1: "Total Commitment as of ..." aggregator (colA starts with "Total")
 *   remaining: deployment / balance rows (not consumed here)
 *
 * @returns {Map<string, {commitment: number|null, flows: Array<{year,month,day,amount}>}>}
 *   Keyed by LP name (multi-account LPs consolidated).
 */
function parseLpRows(rows) {
  const perLp = new Map();
  if (!rows || rows.length < 2) return perLp;

  const dateCols = detectDateColumns(rows[0]);
  if (dateCols.length === 0) return perLp;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const name = String(row[0] ?? '').trim();
    if (!name) continue;
    // Stop at the aggregator row ("Total Commitment as of Oct 2024", etc.)
    // and any subsequent deployment/balance section. LP rows are contiguous
    // at the top; anything starting with "Total" or "Incoming" or
    // "Deployment" is not an LP row.
    if (/^(Total|Incoming|Deployment|Breakdown|Legal|Osta|AllCare|Curenta|Needles|AllRx|InVitro|Amir)/i.test(name)
        && !perLp.has(name)) {
      break;
    }

    // Individual bank-account row — may or may not have a commitment cell.
    const commitment = toNumberOrNull(row[3]);
    const flows = [];
    for (const col of dateCols) {
      const amt = toNumberOrNull(row[col.index]);
      // Skip zeros and blanks — they add no signal to XIRR.
      if (amt != null && amt !== 0) {
        flows.push({ year: col.year, month: col.month, day: col.day, amount: amt });
      }
    }

    if (perLp.has(name)) {
      // Multi-account consolidation (e.g. Fr. Botros JPM + QNB rows).
      // Sum commitments and merge flows; if two rows land on the same
      // month, sum the amounts.
      const existing = perLp.get(name);
      existing.commitment = (existing.commitment ?? 0) + (commitment ?? 0);
      for (const f of flows) {
        const dup = existing.flows.find(x => x.year === f.year && x.month === f.month);
        if (dup) dup.amount += f.amount;
        else existing.flows.push(f);
      }
      // Keep flows date-sorted.
      existing.flows.sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.day - b.day));
    } else {
      perLp.set(name, { commitment, flows });
    }
  }
  return perLp;
}

/**
 * Parse the 'Ownerhsip %' tab for per-LP per-year mgmt fees + authoritative
 * year-end ownership%.
 *
 * Structure:
 *   row 0: header — [LP Name, Bank, Currency, 'Total collected in YYYY',
 *                    'Mang. fees', YYYY_1, YYYY_1_pct, YYYY_2, YYYY_2_pct, ...]
 *   rows 1..N: LP rows. Each pair (amount, percent) is one year. Amount
 *              is cumulative NET-of-fees dollars; percent is ownership%.
 *
 * We use the CFO's exact ownership% values (not a derived formula) so the
 * UI shows the same numbers the CFO sees — the fee model in the sheet
 * (one-time deduction taken in the LP's first contribution year) is
 * bespoke enough that reproducing it from scratch invites drift.
 *
 * Between year-ends, callers should hold the year's snapshot flat (a
 * fresh contribution mid-year changes ownership only at next year-end
 * per the CFO's convention).
 *
 * @returns {Map<string, {mgmtFees: number, ownershipByYear: Object.<number, number>}>}
 *   ownershipByYear is a fraction (0.2356 = 23.56%), keyed by year integer.
 */
function parseOwnershipRows(rows) {
  const perLp = new Map();
  if (!rows || rows.length < 2) return perLp;
  const header = rows[0] ?? [];
  const feeColIdx = header.findIndex(h => /mang.*fee|mgmt.*fee|management.*fee/i.test(String(h ?? '')));
  // Detect (yearAmountCol, yearPctCol) pairs. A year cell looks like a
  // 4-digit number as a string; pct cell is the very next column.
  const yearPairs = [];
  for (let i = 0; i < header.length; i++) {
    const cell = String(header[i] ?? '').trim();
    if (/^\d{4}$/.test(cell)) {
      // Skip if the header cell before this is "Total collected in YYYY"
      // — that's the initial-collection column, not an annual snapshot.
      const prev = String(header[i - 1] ?? '').trim();
      if (/^Total collected/i.test(prev)) continue;
      yearPairs.push({ year: parseInt(cell, 10), amountCol: i, pctCol: i + 1 });
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = String(row[0] ?? '').trim();
    if (!name || /^total/i.test(name)) continue;
    const fee = feeColIdx !== -1 ? toNumberOrNull(row[feeColIdx]) : null;
    const ownershipByYear = {};
    for (const { year, pctCol } of yearPairs) {
      // Percent cells may render as "23.56%" or 0.2356 depending on
      // FORMATTED_VALUE vs UNFORMATTED. Normalize to a fraction.
      const raw = row[pctCol];
      if (raw == null || raw === '') continue;
      const s = String(raw).trim();
      let pct;
      if (s.endsWith('%')) {
        pct = parseFloat(s.slice(0, -1).replace(/,/g, '')) / 100;
      } else {
        const n = parseFloat(s.replace(/,/g, ''));
        pct = n > 1 ? n / 100 : n; // heuristic: >1 means it's already in %
      }
      if (Number.isFinite(pct)) ownershipByYear[year] = pct;
    }

    const existing = perLp.get(name);
    if (existing) {
      if (fee != null) existing.mgmtFees += Math.abs(fee);
      Object.assign(existing.ownershipByYear, ownershipByYear);
    } else {
      perLp.set(name, {
        mgmtFees: fee != null ? Math.abs(fee) : 0,
        ownershipByYear,
      });
    }
  }
  return perLp;
}

/**
 * Parse both Timeline tabs into a single vehicle-level structure.
 *
 * @param {any[][]} timelineRows - 'Cash Flow Timeline' tab rows
 * @param {any[][]} ownershipRows - 'Ownerhsip %' tab rows (typo in tab name)
 * @returns {null | {
 *   perLp: Object.<string, {
 *     commitment: number|null,
 *     mgmtFees: number,
 *     flows: Array<{year: number, month: number, day: number, amount: number}>,
 *   }>,
 *   fundCumCalledByMonth: Array<{year: number, month: number, cumGross: number, cumNet: number}>,
 * }}
 */
export function parseFundTimeline(timelineRows, ownershipRows) {
  const lpFlows = parseLpRows(timelineRows);
  if (lpFlows.size === 0) return null;
  const lpFees = parseOwnershipRows(ownershipRows);

  // Assemble the per-LP record.
  const perLp = {};
  for (const [name, { commitment, flows }] of lpFlows) {
    const feeRec = lpFees.get(name);
    perLp[name] = {
      commitment,
      mgmtFees: feeRec?.mgmtFees ?? 0,
      flows,
      // Authoritative year-end ownership% from the 'Ownerhsip %' tab.
      // Matches what the CFO sees. Empty {} if the ownership tab is
      // unavailable — callers should fall back to their own derivation
      // (LP gross-called / fund gross-called) in that case.
      ownershipByYear: feeRec?.ownershipByYear ?? {},
    };
  }

  // Fund-level cumulative GROSS called by month — used for XIRR
  // reconciliation and as a fallback ownership denominator when the
  // Ownership tab has no snapshot for the queried year.
  const monthKey = (y, m) => y * 12 + (m - 1);
  const allMonths = new Set();
  for (const { flows } of Object.values(perLp)) {
    for (const f of flows) allMonths.add(monthKey(f.year, f.month));
  }
  const sortedMonths = [...allMonths].sort((a, b) => a - b);

  const fundCumCalledByMonth = [];
  const lpCumGross = {}; // running cumulative per LP
  for (const key of sortedMonths) {
    const year = Math.floor(key / 12);
    const month = (key % 12) + 1;
    for (const [name, rec] of Object.entries(perLp)) {
      const monthlyGross = rec.flows
        .filter(f => monthKey(f.year, f.month) === key)
        .reduce((a, f) => a + f.amount, 0);
      if (monthlyGross !== 0) {
        lpCumGross[name] = (lpCumGross[name] ?? 0) + monthlyGross;
      }
    }
    const fundGross = Object.values(lpCumGross).reduce((a, v) => a + v, 0);
    fundCumCalledByMonth.push({ year, month, cumGross: fundGross });
  }

  return { perLp, fundCumCalledByMonth };
}
