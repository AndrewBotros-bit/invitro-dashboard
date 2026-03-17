import { describe, it, expect } from 'vitest';
import {
  PALETTE,
  EXCLUDE_COMPANIES,
  buildColorMap,
  shortMonthLabel,
  buildMonthlySeries,
  buildCashflowSeries,
  annualTotal,
  latestMonthValue,
} from '@/lib/chartHelpers';
import { MOCK_DASHBOARD_DATA } from '../fixtures/dashboardData';

describe('PALETTE', () => {
  it('has exactly 12 colors', () => {
    expect(PALETTE).toHaveLength(12);
  });

  it('contains valid hex color strings', () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('EXCLUDE_COMPANIES', () => {
  it('contains holding/parent entities', () => {
    expect(EXCLUDE_COMPANIES).toContain('InVitro Holding');
    expect(EXCLUDE_COMPANIES).toContain('InVitro Studio');
    expect(EXCLUDE_COMPANIES).toContain('AllRX Holding');
  });
});

describe('buildColorMap', () => {
  it('assigns colors sorted alphabetically', () => {
    const result = buildColorMap(['Osta', 'AllRx', 'AllCare']);
    expect(result).toEqual({
      AllCare: PALETTE[0],
      AllRx: PALETTE[1],
      Osta: PALETTE[2],
    });
  });

  it('is deterministic with same input', () => {
    const a = buildColorMap(['Osta', 'AllRx', 'AllCare']);
    const b = buildColorMap(['AllCare', 'Osta', 'AllRx']);
    expect(a).toEqual(b);
  });

  it('wraps around PALETTE for more than 12 companies', () => {
    const companies = Array.from({ length: 14 }, (_, i) => `Company${String.fromCharCode(65 + i)}`);
    const result = buildColorMap(companies);
    expect(result['CompanyM']).toBe(PALETTE[12 % 12]); // wraps to index 0
    expect(result['CompanyN']).toBe(PALETTE[13 % 12]); // wraps to index 1
  });
});

describe('shortMonthLabel', () => {
  it('returns "Jan 25" for month 1, year 2025', () => {
    expect(shortMonthLabel(1, 2025)).toBe('Jan 25');
  });

  it('returns "Dec 26" for month 12, year 2026', () => {
    expect(shortMonthLabel(12, 2026)).toBe('Dec 26');
  });
});

describe('buildMonthlySeries', () => {
  it('transforms pnl data into Recharts-compatible flat array', () => {
    const result = buildMonthlySeries(MOCK_DASHBOARD_DATA.pnl, 'Revenue');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      month: 'Jan 25',
      AllRx: 1056168,
      AllCare: 202868,
      Osta: 64344,
    });
  });

  it('filters out excluded companies', () => {
    // Add an excluded company to pnl data
    const pnlWithExcluded = [
      ...MOCK_DASHBOARD_DATA.pnl,
      {
        name: 'InVitro Holding',
        metrics: {
          'Revenue': [
            { year: 2025, month: 1, value: 999999 },
            { year: 2025, month: 2, value: 999999 },
            { year: 2025, month: 3, value: 999999 },
          ],
        },
      },
    ];
    const result = buildMonthlySeries(pnlWithExcluded, 'Revenue', EXCLUDE_COMPANIES);
    expect(result[0]).not.toHaveProperty('InVitro Holding');
    expect(Object.keys(result[0])).toEqual(['month', 'AllRx', 'AllCare', 'Osta']);
  });

  it('handles null metric values by keeping null', () => {
    const pnlWithNull = [
      {
        name: 'TestCo',
        metrics: {
          'Revenue': [
            { year: 2025, month: 1, value: null },
            { year: 2025, month: 2, value: 100 },
          ],
        },
      },
    ];
    const result = buildMonthlySeries(pnlWithNull, 'Revenue');
    expect(result[0].TestCo).toBeNull();
    expect(result[1].TestCo).toBe(100);
  });
});

describe('buildCashflowSeries', () => {
  it('returns inflow, outflow (positive), and running balance', () => {
    const result = buildCashflowSeries(MOCK_DASHBOARD_DATA.cashflow);
    expect(result).toHaveLength(3);
    // Month 1: AllRx inflow 500K + AllCare 300K = 800K
    expect(result[0].inflow).toBe(800000);
    // Month 1: AllRx outflow -400K + AllCare -350K = -750K, abs = 750K
    expect(result[0].outflow).toBe(750000);
    // Month 1 balance: net = AllRx 100K + AllCare -50K = 50K (cumulative)
    expect(result[0].balance).toBe(50000);
    // Month 2 balance: cumulative 50K + (90K + -50K) = 90K
    expect(result[1].balance).toBe(90000);
  });

  it('uses shortMonthLabel for month key', () => {
    const result = buildCashflowSeries(MOCK_DASHBOARD_DATA.cashflow);
    expect(result[0].month).toBe('Jan 25');
  });
});

describe('annualTotal', () => {
  it('sums monthly values for a given metric and year', () => {
    const total = annualTotal(MOCK_DASHBOARD_DATA.pnl, 'Revenue', 2025);
    // AllRx: 1056168+1032373+958120 = 3046661
    // AllCare: 202868+228543+274252 = 705663
    // Osta: 64344+44683+44683 = 153710
    expect(total).toBe(3046661 + 705663 + 153710);
  });

  it('returns 0 when no data matches the year', () => {
    expect(annualTotal(MOCK_DASHBOARD_DATA.pnl, 'Revenue', 2020)).toBe(0);
  });

  it('handles null values by treating them as 0', () => {
    const pnlWithNull = [
      {
        name: 'TestCo',
        metrics: {
          'Revenue': [
            { year: 2025, month: 1, value: null },
            { year: 2025, month: 2, value: 100 },
          ],
        },
      },
    ];
    expect(annualTotal(pnlWithNull, 'Revenue', 2025)).toBe(100);
  });

  it('excludes companies in excludeCompanies list', () => {
    const pnlWithExcluded = [
      ...MOCK_DASHBOARD_DATA.pnl,
      {
        name: 'InVitro Holding',
        metrics: {
          'Revenue': [{ year: 2025, month: 1, value: 9999999 }],
        },
      },
    ];
    const withExclude = annualTotal(pnlWithExcluded, 'Revenue', 2025, EXCLUDE_COMPANIES);
    const without = annualTotal(MOCK_DASHBOARD_DATA.pnl, 'Revenue', 2025);
    expect(withExclude).toBe(without);
  });
});

describe('latestMonthValue', () => {
  it('returns the last non-null value for a metric', () => {
    const result = latestMonthValue(MOCK_DASHBOARD_DATA.pnl, 'Revenue', 'AllRx');
    expect(result).toEqual({ year: 2025, month: 3, value: 958120 });
  });

  it('returns null for non-existent company', () => {
    expect(latestMonthValue(MOCK_DASHBOARD_DATA.pnl, 'Revenue', 'NonExistent')).toBeNull();
  });

  it('skips null values to find last non-null', () => {
    const pnlWithTrailingNull = [
      {
        name: 'TestCo',
        metrics: {
          'Revenue': [
            { year: 2025, month: 1, value: 100 },
            { year: 2025, month: 2, value: 200 },
            { year: 2025, month: 3, value: null },
          ],
        },
      },
    ];
    const result = latestMonthValue(pnlWithTrailingNull, 'Revenue', 'TestCo');
    expect(result).toEqual({ year: 2025, month: 2, value: 200 });
  });
});
