import { fetchAllData } from '@/lib/data';
import InVitroDashboard from '@/components/Dashboard';

export default async function Home() {
  const data = await fetchAllData();
  return <InVitroDashboard data={data} />;
}
