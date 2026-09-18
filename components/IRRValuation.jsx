"use client";
import { useState, Fragment } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { fmt, pct, currentPeriodIndex } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// By-Company view uses a deliberately small color palette — three
// structural identities that map to the three section types:
//
//   1. Violet  → the Consolidated rollup card at the top
//   2. Slate   → every Portfolio Company section header (single
//                color across all portcos, instead of per-company
//                brand colors — reduces visual noise on a page that
//                already shows many sections)
//   3. Primary → the LP-facing "My Performance" card inside each
//                portco section
//
// Semantic colors (emerald/red for MOIC, IRR) are kept as accents
// within numbers because they convey information, not branding.
const PORTCO_SECTION_COLOR = '#475569'; // tailwind slate-600
const portcoColor = () => PORTCO_SECTION_COLOR;

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
 * Convertible-loan vehicles: contributions BEFORE the conversion year
 * were structured as convertible loan agreements (debt). They converted
 * to equity at `conversionYear`. Cost-basis math is unchanged — the
 * loan principal becomes the equity cost basis at conversion — but the
 * Year-by-Year row for pre-conversion contributions renders with a
 * distinct "Convertible Loan" label and color so the LP understands
 * the historical context (they weren't shareholders during those years;
 * they were creditors).
 */
const VEHICLE_CONVERSION_YEAR = {
  'Curenta Enterprise': 2024,
  // Add other vehicles here when their initial capital was structured
  // as a convertible loan that later converted to equity.
};

/**
 * Real transfer dates, where the period column alone would be misleading.
 *
 * The IRR sheet records investment by period, so without help a flow can
 * only be dated to that period's end. For most entries that is close
 * enough — the grid is quarterly, so the error is at most ~45 days. It is
 * NOT close enough for a large early lump sum, where a six-month error
 * compounds across the whole hold.
 *
 * Per Andrew, these are the months the transfer actually hit the bank:
 *   - Curenta Enterprise's first $1,428,456 landed in June 2021, not at
 *     the FY2021 year end.
 *   - Barsoum Brothers' first two tranches were December 2021 and
 *     December 2022 — which ARE those periods' ends, so they need no
 *     override and are listed here only so the next reader knows they
 *     were checked rather than assumed.
 *
 * Keyed by vehicle, then by the period's year. Month is 1-based.
 */
/**
 * Hide every IRR figure on the page, leaving MOIC and TVPI.
 *
 * Set false at Andrew's request: an annualised rate on an unrealised
 * mark over a short, back-loaded hold produces three-digit numbers that
 * are arithmetically correct but hard to present — while MOIC and TVPI
 * say the same thing without annualising. Everything that computes IRR
 * is left intact and still runs; only the display is gated, so flipping
 * this back to true restores every figure with no other change.
 */
const SHOW_IRR = false;

const VEHICLE_FIRST_FLOW_DATE = {
  'Curenta Enterprise': { 2021: { month: 6, day: 1 } },
};

/** Resolve the date to use for a vehicle's flow in a given period. */
function flowDateFor(vehicleName, period, year) {
  const override = VEHICLE_FIRST_FLOW_DATE[vehicleName]?.[year];
  if (override) return Date.UTC(year, override.month - 1, override.day ?? 1);
  if (period?.endDate) {
    const t = Date.parse(period.endDate);
    if (Number.isFinite(t)) return t;
  }
  return year != null ? Date.UTC(year, 11, 31) : null;
}

/**
 * Money-weighted XIRR from a series of dated outflows plus a terminal
 * value. Shared by every IRR on this page so vehicles, shareholders and
 * LPs cannot drift onto different conventions again.
 *
 * @param {Array<{ms:number, amount:number}>} contributions money IN (positive)
 * @param {number} terminalValue NAV at the period end
 * @param {number} terminalMs    period end
 * @returns {number|null} percent, or null when unsolvable
 */
function xirrFromDatedFlows(contributions, terminalValue, terminalMs) {
  const paid = (contributions || []).filter(f => f.amount > 0 && Number.isFinite(f.ms));
  if (!paid.length || !(terminalValue > 0) || !Number.isFinite(terminalMs)) return null;
  const firstMs = Math.min(...paid.map(f => f.ms));
  const YR_MS = 365.25 * 86400e3;
  const flows = paid.map(f => ({
    amount: -f.amount,
    yearsFromStart: (f.ms - firstMs) / YR_MS,
  }));
  flows.push({ amount: terminalValue, yearsFromStart: (terminalMs - firstMs) / YR_MS });
  const rate = xirr(flows);
  return rate == null ? null : rate * 100;
}

/**
 * Fund STRUCTURE — which vehicles are funds (committed capital, called in
 * instalments) rather than direct-holding vehicles, and the shape of their
 * call schedule.
 *
 * Deliberately carries NO money. Commitment amounts used to live here as
 * `totalCommitment` and a `perLP` table, and they rotted: the map said
 * George Ayad had committed $125K while the Fund Timeline sheet said
 * $250K, so his own page understated his commitment by half. Every
 * amount now comes from the Timeline sheet, in line with the repo rule
 * that financial data is not hardcoded in source.
 *
 * What stays here is structure the sheet does not express:
 *   - commitmentPeriodYears: [firstYear, lastYear] — instalments are
 *     split evenly across these years
 *   - callScheduleMonth / callWindowEndMonth — the annual call window
 *
 * Vehicles absent from this map are direct-investment vehicles (Barsoum
 * Brothers, Curenta Enterprise, InVitro Ventures) and get no
 * Committed/Called/Funded display.
 *
 * Edit this only when a fund's STRUCTURE changes — a new fund launches,
 * or the call period or window moves. LPs joining, leaving or resizing
 * their commitment need no change here at all.
 */
const FUND_COMMITMENTS = {
  'InVitro Fund': {
    commitmentPeriodYears: [2024, 2027],
    // Calls go out in the Sep–Nov window of each year in the commitment
    // period, in equal annual installments (4 years → 25% each).
    //
    // Two distinct dates, and conflating them cries wolf:
    //   callScheduleMonth  — the call is ISSUED (Sep 1). From here the
    //                        installment counts as called, not unfunded.
    //   callWindowEndMonth — the last month the LP may pay in (Nov). Only
    //                        after this closes is unpaid money OVERDUE.
    // Anchoring overdue to Sep 1 flagged 7 LPs and $488K the moment
    // September began, when they simply had not reached their due date.
    callScheduleMonth: 9,
    callWindowEndMonth: 11,
  },
};

/**
 * Fund lifecycle phase per year — used to badge Capital Call Schedule
 * rows so the reader interprets J-curve numbers in context. The CFO's
 * mental model for InVitro Fund I:
 *   - 2024: fund launches, first LP capital calls
 *   - 2025: fund deploys those calls into portcos
 *   - 2026+: hold period — portcos mature, NAV mark-to-market meaningful
 * Rows in the "calling" and "deployment" phases carry the N/M convention
 * for TVPI/IRR — J-curve makes both sub-1 / negative by construction and
 * they're not honest performance signals yet.
 */
const FUND_LIFECYCLE = {
  'InVitro Fund': {
    2024: { label: 'Calling',       jCurve: true },
    2025: { label: 'Deployment',    jCurve: true },
    2026: { label: 'Hold · Y1',     jCurve: false },
    2027: { label: 'Hold · Y2',     jCurve: false },
    2028: { label: 'Hold · Y3',     jCurve: false },
    2029: { label: 'Hold · Y4',     jCurve: false },
    2030: { label: 'Hold · Y5',     jCurve: false },
    2031: { label: 'Harvest',       jCurve: false },
    2032: { label: 'Harvest',       jCurve: false },
    2033: { label: 'Wind-down',     jCurve: false },
    2034: { label: 'Term end',      jCurve: false },
  },
};

function isFundStructured(vehicleName) {
  return !!FUND_COMMITMENTS[vehicleName];
}
/**
 * An LP's commitment, from the Fund Timeline sheet — the only source.
 * Returns null when the sheet has no record, so the UI shows "—" rather
 * than a number nobody can trace back to the books.
 */
function getLpCommitment(vehicleName, lpName, fundTimeline) {
  return fundTimeline?.perLp?.[lpName]?.commitment ?? null;
}

/**
 * Fund-level committed capital — the sum of the Timeline sheet's per-LP
 * commitments. Derived rather than declared, so an LP joining, leaving
 * or resizing flows straight through with no code change.
 */
function fundCommittedTotal(vehicleName, fundTimeline) {
  const perLp = fundTimeline?.perLp;
  if (!perLp) return null;
  const entries = Object.values(perLp).filter(l => l?.commitment != null);
  return entries.length > 0
    ? entries.reduce((s, l) => s + l.commitment, 0)
    : null;
}

/**
 * Fund-level capital FUNDED through the end of the selected period —
 * cash actually received.
 *
 * Sums real Timeline payments dated ≤ the period end — the SAME source
 * the per-LP rows use, so the tile and the table below it reconcile. Do
 * not sum the IRR sheet's Investment series here: for fund LPs it is a
 * CUMULATIVE snapshot per period (Q1/Q2/Q3 of a year all repeat the
 * running total), so adding the periods together multiplies every call
 * by the number of periods it survives. That over-count is what produced
 * $3.32M called against $2.13M committed — a negative unfunded balance
 * and 156% called.
 *
 * Returns null when there is no Timeline data, so callers can fall back.
 */
function sumFundFundedThroughPeriod(fundTimeline, periodEndMs) {
  const perLp = fundTimeline?.perLp;
  if (!perLp || periodEndMs == null) return null;
  let total = 0;
  let sawFlows = false;
  for (const lp of Object.values(perLp)) {
    for (const f of lp?.flows ?? []) {
      sawFlows = true;
      if (Date.UTC(f.year, f.month - 1, f.day) <= periodEndMs) total += f.amount;
    }
  }
  return sawFlows ? total : null;
}

/**
 * Cumulative cash ONE LP has actually wired into a fund as of the period
 * end, from real Timeline payments. Returns null when there is no
 * Timeline record for that LP, so callers fall back to the sheet series.
 *
 * Every path needing a fund LP's basis must come through here. The IRR
 * sheet's per-LP Investment column is a CUMULATIVE snapshot — Q1/Q2/Q3
 * of a year all repeat the running total — so summing it across periods
 * multiplies each payment by the number of periods it survives. That one
 * mistake has now produced three separate wrong numbers on this page:
 * 0.5x MOIC, $3.32M "called" on the fund tile, and $762K "Your
 * Investment" on the Look-Through card for a man who has paid $200K.
 */
function lpFundedThroughPeriod(fundTimeline, lpName, periodEndMs) {
  const flows = fundTimeline?.perLp?.[lpName]?.flows;
  if (!flows?.length || periodEndMs == null) return null;
  // Contributions only. Today every Timeline row is money coming IN, but
  // a distribution would arrive as a negative amount and must not be
  // netted off paid-in capital, which would inflate every multiple.
  return flows.reduce(
    (s, f) => s + (f.amount > 0 && Date.UTC(f.year, f.month - 1, f.day) <= periodEndMs ? f.amount : 0),
    0,
  );
}


/**
 * The scheduled capital calls for one LP — equal annual installments
 * across the commitment period, each anchored to callScheduleMonth.
 *
 * This is the GP's demand schedule, deliberately independent of when
 * the LP actually wires the money. Timeline flows tell us what was
 * FUNDED; this tells us what was CALLED. The difference is a
 * receivable, and without modelling the schedule separately a
 * chronically late LP is indistinguishable from one who is current.
 */
function lpCallSchedule(vehicleName, commitment) {
  const info = FUND_COMMITMENTS[vehicleName];
  if (!info?.commitmentPeriodYears || commitment == null) return [];
  const [firstYear, lastYear] = info.commitmentPeriodYears;
  const installments = lastYear - firstYear + 1;
  if (!(installments > 0)) return [];
  const month = info.callScheduleMonth ?? 1;
  const windowEnd = info.callWindowEndMonth ?? month;
  const per = commitment / installments;
  return Array.from({ length: installments }, (_, i) => {
    const year = firstYear + i;
    return {
      year,
      // Issued on the 1st of the call month…
      dueMs: Date.UTC(year, month - 1, 1),
      // …and payable until the last day of the window month. Date.UTC
      // with day 0 rolls back to the final day of the preceding month,
      // so windowEnd 11 (November) gives Nov 30.
      windowEndMs: Date.UTC(year, windowEnd, 0),
      amount: per,
    };
  });
}

