import { cookies } from 'next/headers';
import { fetchAllData } from '@/lib/data';
import { verifySessionAndRefresh } from '@/lib/auth';
import InVitroDashboard from '@/components/Dashboard';

// Page is dynamic — depends on cookies + searchParams (display token)
export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const cookieStore = cookies();
  const session = cookieStore.get('invitro-session');
  const displayToken = searchParams?.display;

  // Cookie auth first; fall back to display token (kiosk/Juuno TV signal).
  // verifySessionAndRefresh re-reads the user's permissions from users.json
  // so admin updates take effect on the next page load — no need for the
  // user to log out and back in.
  let user = session?.value ? verifySessionAndRefresh(session.value) : null;
  if (!user && displayToken) user = verifySessionAndRefresh(displayToken);

  const data = await fetchAllData();
  return <InVitroDashboard data={data} user={user} />;
}
