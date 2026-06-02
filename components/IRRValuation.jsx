"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { fmt, pct } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * Per-vehicle recycling configuration.
 *
 * For each vehicle that has started recycling profits back into new
 * positions, the year in which recycling began. LP investment entries
 * in or after that year are classified as "recycled" (GP redeployed
 * profits on the LP's behalf, not new cash from the LP's pocket).
 * LP entries before that year are "initial contributions."
 *
 * If a vehicle isn't listed here, NO LP entries are classified as
 * recycled — all are treated as initial. This is the right default for:
 *   - Fund-structured vehicles with multi-year capital calls
 *     (e.g. InVitro Fund: LPs pay commitment over 2024-2027)
 *   - New vehicles where recycling hasn't started yet
 *
 * To declare recycling has started for a vehicle, add a line:
 *   'Vehicle Name': YEAR
 *
 * Edit this when a vehicle starts recycling profits — typically when
 * an early portfolio company generates returns that get redeployed
 * into a new investment.
 */
const VEHICLE_RECYCLING_START_YEAR = {
  'Curenta Enterprise': 2024,
  // Barsoum Brothers: GP recycling started 2024 (capital recycled from
  // early investments into AllCare + Curenta). Currently no LP-ledger
  // entries in 2024+ — the recycling happens at the vehicle level — but
  // this config catches future LP-level recycled allocations correctly.
  'Barsoum Brothers': 2024,
  // InVitro Ventures: NOT included intentionally. All LP investment
  // entries are initial capital calls (not recycled profits). Per
  // Andrew's confirmation: "no recycling for InVitro Ventures."
};

/**
 * Fund commitments — distinguishes "investment vehicles" (direct holdings,
 * no commitment concept) from "funds" (committed-capital structure with
 * multi-year capital calls).
 *
 * For each fund-structured vehicle, declare:
 *   - totalCommitment: total LP pledge across all LPs
 *   - commitmentPeriodYears: [firstYear, lastYear] — when calls happen
 *   - perLP: each LP's individual commitment amount
 *
 * Vehicles NOT in this map are treated as direct-investment vehicles
 * (Barsoum Brothers, Curenta Enterprise, InVitro Ventures). No
 * Committed/Called/Unfunded display for them.
 *
 * Edit this when:
 *   - LP commitment amounts change (rebalancing, new LPs joining)
 *   - A new fund structure launches
 *   - An LP defaults or buys more
 */
const FUND_COMMITMENTS = {
  'InVitro Fund': {
    totalCommitment: 2_100_000,
    commitmentPeriodYears: [2024, 2027],
    perLP: {
      'Fr. Botros Samy': 400_000,
      'Atef Rafla':      400_000,
      'Medhat Mikhail':  300_000,
      'Laila Pence':     250_000,
      'Mario Karras':    250_000,
      'Daniella Karras': 250_000,
      'Hala Karras':     100_000,
      'Marie Youssef':    50_000,
      'George Ayad':     100_000,
    },
  },
};

function isFundStructured(vehicleName) {
  return !!FUND_COMMITMENTS[vehicleName];
}
function getLpCommitment(vehicleName, lpName) {
  return FUND_COMMITMENTS[vehicleName]?.perLP?.[lpName] ?? null;
}

/**
 * Cap-table data for shareholder-style (vehicle) entities.
 *
 * Phase 2 of shareholder reporting. The IRR sheet supplies per-year cash
 * but not share counts or share prices — this config fills that gap so we
 * can compute:
 *   - Cumulative shares per shareholder per year (cash ÷ share price + non-cash events)
 *   - Last-priced-round valuation (shares × most recent priced round price)
 *   - Year-by-year share issuance with redistribution / bonus events
 *
 * Currently scoped to InVitro Ventures (prototype). Migration path: when
 * we extend to Barsoum Brothers + Curenta Enterprise, this object grows
 * — at that point, consider moving to a "Cap Table" sheet tab with the
 * same event-per-row shape so non-engineers can maintain it.
 *
 * Important caveat (intentional, documented): this config assumes
 * "shares = cash ÷ share price for that year". That's accurate for
 * shareholders whose entire holding came from cash contributions (Ayman
 * Ismail in InVitro Ventures). It's NOT accurate for founders/operators
 * who hold founder-equity shares granted without cash (e.g. Amir Barsoum
 * has 7M+ shares but only ~$1.1M of cash contributions in IRR). For
 * those shareholders, this view will understate shares. The fix is to
 * model their founder grants as non-cash events — out of prototype scope.
 */
