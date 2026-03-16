import { describe, it, expect } from 'vitest';
import { parsePnL, detectMonthColumns } from '@/lib/data/parsePnL';
import { MOCK_PNL_ROWS } from '@/tests/fixtures/pnlRows';

describe('detectMonthColumns', () => {
  it('header-based: finds month columns by header name not index', () => {
    const cols = detectMonthColumns(MOCK_PNL_ROWS[0]);
    expect(cols).toHaveLength(3);
    expect(cols[0]).toEqual({ index: 4, year: 2025, month: 1 });
    expect(cols[1]).toEqual({ index: 5, year: 2025, month: 2 });
    expect(cols[2]).toEqual({ index: 6, year: 2025, month: 3 });
  });

  it('filters out months before 2025', () => {
    const headerWith2024 = [null, null, null, null, 'Dec 2024', 'Jan 2025', 'Feb 2025'];
    const cols = detectMonthColumns(headerWith2024);
    expect(cols.every(c => c.year >= 2025)).toBe(true);
    expect(cols).toHaveLength(2); // Only Jan 2025 and Feb 2025
  });

  it('handles empty or missing header row', () => {
    expect(detectMonthColumns([])).toEqual([]);
    expect(detectMonthColumns([null, null])).toEqual([]);
  });
});

describe('parsePnL', () => {
  it('discovers companies dynamically from row data', () => {
    const result = parsePnL(MOCK_PNL_ROWS);
    const names = result.map(c => c.name);
    expect(names).toContain('AllRx');
    expect(names).toContain('Curenta');
    expect(result).toHaveLength(2);
  });

  it('handles variable metrics per company', () => {
    const result = parsePnL(MOCK_PNL_ROWS);
    const allrx = result.find(c => c.name === 'AllRx');
    const curenta = result.find(c => c.name === 'Curenta');
    // AllRx has Cost of Sales, Gross Profit, Gorss Margin % that Curenta lacks
    expect(Object.keys(allrx.metrics)).toHaveLength(6);
    expect(Object.keys(curenta.metrics)).toHaveLength(3);
    expect(allrx.metrics['Revenue']).toBeDefined();
    expect(allrx.metrics['Cost of Sales']).toBeDefined();
    expect(curenta.metrics['Cost of Sales']).toBeUndefined();
  });

  it('returns MonthlyValue objects with year, month, value', () => {
    const result = parsePnL(MOCK_PNL_ROWS);
    const allrx = result.find(c => c.name === 'AllRx');
    const revenue = allrx.metrics['Revenue'];
    expect(revenue).toHaveLength(3);
    expect(revenue[0]).toEqual({ year: 2025, month: 1, value: 1056168 });
    expect(revenue[1]).toEqual({ year: 2025, month: 2, value: 1032373 });
  });

  it('handles missing trailing cell values as null', () => {
    // Company row with no values in month columns
    const rows = [
      [null, null, null, null, 'Jan 2025', 'Feb 2025'],
      [null, 'TestCo', null, null],
      [null, null, 'Revenue', null, 100], // Only 1 value, Feb is missing
      [],
    ];
    const result = parsePnL(rows);
    const testCo = result.find(c => c.name === 'TestCo');
    expect(testCo.metrics['Revenue'][0].value).toBe(100);
    expect(testCo.metrics['Revenue'][1].value).toBeNull();
  });
});
