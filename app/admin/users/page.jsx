import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, isAdmin, COOKIE_NAME } from '@/lib/auth';
import UserAdmin from '@/components/UserAdmin';

export const metadata = {
  title: 'User Management — InVitro Capital',
  robots: 'noindex, nofollow',
};

export default function AdminUsersPage() {
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

  return <UserAdmin currentUser={user} />;
}