const VEHICLE_CAP_TABLE = {
  'InVitro Ventures': {
    // Share price per year — converts cash contributions to shares.
    // Until a priced round happens, contributions during the year use
    // the prior priced-round price (typical SAFE/convertible behavior).
    sharePriceByYear: {
      2023: 1,
      2024: 1,
      2025: 1,
      2026: 2, // R2 markup
      2027: 2,
    },
    // All priced rounds, chronologically. The "Last Priced Round" card
    // picks the most recent one ≤ selected year (so a user viewing 2025
    // sees R1 — R2 hasn't happened yet from their as-of viewpoint).
    pricedRounds: [
      { name: 'R1', year: 2023, sharePrice: 1 },
      { name: 'R2', year: 2026, sharePrice: 2 },
    ],
    // Non-cash share events. Per-shareholder array of { year, shares, label, description }.
    // Year determines when the shares are added to cumulative count.
    // Ayman's +50K redistribution happened in 2025 (post the R1-2nd-batch
    // close, when Ambrish ceased contributing); the year-end-2025
    // ownership jumps from 24.6% (2024 cap-table) to 25.0% as a result.
    nonCashEvents: {
      'Ayman Ismail': [
        { year: 2025, shares: 50_000, label: 'Redistribution',
          description: 'Bonus shares from Ambrish Mody redistribution' },
      ],
    },
  },
  // Barsoum Brothers — founder-heavy SPV. Amir & Ramy are founders;
  // most of their shares are founder grants (no cash). Cash contributions
  // (pre-2024 only; 2024+ are recycled per VEHICLE_RECYCLING_START_YEAR)
  // priced at $0.99/share since vehicle formation in 2021. Interest
  // accrual on convertible note converted into additional shares in 2024.
  'Barsoum Brothers': {
    sharePriceByYear: {
      2021: 0.99, 2022: 0.99, 2023: 0.99, 2024: 0.99,
      2025: 0.99, 2026: 0.99, 2027: 0.99,
    },
    pricedRounds: [
      { name: 'R1', year: 2021, sharePrice: 0.99 },
    ],
    nonCashEvents: {
      'Amir Barsoum': [
        { year: 2021, shares: 5_394_344, label: 'Founder grant',
          description: 'Founder equity at vehicle formation — no cash' },
        { year: 2024, shares: 37_963, label: 'Interest accrual',
          description: 'Accrued interest on convertible note, converted to shares' },
      ],
      'Ramy Barsoum': [
        { year: 2021, shares: 3_599_000, label: 'Founder grant',
          description: 'Founder equity at vehicle formation — no cash' },
        { year: 2024, shares: 5_880, label: 'Interest accrual',
          description: 'Accrued interest on convertible note, converted to shares' },
      ],
    },
  },
  // Curenta Enterprise — mixed cap table with founder Common (Amir/Ramy
  // got no-cash founder shares) + CrowdFunding Common at a different
  // historical price + Convertible class (most LPs) at $0.041/share.
  // 2024+ entries are GP-recycled per VEHICLE_RECYCLING_START_YEAR.
  // Per-LP interest accruals on the convertibles are modeled below for
  // major shareholders; minor LPs' interest is approximated (cumulative
  // shares slightly underestimates for them — acceptable given their
  // small stakes; can be added explicitly if a specific LP loads up).
  'Curenta Enterprise': {
    sharePriceByYear: {
      2021: 0.041, 2022: 0.041, 2023: 0.041, 2024: 0.041,
      2025: 0.041, 2026: 0.041, 2027: 0.041,
    },
    pricedRounds: [
      { name: 'R1', year: 2021, sharePrice: 0.041 },
    ],
    nonCashEvents: {
      // Founder Common shares (no cash) granted at vehicle formation
      'Amir Barsoum': [
        { year: 2021, shares: 1_080_000, label: 'Founder grant',
          description: 'Common voting shares granted at vehicle formation' },
        { year: 2024, shares: 81_002, label: 'Interest accrual',
          description: 'Accrued interest on Ex-Mic convertible' },
      ],
      'Ramy Barsoum': [
        { year: 2021, shares: 720_000, label: 'Founder grant',
          description: 'Common voting shares granted at vehicle formation' },
        { year: 2024, shares: 81_002, label: 'Interest accrual',
          description: 'Accrued interest on Ex-Mic convertible' },
      ],
      // Per-LP interest accruals (modeled for the larger holders;
      // smaller LPs' interest can be added on request).
      'Ihab Dorotta':       [{ year: 2024, shares:  536_585, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Ayman Ismail':       [{ year: 2024, shares: 1_185_767, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Rasha Abdrabou':     [{ year: 2024, shares:  179_419, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Luis Garcia':        [{ year: 2024, shares:  157_868, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Mario Karras':       [{ year: 2024, shares:  155_112, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Daniella Karras':    [{ year: 2024, shares:  155_112, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Betul Aslandogan':   [{ year: 2024, shares:  117_441, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Sameh Halaka':       [{ year: 2024, shares:  105_246, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Hala Karras':        [{ year: 2024, shares:  102_907, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Abdulamir Kahtan Fadel': [{ year: 2024, shares: 59_389, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Hassan Mohammad Fawaz':  [{ year: 2024, shares: 59_389, label: 'Interest accrual', description: 'Accrued convertible interest' }],
      'Marc Farhat':        [{ year: 2024, shares:   57_467, label: 'Interest accrual', description: 'Accrued convertible interest' }],
    },
  },
};

function getCapTableConfig(vehicleName) {
  return VEHICLE_CAP_TABLE[vehicleName] ?? null;
}

/**
 * Most recent priced round whose year is ≤ asOfYear. Returns null when
 * no priced round has happened yet (or the vehicle isn't cap-table-
 * configured). Used by the "Last Priced Round" card to render the
 * snapshot from the as-of-selected-year viewpoint, not the absolute
 * latest.
 */
function getPricedRoundAsOf(vehicleName, asOfYear) {
  const cfg = getCapTableConfig(vehicleName);
  if (!cfg?.pricedRounds?.length) return null;
  const eligible = cfg.pricedRounds.filter(r => r.year <= asOfYear);
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, r) => (r.year > latest.year ? r : latest), eligible[0]);
}

/**
 * Cumulative shares for a shareholder through a given year.
 *   shares = Σ (cash[y] ÷ sharePrice[y])  for y ≤ throughYear
 *          + Σ nonCashEvents[lp].shares    for events whose year ≤ throughYear
 *
 * Returns null when the vehicle has no cap-table config (consumers fall
 * back to cash-only display). Returns 0 when config exists but the
 * shareholder has no contributions / events yet.
 */
function computeCumulativeShares(vehicleName, lpName, lpInvestmentSeries, years, throughYearIdx) {
  const cfg = getCapTableConfig(vehicleName);
  if (!cfg) return null;
  let total = 0;
  for (let i = 0; i <= throughYearIdx && i < (lpInvestmentSeries?.length ?? 0); i++) {
    const cash = lpInvestmentSeries[i] ?? 0;
    if (cash === 0) continue;
    const price = cfg.sharePriceByYear[years[i]];
    if (!price || price <= 0) continue;
    total += cash / price;
  }
  const events = cfg.nonCashEvents?.[lpName] ?? [];
  for (const ev of events) {
    const evIdx = years.indexOf(ev.year);
    if (evIdx >= 0 && evIdx <= throughYearIdx) total += ev.shares;
  }
  return total;
}

/** Shares issued in a specific year — both cash-derived and non-cash. */
function computeSharesInYear(vehicleName, lpName, lpInvestmentSeries, years, yearIdx) {
  const cfg = getCapTableConfig(vehicleName);
  if (!cfg) return { cashShares: 0, nonCashShares: 0, nonCashEvents: [] };
  const cash = lpInvestmentSeries?.[yearIdx] ?? 0;
  const price = cfg.sharePriceByYear[years[yearIdx]];
  const cashShares = (cash > 0 && price > 0) ? cash / price : 0;
  const events = cfg.nonCashEvents?.[lpName] ?? [];
  const yearEvents = events.filter(ev => ev.year === years[yearIdx]);
  const nonCashShares = yearEvents.reduce((s, ev) => s + ev.shares, 0);
  return { cashShares, nonCashShares, nonCashEvents: yearEvents };
}
function sumLpInvestmentsThroughYear(vehicle, yearIdx) {
  return vehicle.lps.reduce((s, lp) => {
    const series = lp.investment ?? [];
    return s + series.slice(0, yearIdx + 1).reduce((a, v) => a + (v ?? 0), 0);
  }, 0);
}

/**
 * Split an LP's per-year investment series into initial contributions
 * (cash the LP put in) vs recycled allocations (GP redeployed profits
 * on their behalf into new positions).
 *
 * Driven by VEHICLE_RECYCLING_START_YEAR above. Entries before the
 * vehicle's recycling start year = initial. Entries on/after = recycled.
 * Vehicles without a recycling-start config → all entries treated as
 * initial.
 */
function splitContributions(series, throughYearIdx, years, recyclingStartYear) {
  let initial = 0, recycled = 0;
  const initialEvents = [], recycledEvents = [];
  for (let i = 0; i <= throughYearIdx && i < series.length; i++) {
    const v = series[i] ?? 0;
    if (v === 0) continue;
    const year = years[i];
    if (recyclingStartYear != null && year >= recyclingStartYear) {
      recycled += v; recycledEvents.push({ yearIdx: i, amount: v });
    } else {
      initial += v; initialEvents.push({ yearIdx: i, amount: v });
    }
  }
  return { initial, recycled, initialEvents, recycledEvents };
}

/**
 * XIRR — money-weighted internal rate of return for irregular cash flows.
 *
 * Solves for the annualized rate r where Σ CF_i / (1+r)^t_i = 0, given
 * cash flows with their times (in years from the first flow). This is
 * the standard formula behind Excel's XIRR() and what Carta-style LP
 * statements use for fund IRR.
 *
 * Implementation: Newton-Raphson iteration starting from `guess`.
 * Converges quickly for "normal" fund-style cash flows (one or more
 * negative outflows followed by a positive terminal value).
 *
 * Returns the rate as a fraction (0.25 = 25%) or null if:
 *   - Fewer than 2 flows
 *   - No mix of positive and negative flows (can't solve)
 *   - Solver fails to converge in MAX_ITER iterations
 *
 * @param {Array<{amount: number, yearsFromStart: number}>} flows
 * @param {number} [guess=0.1]  initial rate guess (10%)
 */
function xirr(flows, guess = 0.1) {
  if (!flows || flows.length < 2) return null;
  const hasNeg = flows.some(f => f.amount < 0);
  const hasPos = flows.some(f => f.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const MAX_ITER = 100;
  const TOL = 1e-9;
  let r = guess;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let f = 0, df = 0;
    for (const cf of flows) {
      const onePlusR = 1 + r;
      if (onePlusR <= 0) return null; // rate below -100% is nonsensical
      const denom = Math.pow(onePlusR, cf.yearsFromStart);
      f += cf.amount / denom;
      df -= (cf.amount * cf.yearsFromStart) / (denom * onePlusR);
    }
    if (Math.abs(f) < TOL) return r;
    if (Math.abs(df) < 1e-12) return null; // flat slope; can't step
    let newR = r - f / df;
    // Clamp to keep numerically stable.
    if (newR <= -0.999) newR = (r - 0.999) / 2; // bounce away from -100%
    if (newR > 10) newR = 10;                   // 1000% is the practical cap
    r = newR;
  }
  return null; // didn't converge
}

/**
 * Compute LP-specific returns for the selected year using two framings:
 *
 *   onInitial (Carta-style — primary display)
 *     LP_Value  = vehicle.ownershipValue × LP.ownership%
 *     MOIC      = LP_Value / initial contributions only
 *     IRR       = MOIC^(1/years) - 1
 *
 *   onTotal (conservative — secondary, shown in tooltip)
 *     MOIC      = LP_Value / (initial + recycled allocations)
 *     IRR       = MOIC^(1/years) - 1
 *
 * Initial vs recycled split via splitContributions() above. Years uses
 * the vehicle's hold period (consistent with the vehicle-level rollup).
 *
 * Returns IRRs in percent units (43 means 43%).
 */
function computeLpReturns(lp, vehicle, yearIdx, years) {
  const ownPct = lp.ownership?.[yearIdx] ?? 0;
  const vehicleValue = vehicle.ownershipValue?.[yearIdx] ?? 0;
  const lpValue = vehicleValue * (ownPct / 100);

  const series = lp.investment ?? [];
  const recyclingStartYear = VEHICLE_RECYCLING_START_YEAR[vehicle.name];
  const split = splitContributions(series, yearIdx, years, recyclingStartYear);
  const cumInvest = split.initial + split.recycled;

  const isFund = isFundStructured(vehicle.name);

  // LP-specific hold years: from this LP's FIRST investment year to the
  // currently-selected year. Per Andrew: "each LP has his own initial year."
  // Late-joiner LPs (Ayman Ismail entered InVitro Ventures in 2024 while
  // the vehicle started 2023) get a shorter hold than the vehicle —
  // their annualization should reflect how long THEIR money was at work,
  // not the vehicle's age. Falls back to the vehicle's hold period when
  // the LP hasn't invested anything yet in the selected year window.
  const firstInvestIdx = series.findIndex(v => v != null && v !== 0);
  const lpHoldYears = firstInvestIdx >= 0 && firstInvestIdx <= yearIdx && years
    ? years[yearIdx] - years[firstInvestIdx]
    : (vehicle.holdPeriod?.[yearIdx] ?? null);
  const lpFirstYear = firstInvestIdx >= 0 && years ? years[firstInvestIdx] : null;

  // Returns calculator. MOIC = NAV / basis is unchanged across methods
  // (no time dependence). IRR branches:
  //   - Fund-structured vehicle: money-weighted XIRR computed from the
  //     actual call timing. Matches Excel's =XIRR() formula and what
  //     LP fund statements expect.
  //   - Direct investment vehicle: CAGR on the vehicle's hold period
  //     (matches the sheet's vehicle-rollup convention).
  // If XIRR fails to converge for any reason, fall back to CAGR rather
  // than show a missing value.
  const calcReturn = (basis, events) => {
    if (basis <= 0 || lpValue <= 0) return { moic: null, irr: null };
    const moic = lpValue / basis;

    if (isFund && events && events.length > 0) {
      const firstYearIdx = events[0].yearIdx;
      const flows = events.map(e => ({
        amount: -e.amount, // outflow from LP perspective
        yearsFromStart: e.yearIdx - firstYearIdx,
      }));
      // Terminal NAV = positive inflow at the current year.
      flows.push({ amount: lpValue, yearsFromStart: yearIdx - firstYearIdx });
      const rate = xirr(flows);
      if (rate != null) return { moic, irr: rate * 100 };
      // XIRR didn't converge — fall through to CAGR
    }

    // CAGR fallback using LP-SPECIFIC hold years (not the vehicle's).
    // Late-joiner LPs annualize over their own time-at-work, which is
    // the honest LP framing.
    const irr = lpHoldYears && lpHoldYears > 0
      ? (Math.pow(moic, 1 / lpHoldYears) - 1) * 100
      : null;
    return { moic, irr };
  };

  const onInitial = calcReturn(split.initial, split.initialEvents);
  const onTotal   = calcReturn(cumInvest, [...split.initialEvents, ...split.recycledEvents]);

  return {
    ownPct,
    lpValue,
    initialContrib: split.initial,
    recycledAlloc: split.recycled,
    cumInvest,
    // Default `moic` and `irr` use the LP-friendly Carta-style framing.
    moic: onInitial.moic,
    irr: onInitial.irr,
    moicOnInitial: onInitial.moic,
    moicOnTotal: onTotal.moic,
    irrOnInitial: onInitial.irr,
    irrOnTotal: onTotal.irr,
    // LP-specific hold timeline — used by the UI to show "Hold: N yr (joined YYYY)"
    lpHoldYears,
    lpFirstYear,
    // Tells the UI which IRR method was used so it can label/footnote
    // appropriately (cagr for vehicles, xirr for funds).
    irrMethod: isFund ? 'xirr' : 'cagr',
  };
}

/**
 * IRR & Valuation tab.
 * Shows per-vehicle: KPI strip, per-company table, optional "My Performance"
 * card for LP users, LP roster table.
 *
 * Permission scoping (driven by user.permissions.lpName):
 *  - lpName set → only show vehicles where this LP appears, highlight LP's row.
 *  - lpName unset → show all 4 vehicles (admin / general viewer).
 */
export default function IRRValuation({ data, user, selectedYear: selectedYearProp, compareYear }) {
  const irr = data?.irrValuation;

  // No IRR data available — could be missing tab access or sheet load failure
  if (!irr || !irr.vehicles?.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">IRR &amp; Valuation data is not available.</p>
      </div>
    );
  }

  const years = irr.years;
  // Year selection comes from the header (Dashboard owns the state). Fall
  // back to "most recent year with data" if the prop isn't provided (e.g.
  // standalone usage without the parent's header).
  const fallbackYear = (() => {
    for (let i = years.length - 1; i >= 0; i--) {
      const hasData = irr.vehicles.some(v => v.ownershipValue?.[i] != null && v.ownershipValue[i] > 0);
      if (hasData) return years[i];
    }
    return years[years.length - 1];
  })();
  const selectedYear = selectedYearProp ?? fallbackYear;
  const yearIdx = years.indexOf(selectedYear);
  // Comparison year (optional). When set, vehicle KPI tiles render a delta
  // badge underneath their primary value.
  const compIdx = compareYear != null ? years.indexOf(compareYear) : -1;
  const compEnabled = compIdx >= 0 && compIdx !== yearIdx;

  // LP scoping
  const lpName = user?.permissions?.lpName || null;
  const visibleVehicles = lpName
    ? irr.vehicles.filter(v => v.lps.some(lp => lp.name === lpName))
    : irr.vehicles;

  /**
   * Compute look-through exposure: an LP's total economic interest in
   * each portco, summing their direct stake (if any) + their pro-rata
   * slice through every vehicle they're invested in.
   *
   *   effective % = direct % + Σ (vehicle's % of portco × LP's % of vehicle)
   *   effective $ = portco_valuation × effective %
   *
   * Returns one entry per portco where the LP has any exposure (direct
   * OR indirect). Used for the violet "Look-Through Exposure" card that
   * shows above the per-vehicle sections for LPs who have direct stakes.
   */
  function computeLookThrough(lpNameArg) {
    if (!lpNameArg || !irr) return [];
    const results = [];
    for (const co of irr.companies || []) {
      // InVitro Studio is the parent venture studio entity — its
      // valuation derives from the portcos it already holds stakes in.
      // Including it here would double-count those portcos (which are
      // also in this loop as standalone entries). Per the same rule
      // used in the per-vehicle "Companies Invested In" table.
      if (co.name === 'InVitro Studio') continue;
      const valuation = co.financials?.valuation?.[yearIdx] ?? 0;
      // Direct stake (from "(Individual)" rows in the IRR sheet)
      const directRecord = co.directShareholders?.[lpNameArg];
      const directOwnPct = directRecord?.ownership?.[yearIdx] ?? 0;
      const directValue = valuation * (directOwnPct / 100);
      const directCash = (directRecord?.investment ?? [])
        .slice(0, yearIdx + 1).reduce((s, v) => s + (v ?? 0), 0);
      // First-investment-year for the direct stake (used to anchor CAGR)
      const directFirstIdx = (directRecord?.investment ?? [])
        .findIndex(v => v != null && v > 0);
      // Earliest year of any contribution (direct or via any vehicle).
      // Used as the CAGR base year for the look-through IRR.
      let earliestYearIdx = directFirstIdx >= 0 ? directFirstIdx : Infinity;

      // Indirect through each vehicle the LP is a member of
      const indirect = [];
      let totalIndirectPct = 0;
      let totalIndirectValue = 0;
      let totalIndirectInvestment = 0;
      for (const v of irr.vehicles || []) {
        const lpInVehicle = v.lps?.find(lp => lp.name === lpNameArg);
        if (!lpInVehicle) continue;
        const vehicleOwnsCoPct = co.ownership?.[v.name]?.[yearIdx] ?? 0;
        if (vehicleOwnsCoPct === 0) continue;
        const lpInVehiclePct = lpInVehicle.ownership?.[yearIdx] ?? 0;
        if (lpInVehiclePct === 0) continue;
        // Effective look-through ownership: multiply the two %s.
        // (vehicleOwnsCoPct and lpInVehiclePct are both in percent units,
        // so the product is in pct² — divide once by 100 to get back to
        // a percent of the portco.)
        const effectivePct = (vehicleOwnsCoPct * lpInVehiclePct) / 100;
        const effectiveValue = valuation * (effectivePct / 100);
        // LP's attributable cost basis flowing into this portco via this
        // vehicle. The vehicle's cumulative cash into the portco × LP's
        // current ownership of the vehicle — that's the LP's slice of
        // the dollars deployed.
        const vehicleCashIntoCo = (co.investments?.[v.name] ?? [])
          .slice(0, yearIdx + 1).reduce((s, val) => s + (val ?? 0), 0);
        const lpAttributableInvestment = vehicleCashIntoCo * (lpInVehiclePct / 100);

        // Anchor for CAGR: LP's first investment year in this vehicle
        const lpInvSeries = lpInVehicle.investment ?? [];
        const lpFirstInVehicleIdx = lpInvSeries.findIndex(val => val != null && val > 0);
        if (lpFirstInVehicleIdx >= 0 && lpFirstInVehicleIdx < earliestYearIdx) {
          earliestYearIdx = lpFirstInVehicleIdx;
        }

        indirect.push({
          vehicle: v.name, vehicleOwnsCoPct, lpInVehiclePct,
          effectivePct, effectiveValue,
          lpAttributableInvestment,
        });
        totalIndirectPct += effectivePct;
        totalIndirectValue += effectiveValue;
        totalIndirectInvestment += lpAttributableInvestment;
      }
      const totalPct = directOwnPct + totalIndirectPct;
      const totalValue = directValue + totalIndirectValue;
      const totalInvestment = directCash + totalIndirectInvestment;
      // MOIC = current value ÷ cumulative cost basis
      const moic = totalInvestment > 0 ? totalValue / totalInvestment : null;
      // CAGR-style IRR (approximation; full XIRR would require per-year
      // cash-flow timing across direct + each vehicle slice — out of
      // scope for the look-through summary, but vehicle-level XIRR is
      // still available on each vehicle's My Performance card)
      let lookThruIrr = null;
      if (moic != null && moic > 0 && earliestYearIdx !== Infinity) {
        const holdYears = years[yearIdx] - years[earliestYearIdx];
        if (holdYears > 0) {
          lookThruIrr = (Math.pow(moic, 1 / holdYears) - 1) * 100;
        }
      }

      if (totalValue > 0 || totalPct > 0 || directCash > 0) {
        results.push({
          portcoName: co.name, valuation,
          directOwnPct, directValue, directCash,
          indirect, totalIndirectPct, totalIndirectValue, totalIndirectInvestment,
          totalPct, totalValue, totalInvestment,
          moic, irr: lookThruIrr,
          earliestYearIdx,
        });
      }
    }
    return results;
  }

  // Companies invested in by a vehicle, in the selected year.
  // `inv` is year-only (what was put in this year), `cumInv` is the running total
  // through the selected year — this matches the sheet's vehicle-rollup convention
  // where the vehicle's "Investment" line is cumulative.
  function vehicleCompanies(vehicleName) {
    return irr.companies
      .map(co => {
        const series = co.investments?.[vehicleName] ?? [];
        const inv = series[yearIdx] ?? 0;
        const cumInv = series
          .slice(0, yearIdx + 1)
          .reduce((s, v) => s + (v ?? 0), 0);
        const own = co.ownership?.[vehicleName]?.[yearIdx] ?? 0;
        const valuation = co.financials?.valuation?.[yearIdx] ?? 0;
        return { co, inv, cumInv, own, valuation };
      })
      .filter(x => x.cumInv > 0 || x.own > 0);
  }

  return (
    <div className="space-y-6">
      {/* Title / LP scope label. Year + Compare selectors live in the
          page header (Dashboard component) so they're consistent with
          the other tabs' header treatment. */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          IRR &amp; Valuation — {selectedYear}{compEnabled ? ` vs ${compareYear}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          {lpName ? <>Viewing your stakes as <strong>{lpName}</strong></> : <>All investment vehicles</>}
        </p>
      </div>

      {/* LP-scoped wayfinding banner — tells the LP up-front how many
          investment vehicles they're in, before they scroll through them.
          Sets the expectation that there are MORE vehicles below. */}
      {lpName && visibleVehicles.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Your investments</p>
          <p className="text-sm text-foreground">
            You're invested through <strong>{visibleVehicles.length}</strong> {visibleVehicles.length === 1 ? 'investment vehicle' : 'investment vehicles'}:
            {' '}
            {visibleVehicles.map((v, i) => (
              <span key={v.name}>
                {i > 0 && (i === visibleVehicles.length - 1 ? ', and ' : ', ')}
                <strong className="text-primary">{v.name}</strong>
              </span>
            ))}
            .
          </p>
        </div>
      )}

      {/* Look-Through Exposure — only renders for LPs who have at least
          one direct shareholder stake. For non-direct LPs the per-vehicle
          breakdown already tells the whole story, so this card would be
          redundant. For Amir (and any future direct shareholders) it
          aggregates direct + indirect exposure to each portco. */}
      {lpName && (() => {
        const lookThrough = computeLookThrough(lpName);
        const hasAnyDirect = lookThrough.some(lt => lt.directOwnPct > 0 || lt.directCash > 0);
        if (!hasAnyDirect) return null;
        return (
          <div className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-violet-50/60 to-fuchsia-50/40 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-violet-200/60 bg-violet-100/40">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-700">Your Look-Through Exposure</p>
              <p className="text-sm text-violet-900 mt-0.5">
                Total economic interest in each portfolio company — your direct stake plus your pro-rata slice through every vehicle.
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Consolidated summary — rolls the per-portco cards up
                  into a single "total exposure across the whole
                  portfolio" view, broken down by source (direct + each
                  vehicle). This is the answer to "what's the total $
                  value of everything I'm exposed to?" The numbers
                  reconcile downward — sum of direct/vehicle rows here
                  matches the sum of direct/vehicle rows across the
                  per-portco cards below. */}
              {(() => {
                let totalDirect = 0;
                let totalDirectCash = 0;
                const byVehicle = new Map();          // vehicleName → cumulative effective value
                const byVehicleInvestment = new Map(); // vehicleName → cumulative attributable investment
                let totalAll = 0;
                let totalInvestmentAll = 0;
                let earliestYearIdxAll = Infinity;
                for (const lt of lookThrough) {
                  totalDirect += lt.directValue;
                  totalDirectCash += lt.directCash;
                  totalInvestmentAll += lt.totalInvestment;
                  for (const ind of lt.indirect) {
                    byVehicle.set(ind.vehicle, (byVehicle.get(ind.vehicle) ?? 0) + ind.effectiveValue);
                    byVehicleInvestment.set(ind.vehicle, (byVehicleInvestment.get(ind.vehicle) ?? 0) + ind.lpAttributableInvestment);
                  }
                  totalAll += lt.totalValue;
                  if (lt.earliestYearIdx < earliestYearIdxAll) earliestYearIdxAll = lt.earliestYearIdx;
                }
                if (totalAll <= 0) return null;
                // Consolidated MOIC = total value ÷ total cost basis
                const consMoic = totalInvestmentAll > 0 ? totalAll / totalInvestmentAll : null;
                // Consolidated IRR (CAGR) anchored on the earliest year ANY
                // contribution to ANY portco started. Approximate — full
                // XIRR would aggregate per-year flows across direct + every
                // vehicle slice across every portco; the per-vehicle
                // XIRR (on the My Performance card) is still the authoritative
                // per-vehicle number.
                let consIrr = null;
                if (consMoic != null && consMoic > 0 && earliestYearIdxAll !== Infinity) {
                  const holdYears = years[yearIdx] - years[earliestYearIdxAll];
                  if (holdYears > 0) consIrr = (Math.pow(consMoic, 1 / holdYears) - 1) * 100;
                }
                return (
                  <div className="rounded-lg border-2 border-violet-400 bg-violet-100/40 overflow-hidden">
                    <div className="px-4 py-2 border-b border-violet-300/60 bg-violet-200/30">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-xs font-bold uppercase tracking-wide text-violet-900">Consolidated</span>
                          <span className="text-[10px] text-violet-700">total across all portcos · {lookThrough.length} {lookThrough.length === 1 ? 'company' : 'companies'}</span>
                        </div>
                      </div>
                      {/* Consolidated metrics strip — same shape as the
                          per-portco strip so the eye scans top-to-bottom
                          across rows. Value + Investment reconcile to
                          the column totals below. */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">Investment</p>
                          <p className="text-base font-bold tabular-nums text-violet-900">{totalInvestmentAll > 0 ? fmt(totalInvestmentAll) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">Total Value</p>
                          <p className="text-base font-bold tabular-nums text-violet-900">{fmt(totalAll)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">MOIC</p>
                          <p className={cn(
                            "text-base font-bold tabular-nums",
                            consMoic == null ? "text-violet-900" :
                            consMoic >= 1 ? "text-emerald-700" : "text-red-600"
                          )}>{consMoic != null ? `${consMoic.toFixed(2)}×` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">IRR</p>
                          <p className={cn(
                            "text-base font-bold tabular-nums",
                            consIrr == null ? "text-violet-900" :
                            consIrr >= 0 ? "text-emerald-700" : "text-red-600"
                          )}>{consIrr != null ? `${consIrr.toFixed(1)}%` : '—'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-2 space-y-1.5">
                      {/* Direct line (only if any direct exposure) */}
                      {totalDirect > 0 && (
                        <div className="flex items-baseline justify-between gap-3 py-1">
                          <div className="text-xs">
                            <span className="font-semibold text-fuchsia-800">Direct holdings</span>
                            <span className="text-muted-foreground ml-2">cumulative cost basis {fmt(totalDirectCash)}</span>
                          </div>
                          <div className="text-right tabular-nums">
                            <span className="text-xs font-bold text-fuchsia-800">{fmt(totalDirect)}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">{totalAll > 0 ? ((totalDirect / totalAll) * 100).toFixed(1) : '0.0'}% of total</span>
                          </div>
                        </div>
                      )}
                      {/* Per-vehicle rollup — sorted by size descending */}
                      {[...byVehicle.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([vehicle, val]) => (
                          <div key={vehicle} className="flex items-baseline justify-between gap-3 py-1">
                            <div className="text-xs">
                              <span className="text-foreground">via <span className="font-medium text-violet-800">{vehicle}</span></span>
                            </div>
                            <div className="text-right tabular-nums">
                              <span className="text-xs font-medium text-foreground">{fmt(val)}</span>
                              <span className="text-[10px] text-muted-foreground ml-2">{totalAll > 0 ? ((val / totalAll) * 100).toFixed(1) : '0.0'}% of total</span>
                            </div>
                          </div>
                        ))}
                      {/* Grand total */}
                      <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t-2 border-violet-300/60">
                        <span className="text-sm font-bold text-violet-900">Total economic exposure (all paths, all portcos)</span>
                        <span className="text-base font-bold tabular-nums text-violet-900">{fmt(totalAll)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {lookThrough.map(lt => (
                <div key={lt.portcoName} className="rounded-lg border border-violet-200/70 bg-white/70 overflow-hidden">
                  <div className="px-4 py-2 border-b border-violet-100">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-sm font-bold text-violet-900 truncate">{lt.portcoName}</span>
                        <span className="text-[10px] text-violet-600">Portco valuation: {fmt(lt.valuation)}</span>
                      </div>
                      <span className="text-[10px] text-violet-700">{lt.totalPct.toFixed(2)}% effective ownership</span>
                    </div>
                    {/* Per-portco metrics strip — Investment (cost basis),
                        Value (current stake FMV), MOIC, IRR (CAGR over
                        earliest investment year). Null-safe display
                        for portcos where the LP has only exposure but
                        no cost basis. */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-violet-600 uppercase tracking-wide">Investment</p>
                        <p className="text-sm font-bold tabular-nums text-violet-900">{lt.totalInvestment > 0 ? fmt(lt.totalInvestment) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 uppercase tracking-wide">Stake Value</p>
                        <p className="text-sm font-bold tabular-nums text-violet-900">{fmt(lt.totalValue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 uppercase tracking-wide">MOIC</p>
                        <p className={cn(
                          "text-sm font-bold tabular-nums",
                          lt.moic == null ? "text-violet-900" :
                          lt.moic >= 1 ? "text-emerald-700" : "text-red-600"
                        )}>{lt.moic != null ? `${lt.moic.toFixed(2)}×` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 uppercase tracking-wide">IRR</p>
                        <p className={cn(
                          "text-sm font-bold tabular-nums",
                          lt.irr == null ? "text-violet-900" :
                          lt.irr >= 0 ? "text-emerald-700" : "text-red-600"
                        )}>{lt.irr != null ? `${lt.irr.toFixed(1)}%` : '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 space-y-1.5">
                    {/* Direct row */}
                    {(lt.directOwnPct > 0 || lt.directCash > 0) && (
                      <div className="flex items-baseline justify-between gap-3 py-1">
                        <div className="text-xs">
                          <span className="font-semibold text-fuchsia-800">Direct</span>
                          <span className="text-muted-foreground ml-2">your name on the cap table · cost basis {fmt(lt.directCash)}</span>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="text-xs font-bold text-fuchsia-800">{fmt(lt.directValue)}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{lt.directOwnPct.toFixed(2)}%</span>
                        </div>
                      </div>
                    )}
                    {/* Vehicle rows */}
                    {lt.indirect.map(ind => (
                      <div key={ind.vehicle} className="flex items-baseline justify-between gap-3 py-1">
                        <div className="text-xs">
                          <span className="text-foreground">via <span className="font-medium text-violet-800">{ind.vehicle}</span></span>
                          <span className="text-muted-foreground ml-2">
                            ({ind.lpInVehiclePct.toFixed(1)}% × {ind.vehicleOwnsCoPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="text-xs font-medium text-foreground">{fmt(ind.effectiveValue)}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{ind.effectivePct.toFixed(2)}%</span>
                        </div>
                      </div>
                    ))}
                    {/* Total row */}
                    <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t border-violet-100">
                      <span className="text-xs font-semibold text-violet-900">Total economic exposure</span>
                      <div className="text-right tabular-nums">
                        <span className="text-sm font-bold text-violet-900">{fmt(lt.totalValue)}</span>
                        <span className="text-[10px] font-medium text-violet-700 ml-2">{lt.totalPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Vehicles */}
      {visibleVehicles.map(v => {
        const ownership = v.ownershipValue?.[yearIdx] ?? 0;
        const investment = v.investment?.[yearIdx] ?? 0;
        const irrPct = v.irr?.[yearIdx];
        const moic = v.moic?.[yearIdx];
        // Comparison-year values for the delta badges (only used when
        // compEnabled is true; otherwise compIdx is -1 and DeltaBadge
        // returns null because prior is null).
        const ownershipPrior = compEnabled ? (v.ownershipValue?.[compIdx] ?? null) : null;
        const investmentPrior = compEnabled ? (v.investment?.[compIdx] ?? null) : null;
        const irrPrior = compEnabled ? (v.irr?.[compIdx] ?? null) : null;
        const moicPrior = compEnabled ? (v.moic?.[compIdx] ?? null) : null;
        const cos = vehicleCompanies(v.name);
        const myLp = lpName ? v.lps.find(lp => lp.name === lpName) : null;
        // LP-specific returns: ownership %, value, cumulative invested,
        // MOIC, IRR — computed using the actual sheet-provided investment
        // amounts (not vehicle investment × ownership %).
        const myReturns = myLp ? computeLpReturns(myLp, v, yearIdx, years) : null;
        const myOwnPct = myReturns?.ownPct ?? 0;
        const myValue = myReturns?.lpValue ?? 0;
        const myInvestment = myReturns?.cumInvest ?? 0;
        const myIrr = myReturns?.irr;
        const myMoic = myReturns?.moic;

        // Fund-structured vehicle? Compute commitment/called/unfunded.
        const fundInfo = FUND_COMMITMENTS[v.name];
        const isFund = !!fundInfo;
        const fundTotalCommit = fundInfo?.totalCommitment ?? null;
        const fundCalledToDate = isFund ? sumLpInvestmentsThroughYear(v, yearIdx) : null;
        const fundUnfunded = isFund ? fundTotalCommit - fundCalledToDate : null;
        const fundPctCalled = isFund && fundTotalCommit > 0 ? (fundCalledToDate / fundTotalCommit) * 100 : null;

        return (
          <Card key={v.name} className="overflow-hidden">
            {/* Vehicle name banner — clear visual anchor so the reader
                always knows which vehicle's data they're looking at.
                Colored left stripe + larger title than the default. */}
            <div className="flex items-stretch border-b border-border/60">
              <div className="w-1.5 bg-primary" aria-hidden="true" />
              <div className="flex-1 flex items-center justify-between px-5 py-4 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                    {isFund ? 'Investment Fund' : 'Investment Vehicle'}
                  </p>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {v.name}
                    {isFund && <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded align-middle">Fund</span>}
                  </h3>
                </div>
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {v.holdPeriod?.[yearIdx] != null ? `Hold period: ${v.holdPeriod[yearIdx]} yr` : ''}
                </span>
              </div>
            </div>
            <CardContent className="space-y-6">
              {/* Fund Commitments panel — only for fund-structured vehicles.
                  Shows the LP-facing commitment vocabulary: Committed
                  (total pledge), Called (cash wired so far), Unfunded
                  (remaining obligation), and % Called. */}
              {isFund && (
                <div className="rounded-lg border border-primary/30 bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Fund Commitments
                    </p>
                    {fundPctCalled != null && (
                      <p className="text-[11px] text-muted-foreground">
                        Capital call period: {fundInfo.commitmentPeriodYears[0]}–{fundInfo.commitmentPeriodYears[1]}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiTile label="Total Committed" value={fmt(fundTotalCommit)} compact />
                    <KpiTile label="Called to Date" value={fmt(fundCalledToDate)} compact />
                    <KpiTile label="Unfunded" value={fmt(fundUnfunded)} tone={fundUnfunded > 0 ? 'neutral' : 'positive'} compact />
                    <KpiTile label="% Called" value={fundPctCalled != null ? `${fundPctCalled.toFixed(0)}%` : '—'} compact />
                  </div>
                  {/* Mini progress bar — visual reinforcement of % called */}
                  {fundPctCalled != null && (
                    <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, fundPctCalled)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Vehicle KPI strip — when compEnabled, each tile gets a
                  delta badge showing change vs the comparison year. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile label="Ownership Value" value={fmt(ownership)}
                  delta={compEnabled && <DeltaBadge current={ownership} prior={ownershipPrior} compareYear={compareYear} />} />
                <KpiTile label="Total Investment" value={fmt(investment)}
                  delta={compEnabled && <DeltaBadge current={investment} prior={investmentPrior} compareYear={compareYear} />} />
                <KpiTile label="IRR" value={irrPct != null ? `${irrPct.toFixed(1)}%` : '—'}
                  tone={irrPct == null ? 'neutral' : irrPct >= 0 ? 'positive' : 'negative'}
                  delta={compEnabled && <DeltaBadge current={irrPct} prior={irrPrior} compareYear={compareYear} />} />
                <KpiTile label="MOIC" value={moic != null ? `${moic.toFixed(1)}x` : '—'}
                  tone={moic == null ? 'neutral' : moic >= 1 ? 'positive' : 'negative'}
                  delta={compEnabled && <DeltaBadge current={moic} prior={moicPrior} compareYear={compareYear} />} />
              </div>

              {/* My Performance — relocated to after "Companies Invested In" so the narrative reads vehicle-portfolio first, then LP-specific impact. */}

              {/* Per-company table */}
              {cos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Companies Invested In
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">{selectedYear} Investment</TableHead>
                        <TableHead className="text-right">Cum. Investment</TableHead>
                        <TableHead className="text-right">Ownership %</TableHead>
                        <TableHead className="text-right">Stake Value</TableHead>
                        {/* Multiple sits adjacent to Valuation since
                            Valuation = ARR × Multiple in the source sheet. */}
                        <TableHead className="text-right">Multiple</TableHead>
                        <TableHead className="text-right">Company Valuation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cos.map(({ co, inv, cumInv, own, valuation }) => {
                        // InVitro Studio is the parent venture studio entity —
                        // its valuation derives from the very portfolio companies
                        // each vehicle already holds stakes in. Showing a stake
                        // value here would double-count against the vehicle's
                        // actual ownership total. Investment columns stay live
                        // (real cash flowed); multiple/valuation/stake suppressed.
                        const isParentStudio = co.name === 'InVitro Studio';
                        const stakeValue = (own / 100) * valuation;
                        const multiple = co.financials?.multiple?.[yearIdx];
                        return (
                          <TableRow key={co.name}>
                            <TableCell className="font-medium">{co.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(inv)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmt(cumInv)}</TableCell>
                            <TableCell className="text-right tabular-nums">{own.toFixed(1)}%</TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              isParentStudio && "text-muted-foreground"
                            )}>
                              {isParentStudio ? '—' : fmt(stakeValue)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              isParentStudio && "text-muted-foreground"
                            )}>
                              {isParentStudio || multiple == null ? '—' : `${multiple.toFixed(1)}x`}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              isParentStudio && "text-muted-foreground"
                            )}>
                              {isParentStudio ? '—' : fmt(valuation)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}


              {/* My Performance card (relocated) — appears AFTER the per-
                  company table so the LP reads "what the vehicle holds →
                  what that means for me" rather than the reverse. */}
              {myLp && (() => {
                const myInitial = myReturns?.initialContrib ?? 0;
                const myRecycled = myReturns?.recycledAlloc ?? 0;
                const myMoicTotal = myReturns?.moicOnTotal;
                const myIrrTotal = myReturns?.irrOnTotal;
                const hasRecycling = myRecycled > 0;
                const myCommitment = isFund ? getLpCommitment(v.name, myLp.name) : null;
                const myCalledPct = myCommitment ? (myInvestment / myCommitment) * 100 : null;
                const myUnfunded = myCommitment ? myCommitment - myInvestment : null;
                return (
                <div className="rounded-xl border-2 border-primary bg-gradient-to-br from-primary/15 via-primary/8 to-primary/5 shadow-md overflow-hidden">
                  {/* Prominent header — Ownership % rendered as a LARGE
                      stat on the right so the LP's defining number stands
                      out visually. The left side carries identity (LP name,
                      vehicle, hold-time). */}
                  <div className="bg-primary text-primary-foreground px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold shrink-0">
                          {(myLp.name || 'Me').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'ME'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80 leading-tight">Your Performance</p>
                          <p className="text-base font-bold leading-tight truncate">{myLp.name}</p>
                          <p className="text-[11px] opacity-80 leading-tight">
                            in <strong>{v.name}</strong>
                            {myReturns?.lpFirstYear != null && myReturns?.lpHoldYears != null && (
                              <> · joined {myReturns.lpFirstYear} ({myReturns.lpHoldYears} yr hold)</>
                            )}
                            {isFund && <> · XIRR (call-timing-weighted)</>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold tabular-nums leading-none">{myOwnPct.toFixed(2)}%</p>
                        <p className="text-[10px] opacity-80 uppercase tracking-wide mt-1">Your stake</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">

                  {/* Fund-specific "My Commitment" mini-strip */}
                  {myCommitment && (
                    <div className="mb-4 grid grid-cols-3 gap-3 p-3 bg-background rounded-md border border-primary/20">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">My Commitment</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{fmt(myCommitment)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Called</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">
                          {fmt(myInvestment)} <span className="text-[10px] font-normal text-muted-foreground">({myCalledPct?.toFixed(0)}%)</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Unfunded</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{fmt(myUnfunded)}</p>
                      </div>
                    </div>
                  )}

                  {/* KPI grid — labels diverge by legal structure:
                      - FUND (InVitro Fund): partnership-style language —
                        "Called to Date", "Ownership Value", IRR is XIRR.
                      - VEHICLE (Barsoum Brothers, Curenta Enterprise,
                        InVitro Ventures): shareholder-style language —
                        "Cost Basis", "Stake Fair Value" to disambiguate
                        cap-table cost from mark-to-market portfolio FMV.
                      Same data, different vocabulary — what a shareholder
                      vs an LP expects to see on their statement. */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiTile label={isFund ? 'My Ownership Value' : 'Stake Fair Value'} value={fmt(myValue)} compact />
                    {/* Cost Basis = actual cash the shareholder paid in.
                        For vehicles with recycling (Curenta Enterprise,
                        Barsoum Brothers), the post-recycling-start entries
                        in lp.investment are GP-redeployed profits, NOT new
                        cash — so cost basis is initialContrib, not the
                        cumulative total. The recycled portion is surfaced
                        in the "Capital Activity" breakdown below. */}
                    <KpiTile label={isFund ? 'Called to Date' : 'Cost Basis'} value={fmt(isFund ? myInvestment : myInitial)} compact />
                    <KpiTile label={isFund ? 'My IRR' : 'IRR'} value={myIrr != null ? `${myIrr.toFixed(1)}%` : '—'}
                      tone={myIrr == null ? 'neutral' : myIrr >= 0 ? 'positive' : 'negative'} compact />
                    <KpiTile label={isFund ? 'My MOIC' : 'MOIC'} value={myMoic != null ? `${myMoic.toFixed(1)}x` : '—'}
                      tone={myMoic == null ? 'neutral' : myMoic >= 1 ? 'positive' : 'negative'} compact />
                  </div>

                  {/* Last Priced Round mini-card (vehicle-style only).
                      Shows the cap-table-implied valuation of the
                      shareholder's stake based on the most recent priced
                      round's share price. This is the "internal narrative"
                      that complements (and often disagrees with) the
                      portfolio-FMV view above — both are legitimate, just
                      different methodologies. */}
                  {!isFund && (() => {
                    const cap = getCapTableConfig(v.name);
                    if (!cap) return null;
                    const cumShares = computeCumulativeShares(v.name, myLp.name, myLp.investment, years, yearIdx);
                    if (cumShares == null || cumShares <= 0) return null;
                    // Pick the most recent priced round AS OF the selected
                    // year — so 2025 sees R1, 2026/2027 see R2, etc. Falls
                    // back gracefully (returns null) if no priced round
                    // has happened by the selected year.
                    const lr = getPricedRoundAsOf(v.name, years[yearIdx]);
                    if (!lr) return null;
                    const lastRoundStakeValue = cumShares * lr.sharePrice;
                    const lastRoundMarkup = myInvestment > 0 ? lastRoundStakeValue / myInvestment : null;
                    const blendedCostPerShare = myInvestment > 0 ? myInvestment / cumShares : null;
                    return (
                      <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200 rounded-md">
                        <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                            Last Priced Round (Cap-Table View)
                          </p>
                          <p className="text-[10px] text-amber-800">
                            {lr.name} · {lr.year} · ${lr.sharePrice.toFixed(2)}/share
                          </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Your shares</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">{Math.round(cumShares).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Blended cost / share</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">{blendedCostPerShare != null ? `$${blendedCostPerShare.toFixed(3)}` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Stake @ last round</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">{fmt(lastRoundStakeValue)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">vs cost basis</p>
                            <p className={cn(
                              "text-sm font-bold tabular-nums",
                              lastRoundMarkup != null && lastRoundMarkup >= 1 && "text-emerald-700",
                              lastRoundMarkup != null && lastRoundMarkup < 1 && "text-red-600",
                              lastRoundMarkup == null && "text-foreground",
                            )}>{lastRoundMarkup != null ? `${lastRoundMarkup.toFixed(2)}×` : '—'}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-700 italic mt-2">
                          Reflects insider pricing at the most recent priced round, not an independent valuation. Compare with <strong>Stake Fair Value</strong> above (portfolio-driven) for the fundamental view.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Year-by-Year Contributions — vehicle-style only.
                      Shareholders need to see when they paid in, how their
                      cumulative cost basis built up, and how their stake
                      FMV evolved alongside it. Fund LPs get the same story
                      through the "Called to Date" + commitment mini-strip
                      above, so this table would be redundant for them. */}
                  {!isFund && myLp.investment?.some(x => x != null && x !== 0) && (
                    <div className="mt-4 pt-4 border-t border-primary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                        Year-by-Year Contributions
                      </p>
                      <div className="overflow-x-auto">
                      {(() => {
                        // Cap-table data only available when the vehicle is
                        // configured in VEHICLE_CAP_TABLE. Without it, share
                        // columns are hidden (cash-only table).
                        const capCfg = getCapTableConfig(v.name);
                        const showShares = capCfg != null;
                        // Recycling-aware: when the vehicle recycles, post-
                        // recyclingStartYear entries in lp.investment are
                        // GP-redeployed profits, NOT new cash. We split
                        // them into a separate "Recycled (GP)" column so
                        // the cost basis number isn't double-counted.
                        const recyclingStartYear = VEHICLE_RECYCLING_START_YEAR[v.name];
                        const hasRecyclingCol = recyclingStartYear != null;

                        // Build the row list. Each year may produce one or
                        // two rows: a cash/recycled row (if amount > 0) and
                        // one row per non-cash event (e.g. redistribution).
                        // Year-end metrics (ownership %, Stake FMV, MOIC)
                        // attach to the LAST row of the year — they're
                        // year-end snapshots, so they'd misrepresent mid-
                        // year events if duplicated across rows.
                        const rows = [];
                        let runningShares = 0;
                        let runningInitial = 0;  // cumulative initial cash (= cost basis)
                        let runningRecycled = 0; // cumulative GP-recycled allocations
                        for (let idx = 0; idx < years.length; idx++) {
                          const year = years[idx];
                          const investmentVal = myLp.investment?.[idx] ?? 0;
                          const isRecycled = hasRecyclingCol && year >= recyclingStartYear;
                          const initialThisYear = isRecycled ? 0 : investmentVal;
                          const recycledThisYear = isRecycled ? investmentVal : 0;
                          runningInitial += initialThisYear;
                          runningRecycled += recycledThisYear;
                          const ownPctYr = myLp.ownership?.[idx] ?? 0;
                          const vehVal = v.ownershipValue?.[idx];
                          const stakeFmv = vehVal != null && ownPctYr > 0 ? vehVal * (ownPctYr / 100) : null;
                          // MOIC = stake FMV ÷ initial cost basis (cash actually paid).
                          // Recycled allocations are NOT in the denominator — they're
                          // GP-redeployed profits, not new investor capital.
                          const moicYr = runningInitial > 0 && stakeFmv != null ? stakeFmv / runningInitial : null;
                          const yearNonCash = showShares
                            ? (capCfg.nonCashEvents?.[myLp.name] || []).filter(ev => ev.year === year)
                            : [];
                          const sharePrice = showShares ? capCfg.sharePriceByYear[year] : null;
                          // Share derivation: only initial cash buys shares at
                          // the cap-table share price. Recycled allocations don't
                          // create new shares (they reflect GP P&L motion, not
                          // shareholder capital). For vehicles without cap-table
                          // config (no Phase 2 data yet), this falls through to 0.
                          const cashShares = (initialThisYear > 0 && sharePrice > 0) ? initialThisYear / sharePrice : 0;

                          // Build per-year event list (chronological): cash/recycled
                          // first, then non-cash events.
                          const events = [];
                          if (investmentVal > 0) {
                            runningShares += cashShares;
                            events.push({
                              kind: isRecycled ? 'recycled' : 'cash',
                              year,
                              initial: initialThisYear,
                              recycled: recycledThisYear,
                              cumInitial: runningInitial,
                              cumRecycled: runningRecycled,
                              sharesDelta: cashShares,
                              cumShares: runningShares,
                            });
                          }
                          for (const ev of yearNonCash) {
                            runningShares += ev.shares;
                            events.push({
                              kind: 'nonCash',
                              year, label: ev.label, description: ev.description,
                              initial: 0, recycled: 0,
                              cumInitial: runningInitial,
                              cumRecycled: runningRecycled,
                              sharesDelta: ev.shares,
                              cumShares: runningShares,
                            });
                          }
                          // Idle year — no contribution, no event, but cumulative
                          // position exists.
                          if (events.length === 0 && (runningInitial > 0 || runningRecycled > 0)) {
                            events.push({
                              kind: 'idle',
                              year,
                              initial: 0, recycled: 0,
                              cumInitial: runningInitial,
                              cumRecycled: runningRecycled,
                              sharesDelta: null,
                              cumShares: runningShares || null,
                            });
                          }
                          if (events.length === 0) continue; // pre-investment year
                          // Attach year-end metrics to LAST event row
                          events[events.length - 1].ownPctYr = ownPctYr;
                          events[events.length - 1].stakeFmv = stakeFmv;
                          events[events.length - 1].moicYr = moicYr;
                          events[events.length - 1].isYearEnd = true;
                          events[events.length - 1].isSelectedYear = idx === yearIdx;
                          if (idx === yearIdx) events.forEach(e => e.isSelectedYear = true);
                          rows.push(...events);
                        }

                        return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Year / Event</TableHead>
                            <TableHead className="text-right text-xs">{hasRecyclingCol ? 'Initial Cash' : 'Cash Invested'}</TableHead>
                            {hasRecyclingCol && (
                              <TableHead className="text-right text-xs text-amber-800" title="GP-recycled profits redeployed on your behalf — not new cash from you">
                                Recycled (GP)
                              </TableHead>
                            )}
                            <TableHead className="text-right text-xs">Cumulative Cost</TableHead>
                            {showShares && <TableHead className="text-right text-xs">Shares Δ</TableHead>}
                            {showShares && <TableHead className="text-right text-xs">Cum. Shares</TableHead>}
                            <TableHead className="text-right text-xs">Ownership %</TableHead>
                            <TableHead className="text-right text-xs">Stake FMV</TableHead>
                            <TableHead className="text-right text-xs">MOIC</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r, ri) => {
                            const rowCls = cn(
                              r.isSelectedYear && 'bg-primary/10',
                              r.isSelectedYear && r.isYearEnd && 'font-medium',
                              r.kind === 'nonCash' && !r.isSelectedYear && 'bg-amber-50/50',
                              r.kind === 'recycled' && !r.isSelectedYear && 'bg-sky-50/50',
                            );
                            return (
                              <TableRow key={`${r.year}-${r.kind}-${ri}`} className={rowCls}>
                                <TableCell className="text-xs tabular-nums">
                                  {r.kind === 'nonCash' ? (
                                    <span className="text-amber-800" title={r.description}>
                                      <span className="text-muted-foreground">↳ {r.year}</span>{' '}
                                      <em className="not-italic font-medium">{r.label}</em>
                                    </span>
                                  ) : r.kind === 'recycled' ? (
                                    <span className="text-sky-800" title="GP recycled profits into a new investment on your behalf — no new cash from you">
                                      {r.year} <em className="not-italic text-[10px] font-medium">↻ Recycled</em>
                                    </span>
                                  ) : (
                                    <span>{r.year}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{r.initial > 0 ? fmt(r.initial) : '—'}</TableCell>
                                {hasRecyclingCol && (
                                  <TableCell className="text-right text-xs tabular-nums text-sky-800">{r.recycled > 0 ? fmt(r.recycled) : '—'}</TableCell>
                                )}
                                <TableCell className="text-right text-xs tabular-nums font-medium">{fmt(r.cumInitial)}</TableCell>
                                {showShares && (
                                  <TableCell className={cn(
                                    "text-right text-xs tabular-nums",
                                    r.kind === 'nonCash' && "text-amber-800 font-semibold",
                                  )}>
                                    {r.sharesDelta != null && r.sharesDelta > 0 ? `+${Math.round(r.sharesDelta).toLocaleString()}` : '—'}
                                  </TableCell>
                                )}
                                {showShares && (
                                  <TableCell className="text-right text-xs tabular-nums font-medium">
                                    {r.cumShares != null && r.cumShares > 0 ? Math.round(r.cumShares).toLocaleString() : '—'}
                                  </TableCell>
                                )}
                                <TableCell className="text-right text-xs tabular-nums">{r.isYearEnd && r.ownPctYr > 0 ? `${r.ownPctYr.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{r.isYearEnd && r.stakeFmv != null && r.stakeFmv > 0 ? fmt(r.stakeFmv) : '—'}</TableCell>
                                <TableCell className={cn(
                                  "text-right text-xs tabular-nums",
                                  r.isYearEnd && r.moicYr != null && r.moicYr >= 1 && "text-emerald-700",
                                  r.isYearEnd && r.moicYr != null && r.moicYr < 1 && "text-red-600",
                                )}>{r.isYearEnd && r.moicYr != null ? `${r.moicYr.toFixed(2)}x` : '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                        );
                      })()}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3 italic">
                        <strong className="text-foreground">Initial Cash</strong> = cash you actually contributed to the vehicle.
                        <strong className="text-sky-800"> Recycled (GP)</strong> = GP redeploying vehicle profits into new investments on your behalf — these are NOT new cash from you and are excluded from Cost Basis and MOIC math.
                        <strong className="text-foreground"> Cumulative Cost</strong> = your running cost basis (initial cash only).
                        <span className="text-amber-700"> Amber rows</span> are non-cash share events (redistribution, bonus, etc.) — hover for details.
                        <strong className="text-foreground"> Stake FMV</strong> = your ownership % × the vehicle&apos;s mark-to-market value at year-end.
                        <strong className="text-foreground"> MOIC</strong> = Stake FMV ÷ Cumulative Cost (≥ 1.00× means the stake is worth more than what you paid in).
                      </p>
                    </div>
                  )}

                  {/* Capital Call Schedule — fund LPs only.
                      The fund equivalent of the vehicle-style year-by-year
                      table. Uses ILPA-style fund vocabulary:
                        - "Capital Called" instead of "Cash Invested"
                        - "Stake NAV" instead of "Stake FMV"
                        - "TVPI" (Total Value to Paid-In) instead of MOIC
                      No shares, no priced rounds — partnership interest is
                      the unit, not equity shares.
                      Mgmt fees deducted at call time are reflected in the
                      net amount stored in the IRR sheet (not shown as a
                      separate column here — can be added later if needed). */}
                  {isFund && myLp.investment?.some(x => x != null && x !== 0) && (
                    <div className="mt-4 pt-4 border-t border-primary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                        Capital Call Schedule
                      </p>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Year</TableHead>
                            <TableHead className="text-right text-xs">Capital Called</TableHead>
                            <TableHead className="text-right text-xs">Cum Called</TableHead>
                            {myCommitment && <TableHead className="text-right text-xs">% of Commitment</TableHead>}
                            {myCommitment && <TableHead className="text-right text-xs">Unfunded</TableHead>}
                            <TableHead className="text-right text-xs">Stake NAV</TableHead>
                            <TableHead className="text-right text-xs">TVPI</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {years.map((year, idx) => {
                            const called = myLp.investment?.[idx] ?? 0;
                            const cumCalled = (myLp.investment ?? [])
                              .slice(0, idx + 1)
                              .reduce((a, v) => a + (v ?? 0), 0);
                            const pctCommitted = myCommitment ? (cumCalled / myCommitment) * 100 : null;
                            const unfunded = myCommitment ? Math.max(0, myCommitment - cumCalled) : null;
                            const ownPctYr = myLp.ownership?.[idx] ?? 0;
                            const vehVal = v.ownershipValue?.[idx];
                            const stakeNav = vehVal != null && ownPctYr > 0 ? vehVal * (ownPctYr / 100) : null;
                            const tvpi = cumCalled > 0 && stakeNav != null ? stakeNav / cumCalled : null;
                            // Skip pre-investment / post-exit empty years
                            if (called === 0 && cumCalled === 0 && (stakeNav == null || stakeNav === 0)) return null;
                            const isSelectedYear = idx === yearIdx;
                            return (
                              <TableRow key={year} className={isSelectedYear ? 'bg-primary/10 font-medium' : ''}>
                                <TableCell className="text-xs tabular-nums">{year}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{called !== 0 ? fmt(called) : '—'}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-medium">{fmt(cumCalled)}</TableCell>
                                {myCommitment && (
                                  <TableCell className="text-right text-xs tabular-nums">{pctCommitted != null ? `${pctCommitted.toFixed(1)}%` : '—'}</TableCell>
                                )}
                                {myCommitment && (
                                  <TableCell className="text-right text-xs tabular-nums">{unfunded != null ? fmt(unfunded) : '—'}</TableCell>
                                )}
                                <TableCell className="text-right text-xs tabular-nums">{stakeNav != null && stakeNav > 0 ? fmt(stakeNav) : '—'}</TableCell>
                                <TableCell className={cn(
                                  "text-right text-xs tabular-nums",
                                  tvpi != null && tvpi >= 1 && "text-emerald-700",
                                  tvpi != null && tvpi < 1 && "text-red-600",
                                )}>{tvpi != null ? `${tvpi.toFixed(2)}x` : '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3 italic">
                        <strong className="text-foreground">Capital Called</strong> = capital drawn from your commitment in that year.
                        <strong className="text-foreground"> Cum Called</strong> = total paid-in to date.
                        <strong className="text-foreground"> Unfunded</strong> = remaining commitment you haven&apos;t paid in yet.
                        <strong className="text-foreground"> Stake NAV</strong> = your ownership × the fund&apos;s net asset value at year-end.
                        <strong className="text-foreground"> TVPI</strong> = Stake NAV ÷ Cum Called (Total Value to Paid-In; ≥ 1.00× means you&apos;re in the green).
                        Capital amounts are net of any management fees deducted at call.
                      </p>
                    </div>
                  )}

                  {/* Capital Activity breakdown — only shown when recycling has happened */}
                  {hasRecycling && (
                    <div className="mt-4 pt-4 border-t border-primary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                        Capital Activity
                      </p>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-muted-foreground">Initial contribution (cash you put in)</span>
                          <span className="font-semibold tabular-nums text-foreground">{fmt(myInitial)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-muted-foreground">+ Recycled by GP (profits redeployed on your behalf)</span>
                          <span className="font-semibold tabular-nums text-foreground">{fmt(myRecycled)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-primary/10">
                          <span className="text-foreground font-medium">= Total deployed on your behalf</span>
                          <span className="font-semibold tabular-nums text-foreground">{fmt(myInvestment)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-foreground font-medium">Current value</span>
                          <span className="font-bold tabular-nums text-foreground">{fmt(myValue)}</span>
                        </div>
                        {myMoicTotal != null && (
                          <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
                            <span>MOIC on total deployed (alt. framing)</span>
                            <span className="tabular-nums">
                              {myMoicTotal.toFixed(2)}x &nbsp;·&nbsp; IRR {myIrrTotal?.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3 italic">
                        Your <strong className="text-foreground">My MOIC</strong> above is computed on your initial
                        cash ({fmt(myInitial)}) — the GP redeploying profits doesn&apos;t change how much you put in,
                        so this is the truest measure of what your money turned into.
                      </p>
                    </div>
                  )}
                  </div>{/* end inner p-4 wrapper */}
                </div>
                );
              })()}

              {/* LP roster table — admins see everyone; LP users see nothing
                  here because the "My Performance" card already shows their
                  numbers in a richer format (no point repeating them). */}
              {!lpName && v.lps.length > 0 && (() => {
                const rosterLps = v.lps;
                if (rosterLps.length === 0) return null;
                return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Shareholders ({v.lps.length})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>LP / Shareholder</TableHead>
                        <TableHead className="text-right">Ownership %</TableHead>
                        <TableHead className="text-right">Ownership Value</TableHead>
                        {/* Committed column only for fund-structured vehicles */}
                        {isFund && <TableHead className="text-right">Committed</TableHead>}
                        <TableHead className="text-right">{isFund ? 'Called' : 'Cum. Investment'}</TableHead>
                        <TableHead className="text-right">IRR</TableHead>
                        <TableHead className="text-right">MOIC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosterLps.map(lp => {
                        const r = computeLpReturns(lp, v, yearIdx, years);
                        const { ownPct, lpValue, cumInvest, initialContrib, recycledAlloc,
                          moic: lpMoic, irr: lpIrr, moicOnTotal, irrOnTotal, irrMethod,
                          lpHoldYears, lpFirstYear } = r;
                        const isMe = lpName && lp.name === lpName;
                        const hasRecycling = recycledAlloc > 0;
                        const lpCommitment = isFund ? getLpCommitment(v.name, lp.name) : null;
                        const lpCalledPct = lpCommitment ? (cumInvest / lpCommitment) * 100 : null;
                        // Cell tooltips: show the contribution breakdown,
                        // the LP's individual hold timeline (for CAGR rows),
                        // and (for XIRR cells) the methodology so anyone
                        // cross-checking against the sheet knows why
                        // numbers differ.
                        const investTitle = hasRecycling
                          ? `Initial contribution: ${fmt(initialContrib)}\nRecycled by GP: ${fmt(recycledAlloc)}\nTotal at work: ${fmt(cumInvest)}`
                          : isFund && lpCommitment
                            ? `Called: ${fmt(cumInvest)} of ${fmt(lpCommitment)} committed (${lpCalledPct?.toFixed(0)}%)`
                            : `Initial contribution: ${fmt(initialContrib)}`;
                        const moicTitle = hasRecycling
                          ? `MOIC on initial cash: ${lpMoic?.toFixed(2)}x\nMOIC on total deployed: ${moicOnTotal?.toFixed(2)}x`
                          : '';
                        const irrTitle = (() => {
                          const lines = [];
                          if (irrMethod === 'xirr') {
                            lines.push('Money-weighted IRR (XIRR) — accounts for capital call timing');
                          } else if (lpFirstYear != null && lpHoldYears != null) {
                            lines.push(`Annualized over ${lpHoldYears} yr (joined ${lpFirstYear})`);
                          }
                          if (hasRecycling) {
                            lines.push(`IRR on initial cash: ${lpIrr?.toFixed(1)}%`);
                            lines.push(`IRR on total deployed: ${irrOnTotal?.toFixed(1)}%`);
                          }
                          return lines.join('\n');
                        })();
                        return (
                          <TableRow
                            key={lp.name}
                            className={cn(
                              isMe && "bg-primary/5 border-l-2 border-l-primary"
                            )}
                          >
                            <TableCell className={cn("font-medium", isMe && "text-primary font-semibold")}>
                              {lp.name}{isMe && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/70">you</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{ownPct.toFixed(2)}%</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(lpValue)}</TableCell>
                            {isFund && (
                              <TableCell className="text-right tabular-nums">
                                {lpCommitment != null ? fmt(lpCommitment) : '—'}
                              </TableCell>
                            )}
                            <TableCell className="text-right tabular-nums" title={investTitle}>
                              {fmt(cumInvest)}
                              {hasRecycling && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {fmt(initialContrib)} + {fmt(recycledAlloc)} recycled
                                </div>
                              )}
                              {isFund && lpCalledPct != null && !hasRecycling && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {lpCalledPct.toFixed(0)}% of commitment
                                </div>
                              )}
                            </TableCell>
                            <TableCell
                              title={irrTitle}
                              className={cn(
                                "text-right tabular-nums",
                                lpIrr != null && (lpIrr >= 0 ? "text-emerald-600" : "text-red-500")
                              )}>
                              {lpIrr != null ? `${lpIrr.toFixed(1)}%` : '—'}
                            </TableCell>
                            <TableCell
                              title={moicTitle}
                              className={cn(
                                "text-right tabular-nums",
                                lpMoic != null && (lpMoic >= 1 ? "text-emerald-600" : "text-red-500")
                              )}>
                              {lpMoic != null ? `${lpMoic.toFixed(2)}x` : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })}

      {visibleVehicles.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No investment vehicles match your access. Contact your admin if this looks wrong.
          </p>
        </div>
      )}
    </div>
  );
}

/** Compact KPI tile used inside a card header strip. */
function KpiTile({ label, value, tone = 'neutral', compact = false, delta = null }) {
  const toneCls = {
    positive: 'text-emerald-600',
    negative: 'text-red-500',
    neutral: 'text-foreground',
  }[tone];
  return (
    <div className={cn(
      "rounded-md border bg-card p-3",
      compact && "p-2.5"
    )}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-bold tabular-nums mt-0.5", compact ? "text-base" : "text-lg", toneCls)}>{value}</p>
      {delta}
    </div>
  );
}

/**
 * Small "▲/▼ X.X% vs YYYY" badge rendered under a KPI tile value when
 * compare mode is on. Pure formatting — no business logic; pass in the
 * already-computed numeric delta and the comparison label.
 */
function DeltaBadge({ current, prior, compareYear, format = 'percent', invertColor = false }) {
  if (current == null || prior == null || prior === 0) return null;
  const pctChange = ((current - prior) / Math.abs(prior)) * 100;
  const up = pctChange >= 0;
  const isGood = invertColor ? !up : up;
  return (
    <p className={cn(
      "text-[10px] font-medium mt-1",
      isGood ? 'text-emerald-600' : 'text-red-500'
    )}>
      {up ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}% vs {compareYear}
    </p>
  );
}
