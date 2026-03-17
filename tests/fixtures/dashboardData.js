/**
 * Mock DashboardData fixtures for chart helper and insight tests.
 * Conforms to the DashboardData type defined in lib/data/types.js.
 */

/**
 * Standard fixture with 3 P&L companies and 2 cashflow companies.
 * 3 months of data (Jan-Mar 2025).
 * @type {import('@/lib/data/types').DashboardData}
 */
export const MOCK_DASHBOARD_DATA = {
  pnl: [
    {
      name: 'AllRx',
      metrics: {
        'Revenue': [
          { year: 2025, month: 1, value: 1056168 },
          { year: 2025, month: 2, value: 1032373 },
          { year: 2025, month: 3, value: 958120 },
        ],
        'EBITDA': [
          { year: 2025, month: 1, value: 240345 },
          { year: 2025, month: 2, value: 329155 },
          { year: 2025, month: 3, value: 206776 },
        ],
        'Gorss Margin, %': [
          { year: 2025, month: 1, value: 0.77 },
          { year: 2025, month: 2, value: 0.82 },
          { year: 2025, month: 3, value: 0.76 },
        ],
      },
    },
    {
      name: 'AllCare',
      metrics: {
        'Revenue': [
          { year: 2025, month: 1, value: 202868 },
          { year: 2025, month: 2, value: 228543 },
          { year: 2025, month: 3, value: 274252 },
        ],
        'EBITDA': [
          { year: 2025, month: 1, value: -149106 },
          { year: 2025, month: 2, value: -159782 },
          { year: 2025, month: 3, value: -137009 },
        ],
        'Gorss Margin, %': [
          { year: 2025, month: 1, value: 0.55 },
          { year: 2025, month: 2, value: 0.58 },
          { year: 2025, month: 3, value: 0.60 },
        ],
      },
    },
    {
      name: 'Osta',
      metrics: {
        'Revenue': [
          { year: 2025, month: 1, value: 64344 },
          { year: 2025, month: 2, value: 44683 },
          { year: 2025, month: 3, value: 44683 },
        ],
        'EBITDA': [
          { year: 2025, month: 1, value: -114632 },
          { year: 2025, month: 2, value: -111369 },
          { year: 2025, month: 3, value: -111610 },
        ],
        'Gorss Margin, %': [
          { year: 2025, month: 1, value: 0.45 },
          { year: 2025, month: 2, value: 0.48 },
          { year: 2025, month: 3, value: 0.48 },
        ],
      },
    },
  ],
  cashflow: [
    {
      name: 'AllRx',
      metrics: {
        'Cash Inflow': [
          { year: 2025, month: 1, value: 500000 },
          { year: 2025, month: 2, value: 480000 },
          { year: 2025, month: 3, value: 510000 },
        ],
        'Cash Outflow': [
          { year: 2025, month: 1, value: -400000 },
          { year: 2025, month: 2, value: -390000 },
          { year: 2025, month: 3, value: -420000 },
        ],
        'Net Cash Flow': [
          { year: 2025, month: 1, value: 100000 },
          { year: 2025, month: 2, value: 90000 },
          { year: 2025, month: 3, value: 90000 },
        ],
      },
    },
    {
      name: 'AllCare',
      metrics: {
        'Cash Inflow': [
          { year: 2025, month: 1, value: 300000 },
          { year: 2025, month: 2, value: 310000 },
          { year: 2025, month: 3, value: 320000 },
        ],
        'Cash Outflow': [
          { year: 2025, month: 1, value: -350000 },
          { year: 2025, month: 2, value: -360000 },
          { year: 2025, month: 3, value: -370000 },
        ],
        'Net Cash Flow': [
          { year: 2025, month: 1, value: -50000 },
          { year: 2025, month: 2, value: -50000 },
          { year: 2025, month: 3, value: -50000 },
        ],
      },
    },
  ],
  companies: ['AllCare', 'AllRx', 'Osta'],
  fetchedAt: '2026-03-12T10:00:00.000Z',
  expenses: [],
};

/**
 * Two-year fixture for YoY testing.
 * 6 months spanning 2025 (Oct-Dec) and 2026 (Jan-Mar).
 * AllRx has strong growth, AllCare crosses EBITDA breakeven, Osta has persistent losses.
 * @type {import('@/lib/data/types').DashboardData}
 */
