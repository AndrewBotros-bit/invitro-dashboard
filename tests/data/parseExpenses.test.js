import { describe, it, expect } from 'vitest';
import { parseExpenses } from '@/lib/data/parseExpenses';
import { MOCK_EXPENSE_ROWS, EXPENSE_HEADERS } from '@/tests/fixtures/expenseRows';

describe('parseExpenses', () => {
  it('parses all data rows (excludes header)', () => {
    const result = parseExpenses(MOCK_EXPENSE_ROWS);
    expect(result).toHaveLength(6);
  });

  it('maps company names to canonical names', () => {
    const result = parseExpenses(MOCK_EXPENSE_ROWS);
    const companies = result.map(r => r.company);
    expect(companies).toContain('AllRx');       // mapped from AllRX
    expect(companies).toContain('Curenta');      // mapped from Curenta Technology LLC
    expect(companies).toContain('Osta');         // mapped from Osta LLC
    expect(companies).toContain('InVitro Studio'); // mapped from InVitro Studio, LLC
    expect(companies).not.toContain('AllRX');    // raw name should not appear
    expect(companies).not.toContain('Curenta Technology LLC');
  });

  it('extracts correct fields from each row', () => {
    const result = parseExpenses(MOCK_EXPENSE_ROWS);
    const first = result[0];
    expect(first.company).toBe('AllRx');
    expect(first.category).toBe('HC');
    expect(first.department).toBe('R&D');
    expect(first.gl).toBe('Salaries');
    expect(first.amount).toBe(5000);
    expect(first.year).toBe(2026);
    expect(first.month).toBe(1); // January -> 1
    expect(first.merchant).toBe('ADP');
  });

  it('converts month names to numbers', () => {
    const result = parseExpenses(MOCK_EXPENSE_ROWS);
    expect(result[0].month).toBe(1);  // January
    expect(result[2].month).toBe(2);  // February
    expect(result[5].month).toBe(3);  // March
  });

  it('works when columns are reordered (header-based detection)', () => {
    // Swap Company (index 13) and Category (index 1) columns
    const reordered = MOCK_EXPENSE_ROWS.map(row => {
      const newRow = [...row];
      if (newRow.length > 13) {
        [newRow[1], newRow[13]] = [newRow[13], newRow[1]];
      }
      return newRow;
    });
    // Headers are already swapped by the map above

    const result = parseExpenses(reordered);
    // Should still correctly find company and category despite reorder
    expect(result[0].company).toBe('AllRx');
    expect(result[0].category).toBe('HC');
  });

  it('returns null for missing or non-numeric amounts (not 0)', () => {
    const rows = [
      EXPENSE_HEADERS,
      ['Expense', 'HC', 'January', '2026-01-15', 5000, '2026-01-15', undefined, 6000, 'John', 'R&D', 'ADP', 'Salaries', 'Operating', 'AllRX', 2026, 'January', 1, 5000, '2026-01-15'],
      ['Expense', 'HC', 'January', '2026-01-15', 5000, '2026-01-15', 'N/A', 6000, 'John', 'R&D', 'ADP', 'Salaries', 'Operating', 'AllRX', 2026, 'January', 1, 5000, '2026-01-15'],
      ['Expense', 'HC', 'January', '2026-01-15', 5000, '2026-01-15', '', 6000, 'John', 'R&D', 'ADP', 'Salaries', 'Operating', 'AllRX', 2026, 'January', 1, 5000, '2026-01-15'],
    ];
    const result = parseExpenses(rows);
    expect(result[0].amount).toBeNull();
    expect(result[1].amount).toBeNull();
    expect(result[2].amount).toBeNull();
  });

  it('handles Direct Cost department (COGS, not SG&A)', () => {
    const result = parseExpenses(MOCK_EXPENSE_ROWS);
    const directCost = result.find(r => r.department === 'Direct Cost');
    expect(directCost).toBeDefined();
    expect(directCost.company).toBe('Needles');
  });
});
