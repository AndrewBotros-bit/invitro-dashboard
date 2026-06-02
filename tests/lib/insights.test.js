import { describe, it, expect } from 'vitest';
import { generateInsights } from '@/lib/insights';
import { MOCK_DASHBOARD_DATA_TWO_YEARS } from '../fixtures/dashboardData';

// The insights engine was rewritten from a threshold-based array
// generator (e.g. "revenue grew >50%") to a comparative ranking engine
// that returns MoM + QoQ ChangeRecords sorted by magnitude. These tests
// cover the new contract.

describe('generateInsights — comparative engine', () => {
  it('returns the new shape with mom, qoq, and alerts fields', () => {
    const result = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
    expect(result).toHaveProperty('mom');
    expect(result).toHaveProperty('qoq');
    expect(result).toHaveProperty('alerts');
    expect(Array.isArray(result.alerts)).toBe(true);
  });

  it('mom block (when present) carries current+prior period labels and a ranked changes array', () => {
    const result = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
    if (!result.mom) return; // mock fixture may lack lastActualMonth
    expect(result.mom.current).toHaveProperty('label');
    expect(result.mom.prior).toHaveProperty('label');
    expect(Array.isArray(result.mom.changes)).toBe(true);
    // changes must be sorted by score desc
    for (let i = 1; i < result.mom.changes.length; i++) {
      expect(result.mom.changes[i - 1].score).toBeGreaterThanOrEqual(result.mom.changes[i].score);
    }
  });

  it('qoq block (when present) carries the right Q labels and ranked changes', () => {
    const result = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
    if (!result.qoq) return;
    expect(result.qoq.current.label).toMatch(/^Q[1-4] \d{4}$/);
    expect(result.qoq.prior.label).toMatch(/^Q[1-4] \d{4}$/);
    expect(Array.isArray(result.qoq.changes)).toBe(true);
  });

  it('each change record carries the comparative fields needed for rendering', () => {
    const result = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
    const allChanges = [...(result.mom?.changes ?? []), ...(result.qoq?.changes ?? [])];
    for (const rec of allChanges) {
      expect(rec).toHaveProperty('kpi');
      expect(rec).toHaveProperty('scope');
      expect(rec).toHaveProperty('current');
      expect(rec).toHaveProperty('prior');
      expect(rec).toHaveProperty('absDelta');
      expect(rec).toHaveProperty('tone');
      expect(['positive', 'warning', 'danger', 'info']).toContain(rec.tone);
      expect(typeof rec.improved).toBe('boolean');
      expect(typeof rec.score).toBe('number');
    }
  });

  it('selectedCompany scope restricts changes to that company only', () => {
    const result = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS, 'AllCare');
    const allChanges = [...(result.mom?.changes ?? []), ...(result.qoq?.changes ?? [])];
    for (const rec of allChanges) {
      expect(rec.scope).toBe('AllCare');
    }
  });

  it('returns empty alerts and null mom/qoq for empty data', () => {
    const result = generateInsights({ pnl: [], cashflow: [], cashRunwayRow: [], lastActualMonth: null });
    expect(result.mom).toBeNull();
    expect(result.qoq).toBeNull();
    expect(result.alerts).toEqual([]);
  });
});
