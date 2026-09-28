import { describe, it, expect } from 'vitest';
import { parseCapTable, roundAsOf } from '@/lib/data/parseCapTable';

/**
 * Fixture mirrors the real "AllCare - Captable" layout, including the two
 * traps that make index-based parsing wrong:
 *
 *   1. Block 2 carries an extra "2026 Round Investment amounts, $" column,
 *      shifting Price Per Share from index 5 to index 6 and everything
 *      after it along by one.
 *   2. Block 3's header row is a copy of block 2's and also says
 *      "Pre-2027", even though it is the third round.
 *
 * Prices are deliberately non-round so a column misread is obvious.
 */
const blank = [];

const BLOCK1 = [
  ['', 'AllCare ai Holdco'],
  ['', 'Post Merge', '', 'Post ESOP', '', 46112],
  ['', 'Initial Shares', 'Post Merge Ownership', 'Issued Shares, #', 'Shares After New Issuance',
   'Price Per Share', 'Pre-2026 Round Valuation, $', '2026 Round Investment amounts, $',
   'Preferred Shares', 'Post-2026 Round Valuation, $', 'Shares Post the Round, #', 'Post Money Ownership'],
  blank,
  ['InVitro Fund', 461464.46, 0.0248, '', 461464.46, 1.8, 830636.028, 550000, 305555.5556, 1380636.028, 767020.0156, 0.0360977],
  ['InVitro Ventures', 8498563, 0.4574, '', 8498563, 1.8, 15297413.4, 721000, 400555.5556, 16018413.4, 8899118.5556, 0.4188],
  ['Total', 18581763.18, 1, 0, 18581763.18, 1.8, 33447173.724, 4800000, 2666666.6667, 38247173.724, 21248429.8467, 1],
];

// Note the extra column at index 3 — this is the shift.
const BLOCK2 = [
  ['', 'AllCare ai Holdco'],
  ['', '2026', '', '', 'New Investor', '', 46049],
  ['', 'Initial Shares', 'Post Merge Ownership', '2026 Round Investment amounts, $', 'Issued Shares, #',
   'Shares After New Issuance', 'Price Per Share', 'Pre-2027 Round Valuation, $',
   '2027 Round Investment amounts, $', 'Preferred Shares', 'Post-2027 Round Valuation, $',
   'Shares Post the Round, #', 'Post Money Ownership'],
  blank,
  ['InVitro Fund', 767020.0156, 0.0360977, '', '', 767020.0156, 4.0333890371, 3093690.122, 550000, 136361.7531, 3643690.122, 903381.7686, 0.0412868],
  ['Total', 21248429.8467, 1, '', 0, 21248429.8467, 4.0333890371, 85703184, 2550000, 632222.6734, 88253184, 21880652.5201, 1],
];

// Same header year as block 2 — the monotonic guard must bump this to 2028.
const BLOCK3 = [
  ['', 'AllCare ai Holdco'],
  ['', '2027', '', 'Post ESOP', '', 46050],
  ['', 'Initial Shares', 'Post Merge Ownership', 'Issued Shares, #', 'Shares After New Issuance',
   'Price Per Share', 'Pre-2027 Round Valuation, $', '2027 Round Investment amounts, $',
   'Preferred Shares', 'Post-2027 Round Valuation, $', 'Shares Post the Round, #', 'Post Money Ownership'],
  blank,
  ['InVitro Fund', 903381.7686, 0.0412868, '', 903381.7686, 4.7128846777, 4257534.0956, 0, 0, 4257534.0956, 903381.7686, 0.0412868],
  ['Total', 21880652.5201, 1, 0, 21880652.5201, 4.7128846777, 103120992, 0, 0, 103120992, 21880652.5201, 1],
];

const ROWS = [blank, ...BLOCK1, blank, ...BLOCK2, blank, ...BLOCK3];

describe('parseCapTable', () => {
  it('finds every round block', () => {
    const ct = parseCapTable(ROWS);
    expect(ct.rounds).toHaveLength(3);
    expect(ct.company).toBe('AllCare + Curenta');
  });

  it('reads the price per share from block 2 despite its extra column', () => {
    // The trap: index 5 in block 2 is "Shares After New Issuance"
    // (767,020), not the price. A shifted read returns a six-figure
    // "price per share" instead of ~$4.03.
    const [, r2] = parseCapTable(ROWS).rounds;
    expect(r2.pricePerShare).toBeCloseTo(4.0333890371, 8);
  });

  it('keeps full price precision rather than rounding to dollars', () => {
    const [r1, r2, r3] = parseCapTable(ROWS).rounds;
    expect(r1.pricePerShare).toBe(1.8);
    expect(r2.pricePerShare).not.toBe(4);
    expect(r3.pricePerShare).toBeCloseTo(4.7128846777, 8);
  });

  it('advances the round year when the header repeats the previous one', () => {
    const [r1, r2, r3] = parseCapTable(ROWS).rounds;
    expect([r1.year, r2.year, r3.year]).toEqual([2026, 2027, 2028]);
    expect(r3.headerYear).toBe(2027);
    expect(r3.yearDerived).toBe(true);
    expect(r1.yearDerived).toBe(false);
  });

  it('picks this round\'s investment column, not the prior round\'s', () => {
    // Block 2 has a 2026 column (empty, carried over) before the 2027 one.
    const [r1, r2] = parseCapTable(ROWS).rounds;
    expect(r1.totalRaised).toBe(4800000);
    expect(r2.totalRaised).toBe(2550000);
    expect(r2.holders['InVitro Fund'].investment).toBe(550000);
  });

  it('reads holder shares, stake value and post-money', () => {
    const [r1] = parseCapTable(ROWS).rounds;
    const fund = r1.holders['InVitro Fund'];
    expect(fund.shares).toBeCloseTo(767020.0156, 4);
    expect(fund.stakeValue).toBeCloseTo(1380636.028, 3);
    expect(fund.ownership).toBeCloseTo(0.0360977, 7);
    expect(r1.postMoney).toBeCloseTo(38247173.724, 3);
    // The Total row is a roll-up, not a shareholder.
    expect(r1.holders.Total).toBeUndefined();
  });

  it('returns null for an empty or unrecognised tab', () => {
    expect(parseCapTable([])).toBeNull();
    expect(parseCapTable(null)).toBeNull();
    expect(parseCapTable([['Some', 'unrelated', 'tab']])).toBeNull();
  });
});

describe('roundAsOf', () => {
  const ct = parseCapTable(ROWS);

  it('returns nothing before the first round', () => {
    expect(roundAsOf(ct, 2025)).toBeNull();
  });

  it('returns the latest round at or before the year', () => {
    expect(roundAsOf(ct, 2026).index).toBe(1);
    expect(roundAsOf(ct, 2027).index).toBe(2);
    expect(roundAsOf(ct, 2028).index).toBe(3);
    expect(roundAsOf(ct, 2030).index).toBe(3);
  });

  it('is safe with missing inputs', () => {
    expect(roundAsOf(null, 2026)).toBeNull();
    expect(roundAsOf(ct, null)).toBeNull();
  });
});
