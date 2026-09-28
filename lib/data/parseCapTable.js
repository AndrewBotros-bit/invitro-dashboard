/**
 * Parses a portfolio-company cap table tab (currently "AllCare - Captable")
 * into a list of priced rounds with each holder's share count and the value
 * of their stake at that round's price.
 *
 * WHY THIS EXISTS
 * ---------------
 * The dashboard marks each portco at a revenue/ARR multiple ("Company
 * valuation" on the IRR & Valuation tab). That is a portfolio-FMV view. A
 * priced round is a different, independent view — what a third party
 * actually paid. The two disagree, sometimes sharply: at Q3 2026 AllCare is
 * marked at $59.2M (11.5x ARR) while the Mar-26 round prices it at $38.2M.
 * Both are legitimate; showing only one is what gets a CFO in trouble.
 *
 * WHY EVERYTHING IS RESOLVED BY HEADER LABEL
 * ------------------------------------------
 * The three round blocks on the tab do NOT share a column layout. Block 2
 * carries an extra "2026 Round Investment amounts, $" column, which pushes
 * Price Per Share from column F to column G and every column after it along
 * by one. Index-based parsing reads block 2 one column out and silently
 * returns the wrong price. So each block resolves its own columns from its
 * own header row.
 *
 * WHY THE ROUND YEAR IS NOT READ FROM THE DATE CELL
 * -------------------------------------------------
 * The date cells above each block cannot be trusted. Block 1 holds a real
 * date (serial 46112 = 31 Mar 2026, displayed "Mar-26" via a mmm-yy format
 * — correct). Blocks 2 and 3 hold 46049 and 46050, which are 27 and 28
 * JANUARY 2026, displayed as "Jan-27" and "Jan-28" via a day-based format.
 * They were typed meaning January 2027 and January 2028; Sheets read them
 * as a day of the current year. They look right and are two years wrong.
 *
 * The year therefore comes from the "Pre-<year> Round Valuation, $" header,
 * which states the intent unambiguously — except that block 3's header row
 * is a copy of block 2's and also says "Pre-2027". A monotonic guard fixes
 * that: each block is a later round than the one before it, so a year that
 * fails to advance is bumped. Blocks resolve to 2026, 2027, 2028.
 *
 * parseCapTables() reports both years so the caller can warn at build time
 * when the sheet's own label disagrees with the derived year.
 */

/** Cap-table holder name -> the name the rest of the dashboard uses. */
const HOLDER_ALIASES = {
  'invitro fund': 'InVitro Fund',
  'invitro ventures': 'InVitro Ventures',
  'curenta enterprise': 'Curenta Enterprise',
  'barsoum brothers': 'Barsoum Brothers',
};

/** Cap-table block title -> the company name used on the IRR tab. */
const COMPANY_ALIASES = {
  'allcare ai holdco': 'AllCare + Curenta',
};

const norm = (v) => String(v ?? '').trim();
const lower = (v) => norm(v).toLowerCase();

