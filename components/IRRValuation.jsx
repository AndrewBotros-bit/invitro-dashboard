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
                    <KpiTile label={isFund ? 'Called to Date' : 'Cost Basis'} value={fmt(myInvestment)} compact />
                    <KpiTile label={isFund ? 'My IRR' : 'IRR'} value={myIrr != null ? `${myIrr.toFixed(1)}%` : '—'}
                      tone={myIrr == null ? 'neutral' : myIrr >= 0 ? 'positive' : 'negative'} compact />
                    <KpiTile label={isFund ? 'My MOIC' : 'MOIC'} value={myMoic != null ? `${myMoic.toFixed(1)}x` : '—'}
                      tone={myMoic == null ? 'neutral' : myMoic >= 1 ? 'positive' : 'negative'} compact />
                  </div>

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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Year</TableHead>
                            <TableHead className="text-right text-xs">Cash Invested</TableHead>
                            <TableHead className="text-right text-xs">Cumulative Cost</TableHead>
                            <TableHead className="text-right text-xs">Ownership %</TableHead>
                            <TableHead className="text-right text-xs">Stake FMV</TableHead>
                            <TableHead className="text-right text-xs">MOIC</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {years.map((year, idx) => {
                            const cash = myLp.investment?.[idx] ?? 0;
                            const cumCash = (myLp.investment ?? [])
                              .slice(0, idx + 1)
                              .reduce((a, v) => a + (v ?? 0), 0);
                            // ownership is stored in percent units (25 = 25%),
                            // matching the convention used in computeLpReturns
                            // (see lpValue = vehicleValue * (ownPct/100)).
                            const ownPctYr = myLp.ownership?.[idx] ?? 0;
                            const vehVal = v.ownershipValue?.[idx];
                            const stakeFmv = vehVal != null && ownPctYr > 0 ? vehVal * (ownPctYr / 100) : null;
                            const moicYr = cumCash > 0 && stakeFmv != null ? stakeFmv / cumCash : null;
                            // Skip rows with no contribution AND no FMV — they're
                            // pre-investment or post-exit empty years.
                            if (cash === 0 && cumCash === 0 && (stakeFmv == null || stakeFmv === 0)) return null;
                            const isSelectedYear = idx === yearIdx;
                            return (
                              <TableRow key={year} className={isSelectedYear ? 'bg-primary/10 font-medium' : ''}>
                                <TableCell className="text-xs tabular-nums">{year}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{cash !== 0 ? fmt(cash) : '—'}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-medium">{fmt(cumCash)}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{ownPctYr > 0 ? `${ownPctYr.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{stakeFmv != null && stakeFmv > 0 ? fmt(stakeFmv) : '—'}</TableCell>
                                <TableCell className={cn(
                                  "text-right text-xs tabular-nums",
                                  moicYr != null && moicYr >= 1 && "text-emerald-700",
                                  moicYr != null && moicYr < 1 && "text-red-600",
                                )}>{moicYr != null ? `${moicYr.toFixed(2)}x` : '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3 italic">
                        <strong className="text-foreground">Cost Basis</strong> = cumulative cash you&apos;ve put into the vehicle.
                        <strong className="text-foreground"> Stake FMV</strong> = your ownership % × the vehicle&apos;s mark-to-market value at year-end,
                        driven by the underlying portfolio company valuations.
                        <strong className="text-foreground"> MOIC</strong> = Stake FMV ÷ Cost Basis (≥ 1.00× means the stake is worth more than what you paid in).
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
