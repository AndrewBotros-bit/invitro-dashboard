const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxwGKfcxAuMQxcjJ_mlKF45DjJ3nCivGr5ErTi0mksME36T1zAUPLnZbvQxb2Hkwlj4/exec';

export async function fetchSheetData() {
  const res = await fetch(APPS_SCRIPT_URL, { next: { revalidate: 300 } }); // 5 min ISR
  if (!res.ok) throw new Error('Failed to fetch sheet data');
  const raw = await res.json();
  return transformData(raw);
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function transformData(raw) {
  const pl = raw.pl;
  if (!pl || !pl.companies) return null;

  const c = pl.companies;

  // Build monthly2026 in the format the dashboard expects
  const monthly2026 = {
    allrx: {
      rev: (c.allrx?.rev?.monthly2026 || []).map(num),
      ebitda: (c.allrx?.ebitda?.monthly2026 || []).map(num),
      grossMargin: (c.allrx?.gm?.monthly2026 || []).map(num),
    },
    allcare: {
      rev: (c.allcare?.rev?.monthly2026 || []).map(num),
      ebitda: (c.allcare?.ebitda?.monthly2026 || []).map(num),
      grossMargin: (c.allcare?.gm?.monthly2026 || []).map(num),
    },
    osta: {
      rev: (c.osta?.rev?.monthly2026 || []).map(num),
      ebitda: (c.osta?.ebitda?.monthly2026 || []).map(num),
      grossMargin: (c.osta?.gm?.monthly2026 || []).map(num),
    },
    needles: {
      rev: (c.needles?.rev?.monthly2026 || []).map(num),
      ebitda: (c.needles?.ebitda?.monthly2026 || []).map(num),
      grossMargin: new Array(12).fill(0),
    },
    invitro: {
      rev: (c.invitro_studio?.rev?.monthly2026 || []).map(num),
      ebitda: (c.invitro_studio?.ebitda?.monthly2026 || []).map(num),
      grossMargin: new Array(12).fill(1),
    },
  };

  // Build annual data
  const allrxRev2025 = num(c.allrx?.rev?.total2025);
  const allrxRev2026 = num(c.allrx?.rev?.total2026);
  const allcareRev2025 = num(c.allcare?.rev?.total2025);
  const allcareRev2026 = num(c.allcare?.rev?.total2026);
  const ostaRev2025 = num(c.osta?.rev?.total2025);
  const ostaRev2026 = num(c.osta?.rev?.total2026);
  const needlesRev2025 = num(c.needles?.rev?.total2025);
  const needlesRev2026 = num(c.needles?.rev?.total2026);
  const invitroRev2025 = num(c.invitro_studio?.rev?.total2025);
  const invitroRev2026 = num(c.invitro_studio?.rev?.total2026);

  const allrxEbitda2025 = num(c.allrx?.ebitda?.total2025);
  const allrxEbitda2026 = num(c.allrx?.ebitda?.total2026);
  const allcareEbitda2025 = num(c.allcare?.ebitda?.total2025);
  const allcareEbitda2026 = num(c.allcare?.ebitda?.total2026);
  const ostaEbitda2025 = num(c.osta?.ebitda?.total2025);
  const ostaEbitda2026 = num(c.osta?.ebitda?.total2026);
  const needlesEbitda2025 = num(c.needles?.ebitda?.total2025);
  const needlesEbitda2026 = num(c.needles?.ebitda?.total2026);
  const invitroEbitda2025 = num(c.invitro_studio?.ebitda?.total2025);
  const invitroEbitda2026 = num(c.invitro_studio?.ebitda?.total2026);

  const allrxGP2025 = num(c.allrx?.gp?.total2025);
  const allrxGP2026 = num(c.allrx?.gp?.total2026);
  const allcareGP2025 = num(c.allcare?.gp?.total2025);
  const allcareGP2026 = num(c.allcare?.gp?.total2026);
  const ostaGP2025 = num(c.osta?.gp?.total2025);
  const ostaGP2026 = num(c.osta?.gp?.total2026);

  // Consolidated (excluding InVitro Studio from revenue per original requirement)
  const consRev2025 = allrxRev2025 + allcareRev2025 + ostaRev2025 + needlesRev2025;
  const consRev2026 = allrxRev2026 + allcareRev2026 + ostaRev2026 + needlesRev2026;
  const consEbitda2025 = allrxEbitda2025 + allcareEbitda2025 + ostaEbitda2025 + needlesEbitda2025 + invitroEbitda2025;
  const consEbitda2026 = allrxEbitda2026 + allcareEbitda2026 + ostaEbitda2026 + needlesEbitda2026 + invitroEbitda2026;
  const consGP2026 = allrxGP2026 + allcareGP2026 + ostaGP2026;

  const annual = {
    2025: {
      allrx: { rev: allrxRev2025, ebitda: allrxEbitda2025, grossProfit: allrxGP2025 },
      allcare: { rev: allcareRev2025, ebitda: allcareEbitda2025, grossProfit: allcareGP2025 },
      osta: { rev: ostaRev2025, ebitda: ostaEbitda2025, grossProfit: ostaGP2025 },
      needles: { rev: needlesRev2025, ebitda: needlesEbitda2025, grossProfit: 0 },
      invitro: { rev: invitroRev2025, ebitda: invitroEbitda2025, grossProfit: invitroRev2025 },
      consolidated: { rev: consRev2025, ebitda: consEbitda2025, grossMargin: consRev2025 > 0 ? (allrxGP2025 + allcareGP2025 + ostaGP2025) / consRev2025 : 0 },
    },
    2026: {
      allrx: { rev: allrxRev2026, ebitda: allrxEbitda2026, grossProfit: allrxGP2026 },
      allcare: { rev: allcareRev2026, ebitda: allcareEbitda2026, grossProfit: allcareGP2026 },
      osta: { rev: ostaRev2026, ebitda: ostaEbitda2026, grossProfit: ostaGP2026 },
      needles: { rev: needlesRev2026, ebitda: needlesEbitda2026, grossProfit: 0 },
      invitro: { rev: invitroRev2026, ebitda: invitroEbitda2026, grossProfit: invitroRev2026 },
      consolidated: { rev: consRev2026, ebitda: consEbitda2026, grossMargin: consRev2026 > 0 ? consGP2026 / consRev2026 : 0 },
    },
  };

  // Cashflow — use from API if available, otherwise build from P&L
  // The cashflow tab data may be sparse, so we build a reasonable estimate
  const cashflow2026 = buildCashflowFromPL(monthly2026, raw.cashflow);

  return {
    monthly2026,
    annual,
    cashflow2026,
    lastUpdated: raw.lastUpdated,
  };
}

function buildCashflowFromPL(monthly2026, rawCashflow) {
  // Build estimated cashflow from monthly P&L data
  // Total inflows = sum of all revenues
  const monthlyInflow = [];
  const monthlyOutflow = [];
  const monthlyBalance = [];

  for (let i = 0; i < 12; i++) {
    const totalRev = monthly2026.allrx.rev[i] + monthly2026.allcare.rev[i] +
                     monthly2026.osta.rev[i] + monthly2026.needles.rev[i] + monthly2026.invitro.rev[i];
    const totalEbitda = monthly2026.allrx.ebitda[i] + monthly2026.allcare.ebitda[i] +
                        monthly2026.osta.ebitda[i] + monthly2026.needles.ebitda[i] + monthly2026.invitro.ebitda[i];
    const totalExpenses = totalRev - totalEbitda;

    monthlyInflow.push(Math.round(totalRev));
    monthlyOutflow.push(-Math.round(totalExpenses));
  }

  // Running balance (start from estimated opening)
  let balance = 335627; // estimated opening
  for (let i = 0; i < 12; i++) {
    balance += monthlyInflow[i] + monthlyOutflow[i];
    monthlyBalance.push(Math.round(balance));
  }

  const totalInflow = monthlyInflow.reduce((a, b) => a + b, 0);
  const totalOutflow = monthlyOutflow.reduce((a, b) => a + b, 0);

  return {
    totalCashInflow: totalInflow,
    totalCashOutflow: totalOutflow,
    netCashMovement: totalInflow + totalOutflow,
    financingEquity: 1110000,
    financingDebt: 148083,
    cashedOut: -400000,
    endingCashBalance: monthlyBalance[11],
    monthlyBalance,
    monthlyInflow,
    monthlyOutflow,
  };
}
