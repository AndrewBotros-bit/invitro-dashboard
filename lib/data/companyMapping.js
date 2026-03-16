/**
 * Maps expense sheet company names to canonical P&L tab names.
 * P&L names are the canonical source of truth.
 */
export const EXPENSE_TO_CANONICAL = {
  'AllRX': 'AllRx',
  'Curenta Technology LLC': 'Curenta',
  'InVitro Studio, LLC': 'InVitro Studio',
  'AllCare': 'AllCare',
  'Osta LLC': 'Osta',
  'Needles': 'Needles',
};

/**
 * Returns the canonical company name for a given expense sheet name.
 * Unknown names pass through unchanged.
 * @param {string} expenseSheetName
 * @returns {string}
 */
export function canonicalName(expenseSheetName) {
  return EXPENSE_TO_CANONICAL[expenseSheetName] || expenseSheetName;
}
