import { cookies } from 'next/headers';
import { fetchAllData } from '@/lib/data';
import { verifySessionToken } from '@/lib/auth';
import InVitroDashboard from '@/components/Dashboard';

// Page is dynamic — depends on cookies + searchParams (display token)
export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const cookieStore = cookies();
  const session = cookieStore.get('invitro-session');
  const displayToken = searchParams?.display;

  // Cookie auth first; fall back to display token (kiosk/Juuno TV signal)
  let user = session?.value ? verifySessionToken(session.value) : null;
  if (!user && displayToken) user = verifySessionToken(displayToken);

  const data = await fetchAllData();
  return <InVitroDashboard data={data} user={user} />;
}
