import { describe, it, expect } from 'vitest';
import { canonicalName, EXPENSE_TO_CANONICAL } from '@/lib/data/companyMapping';

describe('companyMapping', () => {
  it('maps AllRX to AllRx', () => {
    expect(canonicalName('AllRX')).toBe('AllRx');
  });

  it('maps Curenta Technology LLC to Curenta', () => {
    expect(canonicalName('Curenta Technology LLC')).toBe('Curenta');
  });

  it('maps InVitro Studio, LLC to InVitro Studio', () => {
    expect(canonicalName('InVitro Studio, LLC')).toBe('InVitro Studio');
  });

  it('passes through AllCare unchanged', () => {
    expect(canonicalName('AllCare')).toBe('AllCare');
  });

  it('maps Osta LLC to Osta', () => {
    expect(canonicalName('Osta LLC')).toBe('Osta');
  });

  it('passes through Needles unchanged', () => {
    expect(canonicalName('Needles')).toBe('Needles');
  });

  it('passes through unknown company names unchanged', () => {
    expect(canonicalName('UnknownCorp')).toBe('UnknownCorp');
  });

  it('EXPENSE_TO_CANONICAL has exactly 6 entries', () => {
    expect(Object.keys(EXPENSE_TO_CANONICAL)).toHaveLength(6);
  });
});