/** Sheet numbers arrive as numbers when unformatted, strings when not. */
function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[,$%\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const cell = (row, idx) => (idx == null || !row ? null : row[idx]);

/**
 * A header row is the one carrying "Price Per Share". Returns a map of the
 * columns this block needs, or null when the row is not a header.
 */
function resolveColumns(row) {
  if (!row) return null;
  const idx = {};
  let preValuationCol = null;

  for (let c = 0; c < row.length; c++) {
    const h = lower(row[c]);
    if (!h) continue;
    if (h === 'price per share') idx.pps = c;
    else if (h.startsWith('shares post the round')) idx.shares = c;
    else if (h === 'post money ownership') idx.ownership = c;
    else if (/^post-\d{4} round valuation/.test(h)) idx.stakeValue = c;
    else if (/^pre-\d{4} round valuation/.test(h)) {
      preValuationCol = c;
      const m = h.match(/^pre-(\d{4})/);
      if (m) idx.headerYear = Number(m[1]);
    }
  }
  if (idx.pps == null || idx.shares == null || idx.stakeValue == null) return null;

  // Two blocks carry more than one "<year> Round Investment amounts, $"
  // column — the prior round's carried over, and this round's. The one that
  // belongs to THIS round is the first one after the pre-money column.
  for (let c = (preValuationCol ?? 0) + 1; c < row.length; c++) {
    if (/^\d{4} round investment amounts/.test(lower(row[c]))) { idx.investment = c; break; }
  }
  return idx;
}

/** Nearest standalone title above a header row (col B filled, C-E empty). */
function findBlockTitle(rows, headerRow) {
  for (let r = headerRow - 1; r >= Math.max(0, headerRow - 4); r--) {
    const row = rows[r];
    if (!row) continue;
    const b = norm(row[1]);
    if (b && !norm(row[2]) && !norm(row[3]) && !norm(row[4])) return b;
  }
  return null;
}

/**
 * Parse every round block on a cap table tab.
 *
 * @param {any[][]} rows Raw sheet rows (unformatted values preferred).
 * @returns {{company: string, rounds: Array<{
 *   index: number, year: number, yearDerived: boolean, headerYear: number|null,
 *   pricePerShare: number|null, postMoney: number|null, totalRaised: number|null,
 *   holders: Record<string, {shares: number|null, ownership: number|null,
 *                            stakeValue: number|null, investment: number|null}>
 * }>}|null}
 */
export function parseCapTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const rounds = [];
  let company = null;

  for (let r = 0; r < rows.length; r++) {
    const cols = resolveColumns(rows[r]);
    if (!cols) continue;

    const title = findBlockTitle(rows, r);
    if (title && !company) company = COMPANY_ALIASES[lower(title)] ?? title;

    const holders = {};
    let postMoney = null;
    let totalRaised = null;
    let pricePerShare = null;

    for (let h = r + 1; h < rows.length; h++) {
      const row = rows[h];
      const name = norm(row?.[0]);
      if (!row || (!name && !toNum(cell(row, cols.shares)))) {
        // Blank spacer rows are normal inside a block; stop only once a new
        // block's header appears, which the outer loop will pick up anyway.
        if (resolveColumns(row)) break;
        continue;
      }
      if (resolveColumns(row)) break;

      if (pricePerShare == null) pricePerShare = toNum(cell(row, cols.pps));

      if (lower(name) === 'total') {
        postMoney = toNum(cell(row, cols.stakeValue));
        totalRaised = toNum(cell(row, cols.investment));
        break;
      }
      if (!name) continue;

      holders[HOLDER_ALIASES[lower(name)] ?? name] = {
        shares: toNum(cell(row, cols.shares)),
        ownership: toNum(cell(row, cols.ownership)),
        stakeValue: toNum(cell(row, cols.stakeValue)),
        investment: toNum(cell(row, cols.investment)),
      };
    }

    if (Object.keys(holders).length === 0) continue;

    // Monotonic guard — see the header comment. Block 3 repeats block 2's
    // "Pre-2027" header; without this both would claim 2027 and the "latest
    // round as of <period>" lookup would never reach the third round.
    const prevYear = rounds.length ? rounds[rounds.length - 1].year : null;
    let year = cols.headerYear ?? null;
    if (prevYear != null && (year == null || year <= prevYear)) year = prevYear + 1;

    rounds.push({
      index: rounds.length + 1,
      year,
      // True when the block's own header year had to be overridden by the
      // monotonic guard — i.e. the sheet's labelling is ambiguous here.
      yearDerived: cols.headerYear !== year,
      headerYear: cols.headerYear ?? null,
      pricePerShare,
      postMoney,
      totalRaised,
      holders,
    });

    r = r + 1; // header consumed; holder scan already advanced past its rows
  }

  if (rounds.length === 0) return null;
  return { company: company ?? 'Unknown', rounds };
}

/**
 * Most recent round at or before `asOfYear`. Returns null when the first
 * round has not happened yet from that viewpoint — a 2025 viewer should not
 * see a 2026 price.
 */
export function roundAsOf(capTable, asOfYear) {
  if (!capTable?.rounds?.length || asOfYear == null) return null;
  let found = null;
  for (const round of capTable.rounds) {
    if (round.year != null && round.year <= asOfYear) found = round;
  }
  return found;
}
