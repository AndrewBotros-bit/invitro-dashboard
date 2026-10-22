import { describe, it, expect } from 'vitest';
import { parsePnL, detectMonthColumns, DERIVED_NET_REVENUE } from '@/lib/data/parsePnL';
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
    // AllRx has Cost of Sales, Gross Profit, Gorss Margin % that Curenta
    // lacks — 6 rows read from the sheet, plus the derived net-revenue
    // base that having both Gross Profit and a margin row earns it.
    expect(Object.keys(allrx.metrics)).toHaveLength(7);
    expect(Object.keys(curenta.metrics)).toHaveLength(3);
    expect(allrx.metrics['Revenue']).toBeDefined();
    expect(allrx.metrics['Cost of Sales']).toBeDefined();
    expect(curenta.metrics['Cost of Sales']).toBeUndefined();
  });

  describe('derived net revenue', () => {
    it('recovers the base the margin was struck against', () => {
      const allrx = parsePnL(MOCK_PNL_ROWS).find(c => c.name === 'AllRx');
      const gp = allrx.metrics['Gross Profit'];
      const margin = allrx.metrics['Gorss Margin, %'];
      const net = allrx.metrics[DERIVED_NET_REVENUE];
      expect(net).toBeDefined();
      expect(net).toHaveLength(gp.length);
      for (let i = 0; i < net.length; i++) {
        const m = margin[i].value;
        if (m == null || m === 0 || gp[i].value == null) continue;
        // Dividing GP back by the derived base must return the sheet's
        // own margin — that is the whole contract.
        expect(gp[i].value / net[i].value).toBeCloseTo(m, 10);
        expect(net[i]).toMatchObject({ year: gp[i].year, month: gp[i].month });
      }
    });

    it('is absent for a company with no margin row', () => {
      const curenta = parsePnL(MOCK_PNL_ROWS).find(c => c.name === 'Curenta');
      expect(curenta.metrics[DERIVED_NET_REVENUE]).toBeUndefined();
    });

    it('yields null rather than Infinity on a zero or blank margin', () => {
      const rows = JSON.parse(JSON.stringify(MOCK_PNL_ROWS));
      const marginRow = rows.find(r => String(r?.[2] ?? '').startsWith('Gorss Margin'));
      marginRow[4] = 0;      // zero margin
      marginRow[5] = null;   // blank margin
      const allrx = parsePnL(rows).find(c => c.name === 'AllRx');
      const net = allrx.metrics[DERIVED_NET_REVENUE];
      expect(net[0].value).toBeNull();
      expect(net[1].value).toBeNull();
      expect(Number.isFinite(net[0].value ?? 0)).toBe(true);
    });
  });

  it('returns MonthlyValue objects with year, month, value', () => {
    const result = parsePnL(MOCK_PNL_ROWS);
    const allrx = result.find(c => c.name === 'AllRx');
    const revenue = allrx.metrics['Revenue'];
    expect(revenue).toHaveLength(3);
    expect(revenue[0]).toEqual({ year: 2025, month: 1, value: 1056168 });
    expect(revenue[1]).toEqual({ year: 2025, month: 2, value: 1032373 });
  });

  it('coerces non-numeric cell values to null', () => {
    const rows = [
      [null, null, null, null, 'Jan 2025', 'Feb 2025', 'Mar 2025'],
      [null, 'TestCo', null, null],
      [null, null, 'Revenue', null, 100, 'N/A', ''],
    ];
    const result = parsePnL(rows);
    const rev = result[0].metrics['Revenue'];
    expect(rev[0].value).toBe(100);
    expect(rev[1].value).toBeNull(); // 'N/A' -> null
    expect(rev[2].value).toBeNull(); // '' -> null
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

describe('percentage cells', () => {
  it('reads a formatted percentage as a fraction, not null', () => {
    // The P&L tabs are fetched as FORMATTED_VALUE, so margins arrive as
    // "38%". Number("38%") is NaN, which silently nulled every margin row
    // in the sheet and made the metric unusable.
    const rows = JSON.parse(JSON.stringify(MOCK_PNL_ROWS));
    const marginRow = rows.find(r => String(r?.[2] ?? '').startsWith('Gorss Margin'));
    marginRow[4] = '38%';
    marginRow[5] = '-6927%';
    marginRow[6] = '0%';
    const allrx = parsePnL(rows).find(c => c.name === 'AllRx');
    const m = allrx.metrics['Gorss Margin, %'];
    expect(m[0].value).toBeCloseTo(0.38, 10);
    expect(m[1].value).toBeCloseTo(-69.27, 10);
    expect(m[2].value).toBe(0);
  });

  it('leaves ordinary numbers and accounting negatives untouched', () => {
    const rows = JSON.parse(JSON.stringify(MOCK_PNL_ROWS));
    const revRow = rows.find(r => String(r?.[2] ?? '') === 'Revenue');
    revRow[4] = '1,234';
    revRow[5] = '(185,965)';
    revRow[6] = '$500';
    const allrx = parsePnL(rows).find(c => c.name === 'AllRx');
    const r = allrx.metrics['Revenue'];
    expect(r[0].value).toBe(1234);
    expect(r[1].value).toBe(-185965);
    expect(r[2].value).toBe(500);
  });
});

describe('repeated metric rows', () => {
  it('keeps the first occurrence when a block restates a metric', () => {
    // "AllCare P&L External" carries two presentations of AllCare. Their
    // margin rows disagree: the first states the real margin, the second
    // restates GP over gross revenue. Last-write-wins kept the redundant
    // one and threw away the only row carrying information.
    const rows = JSON.parse(JSON.stringify(MOCK_PNL_ROWS));
    const marginRow = rows.find(r => String(r?.[2] ?? '').startsWith('Gorss Margin'));
    const restated = [...marginRow];
    restated[1] = '';          // no company name -> same block continues
    restated[4] = '50%';
    marginRow[4] = '53%';
    rows.splice(rows.indexOf(marginRow) + 1, 0, restated);

    const allrx = parsePnL(rows).find(c => c.name === 'AllRx');
    expect(allrx.metrics['Gorss Margin, %'][0].value).toBeCloseTo(0.53, 10);
  });

  it('still starts a fresh metric set for a genuinely new company', () => {
    const result = parsePnL(MOCK_PNL_ROWS);
    expect(result.map(c => c.name)).toEqual(['AllRx', 'Curenta']);
    expect(result[1].metrics['Revenue']).toBeDefined();
  });
});
