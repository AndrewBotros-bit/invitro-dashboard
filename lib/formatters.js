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
