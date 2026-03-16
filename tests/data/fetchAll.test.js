import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_PNL_ROWS } from '@/tests/fixtures/pnlRows';
import { MOCK_CASHFLOW_ROWS } from '@/tests/fixtures/cashflowRows';
import { MOCK_EXPENSE_ROWS } from '@/tests/fixtures/expenseRows';

// Mock the googleSheets module
vi.mock('@/lib/googleSheets', () => ({
  batchGetSheetValues: vi.fn(),
  getExpenseSheetValues: vi.fn(),
}));

describe('fetchAllData', () => {
  beforeEach(() => {
    vi.resetModules();
    // Set required env vars
    process.env.INVITRO_MAIN_CONSOLIDATED_SHEET_ID = 'test-sheet-id';
    process.env.INVITRO_EXPENSE_SHEET_ID = 'test-expense-id';
  });

  it('fetches data and returns DashboardData shape', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    const data = await fetchAllData();

    expect(data).toHaveProperty('pnl');
    expect(data).toHaveProperty('cashflow');
    expect(data).toHaveProperty('expenses');
    expect(data).toHaveProperty('companies');
    expect(data).toHaveProperty('fetchedAt');
  });

  it('pnl contains parsed company data', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    const data = await fetchAllData();

    expect(data.pnl).toHaveLength(2); // AllRx, Curenta
    expect(data.pnl.map(c => c.name)).toContain('AllRx');
  });

  it('companies is sorted union of all sources', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    const data = await fetchAllData();

    // Union of P&L (AllRx, Curenta), Cashflow (AllRx, Curenta), Expenses (AllRx, Curenta, Osta, InVitro Studio, Needles)
    expect(data.companies).toContain('AllRx');
    expect(data.companies).toContain('Curenta');
    expect(data.companies).toContain('Osta');
    expect(data.companies).toContain('InVitro Studio');
    expect(data.companies).toContain('Needles');
    // Should be sorted alphabetically
    const sorted = [...data.companies].sort();
    expect(data.companies).toEqual(sorted);
  });

  it('fetchedAt is a valid ISO timestamp', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    const data = await fetchAllData();

    expect(() => new Date(data.fetchedAt)).not.toThrow();
    expect(new Date(data.fetchedAt).toISOString()).toBe(data.fetchedAt);
  });

  it('propagates API errors (no fallback)', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockRejectedValue(new Error('API unreachable'));
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    await expect(fetchAllData()).rejects.toThrow('API unreachable');
  });
});
