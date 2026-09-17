/**
 * Format a monetary value for display. Returns '---' for null/undefined.
 * @param {number|null|undefined} v
 * @returns {string}
 */
export const fmt = (v) => {
  if (v === null || v === undefined) return '---';
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

/**
 * Format a monetary value in short form. Returns '---' for null/undefined.
 * @param {number|null|undefined} v
 * @returns {string}
 */
export const fmtShort = (v) => {
  if (v === null || v === undefined) return '---';
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
};

/**
 * Format a decimal as percentage. Returns '---' for null/undefined.
 * @param {number|null|undefined} v
 * @returns {string}
 */
export const pct = (v) => {
  if (v === null || v === undefined) return '---';
  return `${(v * 100).toFixed(1)}%`;
};

/**
 * Index of the period that the given date falls inside — the earliest
 * period whose end date is on or after `now`.
 *
 * This is what the dashboard lands on by default. Deliberately
 * DATE-driven, not data-driven: per Andrew, "if we are in Q3 then land
 * the page at Q3". Opening on Q3 while standing in Q3 is what a CFO
 * expects, even though the quarter is still part forecast — the old
 * behaviour walked backwards to the last period with complete actuals
 * and so opened on Q2 for the whole of Q3.
 *
 * Works for the mixed grid: the annual FY rows end Dec 31 of their year,
 * so a date in 2024 resolves to FY 2024 and a date in Q3 2026 resolves
 * to Q3 2026.
 *
 * Returns the final period when `now` is past the end of the grid, and
 * -1 when there are no periods or none carry a usable end date, so
 * callers can fall back.
 *
 * @param {Array<{endDate?: string}>} periods
 * @param {Date|string|number} [now]
 * @returns {number}
 */
export function currentPeriodIndex(periods, now = new Date()) {
  if (!Array.isArray(periods) || periods.length === 0) return -1;
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(t)) return -1;
  let sawEndDate = false;
  for (let i = 0; i < periods.length; i++) {
    const end = periods[i]?.endDate ? Date.parse(periods[i].endDate) : NaN;
    if (!Number.isFinite(end)) continue;
    sawEndDate = true;
    if (end >= t) return i;
  }
  return sawEndDate ? periods.length - 1 : -1;
}
