import { cookies } from 'next/headers';
import { fetchAllData } from '@/lib/data';
import { verifySessionToken } from '@/lib/auth';
import InVitroDashboard from '@/components/Dashboard';

export default async function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get('invitro-session');
  const user = session?.value ? verifySessionToken(session.value) : null;

  const data = await fetchAllData();
  return <InVitroDashboard data={data} user={user} />;
}
