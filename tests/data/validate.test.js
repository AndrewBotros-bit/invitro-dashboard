import { describe, it, expect } from 'vitest';
import { validateSheetData } from '@/lib/data/validate';
import {
  EMPTY_PNL_ROWS,
  NO_MONTH_PNL_ROWS,
  NO_COMPANY_PNL_ROWS,
  MISSING_HEADER_EXPENSE_ROWS,
  VALID_MINIMAL_PNL_ROWS,
  VALID_MINIMAL_CASHFLOW_ROWS,
  VALID_MINIMAL_EXPENSE_ROWS,
} from '@/tests/fixtures/invalidRows';
import { MOCK_PNL_ROWS } from '@/tests/fixtures/pnlRows';
import { MOCK_CASHFLOW_ROWS } from '@/tests/fixtures/cashflowRows';
import { MOCK_EXPENSE_ROWS } from '@/tests/fixtures/expenseRows';

describe('validateSheetData', () => {
  it('returns error when P&L tab is empty', () => {
    const result = validateSheetData({
      pnlRows: EMPTY_PNL_ROWS,
      cashflowRows: MOCK_CASHFLOW_ROWS,
      expenseRows: MOCK_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', tab: 'P&L', message: expect.stringContaining('empty') }),
      ]),
    );
  });

  it('returns error when P&L header has no month columns', () => {
    const result = validateSheetData({
      pnlRows: NO_MONTH_PNL_ROWS,
      cashflowRows: MOCK_CASHFLOW_ROWS,
      expenseRows: MOCK_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', tab: 'P&L', message: expect.stringContaining('month columns') }),
      ]),
    );
  });

  it('returns error when P&L has months but no company blocks', () => {
    const result = validateSheetData({
      pnlRows: NO_COMPANY_PNL_ROWS,
      cashflowRows: MOCK_CASHFLOW_ROWS,
      expenseRows: MOCK_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', tab: 'P&L', message: expect.stringContaining('company blocks') }),
      ]),
    );
  });

  it('returns error when Cashflow tab is empty', () => {
    const result = validateSheetData({
      pnlRows: MOCK_PNL_ROWS,
      cashflowRows: [],
      expenseRows: MOCK_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', tab: 'Cashflow', message: expect.stringContaining('empty') }),
      ]),
    );
  });

  it('returns error when Expense tab is missing required header columns', () => {
    const result = validateSheetData({
      pnlRows: MOCK_PNL_ROWS,
      cashflowRows: MOCK_CASHFLOW_ROWS,
      expenseRows: MISSING_HEADER_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', tab: 'Expenses', message: expect.stringContaining("'Company'") }),
        expect.objectContaining({ severity: 'error', tab: 'Expenses', message: expect.stringContaining("'GL'") }),
      ]),
    );
  });

  it('collects ALL errors when multiple tabs are invalid (not fail-on-first)', () => {
    const result = validateSheetData({
      pnlRows: EMPTY_PNL_ROWS,
      cashflowRows: [],
      expenseRows: MISSING_HEADER_EXPENSE_ROWS,
    });
    // Should have errors from P&L, Cashflow, AND Expenses
    const tabs = result.errors.map(e => e.tab);
    expect(tabs).toContain('P&L');
    expect(tabs).toContain('Cashflow');
    expect(tabs).toContain('Expenses');
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('returns no errors for valid data', () => {
    const result = validateSheetData({
      pnlRows: MOCK_PNL_ROWS,
      cashflowRows: MOCK_CASHFLOW_ROWS,
      expenseRows: MOCK_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual([]);
  });

  it('produces warnings (not errors) for optional metrics missing from a company block', () => {
    // Curenta in MOCK_PNL_ROWS has no 'Cost of Sales' -- that's optional
    const result = validateSheetData({
      pnlRows: MOCK_PNL_ROWS,
      cashflowRows: MOCK_CASHFLOW_ROWS,
      expenseRows: MOCK_EXPENSE_ROWS,
    });
    // No errors for missing optional metrics
    expect(result.errors).toEqual([]);
    // Warnings generated for Curenta missing optional metrics
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          tab: 'P&L',
          message: expect.stringContaining('Curenta'),
        }),
      ]),
    );
    // AllRx has all optional metrics -- no warnings for AllRx
    const allrxWarnings = result.warnings.filter(w => w.message.includes('AllRx'));
    expect(allrxWarnings).toEqual([]);
  });

  it('validates minimal valid data passes without errors', () => {
    const result = validateSheetData({
      pnlRows: VALID_MINIMAL_PNL_ROWS,
      cashflowRows: VALID_MINIMAL_CASHFLOW_ROWS,
      expenseRows: VALID_MINIMAL_EXPENSE_ROWS,
    });
    expect(result.errors).toEqual([]);
  });
});
