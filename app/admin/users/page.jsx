import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, isAdmin, COOKIE_NAME } from '@/lib/auth';
import { fetchAllData } from '@/lib/data';
import UserAdmin from '@/components/UserAdmin';

export const metadata = {
  title: 'User Management — InVitro Capital',
  robots: 'noindex, nofollow',
};

// Page is dynamic — depends on cookies
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = cookies().get(COOKIE_NAME);
  const user = session?.value ? verifySessionToken(session.value) : null;

  if (!user) redirect('/login');
  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">403 — Access Denied</h1>
          <p className="text-muted-foreground mb-4">You need admin privileges to view this page.</p>
          <a href="/" className="text-primary underline">Back to dashboard</a>
        </div>
      </div>
    );
  }

  // Pull LP names from the IRR sheet for the admin form's LP dropdown.
  // Also build lpCompaniesMap so UserAdmin can auto-check the companies
  // an LP is invested in when admin picks their name. Mirrors the walk
  // done by Dashboard.jsx's lpAutoCompanies — same IRR alias handling
  // ("AllCare + Curenta" → "AllCare").
  //
  // LP/shareholder convention: an LP's exposure to AllRx or AllCare is
  // shown via the External (public-target) variant — never the internal
  // entry. So after alias resolution, we swap AllRx → AllRx External and
  // AllCare → AllCare External. Other portcos pass through unchanged.
  // This matches how existing LP users' companies arrays are shaped
  // (Ayman.Ismail, Karim.Soliman, etc. all have "AllCare External" and
  // "AllRx External", not the internal names).
  //
  // Graceful fallback if sheet load fails: dropdown empty, auto-scope
  // silently no-ops.
  let lpNames = [];
  let lpCompaniesMap = {};
  try {
    const data = await fetchAllData();
    lpNames = data?.irrValuation?.allLpNames ?? [];
    const IRR_TO_PNL_ALIAS = { 'AllCare + Curenta': 'AllCare' };
    const LP_EXTERNAL_MAP = { 'AllCare': 'AllCare External', 'AllRx': 'AllRx External' };
    const vehicles = data?.irrValuation?.vehicles ?? [];
    const companies = data?.irrValuation?.companies ?? [];
    for (const lp of lpNames) {
      const lpVehicles = vehicles.filter(v => v.lps?.some(x => x.name === lp));
      const allowed = new Set();
      for (const v of lpVehicles) {
        for (const co of companies) {
          const series = co.investments?.[v.name] || [];
          if (series.some(x => x != null && x > 0)) {
            const pnlName = IRR_TO_PNL_ALIAS[co.name] || co.name;
            const finalName = LP_EXTERNAL_MAP[pnlName] || pnlName;
            allowed.add(finalName);
          }
        }
      }
      lpCompaniesMap[lp] = [...allowed];
    }
  } catch (err) {
    console.warn('[admin/users] Could not load LP names:', err.message);
  }

  return <UserAdmin currentUser={user} lpNames={lpNames} lpCompaniesMap={lpCompaniesMap} />;
}
