// Mock P&L tab data matching real sheet layout
// Row structure: [colA, colB(company), colC(metric), colD, colE(Jan2025), colF(Feb2025), ...]
// Header row has month labels starting at index 4
export const MOCK_PNL_HEADER = [null, null, null, null, 'Jan 2025', 'Feb 2025', 'Mar 2025'];

export const MOCK_PNL_ROWS = [
  MOCK_PNL_HEADER,
  // Company 1: AllRx (has Cost of Sales and Gross Margin)
  [null, 'AllRx', null, null],
  [null, null, 'Revenue', null, 1056168, 1032373, 958120],
  [null, null, 'Cost of Sales', null, -243000, -185000, -230000],
  [null, null, 'Gross Profit', null, 813168, 847373, 728120],
  [null, null, 'Gorss Margin, %', null, 0.77, 0.82, 0.76],
  [null, null, 'SG&A Expenses', null, -400000, -380000, -390000],
  [null, null, 'EBITDA', null, 240345, 329155, 206776],
  // Blank row separator
  [],
  // Company 2: Curenta (no Cost of Sales, no Gross Margin)
  [null, 'Curenta', null, null],
  [null, null, 'Revenue', null, 500000, 520000, 540000],
  [null, null, 'SG&A Expenses', null, -300000, -310000, -320000],
  [null, null, 'EBITDA', null, 200000, 210000, 220000],
  [],
];
