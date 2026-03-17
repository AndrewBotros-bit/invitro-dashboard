import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MOCK_PNL_ROWS } from '@/tests/fixtures/pnlRows';
import { MOCK_CASHFLOW_ROWS } from '@/tests/fixtures/cashflowRows';
import { MOCK_EXPENSE_ROWS } from '@/tests/fixtures/expenseRows';
import {
  EMPTY_PNL_ROWS,
  MISSING_HEADER_EXPENSE_ROWS,
  VALID_MINIMAL_EXPENSE_ROWS,
} from '@/tests/fixtures/invalidRows';

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

  it('throws with [DATA VALIDATION] prefix when sheet structure is invalid', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: EMPTY_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    await expect(fetchAllData()).rejects.toThrow('[DATA VALIDATION]');
  });

  it('collects all validation errors in thrown message', async () => {
    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    // Empty P&L and Cashflow, bad expense headers
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: EMPTY_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: [] },
    ]);
    getExpenseSheetValues.mockResolvedValue(MISSING_HEADER_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    try {
      await fetchAllData();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.message).toContain('P&L');
      expect(err.message).toContain('Cashflow');
      expect(err.message).toContain('Expenses');
    }
  });

  it('logs warnings to console.warn with [DATA WARNING] prefix', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    // We also mock validateSheetData to inject a warning
    vi.doMock('@/lib/data/validate', () => ({
      validateSheetData: () => ({
        errors: [],
        warnings: [{ severity: 'warning', tab: 'P&L', message: 'Test warning' }],
      }),
    }));

    // Re-import after mocking validate
    const { fetchAllData } = await import('@/lib/data/index');
    await fetchAllData();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[DATA WARNING]'));

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('logs build manifest after successful parse', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    await fetchAllData();

    const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allLogs).toContain('Build Manifest');
    expect(allLogs).toContain('AllRx');

    logSpy.mockRestore();
  });

  it('manifest includes per-company metrics detail', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { batchGetSheetValues, getExpenseSheetValues } = await import('@/lib/googleSheets');
    batchGetSheetValues.mockResolvedValue([
      { range: "'P&L'!A1:ZZ", values: MOCK_PNL_ROWS },
      { range: "'Cashflow'!A1:ZZ", values: MOCK_CASHFLOW_ROWS },
    ]);
    getExpenseSheetValues.mockResolvedValue(MOCK_EXPENSE_ROWS);

    const { fetchAllData } = await import('@/lib/data/index');
    await fetchAllData();

    const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
    // AllRx: has 3 months, 6 P&L metrics, 3 cashflow metrics, 2 expense rows
    expect(allLogs).toMatch(/AllRx.*months.*P&L metrics.*expense rows/);

    logSpy.mockRestore();
  });
});
