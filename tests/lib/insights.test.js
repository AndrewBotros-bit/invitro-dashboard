import { describe, it, expect } from 'vitest';
import { generateInsights } from '@/lib/insights';
import { MOCK_DASHBOARD_DATA, MOCK_DASHBOARD_DATA_TWO_YEARS } from '../fixtures/dashboardData';

describe('generateInsights', () => {
  it('returns an array of insight objects with type, icon, title, body', () => {
    const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
    expect(Array.isArray(insights)).toBe(true);
    for (const insight of insights) {
      expect(insight).toHaveProperty('type');
      expect(insight).toHaveProperty('icon');
      expect(insight).toHaveProperty('title');
      expect(insight).toHaveProperty('body');
      expect(Object.keys(insight)).toHaveLength(4);
    }
  });

  describe('growth insights', () => {
    it('flags companies with >50% YoY revenue growth as positive', () => {
      // AllRx: 2025 revenue = 930K, 2026 revenue = 1560K => ~67% growth
      const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
      const growthInsights = insights.filter((i) => i.title.includes('revenue grew'));
      expect(growthInsights.length).toBeGreaterThanOrEqual(1);
      const allRxGrowth = growthInsights.find((i) => i.title.includes('AllRx'));
      expect(allRxGrowth?.type).toBe('positive');
    });

    it('flags AllCare with >50% YoY revenue growth', () => {
      // AllCare: 2025 revenue = 330K, 2026 revenue = 660K => 100% growth
      const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
      const allCareGrowth = insights.find((i) => i.title.includes('AllCare') && i.title.includes('revenue grew'));
      expect(allCareGrowth).toBeDefined();
      expect(allCareGrowth?.type).toBe('positive');
    });

    it('does not produce growth insight when growth is below 50%', () => {
      // Create data with low growth
      const lowGrowthData = {
        ...MOCK_DASHBOARD_DATA_TWO_YEARS,
        pnl: [
          {
            name: 'SlowCo',
            metrics: {
              'Revenue': [
                { year: 2025, month: 10, value: 100000 },
                { year: 2025, month: 11, value: 100000 },
                { year: 2025, month: 12, value: 100000 },
                { year: 2026, month: 1, value: 110000 },
                { year: 2026, month: 2, value: 110000 },
                { year: 2026, month: 3, value: 110000 },
              ],
              'EBITDA': [
                { year: 2025, month: 10, value: 10000 },
                { year: 2025, month: 11, value: 10000 },
                { year: 2025, month: 12, value: 10000 },
                { year: 2026, month: 1, value: 12000 },
                { year: 2026, month: 2, value: 12000 },
                { year: 2026, month: 3, value: 12000 },
              ],
            },
          },
        ],
      };
      const insights = generateInsights(lowGrowthData);
      const growthInsights = insights.filter((i) => i.title.includes('revenue grew'));
      expect(growthInsights).toHaveLength(0);
    });
  });

  describe('profitability milestones', () => {
    it('detects EBITDA breakeven crossing', () => {
      // AllCare: 2025 EBITDA = -120K (negative), 2026 EBITDA = +10K (positive)
      const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
      const breakeven = insights.find((i) => i.title.includes('EBITDA breakeven'));
      expect(breakeven).toBeDefined();
      expect(breakeven?.type).toBe('positive');
      expect(breakeven?.title).toContain('AllCare');
    });
  });

  describe('risk flags', () => {
    it('warns when losses persist despite revenue growth', () => {
      // Osta: revenue grew ~49% (2025: 96K, 2026: 143K), EBITDA negative in both years
      // Need >20% revenue growth with negative EBITDA
      const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
      const riskInsights = insights.filter((i) => i.title.includes('losses persist'));
      // Osta has ~49% growth and negative EBITDA => should trigger
      const ostaRisk = riskInsights.find((i) => i.title.includes('Osta'));
      expect(ostaRisk).toBeDefined();
      expect(ostaRisk?.type).toBe('warning');
    });
  });

  describe('cash runway', () => {
    it('produces a cash runway insight from cashflow data', () => {
      const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
      const runway = insights.find((i) => i.title.includes('Cash'));
      expect(runway).toBeDefined();
      expect(runway?.body).toBeDefined();
    });
  });

  describe('excluded companies', () => {
    it('skips EXCLUDE_COMPANIES for growth/profitability/risk insights', () => {
      const dataWithExcluded = {
        ...MOCK_DASHBOARD_DATA_TWO_YEARS,
        pnl: [
          ...MOCK_DASHBOARD_DATA_TWO_YEARS.pnl,
          {
            name: 'InVitro Holding',
            metrics: {
              'Revenue': [
                { year: 2025, month: 10, value: 10 },
                { year: 2025, month: 11, value: 10 },
                { year: 2025, month: 12, value: 10 },
                { year: 2026, month: 1, value: 1000000 },
                { year: 2026, month: 2, value: 1000000 },
                { year: 2026, month: 3, value: 1000000 },
              ],
              'EBITDA': [
                { year: 2025, month: 10, value: -100 },
                { year: 2025, month: 11, value: -100 },
                { year: 2025, month: 12, value: -100 },
                { year: 2026, month: 1, value: 500000 },
                { year: 2026, month: 2, value: 500000 },
                { year: 2026, month: 3, value: 500000 },
              ],
            },
          },
        ],
      };
      const insights = generateInsights(dataWithExcluded);
      const holdingInsights = insights.filter(
        (i) => i.title.includes('InVitro Holding')
      );
      expect(holdingInsights).toHaveLength(0);
    });
  });

  describe('single-year data', () => {
    it('produces no YoY insights but still produces runway if cashflow exists', () => {
      const insights = generateInsights(MOCK_DASHBOARD_DATA);
      // Single year => no growth, profitability, or risk insights (all need YoY)
      const yoyInsights = insights.filter(
        (i) => i.title.includes('revenue grew') || i.title.includes('breakeven') || i.title.includes('losses persist')
      );
      expect(yoyInsights).toHaveLength(0);
      // But should have runway insight from cashflow data
      const runway = insights.find((i) => i.title.toLowerCase().includes('cash'));
      expect(runway).toBeDefined();
    });
  });

  describe('empty data', () => {
    it('returns empty array for empty pnl with no cashflow', () => {
      const emptyData = { pnl: [], cashflow: [], companies: [], fetchedAt: '', expenses: [] };
      const insights = generateInsights(emptyData);
      expect(insights).toEqual([]);
    });
  });

  describe('insight body formatting', () => {
    it('contains formatted dollar amounts using fmt()', () => {
      const insights = generateInsights(MOCK_DASHBOARD_DATA_TWO_YEARS);
      const withDollar = insights.filter((i) => i.body.includes('$'));
      expect(withDollar.length).toBeGreaterThan(0);
    });
  });
});
