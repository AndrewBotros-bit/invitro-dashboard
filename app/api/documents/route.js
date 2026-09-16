import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import { listUserDocuments } from '@/lib/documents';

/**
 * LP-facing document list. Session-scoped — always returns only the
 * caller's own files. There's no `?username=` override; admins who want
 * to see another LP's files use /api/admin/documents/[username].
 */
export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = verifySessionToken(session.value);
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  try {
    const docs = await listUserDocuments(user.username);
    return NextResponse.json({ docs });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'List failed' }, { status: 500 });
  }
}
