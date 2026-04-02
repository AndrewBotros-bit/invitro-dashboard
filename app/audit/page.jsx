import { fetchAllData } from '@/lib/data';
import AuditDashboard from '@/components/AuditDashboard';

export const metadata = { title: 'InVitro Capital — Audit Console', robots: 'noindex, nofollow' };

export default async function AuditPage() {
  const data = await fetchAllData();
  return <AuditDashboard data={data} />;
}