/** Cumulative amount CALLED from one LP as of the period end. */
function lpCalledThroughPeriod(vehicleName, commitment, periodEndMs) {
  if (commitment == null || periodEndMs == null) return null;
  const sched = lpCallSchedule(vehicleName, commitment);
  if (!sched.length) return null;
  return sched.reduce((s, c) => s + (c.dueMs <= periodEndMs ? c.amount : 0), 0);
}

/**
 * Cumulative amount that was actually DUE from one LP by the period end —
 * only installments whose payment window has already closed.
 *
 * Overdue must be measured against this, not against `called`. LPs are
 * called on Sep 1 but have until Nov 30 to wire; measuring against the
 * call date marks the entire LP base delinquent every September, which
 * at Q3 2026 wrongly reported $488K overdue across 7 LPs who were simply
 * inside their window.
 */
function lpDueThroughPeriod(vehicleName, commitment, periodEndMs) {
  if (commitment == null || periodEndMs == null) return null;
  const sched = lpCallSchedule(vehicleName, commitment);
  if (!sched.length) return null;
  return sched.reduce((s, c) => s + (c.windowEndMs <= periodEndMs ? c.amount : 0), 0);
}

/**
 * Fund-level called total, plus the GROSS overdue / prepaid split.
 *
 * Overdue is summed only over LPs who are behind, never netted against
 * LPs who are ahead. Netting would let one early payer conceal another's
 * delinquency — at Q2 2026 Laila Pence is $62.5K prepaid and George Ayad
 * is $25K overdue, and a net figure would report the fund as simply
 * "$37.5K ahead" while money is in fact owed.
 */
