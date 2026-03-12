import { fetchSheetData } from '../lib/fetchSheetData'
import InVitroDashboard from '../components/Dashboard'

export const revalidate = 300 // ISR: revalidate every 5 minutes

export default async function Home() {
  let data = null;
  let error = null;

  try {
    data = await fetchSheetData();
  } catch (e) {
    error = e.message;
  }

  return <InVitroDashboard liveData={data} fetchError={error} />
}
