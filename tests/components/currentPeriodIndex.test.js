import { describe, it, expect } from 'vitest';
import { currentPeriodIndex } from '@/lib/formatters';

/**
 * The dashboard's default landing period. Per Andrew: "if we are in Q3
 * then land the page at Q3 and so on" — date-driven, not data-driven, so
 * standing inside a quarter opens on that quarter even while it is still
 * part forecast.
 */

// Mirrors the real grid produced by parseIRR: four annual FY rows, then
// quarterly from Q4 2025 onward.
const PERIODS = [
  { label: 'FY 2021', endDate: '2021-12-31' },
  { label: 'FY 2022', endDate: '2022-12-31' },
  { label: 'FY 2023', endDate: '2023-12-31' },
  { label: 'FY 2024', endDate: '2024-12-31' },
  { label: 'Q4 2025', endDate: '2025-12-31' },
  { label: 'Q1 2026', endDate: '2026-03-31' },
  { label: 'Q2 2026', endDate: '2026-06-30' },
  { label: 'Q3 2026', endDate: '2026-09-30' },
  { label: 'Q4 2026', endDate: '2026-12-31' },
  { label: 'Q1 2027', endDate: '2027-03-31' },
  { label: 'Q4 2028', endDate: '2028-12-31' },
];

const labelAt = (now) => PERIODS[currentPeriodIndex(PERIODS, now)]?.label;

describe('currentPeriodIndex', () => {
  it('lands on Q3 when today is inside Q3', () => {
    expect(labelAt('2026-09-17T12:00:00Z')).toBe('Q3 2026');
  });

  it('walks forward with the calendar, quarter by quarter', () => {
    expect(labelAt('2026-02-01T00:00:00Z')).toBe('Q1 2026');
    expect(labelAt('2026-05-15T00:00:00Z')).toBe('Q2 2026');
    expect(labelAt('2026-08-31T00:00:00Z')).toBe('Q3 2026');
    expect(labelAt('2026-11-02T00:00:00Z')).toBe('Q4 2026');
    expect(labelAt('2027-01-04T00:00:00Z')).toBe('Q1 2027');
  });

  it('includes the closing day of a quarter, and rolls over the next day', () => {
    expect(labelAt('2026-09-30T00:00:00Z')).toBe('Q3 2026');
    expect(labelAt('2026-10-01T00:00:00Z')).toBe('Q4 2026');
  });

  it('resolves dates in the annual-only era to that fiscal year', () => {
    expect(labelAt('2023-07-01T00:00:00Z')).toBe('FY 2023');
    expect(labelAt('2024-01-02T00:00:00Z')).toBe('FY 2024');
  });

  it('clamps to the last period once the grid is exhausted', () => {
    expect(labelAt('2031-01-01T00:00:00Z')).toBe('Q4 2028');
  });

  it('returns -1 when there is nothing usable to land on', () => {
    expect(currentPeriodIndex([], '2026-09-17')).toBe(-1);
    expect(currentPeriodIndex(null, '2026-09-17')).toBe(-1);
    // No end dates at all — the caller must fall back to its own rule.
    expect(currentPeriodIndex([{ label: 'Q1 2026' }], '2026-09-17')).toBe(-1);
    expect(currentPeriodIndex(PERIODS, 'not-a-date')).toBe(-1);
  });

  it('accepts a Date as well as a string', () => {
    expect(labelAt(new Date('2026-09-17T12:00:00Z'))).toBe('Q3 2026');
  });
});
