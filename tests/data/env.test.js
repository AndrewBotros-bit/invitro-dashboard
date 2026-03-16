import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws clear error when GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL is missing', async () => {
    delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const { getSheetValues } = await import('@/lib/googleSheets.js');
    await expect(getSheetValues({ spreadsheetId: 'x', range: 'A1' }))
      .rejects.toThrow('Missing required environment variable: GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL');
  });

  it('throws clear error when GOOGLE_SHEETS_PRIVATE_KEY is missing', async () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
    delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const { getSheetValues } = await import('@/lib/googleSheets.js');
    await expect(getSheetValues({ spreadsheetId: 'x', range: 'A1' }))
      .rejects.toThrow('Missing required environment variable: GOOGLE_SHEETS_PRIVATE_KEY');
  });

  it('no env vars use NEXT_PUBLIC_ prefix', async () => {
    // Verify the source code does not reference NEXT_PUBLIC_ prefixed Google vars
    const fs = await import('fs');
    const source = fs.readFileSync('lib/googleSheets.js', 'utf8');
    expect(source).not.toContain('NEXT_PUBLIC_');
  });
});
