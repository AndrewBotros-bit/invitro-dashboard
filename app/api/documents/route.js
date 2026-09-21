import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionAndRefresh, COOKIE_NAME } from '@/lib/auth';
import { listUserDocuments, getSeenKeys, documentOwnerKey } from '@/lib/documents';

/**
 * LP-facing document list. Session-scoped — always returns only the
 * caller's own files. There's no `?username=` override; admins who want
 * to see another LP's files use /api/admin/documents/[username].
 */
export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = verifySessionAndRefresh(session.value);
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  try {
    // Keyed by investor, not login — an LP with two accounts sees the
    // same folder and the same read receipts from either one.
    const owner = documentOwnerKey(user);
    const [docs, seen] = await Promise.all([
      listUserDocuments(owner),
      getSeenKeys(owner),
    ]);
    // `isNew` = never downloaded by this LP. Newest first so a fresh K-1
    // is the first thing they see.
    const withState = docs
      .map(d => ({ ...d, isNew: !seen.has(d.key) }))
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    return NextResponse.json({
      docs: withState,
      unreadCount: withState.filter(d => d.isNew).length,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'List failed' }, { status: 500 });
  }
}
