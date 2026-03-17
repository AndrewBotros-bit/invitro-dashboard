import { describe, it, expect } from 'vitest';
import { parseCashflow } from '@/lib/data/parseCashflow';
import { MOCK_CASHFLOW_ROWS } from '@/tests/fixtures/cashflowRows';

describe('parseCashflow', () => {
  it('discovers companies dynamically', () => {
    const result = parseCashflow(MOCK_CASHFLOW_ROWS);
    expect(result.map(c => c.name)).toEqual(['AllRx', 'Curenta']);
  });

  it('parses cashflow metrics per company', () => {
    const result = parseCashflow(MOCK_CASHFLOW_ROWS);
    const allrx = result.find(c => c.name === 'AllRx');
    expect(Object.keys(allrx.metrics)).toContain('Cash Inflow');
    expect(Object.keys(allrx.metrics)).toContain('Cash Outflow');
    expect(Object.keys(allrx.metrics)).toContain('Net Cash Flow');
    expect(allrx.metrics['Cash Inflow'][0]).toEqual({ year: 2025, month: 1, value: 500000 });
  });
});
