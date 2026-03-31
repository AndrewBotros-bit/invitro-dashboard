import { google } from "googleapis";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createSheetsClient() {
  const clientEmail = getRequiredEnv("GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL");
  // Private key is usually stored with literal \n sequences; normalize them.
  const rawKey = getRequiredEnv("GOOGLE_SHEETS_PRIVATE_KEY");
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * Fetch raw values from a given sheet tab and range.
 *
 * This is a low-level helper used by higher-level parsers in the data pipeline.
 */
export async function getSheetValues({ spreadsheetId, range }) {
  const sheets = createSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  return response.data.values ?? [];
}

/**
 * Convenience helper for the main consolidated sheet so callers
 * don't need to repeat the ID each time.
 */
export async function getMainConsolidatedValues(range) {
  const spreadsheetId = getRequiredEnv("INVITRO_MAIN_CONSOLIDATED_SHEET_ID");
  return getSheetValues({ spreadsheetId, range });
}

/**
 * Fetch multiple ranges from a single spreadsheet in one API call.
 * Uses UNFORMATTED_VALUE so numbers come back as numbers, not formatted strings.
 *
 * @param {{ spreadsheetId: string, ranges: string[] }} params
 * @returns {Promise<Array<{ range: string, values: any[][] }>>}
 */
export async function batchGetSheetValues({ spreadsheetId, ranges }) {
  const sheets = createSheetsClient();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  return response.data.valueRanges ?? [];
}

/**
 * Convenience helper for the expense breakdown sheet.
 * Uses UNFORMATTED_VALUE for clean numeric data.
 *
 * @param {string} range - A1 notation range (e.g., "'Row Data (2026)'!A1:S")
 * @returns {Promise<any[][]>}
 */
export async function getHeadcountSheetValues(range) {
  const spreadsheetId = process.env['INVITRO_HEADCOUNT_SHEET_ID'];
  if (!spreadsheetId) return []; // optional — don't fail build if not configured
  try {
    const sheets = createSheetsClient();
    console.log(`[HEADCOUNT] Fetching sheet ${spreadsheetId}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    console.log(`[HEADCOUNT] Got ${response.data.values?.length ?? 0} rows`);
    return response.data.values ?? [];
  } catch (err) {
    console.warn(`[HEADCOUNT] Error code=${err.code} msg=${err.message?.substring(0,80)}`);
    return [];
  }
}

export async function getExpenseSheetValues(range) {
  const spreadsheetId = getRequiredEnv('INVITRO_EXPENSE_SHEET_ID');
  const sheets = createSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  return response.data.values ?? [];
}

