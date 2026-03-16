/**
 * @typedef {Object} MonthlyValue
 * @property {number} year
 * @property {number} month - 1-12
 * @property {number|null} value
 */

/**
 * @typedef {Object} CompanyPnL
 * @property {string} name - Canonical company name (e.g., "AllRx", "Curenta")
 * @property {Object<string, MonthlyValue[]>} metrics
 *   Keys are metric names as they appear in the sheet (e.g., "Revenue", "EBITDA", "Gorss Margin, %")
 *   Values are arrays of MonthlyValue sorted chronologically
 */

/**
 * @typedef {Object} CompanyCashflow
 * @property {string} name - Canonical company name
 * @property {Object<string, MonthlyValue[]>} metrics
 *   Keys are cashflow metric names (e.g., "Cash Inflow", "Cash Outflow", "Net Cash Flow")
 */

/**
 * @typedef {Object} ExpenseRow
 * @property {string} company - Canonical company name (mapped from expense sheet name)
 * @property {string} category - "HC" or "NON-HC"
 * @property {string} department - "G&A", "GTM", "Operations", "R&D", or "Direct Cost"
 * @property {string} gl - GL account name
 * @property {number} amount - USD equivalent amount (numeric, cleaned)
 * @property {number} year
 * @property {number} month - 1-12
 * @property {string} merchant - Merchant name (may be empty string)
 */

/**
 * @typedef {Object} MonthColumn
 * @property {number} index - Column index in the row array
 * @property {number} year
 * @property {number} month - 1-12
 */

/**
 * @typedef {Object} DashboardData
 * @property {CompanyPnL[]} pnl - All companies with P&L data
 * @property {CompanyCashflow[]} cashflow - All companies with cashflow data
 * @property {ExpenseRow[]} expenses - All expense transaction rows
 * @property {string[]} companies - All canonical company names discovered (union of all sources)
 * @property {string} fetchedAt - ISO 8601 timestamp of when data was fetched
 */

/**
 * @typedef {Object} ValidationError
 * @property {'error'|'warning'} severity
 * @property {string} tab - 'P&L', 'Cashflow', or 'Expenses'
 * @property {string} message - Human-readable description
 */

/**
 * @typedef {Object} ValidationResult
 * @property {ValidationError[]} errors
 * @property {ValidationError[]} warnings
 */
