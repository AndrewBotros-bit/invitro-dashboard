"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { fmt, pct } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * Compute LP-specific returns for the selected year using the same CAGR
 * formula as the vehicle rollup (Andrew's house formula):
 *
 *   LP_Value      = vehicle.ownershipValue × LP.ownership%
 *   LP_CumInvest  = Σ LP.investment[0..yearIdx]   (year-only, summed forward)
 *   LP_MOIC       = LP_Value / LP_CumInvest
 *   LP_IRR        = LP_MOIC^(1/years) - 1         (years = vehicle hold period)
 *
 * Returns IRR in percent units (43 means 43%) so the existing toFixed(1) +
 * "%" rendering stays correct without further normalization.
 *
 * Edge cases: when cumInvest is 0 (LP not yet invested) or value <= 0 we
 * return null for moic/irr so the UI shows "—" instead of NaN/Infinity.
 */
function computeLpReturns(lp, vehicle, yearIdx) {
  const ownPct = lp.ownership?.[yearIdx] ?? 0;
  const vehicleValue = vehicle.ownershipValue?.[yearIdx] ?? 0;
  const lpValue = vehicleValue * (ownPct / 100);

  const series = lp.investment ?? [];
  const cumInvest = series
    .slice(0, yearIdx + 1)
    .reduce((s, v) => s + (v ?? 0), 0);

  const years = vehicle.holdPeriod?.[yearIdx];
  let moic = null;
  let irr = null;
  if (cumInvest > 0 && lpValue > 0) {
    moic = lpValue / cumInvest;
    if (years && years > 0) {
      irr = (Math.pow(moic, 1 / years) - 1) * 100;
    }
  }

  return { ownPct, lpValue, cumInvest, moic, irr };
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
export default function IRRValuation({ data, user }) {
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
  const [selectedYear, setSelectedYear] = useState(() => {
    // Default to most recent year that has any vehicle data
    for (let i = years.length - 1; i >= 0; i--) {
      const hasData = irr.vehicles.some(v => v.ownershipValue?.[i] != null && v.ownershipValue[i] > 0);
      if (hasData) return years[i];
    }
    return years[years.length - 1];
  });
  const yearIdx = years.indexOf(selectedYear);

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
      {/* Header with year selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">IRR &amp; Valuation</h2>
          <p className="text-sm text-muted-foreground">
            {lpName ? <>Viewing your stakes as <strong>{lpName}</strong></> : <>All investment vehicles</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Year</span>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm font-medium"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Vehicles */}
      {visibleVehicles.map(v => {
        const ownership = v.ownershipValue?.[yearIdx] ?? 0;
        const investment = v.investment?.[yearIdx] ?? 0;
        const irrPct = v.irr?.[yearIdx];
        const moic = v.moic?.[yearIdx];
        const cos = vehicleCompanies(v.name);
        const myLp = lpName ? v.lps.find(lp => lp.name === lpName) : null;
        // LP-specific returns: ownership %, value, cumulative invested,
        // MOIC, IRR — computed using the actual sheet-provided investment
        // amounts (not vehicle investment × ownership %).
        const myReturns = myLp ? computeLpReturns(myLp, v, yearIdx) : null;
        const myOwnPct = myReturns?.ownPct ?? 0;
        const myValue = myReturns?.lpValue ?? 0;
        const myInvestment = myReturns?.cumInvest ?? 0;
        const myIrr = myReturns?.irr;
        const myMoic = myReturns?.moic;

        return (
          <Card key={v.name}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-base">{v.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {v.holdPeriod?.[yearIdx] != null ? `Hold period: ${v.holdPeriod[yearIdx]} yr` : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Vehicle KPI strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile label="Ownership Value" value={fmt(ownership)} />
                <KpiTile label="Total Investment" value={fmt(investment)} />
                <KpiTile label="IRR" value={irrPct != null ? `${irrPct.toFixed(1)}%` : '—'}
                  tone={irrPct == null ? 'neutral' : irrPct >= 0 ? 'positive' : 'negative'} />
                <KpiTile label="MOIC" value={moic != null ? `${moic.toFixed(1)}x` : '—'}
                  tone={moic == null ? 'neutral' : moic >= 1 ? 'positive' : 'negative'} />
              </div>

              {/* My Performance card — only for LP users */}
              {myLp && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">My Performance</p>
                      <p className="text-xs text-muted-foreground">
                        Your <strong>{myOwnPct.toFixed(2)}%</strong> stake in {v.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiTile label="My Ownership Value" value={fmt(myValue)} compact />
                    <KpiTile label="My Investment" value={fmt(myInvestment)} compact />
                    <KpiTile label="My IRR" value={myIrr != null ? `${myIrr.toFixed(1)}%` : '—'}
                      tone={myIrr == null ? 'neutral' : myIrr >= 0 ? 'positive' : 'negative'} compact />
                    <KpiTile label="My MOIC" value={myMoic != null ? `${myMoic.toFixed(1)}x` : '—'}
                      tone={myMoic == null ? 'neutral' : myMoic >= 1 ? 'positive' : 'negative'} compact />
                  </div>
                </div>
              )}

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
                        // (real cash flowed); valuation/stake suppressed.
                        const isParentStudio = co.name === 'InVitro Studio';
                        const stakeValue = (own / 100) * valuation;
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
                              {isParentStudio ? '—' : fmt(valuation)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* LP roster table — admins see everyone, LP users see only themselves */}
              {v.lps.length > 0 && (() => {
                const rosterLps = lpName ? v.lps.filter(lp => lp.name === lpName) : v.lps;
                if (rosterLps.length === 0) return null;
                return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {lpName ? 'My Stake' : `Shareholders (${v.lps.length})`}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>LP / Shareholder</TableHead>
                        <TableHead className="text-right">Ownership %</TableHead>
                        <TableHead className="text-right">Ownership Value</TableHead>
                        <TableHead className="text-right">Cum. Investment</TableHead>
                        <TableHead className="text-right">IRR</TableHead>
                        <TableHead className="text-right">MOIC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosterLps.map(lp => {
                        const { ownPct, lpValue, cumInvest, moic: lpMoic, irr: lpIrr } =
                          computeLpReturns(lp, v, yearIdx);
                        const isMe = lpName && lp.name === lpName;
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
                            <TableCell className="text-right tabular-nums">{fmt(cumInvest)}</TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums",
                              lpIrr != null && (lpIrr >= 0 ? "text-emerald-600" : "text-red-500")
                            )}>
                              {lpIrr != null ? `${lpIrr.toFixed(1)}%` : '—'}
                            </TableCell>
                            <TableCell className={cn(
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
function KpiTile({ label, value, tone = 'neutral', compact = false }) {
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
    </div>
  );
}
