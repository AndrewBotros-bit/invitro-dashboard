import { describe, it, expect } from 'vitest';
import { fmt, fmtShort, pct } from '@/lib/formatters';

describe('fmt', () => {
  it('returns --- for null', () => expect(fmt(null)).toBe('---'));
  it('returns --- for undefined', () => expect(fmt(undefined)).toBe('---'));
  it('formats millions', () => expect(fmt(1056168)).toBe('$1.06M'));
  it('formats thousands', () => expect(fmt(5000)).toBe('$5K'));
  it('formats small values', () => expect(fmt(42)).toBe('$42'));
  it('formats negative millions', () => expect(fmt(-2500000)).toBe('$-2.50M'));
});

describe('fmtShort', () => {
  it('returns --- for null', () => expect(fmtShort(null)).toBe('---'));
  it('returns --- for undefined', () => expect(fmtShort(undefined)).toBe('---'));
  it('formats millions', () => expect(fmtShort(1500000)).toBe('1.5M'));
  it('formats thousands', () => expect(fmtShort(5000)).toBe('5K'));
});

describe('pct', () => {
  it('returns --- for null', () => expect(pct(null)).toBe('---'));
  it('returns --- for undefined', () => expect(pct(undefined)).toBe('---'));
  it('formats percentage', () => expect(pct(0.77)).toBe('77.0%'));
  it('formats zero', () => expect(pct(0)).toBe('0.0%'));
});