export const MOCK_DASHBOARD_DATA_TWO_YEARS = {
  pnl: [
    {
      name: 'AllRx',
      metrics: {
        'Revenue': [
          { year: 2025, month: 10, value: 300000 },
          { year: 2025, month: 11, value: 310000 },
          { year: 2025, month: 12, value: 320000 },
          { year: 2026, month: 1, value: 500000 },
          { year: 2026, month: 2, value: 520000 },
          { year: 2026, month: 3, value: 540000 },
        ],
        'EBITDA': [
          { year: 2025, month: 10, value: 50000 },
          { year: 2025, month: 11, value: 55000 },
          { year: 2025, month: 12, value: 60000 },
          { year: 2026, month: 1, value: 100000 },
          { year: 2026, month: 2, value: 110000 },
          { year: 2026, month: 3, value: 120000 },
        ],
        'Gorss Margin, %': [
          { year: 2025, month: 10, value: 0.70 },
          { year: 2025, month: 11, value: 0.72 },
          { year: 2025, month: 12, value: 0.74 },
          { year: 2026, month: 1, value: 0.75 },
          { year: 2026, month: 2, value: 0.76 },
          { year: 2026, month: 3, value: 0.77 },
        ],
      },
    },
    {
      name: 'AllCare',
      metrics: {
        'Revenue': [
          { year: 2025, month: 10, value: 100000 },
          { year: 2025, month: 11, value: 110000 },
          { year: 2025, month: 12, value: 120000 },
          { year: 2026, month: 1, value: 200000 },
          { year: 2026, month: 2, value: 220000 },
          { year: 2026, month: 3, value: 240000 },
        ],
        'EBITDA': [
          { year: 2025, month: 10, value: -50000 },
          { year: 2025, month: 11, value: -40000 },
          { year: 2025, month: 12, value: -30000 },
          { year: 2026, month: 1, value: -10000 },
          { year: 2026, month: 2, value: 5000 },
          { year: 2026, month: 3, value: 15000 },
        ],
        'Gorss Margin, %': [
          { year: 2025, month: 10, value: 0.55 },
          { year: 2025, month: 11, value: 0.57 },
          { year: 2025, month: 12, value: 0.58 },
          { year: 2026, month: 1, value: 0.60 },
          { year: 2026, month: 2, value: 0.61 },
          { year: 2026, month: 3, value: 0.62 },
        ],
      },
    },
    {
      name: 'Osta',
      metrics: {
        'Revenue': [
          { year: 2025, month: 10, value: 30000 },
          { year: 2025, month: 11, value: 32000 },
          { year: 2025, month: 12, value: 34000 },
          { year: 2026, month: 1, value: 45000 },
          { year: 2026, month: 2, value: 48000 },
          { year: 2026, month: 3, value: 50000 },
        ],
        'EBITDA': [
          { year: 2025, month: 10, value: -80000 },
          { year: 2025, month: 11, value: -82000 },
          { year: 2025, month: 12, value: -85000 },
          { year: 2026, month: 1, value: -70000 },
          { year: 2026, month: 2, value: -68000 },
          { year: 2026, month: 3, value: -65000 },
        ],
        'Gorss Margin, %': [
          { year: 2025, month: 10, value: 0.45 },
          { year: 2025, month: 11, value: 0.46 },
          { year: 2025, month: 12, value: 0.47 },
          { year: 2026, month: 1, value: 0.48 },
          { year: 2026, month: 2, value: 0.49 },
          { year: 2026, month: 3, value: 0.50 },
        ],
      },
    },
  ],
  cashflow: [
    {
      name: 'AllRx',
      metrics: {
        'Cash Inflow': [
          { year: 2025, month: 10, value: 400000 },
          { year: 2025, month: 11, value: 410000 },
          { year: 2025, month: 12, value: 420000 },
          { year: 2026, month: 1, value: 500000 },
          { year: 2026, month: 2, value: 520000 },
          { year: 2026, month: 3, value: 540000 },
        ],
        'Cash Outflow': [
          { year: 2025, month: 10, value: -350000 },
          { year: 2025, month: 11, value: -360000 },
          { year: 2025, month: 12, value: -370000 },
          { year: 2026, month: 1, value: -400000 },
          { year: 2026, month: 2, value: -410000 },
          { year: 2026, month: 3, value: -420000 },
        ],
        'Net Cash Flow': [
          { year: 2025, month: 10, value: 50000 },
          { year: 2025, month: 11, value: 50000 },
          { year: 2025, month: 12, value: 50000 },
          { year: 2026, month: 1, value: 100000 },
          { year: 2026, month: 2, value: 110000 },
          { year: 2026, month: 3, value: 120000 },
        ],
      },
    },
    {
      name: 'AllCare',
      metrics: {
        'Cash Inflow': [
          { year: 2025, month: 10, value: 200000 },
          { year: 2025, month: 11, value: 210000 },
          { year: 2025, month: 12, value: 220000 },
          { year: 2026, month: 1, value: 300000 },
          { year: 2026, month: 2, value: 310000 },
          { year: 2026, month: 3, value: 320000 },
        ],
        'Cash Outflow': [
          { year: 2025, month: 10, value: -250000 },
          { year: 2025, month: 11, value: -260000 },
          { year: 2025, month: 12, value: -270000 },
          { year: 2026, month: 1, value: -320000 },
          { year: 2026, month: 2, value: -330000 },
          { year: 2026, month: 3, value: -340000 },
        ],
        'Net Cash Flow': [
          { year: 2025, month: 10, value: -50000 },
          { year: 2025, month: 11, value: -50000 },
          { year: 2025, month: 12, value: -50000 },
          { year: 2026, month: 1, value: -20000 },
          { year: 2026, month: 2, value: -20000 },
          { year: 2026, month: 3, value: -20000 },
        ],
      },
    },
  ],
  companies: ['AllCare', 'AllRx', 'Osta'],
  fetchedAt: '2026-03-12T10:00:00.000Z',
  expenses: [],
};