function fundCalledThroughPeriod(vehicleName, fundTimeline, periodEndMs) {
  const perLp = fundTimeline?.perLp;
  if (!perLp || periodEndMs == null) return null;
  let called = 0, overdue = 0, prepaid = 0, lpsOverdue = 0, inWindow = 0;
  let any = false;
  for (const [name, lp] of Object.entries(perLp)) {
    const commitment = lp?.commitment ?? getLpCommitment(vehicleName, name, fundTimeline);
    const lpCalled = lpCalledThroughPeriod(vehicleName, commitment, periodEndMs);
    if (lpCalled == null) continue;
    any = true;
    called += lpCalled;
    const funded = lpFundedThroughPeriod(fundTimeline, name, periodEndMs) ?? 0;
    // Late only once the payment window has shut; anything called but
    // still inside its window is collectible, not delinquent.
    const due = lpDueThroughPeriod(vehicleName, commitment, periodEndMs) ?? lpCalled;
    const late = Math.max(0, due - funded);
    if (late > 0) { overdue += late; lpsOverdue += 1; }
    prepaid += Math.max(0, funded - lpCalled);
    inWindow += Math.max(0, lpCalled - funded - late);
  }
  return any ? { called, overdue, prepaid, lpsOverdue, inWindow } : null;
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
 * Fund-level money-weighted IRR, computed from the Fund Timeline.
 *
 * The sheet's "IRR, % (annualized)" row is populated for the other four
 * vehicles but blank for InVitro Fund until Q4 2026, which left the
 * fund's IRR tile showing "—" in every current period. Rather than wait
 * on the sheet we derive it the same way each LP's own IRR is derived:
 * every LP capital call dated on or before the period end is an outflow,
 * the fund's NAV at that date is the terminal inflow, solved with the
 * same XIRR used elsewhere on this page.
 *
 * Returns a percentage, or null when there is nothing to solve (no
 * flows, no NAV, or no convergence) so the sheet value stays preferred
 * and the tile falls back to "—".
 */
function computeFundXirr(fundTimeline, navAtPeriodEnd, periodEndMs) {
  const perLp = fundTimeline?.perLp;
  if (!perLp || periodEndMs == null || !(navAtPeriodEnd > 0)) return null;
  const paid = [];
  for (const lp of Object.values(perLp)) {
    for (const f of lp?.flows ?? []) {
      const ms = Date.UTC(f.year, f.month - 1, f.day);
      if (ms <= periodEndMs && f.amount > 0) paid.push({ ms, amount: f.amount });
    }
  }
  return xirrFromDatedFlows(paid, navAtPeriodEnd, periodEndMs);
}

/**
 * Vehicle-level money-weighted IRR — the same measure the LP rows use,
 * one level up. Replaces the sheet's own IRR row for every vehicle.
 *
 * Flow source by vehicle type:
 *   - FUND: capital CALLED from LPs (Fund Timeline), not capital
 *     deployed into portcos. Those differ by the $54,500 of 2025 legal
 *     expenses Andrew paid out of called capital; charging the fund for
 *     money it consumed is what an LP actually experiences, and it keeps
 *     the tile consistent with the LP rows beneath it.
 *   - EVERY OTHER VEHICLE: the IRR sheet's Cumulative Investment row,
 *     differenced back into per-period contributions and dated via
 *     flowDateFor. That row now reconciles exactly to the sum of the
 *     per-company investment rows for Barsoum Brothers, Curenta
 *     Enterprise and InVitro Ventures.
 */
function computeVehicleXirr(vehicle, fundTimeline, periods, years, yearIdx, periodEndMs, navAtPeriodEnd) {
  if (periodEndMs == null || !(navAtPeriodEnd > 0)) return null;

  if (isFundStructured(vehicle.name)) {
    return computeFundXirr(fundTimeline, navAtPeriodEnd, periodEndMs);
  }

  const cum = vehicle.investment;
  if (!Array.isArray(cum)) return null;
  // Cumulative -> per-period. Guard against a dip (a restatement) by
  // never letting the running figure go backwards; a negative "flow"
  // would be read as a distribution and invert the sign of the IRR.
  const dated = [];
  let prev = 0;
  for (let i = 0; i <= yearIdx && i < cum.length; i++) {
    const v = cum[i];
    if (v == null) continue;
    const delta = v - prev;
    if (delta > 0.5) {
      dated.push({ amount: delta, ms: flowDateFor(vehicle.name, periods?.[i], years?.[i]) });
    }
    prev = Math.max(prev, v);
  }
  return xirrFromDatedFlows(dated, navAtPeriodEnd, periodEndMs);
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
function computeLpReturns(lp, vehicle, yearIdx, years, fundTimeline, periods) {
  // The IRR sheet is now quarterly (as of Sept 2026 sheet update) and is
  // the source of truth for period-precise ownership % — it has a
  // separate value for Q1/Q2/Q3/Q4 of each year. The Timeline sheet's
  // Ownership tab only has annual snapshots, so it can't tell us Q2 2026
  // vs Q3 2026. Prefer the IRR-sheet value; fall back to Timeline only
  // when the IRR-sheet has nothing for this period (older sheet
  // versions, edge rows).
  const timelineLp = fundTimeline?.perLp?.[lp.name];
  const timelineOwnByYear = timelineLp?.ownershipByYear;
  const selectedYearNum = years?.[yearIdx];
  const irrSheetOwnPct = lp.ownership?.[yearIdx];
  const ownPctFromTimeline = timelineOwnByYear && selectedYearNum != null
    ? (timelineOwnByYear[selectedYearNum] ?? null)
    : null;
  const ownPct = irrSheetOwnPct != null && irrSheetOwnPct !== 0
    ? irrSheetOwnPct
    : (ownPctFromTimeline != null ? ownPctFromTimeline * 100 : 0);
  const vehicleValue = vehicle.ownershipValue?.[yearIdx] ?? 0;
  const lpValue = vehicleValue * (ownPct / 100);

  // Terminal date for XIRR — end of the selected period (Q4=Dec 31,
  // Q1=Mar 31, etc.). Falls back to Dec 31 of the selected year if
  // the caller didn't pass periods (back-compat).
  const selectedPeriodEndMs = periods?.[yearIdx]?.endDate
    ? Date.parse(periods[yearIdx].endDate)
    : (selectedYearNum != null ? Date.UTC(selectedYearNum, 11, 31) : null);

  const isFund = isFundStructured(vehicle.name);

  // Basis (cumulative capital called) source:
  //   - Fund vehicles with Timeline data → sum of real Timeline flows
  //     dated ≤ this period's end. The IRR sheet's Investment column
  //     for fund LPs is now a CUMULATIVE snapshot per period (Q1/Q2/Q3
  //     of a year all show the same running total, jumps only when a
  //     new call lands), so sum-of-series over-counts. Timeline is
  //     per-payment and unambiguous.
  //   - All other vehicles → keep the historical per-period-series
  //     summation via splitContributions.
  const series = lp.investment ?? [];
  const recyclingStartYear = VEHICLE_RECYCLING_START_YEAR[vehicle.name];
  let split;
  if (isFund && timelineLp?.flows?.length > 0 && selectedPeriodEndMs != null) {
    const flowsUpTo = timelineLp.flows.filter(f =>
      Date.UTC(f.year, f.month - 1, f.day) <= selectedPeriodEndMs
    );
    // Same total the Look-Through card and the fund tiles use.
    const total = lpFundedThroughPeriod(fundTimeline, lp.name, selectedPeriodEndMs) ?? 0;
    // Map Timeline flows into the (yearIdx, amount) event shape the
    // rest of the function expects — yearIdx aligned to each flow's
    // year for CAGR / annual-fallback anchoring.
    const initialEvents = flowsUpTo.map(f => {
      const yr = f.year;
      const idx = years.findIndex(y => y === yr);
      return { yearIdx: idx >= 0 ? idx : 0, amount: f.amount };
    });
    split = { initial: total, recycled: 0, initialEvents, recycledEvents: [] };
  } else {
    split = splitContributions(series, yearIdx, years, recyclingStartYear);
  }
  const cumInvest = split.initial + split.recycled;

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
  // (no time dependence).
  //
  // IRR is money-weighted XIRR for EVERY vehicle type — funds, direct
  // equity vehicles and individual shareholders alike. Per Andrew:
  // "let's unify the IRR% calculation across all vehicles, all
  // shareholders and all LPs". Vehicle type changes only the PRECISION
  // of the dates available, never the formula:
  //   1. real payment dates  — fund LPs (Cash Flow Timeline, daily) and
  //      InVitro Ventures shareholders (Cashflow rows 54-58, monthly)
  //   2. period-end dates    — everyone else, from the IRR sheet's
  //      per-period investment series, with VEHICLE_FIRST_FLOW_DATE
  //      overriding where Andrew gave the real transfer month
  // CAGR survives only as a last resort when a series has too few flows
  // for XIRR to solve, so a cell shows a number rather than a dash.
  //
  // This deliberately no longer mirrors the sheet's own IRR row. That
  // row uses =RATE(hold,0,-inv,NAV), and Google Sheets' RATE truncates
  // the period count to a whole number — so every non-December quarter
  // was annualised over too few years and read far too high (InVitro
  // Ventures Q3 2026: 108.6% shown against 70.7% on a correct CAGR).
  const calcReturn = (basis, events) => {
    if (basis <= 0 || lpValue <= 0) return { moic: null, irr: null };
    const moic = lpValue / basis;

    {
      // Preferred path: real monthly dates from the Timeline sheet.
      // Filter to only flows on or before the terminal NAV date — Timeline
      // holds the LP's full committed schedule (past + future calls); for
      // a selected-year view, calls dated after Dec 31 of that year
      // haven't happened yet and would push the terminal NAV before a
      // remaining outflow. XIRR fails to converge on that impossible
      // sequence (Newton-Raphson can't find a rate that reconciles a
      // pay-out AFTER a supposed exit) and silently falls back to
      // annual buckets.
      const terminalMs = selectedPeriodEndMs;
      const timelineFlows = (timelineLp?.flows ?? []).filter(f =>
        terminalMs == null || Date.UTC(f.year, f.month - 1, f.day) <= terminalMs
      );
      if (timelineFlows.length > 0 && terminalMs != null) {
        const firstMs = Date.UTC(timelineFlows[0].year, timelineFlows[0].month - 1, timelineFlows[0].day);
        const YR_MS = 365.25 * 86400e3;
        const flows = timelineFlows.map(f => ({
          amount: -f.amount,
          yearsFromStart: (Date.UTC(f.year, f.month - 1, f.day) - firstMs) / YR_MS,
        }));
        flows.push({
          amount: lpValue,
          yearsFromStart: (terminalMs - firstMs) / YR_MS,
        });
        const rate = xirr(flows);
        if (rate != null) return { moic, irr: rate * 100, method: 'monthly-xirr' };
      }

      // Period-dated path — used by every vehicle without a per-payment
      // ledger, and by the fund if Timeline is ever unavailable. Each
      // contribution is dated to its period's end, except where
      // VEHICLE_FIRST_FLOW_DATE carries the real transfer month.
      if (events && events.length > 0 && terminalMs != null) {
        const dated = events.map(e => ({
          amount: e.amount,
          ms: flowDateFor(vehicle.name, periods?.[e.yearIdx], years?.[e.yearIdx]),
        }));
        const rate = xirrFromDatedFlows(dated, lpValue, terminalMs);
        if (rate != null) return { moic, irr: rate, method: 'period-xirr' };
      }
    }

    // CAGR only when XIRR has too little to solve with (a single flow in
    // the same period as the terminal value, for instance). Kept so a
    // cell shows a number rather than a dash, never as a parallel
    // convention.
    const irr = lpHoldYears && lpHoldYears > 0
      ? (Math.pow(moic, 1 / lpHoldYears) - 1) * 100
      : null;
    return { moic, irr, method: 'cagr-fallback' };
  };

  const onInitial = calcReturn(split.initial, split.initialEvents);
  const onTotal   = calcReturn(cumInvest, [...split.initialEvents, ...split.recycledEvents]);

  return {
    ownPct,
    lpValue,
    initialContrib: split.initial,
    recycledAlloc: split.recycled,
    cumInvest,
    // Headline `moic` and `irr` are on TOTAL CAPITAL DEPLOYED — initial
    // cash plus recycled profits — not on initial cash alone.
    //
    // The initial-cash framing divides today's value by only the money
    // the LP originally wrote a cheque for, which for a heavily recycled
    // position produces a figure nobody can defend in a room: Ramy
    // Barsoum contributed $98k and had $1.03m of profits redeployed on
    // his behalf, so initial-cash showed 147.02x and a 278.7% IRR. On
    // total deployed the same position is 12.8x — still excellent, and
    // actually explainable.
    //
    // It also makes the roster agree with the Consolidated Look-Through
    // card, which already apportions initAttribution + recAttribution
    // and so has always been on the total basis. The two were showing
    // different multiples for the same LP.
    //
    // Both framings stay available; the tooltip still carries
    // initial-cash for anyone who wants it.
    moic: onTotal.moic,
    irr: onTotal.irr,
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
    // Which flavor of XIRR actually ran (monthly-xirr | annual-xirr | cagr).
    // Kept for the "month-precise" badge on the Capital Call Schedule.
    xirrPath: onTotal.method ?? 'cagr',
    xirrHasMonthlyDates: onTotal.method === 'monthly-xirr',
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
export default function IRRValuation({ data, user, selectedYear: selectedYearProp, compareYear, viewMode, onNavigateToCompany }) {
  const irr = data?.irrValuation;

  // No IRR data available — could be missing tab access or sheet load failure
  if (!irr || !irr.vehicles?.length) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">IRR &amp; Valuation data is not available.</p>
      </div>
    );
  }

  // Period-order-aligned arrays — periods[] carries the full detail,
  // years[] is derived (year integer per period index) so all existing
  // arithmetic against `years[yearIdx]` still gives a year number.
  const periods = irr.periods || [];
  const years = periods.map(p => p.year);
  // Format a period label with an "(annual)" suffix on Dec-ending
  // periods (FY 2021, Q4 2025, etc.) so the reader knows those rows
  // double as the year-end snapshot.
  const formatPeriodLabel = (p) => p ? (p.isAnnualEnd ? `${p.label} (annual)` : p.label) : '';
  // The Dashboard header passes a period LABEL string ("Q4 2025", "FY 2024").
  // If it isn't provided (standalone / stale prop), land on the period we
  // are currently in — same rule as Dashboard's initial state, so the two
  // agree. Only when the grid has no usable end dates do we fall back to
  // the most recent period carrying fund NAV data.
  const fallbackPeriodIdx = (() => {
    const nowIdx = currentPeriodIndex(periods);
    if (nowIdx >= 0) return nowIdx;
    for (let i = periods.length - 1; i >= 0; i--) {
      const hasData = irr.vehicles.some(v => v.ownershipValue?.[i] != null && v.ownershipValue[i] > 0);
      if (hasData) return i;
    }
    return periods.length - 1;
  })();
  const findIdx = (label) => {
    if (!label) return -1;
    // Accept either bare label ("Q4 2025") or the annotated form
    // ("Q4 2025 (annual)") — normalize by stripping the suffix.
    const bare = String(label).replace(/\s*\(annual\)\s*$/i, '').trim();
    return periods.findIndex(p => p.label === bare);
  };
  const resolvedIdx = selectedYearProp != null
    ? (typeof selectedYearProp === 'number'
        // Back-compat: a numeric year prop lands on that year's annual snapshot.
        ? periods.findIndex(p => p.year === selectedYearProp && p.isAnnualEnd)
        : findIdx(selectedYearProp))
    : fallbackPeriodIdx;
  // `yearIdx` is the period index; kept as `yearIdx` so downstream code
  // that reads `years[yearIdx]`, `vehicle.ownershipValue[yearIdx]`, etc.
  // works unchanged.
  const yearIdx = resolvedIdx >= 0 ? resolvedIdx : fallbackPeriodIdx;
  const selectedYear = years[yearIdx];
  const selectedPeriod = periods[yearIdx];
  const compIdx = compareYear != null
    ? (typeof compareYear === 'number'
        ? periods.findIndex(p => p.year === compareYear && p.isAnnualEnd)
        : findIdx(compareYear))
    : -1;
  const compEnabled = compIdx >= 0 && compIdx !== yearIdx;

  // LP scoping
  const lpName = user?.permissions?.lpName || null;
  // Per-portco "Investors" table visibility — gated by the
  // shareholderSplit breakdown permission. By default (false/unset),
  // LPs DO NOT see the full cap-table of who else invested in each
  // portco. Admin can grant this to specific users (e.g. Amir Barsoum,
  // who acts more like an insider) via User Management → Other Access.
  const canSeeShareholderSplit = (() => {
    const perms = user?.permissions;
    if (!perms) return false;
    if (perms.breakdowns === '*') return true;
    return perms.breakdowns?.shareholderSplit === true;
  })();
  // Look-Through view mode — lifted to Dashboard so the sidebar drives
  // it via IRR & Valuation sub-nav. Defaults to by-company when
  // not provided. Values: 'by-company' (portco-centric, default) or
  // 'by-source' (vehicle-centric).
  const lookThroughView = viewMode || 'by-company';
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

    // PHASE-SPLIT attribution convention (follow the money):
    // ------------------------------------------------------
    // For vehicles with recycling (Barsoum Brothers, Curenta Enterprise),
    // LP cash gets split into two phases by year:
    //   - INITIAL: years before VEHICLE_RECYCLING_START_YEAR — real new
    //     LP cash flowing into the vehicle's initial investments
    //   - RECYCLED: years ≥ recycling start — vehicle's own profits being
    //     redeployed (still "the LP's money" economically, but going to
    //     a different set of portcos than the initial cash)
    //
    // Each phase is apportioned to portcos by the vehicle's deployment
    // fractions in that SAME phase. Concretely for Amir's Barsoum
    // Brothers stake at 2026:
    //   - Initial ($560K) × (BB's initial deployment to each portco /
    //     BB's total initial deployment to non-Studio portcos)
    //     → AllRx 100% × $560K = $560K, AC+C 0% × $560K = $0
    //   - Recycled ($2.22M) × (BB's recycled deployment to each portco /
    //     BB's total recycled deployment to non-Studio portcos)
    //     → AllRx 0% × $2.22M = $0, AC+C 100% × $2.22M = $2.22M
    //   - Sum across portcos = $560K (AllRx) + $2.22M (AC+C) = $2.78M
    //     which matches Amir's total cumulative BB cash.
    //
    // This is more accurate than uniform proportional apportionment and
    // matches the LP's mental model ("my $560K bought AllRx exposure;
    // my recycled profits later bought AC+C exposure").
    const isOperatingPortco = (coName) => coName !== 'InVitro Studio';
    const recyclingStartFor = (vehicleName) => VEHICLE_RECYCLING_START_YEAR[vehicleName] ?? null;
    const isRecycledYear = (vehicleName, yIdx) => {
      const start = recyclingStartFor(vehicleName);
      return start != null && years[yIdx] >= start;
    };

    // End of the selected period — the cut-off for "money in so far".
    const ltPeriodEndMs = periods?.[yearIdx]?.endDate
      ? Date.parse(periods[yearIdx].endDate)
      : (years?.[yearIdx] != null ? Date.UTC(years[yearIdx], 11, 31) : null);

    // Pre-compute per-vehicle state.
    const lpInitialByVehicle = new Map();    // vehicleName → LP initial cash
    const lpRecycledByVehicle = new Map();   // vehicleName → LP recycled cash
    const vehicleInitDeployment = new Map(); // vehicleName → {portcoName: $}
    const vehicleRecDeployment = new Map();  // vehicleName → {portcoName: $}
    const vehicleInitTotal = new Map();      // vehicleName → total initial deployment to non-Studio
    const vehicleRecTotal = new Map();       // vehicleName → total recycled deployment to non-Studio
    const vehicleEarliestYearIdx = new Map();
    // NAV reconciliation guard. Per-company stake = valuation × the
    // sheet's ownership %, which only reconciles to the sheet's own
    // "Shareholders ownership, $" NAV row if that % carries enough
    // precision. It briefly did not: the ownership rows were formatted to
    // one decimal (4.3% for a true 4.2861%), which overstated fund NAV by
    // $9,113 and made the Look-Through card report $466K against the
    // per-vehicle card's $464K for the same LP. Andrew has since widened
    // the sheet's ownership rows to three decimals, so the scale is now
    // ~1.0000 and this corrects only sub-dollar rounding — it stays as a
    // guard so a future row added at one decimal cannot silently
    // reintroduce a five-figure discrepancy between the two cards.
    const vehicleNavScale = new Map();
    for (const v of irr.vehicles || []) {
      let computedNav = 0;
      for (const co of irr.companies || []) {
        if (!isOperatingPortco(co.name)) continue;
        const val = co.financials?.valuation?.[yearIdx] ?? 0;
        const pct = co.ownership?.[v.name]?.[yearIdx] ?? 0;
        computedNav += (val * pct) / 100;
      }
      const sheetNav = v.ownershipValue?.[yearIdx] ?? 0;
      vehicleNavScale.set(
        v.name,
        computedNav > 0 && sheetNav > 0 ? sheetNav / computedNav : 1,
      );
    }
    for (const v of irr.vehicles || []) {
      const lpInVehicle = v.lps?.find(lp => lp.name === lpNameArg);
      if (!lpInVehicle) continue;
      let lpInit = 0, lpRec = 0, firstIdx = -1;
      // Fund LPs: basis is real Timeline cash, never the summed sheet
      // series (which is cumulative — see lpFundedThroughPeriod). Funds
      // carry no recycling, so all of it is initial capital.
      const ltTimeline = irr?.fundTimelines?.[v.name];
      const ltFunded = isFundStructured(v.name)
        ? lpFundedThroughPeriod(ltTimeline, lpNameArg, ltPeriodEndMs)
        : null;
      if (ltFunded != null) {
        lpInit = ltFunded;
        const paidIdxs = (ltTimeline.perLp[lpNameArg].flows || [])
          .filter(f => Date.UTC(f.year, f.month - 1, f.day) <= ltPeriodEndMs)
          .map(f => years.indexOf(f.year))
          .filter(i => i >= 0);
        if (paidIdxs.length) firstIdx = Math.min(...paidIdxs);
      } else {
        for (let i = 0; i <= yearIdx; i++) {
          const val = lpInVehicle.investment?.[i] ?? 0;
          if (val === 0) continue;
          if (firstIdx === -1) firstIdx = i;
          if (isRecycledYear(v.name, i)) lpRec += val; else lpInit += val;
        }
      }
      lpInitialByVehicle.set(v.name, lpInit);
      lpRecycledByVehicle.set(v.name, lpRec);
      if (firstIdx >= 0) vehicleEarliestYearIdx.set(v.name, firstIdx);

      const initByPortco = {}, recByPortco = {};
      let initTot = 0, recTot = 0;
      for (const co of irr.companies || []) {
        if (!isOperatingPortco(co.name)) continue;
        const series = co.investments?.[v.name] ?? [];
        let init = 0, rec = 0;
        for (let i = 0; i <= yearIdx; i++) {
          const val = series[i] ?? 0;
          if (val === 0) continue;
          if (isRecycledYear(v.name, i)) rec += val; else init += val;
        }
        initByPortco[co.name] = init;
        recByPortco[co.name] = rec;
        initTot += init;
        recTot += rec;
      }
      vehicleInitDeployment.set(v.name, initByPortco);
      vehicleRecDeployment.set(v.name, recByPortco);
      vehicleInitTotal.set(v.name, initTot);
      vehicleRecTotal.set(v.name, recTot);
    }

    const results = [];
    for (const co of irr.companies || []) {
      if (!isOperatingPortco(co.name)) continue;
      const valuation = co.financials?.valuation?.[yearIdx] ?? 0;
      // Direct stake (from "(Individual)" rows in the IRR sheet)
      const directRecord = co.directShareholders?.[lpNameArg];
      const directOwnPct = directRecord?.ownership?.[yearIdx] ?? 0;
      const directValue = valuation * (directOwnPct / 100);
      const directCash = (directRecord?.investment ?? [])
        .slice(0, yearIdx + 1).reduce((s, v) => s + (v ?? 0), 0);
      // CAGR anchor: earliest year of any contribution (direct or via vehicle)
      const directFirstIdx = (directRecord?.investment ?? [])
        .findIndex(v => v != null && v > 0);
      let earliestYearIdx = directFirstIdx >= 0 ? directFirstIdx : Infinity;

      const indirect = [];
      let totalIndirectPct = 0;
      let totalIndirectValue = 0;
      let totalIndirectInvestment = 0;
      for (const v of irr.vehicles || []) {
        const lpInVehicle = v.lps?.find(lp => lp.name === lpNameArg);
        if (!lpInVehicle) continue;
        const vehicleOwnsCoPct = co.ownership?.[v.name]?.[yearIdx] ?? 0;
        if (vehicleOwnsCoPct === 0) continue;
        // Prefer Timeline sheet's authoritative year-end ownership for the
        // fund vehicle so the Consolidated card's `totalAll` matches the
        // per-vehicle "My Performance" card. Without this override the two
        // cards use different NAVs (IRR-sheet ownership vs Timeline
        // ownership) and their XIRRs diverge even though flows are identical.
        const tlOwnByYear = irr?.fundTimelines?.[v.name]?.perLp?.[lpNameArg]?.ownershipByYear;
        const selectedYearNumLT = years?.[yearIdx];
        const tlPct = tlOwnByYear && selectedYearNumLT != null
          ? (tlOwnByYear[selectedYearNumLT] != null ? tlOwnByYear[selectedYearNumLT] * 100 : null)
          : null;
        const lpInVehiclePct = tlPct != null
          ? tlPct
          : (lpInVehicle.ownership?.[yearIdx] ?? 0);
        if (lpInVehiclePct === 0) continue;
        // Effective ownership: vehicle's % of portco × LP's % of vehicle
        const effectivePct = (vehicleOwnsCoPct * lpInVehiclePct) / 100;
        // Scaled so the portco stakes sum back to the vehicle's own NAV
        // row rather than to the rounded-ownership recomputation.
        const effectiveValue =
          valuation * (effectivePct / 100) * (vehicleNavScale.get(v.name) ?? 1);
        // PHASE-SPLIT attribution: LP's initial cash → allocated to where
        // the vehicle deployed during its initial phase; LP's recycled
        // cash → allocated to where the vehicle deployed during recycling.
        // For Amir BB→AllRx: $560K × (658/658) = $560K (all of his initial
        // went to AllRx, since BB's only initial deployment was there).
        const lpInit = lpInitialByVehicle.get(v.name) ?? 0;
        const lpRec = lpRecycledByVehicle.get(v.name) ?? 0;
        const initByPortco = vehicleInitDeployment.get(v.name) ?? {};
        const recByPortco = vehicleRecDeployment.get(v.name) ?? {};
        const initTot = vehicleInitTotal.get(v.name) ?? 0;
        const recTot = vehicleRecTotal.get(v.name) ?? 0;
        const initInCo = initByPortco[co.name] ?? 0;
        const recInCo = recByPortco[co.name] ?? 0;
        const initAttribution = initTot > 0 ? lpInit * (initInCo / initTot) : 0;
        const recAttribution = recTot > 0 ? lpRec * (recInCo / recTot) : 0;
        const lpAttributableInvestment = initAttribution + recAttribution;

        const vehFirstIdx = vehicleEarliestYearIdx.get(v.name);
        if (vehFirstIdx != null && vehFirstIdx < earliestYearIdx) {
          earliestYearIdx = vehFirstIdx;
        }

        indirect.push({
          vehicle: v.name, vehicleOwnsCoPct, lpInVehiclePct,
          effectivePct, effectiveValue,
          lpAttributableInvestment,
          initAttribution,           // LP initial cash attributed to this portco
          recAttribution,            // LP recycled cash attributed to this portco
          lpCashInVehicle: lpInit + lpRec,  // for ref / display
        });
        totalIndirectPct += effectivePct;
        totalIndirectValue += effectiveValue;
        totalIndirectInvestment += lpAttributableInvestment;
      }
      const totalPct = directOwnPct + totalIndirectPct;
      const totalValue = directValue + totalIndirectValue;
      const totalInvestment = directCash + totalIndirectInvestment;
      const moic = totalInvestment > 0 ? totalValue / totalInvestment : null;
      let lookThruIrr = null;
      if (moic != null && moic > 0 && earliestYearIdx !== Infinity) {
        const holdYears = years[yearIdx] - years[earliestYearIdx];
        if (holdYears > 0) {
          lookThruIrr = (Math.pow(moic, 1 / holdYears) - 1) * 100;
        }
      }

      if (totalValue > 0 || totalPct > 0 || directCash > 0) {
        // Cash vs recycled split for THIS portco:
        //   cash = direct contributions + Σ initAttribution from each vehicle
        //   recycled = Σ recAttribution from each vehicle (GP redeployed)
        // These reconcile to totalInvestment per row (cash + recycled).
        const totalCashInvestment = directCash + indirect.reduce((s, ind) => s + (ind.initAttribution ?? 0), 0);
        const totalRecycledInvestment = indirect.reduce((s, ind) => s + (ind.recAttribution ?? 0), 0);
        results.push({
          portcoName: co.name, valuation,
          directOwnPct, directValue, directCash,
          indirect, totalIndirectPct, totalIndirectValue, totalIndirectInvestment,
          totalPct, totalValue, totalInvestment,
          totalCashInvestment, totalRecycledInvestment,
          moic, irr: lookThruIrr,
          earliestYearIdx,
        });
      }
    }
    // Attach cash/recycled split totals + per-vehicle Maps for the
    // Consolidated card. Direct investments are always cash (LP wrote
    // a check); the cash and recycled splits from vehicles come from
    // the phase-buckets computed above.
    let totalLpCash = 0, totalLpRecycled = 0;
    for (const lp of results) totalLpCash += lp.directCash;     // direct is all cash
    for (const v of lpInitialByVehicle.values()) totalLpCash += v;
    for (const v of lpRecycledByVehicle.values()) totalLpRecycled += v;
    results._cashTotals = { totalLpCash, totalLpRecycled };
    // Per-vehicle splits — used by the Consolidated body's Investment
    // column to render a "$X cash · $Y recycled" sub-line under each
    // vehicle row.
    results._cashByVehicle = lpInitialByVehicle;
    results._recycledByVehicle = lpRecycledByVehicle;
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
      {/* Title / LP scope label. View-mode toggle lives in the sidebar
          (under IRR & Valuation) for LP users — no in-page dropdown
          needed. Admin/non-LP users see the original layout. */}
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

      {/* Look-Through Exposure — universal LP view that aggregates an
          LP's economic interest in each portco across every path
          (direct + every vehicle they're in). Direct-shareholder rows
          render conditionally (only if the LP has a direct stake), so
          for LPs with vehicle-only exposure (Ayman, the Karras family,
          etc.) the card still surfaces their Consolidated and per-portco
          rollup — just without the Direct line.
          Skips entirely if the LP has zero exposure (no vehicles, no
          direct stake) — defensive against an admin-mistagged lpName. */}
      {lpName && (() => {
        const lookThrough = computeLookThrough(lpName);
        if (lookThrough.length === 0) return null;
        // Wrapper flattened — the Consolidated card and per-portco
        // sections now sit as top-level siblings in the page flow,
        // mirroring the by-source view's per-vehicle sections. The
        // outer violet "Your Look-Through Exposure" frame was added
        // visual weight without information; removing it gives each
        // card its own breathing room and consistent treatment.
        return (
          <>
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
                // Sum of full portco valuations across all companies the LP has exposure to
                // — the "total pie" the LP is a slice of.
                let totalPortcoValuation = 0;
                let earliestYearIdxAll = Infinity;
                for (const lt of lookThrough) {
                  totalDirect += lt.directValue;
                  totalDirectCash += lt.directCash;
                  totalInvestmentAll += lt.totalInvestment;
                  totalPortcoValuation += (lt.valuation ?? 0);
                  for (const ind of lt.indirect) {
                    byVehicle.set(ind.vehicle, (byVehicle.get(ind.vehicle) ?? 0) + ind.effectiveValue);
                    byVehicleInvestment.set(ind.vehicle, (byVehicleInvestment.get(ind.vehicle) ?? 0) + ind.lpAttributableInvestment);
                  }
                  totalAll += lt.totalValue;
                  if (lt.earliestYearIdx < earliestYearIdxAll) earliestYearIdxAll = lt.earliestYearIdx;
                }
                if (totalAll <= 0) return null;
                // Consolidated MOIC — CASH-BASIS per CFO direction. We use
                // the LP's total cash-out contributions (cheque you wrote)
                // as the denominator, EXCLUDING GP-recycled redeployments.
                // Rationale: recycled capital is value the LP already earned
                // and the GP put back to work — treating it as a fresh "cost
                // basis" understates the multiple. Investor-friendly
                // convention: MOIC = value / cash invested. The "Your
                // Investment" tile still shows the FULL totalInvestmentAll
                // (cash + recycled) with the composition broken out below
                // it — only the multiplier math uses the cash slice.
                const cashBasis = lookThrough._cashTotals?.totalLpCash ?? 0;
                const consMoic = cashBasis > 0 ? totalAll / cashBasis : null;
                // Consolidated IRR — real XIRR on the LP's actual cash
                // outflows to the fund + terminal NAV = totalAll at Dec 31
                // of the selected year. This is the same money-weighted
                // rate the per-vehicle "My Performance" XIRR reports,
                // scaled up to the LP's whole portfolio. Falls back to
                // CAGR only if no Timeline data OR XIRR fails to converge
                // — CAGR treats all $ as invested on day one, understating
                // the true return.
                let consIrr = null;
                let consIrrMethod = 'cagr';
                const fundTL = irr?.fundTimelines?.['InVitro Fund'];
                // Filter to on/before terminal date — same fix as computeLpReturns.
                // Terminal = end of selected PERIOD (quarter or annual snapshot).
                const terminalMs = periods?.[yearIdx]?.endDate
                  ? Date.parse(periods[yearIdx].endDate)
                  : (years?.[yearIdx] != null ? Date.UTC(years[yearIdx], 11, 31) : null);
                const lpFlows = (fundTL?.perLp?.[lpName]?.flows ?? []).filter(f =>
                  terminalMs == null || Date.UTC(f.year, f.month - 1, f.day) <= terminalMs
                );
                if (lpFlows.length > 0 && totalAll > 0 && terminalMs != null) {
                  const firstMs = Date.UTC(lpFlows[0].year, lpFlows[0].month - 1, lpFlows[0].day);
                  const YR_MS = 365.25 * 86400e3;
                  const flows = lpFlows.map(f => ({
                    amount: -f.amount,
                    yearsFromStart: (Date.UTC(f.year, f.month - 1, f.day) - firstMs) / YR_MS,
                  }));
                  flows.push({
                    amount: totalAll,
                    yearsFromStart: (terminalMs - firstMs) / YR_MS,
                  });
                  const rate = xirr(flows);
                  if (rate != null) {
                    consIrr = rate * 100;
                    consIrrMethod = 'xirr';
                  }
                }
                // Fallback: CAGR (previous behavior) when we can't XIRR.
                if (consIrr == null && consMoic != null && consMoic > 0 && earliestYearIdxAll !== Infinity) {
                  const holdYears = years[yearIdx] - years[earliestYearIdxAll];
                  if (holdYears > 0) consIrr = (Math.pow(consMoic, 1 / holdYears) - 1) * 100;
                }
                return (
                  <div className="rounded-lg border-2 border-violet-400 bg-violet-100/40 overflow-hidden">
                    <div className="px-4 py-2 border-b border-violet-300/60 bg-violet-200/30">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-xs font-bold uppercase tracking-wide text-violet-900">Consolidated</span>
                          <span className="text-[10px] text-violet-700">
                            total across all portcos · {lookThrough.length} {lookThrough.length === 1 ? 'company' : 'companies'}
                            {totalPortcoValuation > 0 && (
                              <> · <span className="font-semibold">{fmt(totalPortcoValuation)}</span> total valuation</>
                            )}
                          </span>
                        </div>
                      </div>
                      {/* Consolidated metrics strip — same shape as the
                          per-portco strip so the eye scans top-to-bottom
                          across rows. Value + Investment reconcile to
                          the column totals below. */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">Your Investment</p>
                          <p className="text-base font-bold tabular-nums text-violet-900">{totalInvestmentAll > 0 ? fmt(totalInvestmentAll) : '—'}</p>
                          {/* Cash vs recycled split — direct contributions + initial-
                              phase vehicle contributions are "cash you put in"; the
                              recycled-phase contributions are GP-redeployed profits
                              (still attributable to the LP economically but not new
                              cash). Showing both makes the cost basis composition
                              transparent. */}
                          {lookThrough._cashTotals && (lookThrough._cashTotals.totalLpCash > 0 || lookThrough._cashTotals.totalLpRecycled > 0) && (
                            <p className="text-[9px] text-violet-700/80 mt-0.5 leading-snug">
                              <span className="font-semibold">{fmt(lookThrough._cashTotals.totalLpCash)}</span> cash
                              {lookThrough._cashTotals.totalLpRecycled > 0 && (
                                <>
                                  <span className="mx-0.5">·</span>
                                  <span className="font-semibold">{fmt(lookThrough._cashTotals.totalLpRecycled)}</span> recycled
                                </>
                              )}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">Your Total Stake Value</p>
                          <p className="text-base font-bold tabular-nums text-violet-900">{fmt(totalAll)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">MOIC</p>
                          <p className={cn(
                            "text-base font-bold tabular-nums",
                            consMoic == null ? "text-violet-900" :
                            consMoic >= 1 ? "text-emerald-700" : "text-red-600"
                          )}>{consMoic != null ? `${consMoic.toFixed(2)}×` : '—'}</p>
                          <p className="text-[9px] text-violet-700/80 mt-0.5">unrealised</p>
                        </div>
                        {SHOW_IRR && (
                        <div>
                          <p className="text-[10px] text-violet-700 uppercase tracking-wide">IRR</p>
                          <p className={cn(
                            "text-base font-bold tabular-nums",
                            consIrr == null ? "text-violet-900" :
                            consIrr >= 0 ? "text-emerald-700" : "text-red-600"
                          )}>{consIrr != null ? `${consIrr.toFixed(1)}%` : '—'}</p>
                          {/* Nothing has been distributed, and neither fees nor
                              carry are modelled — say so where the number is. */}
                          <p className="text-[9px] text-violet-700/80 mt-0.5">gross · unrealised</p>
                        </div>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-2">
                      {/* Per-source breakdown with explicit Cost Basis + Stake Value
                          columns. Column totals reconcile vertically to the top
                          strip's Investment and Total Value respectively. */}
                      {/* Per-source breakdown: Source | Stake Value | % of value.
                          Cost Basis column removed per CFO direction —
                          per-source Investment allocation is noisy and adds
                          little signal vs the aggregate Investment shown in
                          the top-strip. Aggregate Cost Basis is still
                          available there ($ totalInvestmentAll). */}
                      {/* Body breakdown: per-vehicle (and direct, if any)
                          split with Investment + Stake Value + % share.
                          Investment column shows the LP's attributable
                          cost basis routed through each vehicle — by
                          phase-split construction these sum vertically
                          to the top-strip Investment number.
                          Only rendered in 'by-source' view. */}
                      {lookThroughView === 'by-source' && (
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 text-xs items-baseline">
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold pb-1">Source</span>
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold text-right pb-1">Investment</span>
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold text-right pb-1">Stake Value</span>
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold text-right pb-1">% of value</span>
                        {/* Direct row — direct cash is the cost basis;
                            stake value is current FMV of cap-table stake. */}
                        {(totalDirect > 0 || totalDirectCash > 0) && (
                          <>
                            <span className="font-semibold text-violet-900">Direct holdings <span className="text-[10px] text-muted-foreground font-normal">(your cap-table stake)</span></span>
                            <span className="text-right tabular-nums font-medium text-violet-900">{fmt(totalDirectCash)}</span>
                            <span className="text-right tabular-nums font-medium text-violet-900">{fmt(totalDirect)}</span>
                            <span className="text-right tabular-nums text-[10px] text-muted-foreground">{totalAll > 0 ? ((totalDirect / totalAll) * 100).toFixed(1) : '0.0'}%</span>
                          </>
                        )}
                        {/* Per-vehicle rows — sorted by Stake Value desc.
                            Investment cell stacks the total $ with a small
                            "cash · recycled" sub-line so the LP sees both
                            the path total AND the capital composition for
                            each vehicle in one row. */}
                        {[...byVehicle.entries()]
                          .sort((a, b) => b[1] - a[1])
                          .map(([vehicle, val]) => {
                            const inv = byVehicleInvestment.get(vehicle) ?? 0;
                            const cash = lookThrough._cashByVehicle?.get(vehicle) ?? 0;
                            const recycled = lookThrough._recycledByVehicle?.get(vehicle) ?? 0;
                            const hasRecycled = recycled > 0;
                            return (
                              <Fragment key={vehicle}>
                                <span className="text-foreground">via <span className="font-medium text-violet-800">{vehicle}</span></span>
                                <span className="text-right tabular-nums">
                                  <span className="block">{inv > 0 ? fmt(inv) : '—'}</span>
                                  {(inv > 0) && (
                                    <span className="block text-[9px] text-muted-foreground font-normal mt-0.5">
                                      <span className="text-violet-700">{fmt(cash)}</span> cash
                                      {hasRecycled && (
                                        <> · <span className="text-violet-700">{fmt(recycled)}</span> recyc.</>
                                      )}
                                    </span>
                                  )}
                                </span>
                                <span className="text-right tabular-nums font-medium">{fmt(val)}</span>
                                <span className="text-right tabular-nums text-[10px] text-muted-foreground">{totalAll > 0 ? ((val / totalAll) * 100).toFixed(1) : '0.0'}%</span>
                              </Fragment>
                            );
                          })}
                        {/* Grand total row — Investment column sums to the
                            top-strip Investment ($totalInvestmentAll). */}
                        <span className="text-sm font-bold text-violet-900 pt-2 mt-1 border-t-2 border-violet-300/60">Total</span>
                        <span className="text-right text-sm font-bold tabular-nums text-violet-900 pt-2 mt-1 border-t-2 border-violet-300/60">{fmt(totalInvestmentAll)}</span>
                        <span className="text-right text-base font-bold tabular-nums text-violet-900 pt-2 mt-1 border-t-2 border-violet-300/60">{fmt(totalAll)}</span>
                        <span className="text-right text-[10px] text-muted-foreground pt-2 mt-1 border-t-2 border-violet-300/60">100%</span>
                      </div>
                      )}

                      {/* Per-company breakdown — same dollars as the per-
                          vehicle table above, just decomposed by destination
                          (portco) instead of by path (vehicle). Both totals
                          reconcile to the top-strip Investment + Total Value.
                          Useful for the LP's "where did my money end up?"
                          question vs "how did it get there?" (vehicle table).
                          Only rendered in 'by-company' view. */}
                      {lookThroughView === 'by-company' && (
                      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs items-baseline">
                        {/* CFO direction: LP by-company view shows only the
                            Stake Value per portco (and % of total value).
                            Investment / cost-basis split per company is
                            hidden — LPs aren't expected to track the
                            per-portco cost basis routed through them; the
                            by-source view above (when toggled) has that
                            detail. Grid collapses to 3 columns. */}
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold pb-1">By Company</span>
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold text-right pb-1">Stake Value</span>
                        <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold text-right pb-1">% of value</span>
                        {[...lookThrough]
                          .sort((a, b) => b.totalValue - a.totalValue)
                          .map(lt => (
                            <Fragment key={`co-${lt.portcoName}`}>
                              <span className="text-foreground"><span className="font-medium text-violet-800">{lt.portcoName}</span></span>
                              <span className="text-right tabular-nums font-medium">{fmt(lt.totalValue)}</span>
                              <span className="text-right tabular-nums text-[10px] text-muted-foreground">{totalAll > 0 ? ((lt.totalValue / totalAll) * 100).toFixed(1) : '0.0'}%</span>
                            </Fragment>
                          ))}
                        <span className="text-sm font-bold text-violet-900 pt-2 mt-1 border-t-2 border-violet-300/60">Total</span>
                        <span className="text-right text-base font-bold tabular-nums text-violet-900 pt-2 mt-1 border-t-2 border-violet-300/60">{fmt(totalAll)}</span>
                        <span className="text-right text-[10px] text-muted-foreground pt-2 mt-1 border-t-2 border-violet-300/60">100%</span>
                      </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* Per-portco detail sections — only in 'by-company' view.
                  Mirrors the by-source vehicle-section structure:
                    1. Color-ribbon header (portco name + tagline)
                    2. Portco-level KPI strip (Valuation, Multiple, FY
                       Revenue, Total Investment from all sources)
                    3. Investors table (who owns this portco)
                    4. My Performance card (LP's slice) */}
              {lookThroughView === 'by-company' && lookThrough.map(lt => {
                // Pull the parsed company record for portco-level financials
                const co = irr.companies.find(c => c.name === lt.portcoName);
                const fin = co?.financials || {};
                const portcoValuation = fin.valuation?.[yearIdx];
                const portcoMultiple = fin.multiple?.[yearIdx];
                const portcoRevenue = fin.revenue?.[yearIdx];
                // Gross margin sourced from the IRR sheet's
                // "Annual Gross Margin, %" row. The CFO maintains the
                // correct value there (e.g., for AllRx the IRR-sheet GM
                // reflects the public-target view) — single source of
                // truth for the field, no per-portco overrides at
                // render time.
                const portcoGM = fin.grossMargin?.[yearIdx];
                // Total cumulative investment INTO this portco across all
                // sources (every vehicle + every direct shareholder).
                // Through the selected year only.
                let totalInvestedInCo = 0;
                if (co) {
                  for (const v of (irr.vehicles || [])) {
                    totalInvestedInCo += (co.investments?.[v.name] ?? [])
                      .slice(0, yearIdx + 1).reduce((s, x) => s + (x ?? 0), 0);
                  }
                  for (const ds of Object.values(co.directShareholders || {})) {
                    totalInvestedInCo += (ds.investment ?? [])
                      .slice(0, yearIdx + 1).reduce((s, x) => s + (x ?? 0), 0);
                  }
                }
                const color = portcoColor(lt.portcoName);
                // Investors of this portco (every vehicle + direct holder
                // with non-zero contribution or ownership at selected year)
                const investors = [];
                if (co) {
                  for (const v of (irr.vehicles || [])) {
                    const cumInv = (co.investments?.[v.name] ?? [])
                      .slice(0, yearIdx + 1).reduce((s, x) => s + (x ?? 0), 0);
                    const ownPct = co.ownership?.[v.name]?.[yearIdx] ?? 0;
                    if (cumInv > 0 || ownPct > 0) {
                      investors.push({ name: v.name, kind: 'vehicle', investment: cumInv, ownership: ownPct });
                    }
                  }
                  for (const [name, ds] of Object.entries(co.directShareholders || {})) {
                    const cumInv = (ds.investment ?? [])
                      .slice(0, yearIdx + 1).reduce((s, x) => s + (x ?? 0), 0);
                    const ownPct = ds.ownership?.[yearIdx] ?? 0;
                    if (cumInv > 0 || ownPct > 0) {
                      investors.push({ name, kind: 'direct', investment: cumInv, ownership: ownPct });
                    }
                  }
                  investors.sort((a, b) => b.ownership - a.ownership);
                }
                return (
                <div key={lt.portcoName} className="rounded-xl border-2 bg-white shadow-sm overflow-hidden" style={{ borderColor: color }}>
                  {/* Color ribbon — same visual treatment as the by-source
                      vehicle sections, but using portco brand color.
                      Portco name is a button that jumps to the company's
                      Portfolio Performance Overview when provided. */}
                  <div className="px-5 py-3 text-white" style={{ backgroundColor: color }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90 leading-tight">Portfolio Company</p>
                    {onNavigateToCompany ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToCompany(lt.portcoName)}
                        className="text-xl font-bold leading-tight hover:underline focus:outline-none focus:underline text-left cursor-pointer"
                        title={`Open ${lt.portcoName} Overview`}
                      >
                        {lt.portcoName} <span className="text-[12px] font-normal opacity-80">→</span>
                      </button>
                    ) : (
                      <p className="text-xl font-bold leading-tight">{lt.portcoName}</p>
                    )}
                  </div>
                  {/* Portco-level KPI strip — describes the portco itself,
                      not the LP's slice. Same numbers all shareholders see. */}
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valuation</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{portcoValuation != null ? fmt(portcoValuation) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Multiple</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{portcoMultiple != null ? `${portcoMultiple.toFixed(1)}×` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">FY Revenue</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{portcoRevenue != null ? fmt(portcoRevenue) : '—'}</p>
                        {portcoGM != null && (
                          <p className="text-[9px] text-muted-foreground">{portcoGM.toFixed(0)}% gross margin</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Invested</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{totalInvestedInCo > 0 ? fmt(totalInvestedInCo) : '—'}</p>
                        <p className="text-[9px] text-muted-foreground">across all investors</p>
                      </div>
                    </div>
                  </div>
                  {/* Investors table — who owns this portco and how much
                      cash they've put in. Gated by canSeeShareholderSplit
                      (shareholderSplit breakdown permission) — by default
                      LPs don't see other shareholders' contributions or
                      ownership. Admin grants explicitly per user via
                      User Management → Other Access → Shareholder Split. */}
                  {canSeeShareholderSplit && investors.length > 0 && (
                    <div className="px-5 py-3 border-b border-border">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Investors</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Cumulative Investment</TableHead>
                            <TableHead className="text-right">Ownership %</TableHead>
                            <TableHead className="text-right">Stake Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {investors.map(inv => {
                            const stakeVal = portcoValuation != null ? portcoValuation * (inv.ownership / 100) : null;
                            const isMineDirect = inv.kind === 'direct' && inv.name === lpName;
                            return (
                              <TableRow key={`${inv.kind}-${inv.name}`} className={cn(isMineDirect && 'bg-primary/5')}>
                                <TableCell className={cn('font-medium', isMineDirect ? 'text-primary' : 'text-foreground')}>
                                  {inv.name}
                                  {inv.kind === 'direct' && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">Direct</span>}
                                  {isMineDirect && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary font-bold">You</span>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(inv.investment)}</TableCell>
                                <TableCell className="text-right tabular-nums">{inv.ownership.toFixed(2)}%</TableCell>
                                <TableCell className="text-right tabular-nums">{stakeVal != null ? fmt(stakeVal) : '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {/* "My Performance" card — LP's specific slice of this
                      portco, mirroring the vehicle-section My Performance
                      structure (ribbon + KPI strip + per-source decomp). */}
                  <div className="p-4">
                    <div className="rounded-xl border-2 border-primary bg-gradient-to-br from-primary/15 via-primary/8 to-primary/5 shadow-md overflow-hidden">
                      <div className="bg-primary text-primary-foreground px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold shrink-0">
                              {(lpName || 'Me').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'ME'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80 leading-tight">My Performance</p>
                              <p className="text-base font-bold leading-tight truncate">{lpName}</p>
                              <p className="text-[11px] opacity-80 leading-tight">in <strong>{lt.portcoName}</strong></p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-2xl font-bold tabular-nums leading-none">{lt.totalPct.toFixed(2)}%</p>
                            <p className="text-[10px] opacity-80 uppercase tracking-wide mt-0.5">Effective stake</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        {/* CFO direction: LP per-portco card shows only the
                            Stake Value as its headline KPI. Cost Basis,
                            MOIC, and IRR removed — those are vehicle-level
                            metrics not meaningfully attributable to a
                            single LP's slice of a single portco. The
                            "Your exposure breakdown" section below still
                            shows ownership % per vehicle. The Effective
                            Stake % stays in the ribbon header above. */}
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Stake Value</p>
                          <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">{fmt(lt.totalValue)}</p>
                        </div>
                        {/* Per-source decomposition — direct + each vehicle
                            with effective ownership and stake value. */}
                        <div className="mt-4 pt-3 border-t border-primary/20">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">Your exposure breakdown</p>
                          <div className="space-y-1.5">
                            {(lt.directOwnPct > 0 || lt.directCash > 0) && (
                              <div className="flex items-baseline justify-between gap-3 py-1">
                                <div className="text-xs">
                                  <span className="font-semibold text-primary">Direct</span>
                                  <span className="text-muted-foreground ml-2">your name on the cap table</span>
                                </div>
                                <div className="text-right tabular-nums">
                                  <span className="text-xs font-bold text-primary">{fmt(lt.directValue)}</span>
                                  <span className="text-[10px] text-muted-foreground ml-2">{lt.directOwnPct.toFixed(2)}%</span>
                                </div>
                              </div>
                            )}
                            {lt.indirect.map(ind => (
                              <div key={ind.vehicle} className="flex items-baseline justify-between gap-3 py-1">
                                <div className="text-xs">
                                  <span className="text-foreground">via <span className="font-medium text-foreground">{ind.vehicle}</span></span>
                                  <span className="text-muted-foreground ml-2">({ind.lpInVehiclePct.toFixed(1)}% × {ind.vehicleOwnsCoPct.toFixed(1)}%)</span>
                                </div>
                                <div className="text-right tabular-nums">
                                  <span className="text-xs font-medium text-foreground">{fmt(ind.effectiveValue)}</span>
                                  <span className="text-[10px] text-muted-foreground ml-2">{ind.effectivePct.toFixed(2)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
          </>
        );
      })()}

      {/* Vehicles — per-vehicle detail sections (My Performance, Companies
          Invested In, LP roster, etc). For LP users this is gated by the
          view-mode toggle: shown in 'by-source' view; hidden in
          'by-company' view (the per-portco detail cards inside the
          Look-Through card replace this slot). Admin users (no lpName)
          always see vehicles since they don't get the toggle and need
          the full data. */}
      {(!lpName || lookThroughView === 'by-source') && visibleVehicles.map(v => {
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
        // Fund Timeline is per-vehicle — pulled by name so future funds
        // (a second vehicle in FUND_COMMITMENTS) can each carry their own
        // month-precise schedule without ambiguity.
        const fundTimeline = irr?.fundTimelines?.[v.name];
        // LP-specific returns: ownership %, value, cumulative invested,
        // MOIC, IRR — computed using the actual sheet-provided investment
        // amounts (not vehicle investment × ownership %).
        const myReturns = myLp ? computeLpReturns(myLp, v, yearIdx, years, fundTimeline, periods) : null;
        const myOwnPct = myReturns?.ownPct ?? 0;
        const myValue = myReturns?.lpValue ?? 0;
        const myInvestment = myReturns?.cumInvest ?? 0;
        const myIrr = myReturns?.irr;
        const myMoic = myReturns?.moic;

        // Fund-structured vehicle? Compute commitment/called/unfunded.
        const fundInfo = FUND_COMMITMENTS[v.name];
        const isFund = !!fundInfo;
        // End of the selected period (Q1=Mar 31 … Q4=Dec 31), matching the
        // terminal date computeLpReturns uses for the per-LP rows.
        const periodEndMs = periods?.[yearIdx]?.endDate
          ? Date.parse(periods[yearIdx].endDate)
          : (years?.[yearIdx] != null ? Date.UTC(years[yearIdx], 11, 31) : null);
        const fundTotalCommit = isFund ? fundCommittedTotal(v.name, fundTimeline) : null;
        // FUNDED = cash received (Timeline flows ≤ period end). Falls back
        // to the IRR-sheet series only when a fund has no Timeline data.
        const fundFundedToDate = isFund
          ? (sumFundFundedThroughPeriod(fundTimeline, periodEndMs)
             ?? sumLpInvestmentsThroughYear(v, yearIdx))
          : null;
        // CALLED = what the GP has demanded per the call schedule, with the
        // gross overdue/prepaid split. Where no schedule is configured we
        // fall back to funded, which collapses the two and shows no gap.
        const fundCallSummary = isFund
          ? fundCalledThroughPeriod(v.name, fundTimeline, periodEndMs)
          : null;
        const fundCalledToDate = isFund ? (fundCallSummary?.called ?? fundFundedToDate) : null;
        // Unfunded = committed but not yet called. Overdue = called and
        // still unpaid (gross, never netted against prepayers).
        const fundUnfunded = isFund && fundTotalCommit != null ? fundTotalCommit - fundCalledToDate : null;
        const fundOverdue = fundCallSummary?.overdue ?? 0;
        const fundPrepaid = fundCallSummary?.prepaid ?? 0;
        const fundLpsOverdue = fundCallSummary?.lpsOverdue ?? 0;
        const fundInWindow = fundCallSummary?.inWindow ?? 0;
        // Computed here for EVERY vehicle rather than read from the
        // sheet's IRR row, so vehicles, shareholders and LPs all share
        // one convention. The sheet's row stays untouched but is no
        // longer displayed — it is computed with RATE(), which truncates
        // its period count to whole years and so overstates every
        // non-December quarter (Barsoum +14.3pp, AllRx Holding +12.1pp,
        // Curenta +5.7pp, InVitro Ventures +37.9pp at Q3 2026).
        const irrComputedPct = computeVehicleXirr(
          v, fundTimeline, periods, years, yearIdx, periodEndMs, ownership,
        );
        const irrDisplayPct = irrComputedPct != null ? irrComputedPct : irrPct;
        const irrIsDerived = irrComputedPct != null;
        const fundPctCalled = isFund && fundTotalCommit > 0 ? (fundCalledToDate / fundTotalCommit) * 100 : null;
        const fundPctFunded = isFund && fundTotalCommit > 0 ? (fundFundedToDate / fundTotalCommit) * 100 : null;

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
                  Standard LP commitment vocabulary, with Called and Funded
                  kept separate: Committed (total pledge), Called (demanded
                  per the call schedule), Funded (cash actually received),
                  Unfunded (committed but not yet called). Called − Funded
                  is the receivable, shown under the bar. */}
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
                    <KpiTile label="Funded to Date" value={fmt(fundFundedToDate)}
                      tone={fundOverdue > 0 ? 'negative' : 'neutral'} compact />
                    {/* Negative unfunded means called > committed — a data
                        problem, not good news. Flag it rather than greening it. */}
                    <KpiTile label="Unfunded" value={fmt(fundUnfunded)}
                      tone={fundUnfunded < 0 ? 'negative' : fundUnfunded === 0 ? 'positive' : 'neutral'} compact />
                  </div>
                  {/* Two-segment bar over the committed track: solid = funded,
                      amber = called but not yet received. The amber slice IS
                      the receivable, so a delinquent fund reads at a glance. */}
                  {fundPctCalled != null && (
                    <div className="mt-3 flex h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, fundPctFunded))}%` }}
                      />
                      {fundOverdue > 0 && fundTotalCommit > 0 && (
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, (fundOverdue / fundTotalCommit) * 100))}%` }}
                          title={`${fmt(fundOverdue)} called but not yet received`}
                        />
                      )}
                    </div>
                  )}
                  {fundPctCalled != null && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-muted-foreground">
                        {fundPctCalled.toFixed(0)}% called · {fundPctFunded.toFixed(0)}% funded
                      </span>
                      {fundOverdue > 0 && (
                        <span className="font-semibold text-amber-700">
                          {fmt(fundOverdue)} overdue from {fundLpsOverdue} LP{fundLpsOverdue === 1 ? '' : 's'}
                        </span>
                      )}
                      {fundInWindow > 0 && (
                        <span className="text-muted-foreground">
                          {fmt(fundInWindow)} due in the current call window
                        </span>
                      )}
                      {fundPrepaid > 0 && (
                        <span className="font-medium text-emerald-700">
                          {fmt(fundPrepaid)} prepaid ahead of schedule
                        </span>
                      )}
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
                {SHOW_IRR && <KpiTile
                  label={irrIsDerived ? 'IRR (XIRR, gross)' : 'IRR'}
                  title={[
                    irrIsDerived
                      ? (isFund
                          ? 'Money-weighted XIRR of the Fund Timeline capital calls (capital CALLED from LPs, including the $54.5k of 2025 legal expenses paid out of it) against this period’s NAV.'
                          : 'Money-weighted XIRR of this vehicle’s contributions against this period’s NAV. Contributions are dated to each period’s end, except where the real transfer month is known.')
                      : null,
                    'Annualised on an unrealised valuation mark, gross of management fees and carry. No distributions have been made.',
                  ].filter(Boolean).join(' ')}
                  value={irrDisplayPct != null ? `${irrDisplayPct.toFixed(1)}%` : '—'}
                  tone={irrDisplayPct == null ? 'neutral' : irrDisplayPct >= 0 ? 'positive' : 'negative'}
                  delta={compEnabled && <DeltaBadge current={irrDisplayPct} prior={irrPrior} compareYear={compareYear} />} />}
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
                        // Clickable company name — navigates to the
                        // company's Portfolio Performance Overview when
                        // the parent provides onNavigateToCompany.
                        // InVitro Studio is parent venture studio
                        // (no per-company portfolio page); not linked.
                        const canLink = !!onNavigateToCompany && !isParentStudio;
                        return (
                          <TableRow key={co.name}>
                            <TableCell className="font-medium">
                              {canLink ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToCompany(co.name)}
                                  className="text-primary hover:underline focus:outline-none focus:underline cursor-pointer text-left"
                                  title={`Open ${co.name} Overview`}
                                >
                                  {co.name}
                                </button>
                              ) : (
                                co.name
                              )}
                            </TableCell>
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
                const myCommitment = isFund ? getLpCommitment(v.name, myLp.name, fundTimeline) : null;
                const myCalledPct = myCommitment ? (myInvestment / myCommitment) * 100 : null;
                // myInvestment is cash this LP has actually wired. myCalled
                // is what the schedule has demanded of them by now, so
                // Unfunded stays "not yet called" and the gap between the
                // two is what they currently owe.
                const myCalled = isFund ? lpCalledThroughPeriod(v.name, myCommitment, periodEndMs) : null;
                const myDue = isFund ? lpDueThroughPeriod(v.name, myCommitment, periodEndMs) : null;
                const myOverdue = myDue != null ? Math.max(0, myDue - myInvestment) : 0;
                const myPrepaid = myCalled != null ? Math.max(0, myInvestment - myCalled) : 0;
                const myInWindow = myCalled != null
                  ? Math.max(0, myCalled - myInvestment - myOverdue) : 0;
                const myUnfunded = myCommitment ? myCommitment - (myCalled ?? myInvestment) : null;
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
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-background rounded-md border border-primary/20">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">My Commitment</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{fmt(myCommitment)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Called</p>
                        <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">{fmt(myCalled ?? myInvestment)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Funded</p>
                        <p className={cn(
                          "text-sm font-bold tabular-nums mt-0.5",
                          myOverdue > 0 ? "text-amber-700" : "text-foreground"
                        )}>
                          {fmt(myInvestment)} <span className="text-[10px] font-normal text-muted-foreground">({myCalledPct?.toFixed(0)}%)</span>
                        </p>
                        {myOverdue > 0 && (
                          <p className="text-[10px] font-medium text-amber-700">{fmt(myOverdue)} overdue</p>
                        )}
                        {myOverdue === 0 && myInWindow > 0 && (
                          <p className="text-[10px] font-normal text-muted-foreground">{fmt(myInWindow)} due this window</p>
                        )}
                        {myOverdue === 0 && myInWindow === 0 && myPrepaid > 0 && (
                          <p className="text-[10px] font-normal text-emerald-700">{fmt(myPrepaid)} prepaid</p>
                        )}
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
                    {/* myInvestment is cash received, so this is Funded, not
                        Called — it's also the IRR/MOIC basis below. */}
                    <KpiTile label={isFund ? 'Funded to Date' : 'Cost Basis'} value={fmt(isFund ? myInvestment : myInitial)} compact />
                    {SHOW_IRR && <KpiTile label={isFund ? 'My IRR (gross, unrealised)' : 'IRR'}
                      title={isFund
                        ? 'Annualised on an unrealised NAV mark, gross of management fees and carry. Nothing has been distributed, so this is a valuation-driven figure, not a realised return.'
                        : undefined}
                      value={myIrr != null ? `${myIrr.toFixed(1)}%` : '—'}
                      tone={myIrr == null ? 'neutral' : myIrr >= 0 ? 'positive' : 'negative'} compact />}
                    <KpiTile label={isFund ? 'My MOIC (unrealised)' : 'MOIC'}
                      title={isFund ? `Stake NAV ÷ ${fmt(myInvestment)} paid in. Nothing has been distributed, so this is entirely paper value.` : undefined}
                      value={myMoic != null ? `${myMoic.toFixed(1)}x` : '—'}
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
                        // Convertible-loan period: for vehicles that started
                        // as convertible-loan agreements (Curenta Enterprise),
                        // pre-conversion contributions are debt — not equity.
                        // They still count as cost basis (the loan principal
                        // becomes equity basis at conversion) but render with
                        // a distinct "Convertible Loan" label and color.
                        const conversionYear = VEHICLE_CONVERSION_YEAR[v.name];
                        for (let idx = 0; idx < years.length; idx++) {
                          const year = years[idx];
                          const investmentVal = myLp.investment?.[idx] ?? 0;
                          const isRecycled = hasRecyclingCol && year >= recyclingStartYear;
                          const isConvertibleLoan = conversionYear != null && year < conversionYear && investmentVal > 0;
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

                          // Build per-year event list. Order: non-cash events
                          // FIRST (interest accrual, redistribution, founder
                          // grant), then the cash/recycled/convertibleLoan
                          // event. Reflects temporal sequence — e.g., for CE
                          // 2024: interest accrued through conversion, then
                          // recycled allocations began after.
                          const events = [];
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
                          if (investmentVal > 0) {
                            runningShares += cashShares;
                            // Three kinds of contribution rows:
                            //   - 'convertibleLoan': pre-conversion years for
                            //     vehicles structured as convertible loans
                            //     (CE pre-2024). Still counted as initial
                            //     cost basis but labeled distinctly.
                            //   - 'recycled': post-recyclingStartYear (vehicle
                            //     redeploying its own profits, not new LP cash).
                            //   - 'cash': default — straight equity contribution.
                            events.push({
                              kind: isConvertibleLoan ? 'convertibleLoan' : (isRecycled ? 'recycled' : 'cash'),
                              year,
                              initial: initialThisYear,
                              recycled: recycledThisYear,
                              cumInitial: runningInitial,
                              cumRecycled: runningRecycled,
                              sharesDelta: cashShares,
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
                          // Attach year-end metrics. For pre-conversion years
                          // (Curenta Enterprise pre-2024), the LP was a creditor,
                          // not a shareholder — no equity ownership, no FMV stake.
                          // We leave ownPctYr / stakeFmv / moicYr unset so the
                          // renderer naturally shows '—'. For post-conversion
                          // years, attach to EVERY event in the year (interest
                          // accrual, recycled, etc.) so every row shows the
                          // year-end ownership consistently — not only the last
                          // row of the year.
                          const isPreConversionYear = conversionYear != null && year < conversionYear;
                          if (!isPreConversionYear) {
                            for (const e of events) {
                              e.ownPctYr = ownPctYr;
                              e.stakeFmv = stakeFmv;
                              e.moicYr = moicYr;
                            }
                          }
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
                              r.kind === 'convertibleLoan' && !r.isSelectedYear && 'bg-indigo-50/50',
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
                                  ) : r.kind === 'convertibleLoan' ? (
                                    <span className="text-indigo-800" title="Contribution was a convertible loan agreement at the time; converted to equity at the conversion year">
                                      {r.year} <em className="not-italic text-[10px] font-medium">📜 Convertible Loan</em>
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
                                <TableCell className="text-right text-xs tabular-nums">{r.ownPctYr > 0 ? `${r.ownPctYr.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{r.stakeFmv != null && r.stakeFmv > 0 ? fmt(r.stakeFmv) : '—'}</TableCell>
                                <TableCell className={cn(
                                  "text-right text-xs tabular-nums",
                                  r.moicYr != null && r.moicYr >= 1 && "text-emerald-700",
                                  r.moicYr != null && r.moicYr < 1 && "text-red-600",
                                )}>{r.moicYr != null ? `${r.moicYr.toFixed(2)}x` : '—'}</TableCell>
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
                        {VEHICLE_CONVERSION_YEAR[v.name] != null && (
                          <>
                            <span className="text-indigo-700"> Indigo rows</span> are pre-conversion <strong className="text-indigo-800">Convertible Loan</strong> contributions — debt at the time, converted to equity in {VEHICLE_CONVERSION_YEAR[v.name]}. The principal is included in Cumulative Cost.
                          </>
                        )}
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
                  {isFund && myLp.investment?.some(x => x != null && x !== 0) && (() => {
                    // When Timeline data is available for this LP, the
                    // schedule table sources its per-year "Called" from
                    // real monthly flows (not the IRR sheet's annual
                    // buckets). This fixes the fiscal-year artifact where
                    // e.g. Fr. Botros's Sept 2024 contribution was
                    // rolled into 2025's annual column. Ownership% also
                    // switches to the Timeline's authoritative per-year
                    // value when present.
                    const tlLp = fundTimeline?.perLp?.[myLp.name];
                    const hasTimelineFlows = tlLp?.flows?.length > 0;
                    return (
                    <div className="mt-4 pt-4 border-t border-primary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                        Capital Call Schedule
                        {hasTimelineFlows && (
                          <span className="ml-2 text-[9px] font-normal text-muted-foreground">
                            (quarterly · IRR sheet valuation × Fund Timeline calls)
                          </span>
                        )}
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
                            {/* Driver before result: this is the valuation
                                Stake NAV is derived from. */}
                            <TableHead className="text-right text-xs">Portfolio Valuation</TableHead>
                            <TableHead className="text-right text-xs">Stake NAV</TableHead>
                            <TableHead className="text-right text-xs">TVPI</TableHead>
                            {SHOW_IRR && <TableHead className="text-right text-xs">IRR</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            // First year of the LP's participation (year where
                            // called first goes positive) — used as a fallback
                            // when the vehicle has no lifecycle config.
                            // First period the LP has actually paid into.
                            // Used only as a fallback when no lifecycle
                            // config exists for the vehicle.
                            let firstActiveIdx = -1;
                            for (let i = 0; i < periods.length; i++) {
                              const pEnd = Date.parse(periods[i].endDate);
                              const called = tlLp?.flows
                                ? tlLp.flows.filter(f => {
                                    const ms = Date.UTC(f.year, f.month - 1, f.day);
                                    const prevEnd = i > 0 ? Date.parse(periods[i-1].endDate) : -Infinity;
                                    return ms > prevEnd && ms <= pEnd;
                                  }).reduce((s, f) => s + f.amount, 0)
                                : (myLp.investment?.[i] ?? 0);
                              if (called > 0) { firstActiveIdx = i; break; }
                            }
                            const lifecycle = FUND_LIFECYCLE[v.name] ?? null;
                            return periods.map((period, idx) => {
                            const year = period.year;
                            const phase = lifecycle?.[year] ?? null;
                            // Called THIS PERIOD — from Timeline flows dated
                            // within (prev period end, this period end]. When
                            // Timeline isn't available, fall back to the
                            // IRR-sheet period value (which the CFO now
                            // populates per quarter directly).
                            const prevEndMs = idx > 0 ? Date.parse(periods[idx-1].endDate) : -Infinity;
                            const thisEndMs = Date.parse(period.endDate);
                            const called = tlLp?.flows
                              ? tlLp.flows.filter(f => {
                                  const ms = Date.UTC(f.year, f.month - 1, f.day);
                                  return ms > prevEndMs && ms <= thisEndMs;
                                }).reduce((s, f) => s + f.amount, 0)
                              : (myLp.investment?.[idx] ?? 0);
                            // Cum called — all Timeline flows dated on/before this period end.
                            const cumCalled = tlLp?.flows
                              ? tlLp.flows.filter(f => Date.UTC(f.year, f.month - 1, f.day) <= thisEndMs)
                                  .reduce((s, f) => s + f.amount, 0)
                              : (myLp.investment ?? [])
                                  .slice(0, idx + 1)
                                  .reduce((a, v) => a + (v ?? 0), 0);
                            const pctCommitted = myCommitment ? (cumCalled / myCommitment) * 100 : null;
                            const unfunded = myCommitment ? Math.max(0, myCommitment - cumCalled) : null;
                            // Prefer IRR-sheet ownership (period-precise); fall back to Timeline (annual only).
                            const irrOwnPeriod = myLp.ownership?.[idx];
                            const ownPctYr = irrOwnPeriod != null && irrOwnPeriod !== 0
                              ? irrOwnPeriod
                              : (tlLp?.ownershipByYear?.[year] != null ? tlLp.ownershipByYear[year] * 100 : 0);
                            const vehVal = v.ownershipValue?.[idx];
                            const stakeNav = vehVal != null && ownPctYr > 0 ? vehVal * (ownPctYr / 100) : null;
                            const tvpiRaw = cumCalled > 0 && stakeNav != null ? stakeNav / cumCalled : null;
                            // The valuation this row's Stake NAV comes from:
                            // the combined worth of the portfolio companies
                            // the fund held in this period. Same inclusion
                            // rule as the Companies Invested In table (any
                            // capital deployed, or any ownership held), so
                            // the two agree. Shown per row because it is the
                            // single input that moves Stake NAV — AllCare +
                            // Curenta going $36.2M -> $65.6M is what took
                            // TVPI from 1.30x to 2.05x in one quarter.
                            let rowPortfolioVal = 0;
                            let rowCoCount = 0;
                            for (const co of irr.companies || []) {
                              const ownAtIdx = co.ownership?.[v.name]?.[idx] ?? 0;
                              const cumInvAtIdx = (co.investments?.[v.name] ?? [])
                                .slice(0, idx + 1).reduce((s, x) => s + (x ?? 0), 0);
                              if (!(ownAtIdx > 0 || cumInvAtIdx > 0)) continue;
                              rowCoCount += 1;
                              rowPortfolioVal += co.financials?.valuation?.[idx] ?? 0;
                            }
                            const isJCurve = phase ? phase.jCurve : (idx === firstActiveIdx);
                            const tvpi = isJCurve ? null : tvpiRaw;
                            // Per-period XIRR — terminal NAV = this row's Stake NAV at the period's real end date.
                            let rowIrr = null;
                            if (!isJCurve && stakeNav != null && stakeNav > 0 && tlLp?.flows?.length > 0) {
                              const rowTerminalMs = thisEndMs;
                              const rowFlowsBefore = tlLp.flows.filter(f =>
                                Date.UTC(f.year, f.month - 1, f.day) <= rowTerminalMs
                              );
                              if (rowFlowsBefore.length > 0) {
                                const firstMs = Date.UTC(rowFlowsBefore[0].year, rowFlowsBefore[0].month - 1, rowFlowsBefore[0].day);
                                const YR_MS = 365.25 * 86400e3;
                                const cf = rowFlowsBefore.map(f => ({
                                  amount: -f.amount,
                                  yearsFromStart: (Date.UTC(f.year, f.month - 1, f.day) - firstMs) / YR_MS,
                                }));
                                cf.push({ amount: stakeNav, yearsFromStart: (rowTerminalMs - firstMs) / YR_MS });
                                const r = xirr(cf);
                                if (r != null) rowIrr = r * 100;
                              }
                            }
                            // Skip pre-investment / post-exit empty periods
                            if (called === 0 && cumCalled === 0 && (stakeNav == null || stakeNav === 0)) return null;
                            const isSelectedYear = idx === yearIdx;
                            return (
                              <TableRow key={period.label} className={isSelectedYear ? 'bg-primary/10 font-medium' : ''}>
                                <TableCell className="text-xs">
                                  <div className="tabular-nums font-medium">
                                    {period.label}
                                    {period.isAnnualEnd && <span className="ml-1 text-[9px] text-muted-foreground font-normal">(annual)</span>}
                                  </div>
                                  {phase && (
                                    <div className={cn(
                                      "text-[9px] font-normal uppercase tracking-wide leading-tight mt-0.5",
                                      phase.jCurve ? "text-amber-700" : "text-emerald-700"
                                    )}>
                                      {phase.label}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{called !== 0 ? fmt(called) : '—'}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-medium">{fmt(cumCalled)}</TableCell>
                                {myCommitment && (
                                  <TableCell className="text-right text-xs tabular-nums">{pctCommitted != null ? `${pctCommitted.toFixed(1)}%` : '—'}</TableCell>
                                )}
                                {myCommitment && (
                                  <TableCell className="text-right text-xs tabular-nums">{unfunded != null ? fmt(unfunded) : '—'}</TableCell>
                                )}
                                <TableCell
                                  className="text-right text-xs tabular-nums text-muted-foreground"
                                  title={rowPortfolioVal > 0
                                    ? `Combined valuation of the ${rowCoCount} portfolio ${rowCoCount === 1 ? 'company' : 'companies'} the fund held this period. The fund's ownership share of this is its NAV; your ${ownPctYr.toFixed(2)}% of the fund is your Stake NAV.`
                                    : 'No portfolio valuation recorded for this period'}>
                                  {rowPortfolioVal > 0 ? fmt(rowPortfolioVal) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{stakeNav != null && stakeNav > 0 ? fmt(stakeNav) : '—'}</TableCell>
                                <TableCell className={cn(
                                  "text-right text-xs tabular-nums",
                                  tvpi != null && tvpi >= 1 && "text-emerald-700",
                                  tvpi != null && tvpi < 1 && "text-red-600",
                                  tvpi == null && isJCurve && "text-muted-foreground italic",
                                )} title={isJCurve ? `N/M — ${phase?.label ?? 'first year'} phase (J-curve; TVPI sub-1 by construction, not by underperformance)` : undefined}>
                                  {tvpi != null ? `${tvpi.toFixed(2)}x` : (isJCurve ? 'N/M' : '—')}
                                </TableCell>
                                {SHOW_IRR && <TableCell className={cn(
                                  "text-right text-xs tabular-nums",
                                  rowIrr != null && rowIrr >= 0 && "text-emerald-700",
                                  rowIrr != null && rowIrr < 0 && "text-red-600",
                                  rowIrr == null && isJCurve && "text-muted-foreground italic",
                                )} title={isJCurve ? `N/M — ${phase?.label ?? 'first year'} phase (J-curve; IRR negative by construction, not by underperformance)` : undefined}>
                                  {rowIrr != null ? `${rowIrr.toFixed(1)}%` : (isJCurve ? 'N/M' : '—')}
                                </TableCell>}
                              </TableRow>
                            );
                          });
                          })()}
                        </TableBody>
                      </Table>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3 italic">
                        <strong className="text-foreground">Capital Called</strong> = capital drawn from your commitment in that year.
                        <strong className="text-foreground"> Cum Called</strong> = total paid-in to date.
                        <strong className="text-foreground"> Unfunded</strong> = remaining commitment you haven&apos;t paid in yet.
                        <strong className="text-foreground"> Stake NAV</strong> = your ownership × the fund&apos;s net asset value at year-end.
                        <strong className="text-foreground"> Portfolio Valuation</strong> = combined valuation of the portfolio companies the fund held that period — the figure Stake NAV is derived from. The fund&apos;s ownership share of it is the fund&apos;s NAV, and your ownership share of that is your Stake NAV, so a move here drives everything to its right.
                        <strong className="text-foreground"> TVPI</strong> = Stake NAV ÷ Cum Called (Total Value to Paid-In; ≥ 1.00× means you&apos;re in the green) — <em>unrealised</em>, it is a valuation, not cash. Nothing has been distributed to date.
                        {SHOW_IRR && <><strong className="text-foreground"> IRR</strong> = money-weighted XIRR on your capital calls + this row&apos;s Stake NAV as terminal value at Dec 31; recomputes per row so you see the trajectory year by year.</>}
                        Rows in <span className="text-amber-700 font-semibold">Calling</span> and <span className="text-amber-700 font-semibold">Deployment</span> phases show TVPI as <em>N/M</em> — the J-curve makes both sub-par by construction (fee drag + un-marked NAV), not by underperformance. Meaningful returns begin at the <span className="text-emerald-700 font-semibold">Hold</span> phase.
                        Capital amounts are gross of management fees (the cheque you wrote), and returns are gross of management fees and carry — your net return will be lower.
                        Because nothing has been realised, the multiples here are an <em>unrealised</em> mark driven by the portfolio valuation in the CFO&apos;s sheet; early-life figures swing hard on a single revaluation and are not comparable to a realised fund return.
                      </p>
                    </div>
                    );
                  })()}

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
                        {/* Committed + Called columns only for fund-structured
                            vehicles. Called is the schedule; the next column
                            is cash actually received against it. */}
                        {isFund && <TableHead className="text-right">Committed</TableHead>}
                        {isFund && <TableHead className="text-right">Called</TableHead>}
                        <TableHead className="text-right">{isFund ? 'Funded' : 'Cum. Investment'}</TableHead>
                        {SHOW_IRR && <TableHead className="text-right">IRR</TableHead>}
                        <TableHead className="text-right">MOIC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosterLps.map(lp => {
                        const r = computeLpReturns(lp, v, yearIdx, years, fundTimeline, periods);
                        const { ownPct, lpValue, cumInvest, initialContrib, recycledAlloc,
                          moic: lpMoic, irr: lpIrr, moicOnTotal, irrOnTotal,
                          moicOnInitial, irrOnInitial, irrMethod,
                          lpHoldYears, lpFirstYear } = r;
                        const isMe = lpName && lp.name === lpName;
                        const hasRecycling = recycledAlloc > 0;
                        const lpCommitment = isFund ? getLpCommitment(v.name, lp.name, fundTimeline) : null;
                        // cumInvest is cash RECEIVED. lpCalled is what the
                        // schedule has demanded by now; the gap is overdue
                        // (positive) or prepaid (negative).
                        const lpCalled = isFund
                          ? lpCalledThroughPeriod(v.name, lpCommitment, periodEndMs)
                          : null;
                        // Overdue is measured against what was DUE (window
                        // closed), not against what was called — an LP
                        // inside their Sep–Nov window is not late.
                        const lpDue = isFund
                          ? lpDueThroughPeriod(v.name, lpCommitment, periodEndMs)
                          : null;
                        const lpOverdue = lpDue != null ? Math.max(0, lpDue - cumInvest) : 0;
                        const lpPrepaid = lpCalled != null ? Math.max(0, cumInvest - lpCalled) : 0;
                        const lpInWindow = lpCalled != null
                          ? Math.max(0, lpCalled - cumInvest - lpOverdue) : 0;
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
                        // Shown value is total deployed; name that explicitly
                        // so nobody reads the headline as initial-cash.
                        const moicTitle = hasRecycling
                          ? `Shown: MOIC on total capital deployed (${fmt(cumInvest)} — initial cash plus recycled profits): ${moicOnTotal?.toFixed(2)}x\nFor reference, on initial cash only (${fmt(initialContrib)}): ${moicOnInitial?.toFixed(2)}x`
                          : '';
                        const irrTitle = (() => {
                          const lines = [];
                          if (irrMethod === 'xirr') {
                            lines.push('Money-weighted IRR (XIRR) — accounts for capital call timing');
                          } else if (lpFirstYear != null && lpHoldYears != null) {
                            lines.push(`Annualized over ${lpHoldYears} yr (joined ${lpFirstYear})`);
                          }
                          if (hasRecycling) {
                            // Shown figure is total deployed; initial-cash is
                            // the secondary now, not the headline.
                            lines.push(`Shown: IRR on total capital deployed (${fmt(cumInvest)} — initial cash plus recycled profits): ${irrOnTotal?.toFixed(1)}%`);
                            lines.push(`For reference, on initial cash only (${fmt(initialContrib)}): ${irrOnInitial?.toFixed(1)}%`);
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
                            {isFund && (
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {lpCalled != null ? fmt(lpCalled) : '—'}
                              </TableCell>
                            )}
                            <TableCell className="text-right tabular-nums" title={investTitle}>
                              <span className={cn(lpOverdue > 0 && "text-amber-700 font-semibold")}>
                                {fmt(cumInvest)}
                              </span>
                              {hasRecycling && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {fmt(initialContrib)} + {fmt(recycledAlloc)} recycled
                                </div>
                              )}
                              {isFund && !hasRecycling && lpOverdue > 0 && (
                                <div className="text-[10px] font-medium text-amber-700">
                                  {fmt(lpOverdue)} overdue
                                </div>
                              )}
                              {isFund && !hasRecycling && lpOverdue === 0 && lpInWindow > 0 && (
                                <div className="text-[10px] font-normal text-muted-foreground">
                                  {fmt(lpInWindow)} due this window
                                </div>
                              )}
                              {isFund && !hasRecycling && lpOverdue === 0 && lpInWindow === 0 && lpPrepaid > 0 && (
                                <div className="text-[10px] font-normal text-emerald-700">
                                  {fmt(lpPrepaid)} prepaid
                                </div>
                              )}
                              {isFund && !hasRecycling && lpOverdue === 0 && lpInWindow === 0 && lpPrepaid === 0 && lpCalledPct != null && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {lpCalledPct.toFixed(0)}% of commitment
                                </div>
                              )}
                            </TableCell>
                            {SHOW_IRR && <TableCell
                              title={irrTitle}
                              className={cn(
                                "text-right tabular-nums",
                                lpIrr != null && (lpIrr >= 0 ? "text-emerald-600" : "text-red-500")
                              )}>
                              {lpIrr != null ? `${lpIrr.toFixed(1)}%` : '—'}
                            </TableCell>}
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
function KpiTile({ label, value, tone = 'neutral', compact = false, delta = null, title }) {
  const toneCls = {
    positive: 'text-emerald-600',
    negative: 'text-red-500',
    neutral: 'text-foreground',
  }[tone];
  return (
    <div
      title={title}
      className={cn(
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
