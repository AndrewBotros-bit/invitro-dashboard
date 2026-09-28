import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionAndRefresh, isAdmin, findUser, readUsers, COOKIE_NAME } from '@/lib/auth';
import {
  listUserDocuments,
  keyBelongsToUser,
  documentOwnerKey,
  recipientsForOwner,
} from '@/lib/documents';
import { sendDocumentUploadedEmail } from '@/lib/document-email';

/**
 * Send the "new document" notification for a file that is ALREADY stored.
 *
 * The notification normally rides along with the upload, which leaves no way
 * to tell an LP about a document that is already there. That matters twice
 * over: ten K-1s were uploaded while RESEND_API_KEY was unset and silently
 * notified nobody, and separately an LP will occasionally say the mail never
 * arrived. Re-uploading the file would work, but it rewrites the blob under
 * a fresh random key, which orphans the read receipt and re-flags the
 * document as "New" for anyone who had already downloaded it.
 *
 * So this route sends mail and touches nothing else. No blob is written,
 * moved or deleted, and no read receipt changes.
 */
function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return { error: 'Not authenticated', status: 401 };
  const user = verifySessionAndRefresh(session.value);
  if (!user) return { error: 'Invalid session', status: 401 };
  if (!isAdmin(user)) return { error: 'Admin access required', status: 403 };
  return { user };
}

export async function POST(request, { params }) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { username } = params;
  const target = findUser(username);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let body = {};
  try { body = await request.json(); } catch { /* empty body -> validation below */ }
  const key = body?.key;
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const owner = documentOwnerKey(target);
  // Same ownership check as delete: a key from another LP's folder must not
  // be announceable to this one, even by an admin with a typo.
  if (!keyBelongsToUser(key, owner)) {
    return NextResponse.json({ error: 'Key does not belong to this user' }, { status: 400 });
  }

  try {
    // Confirm the document still exists before claiming it is available.
    // Telling an LP to go and download a deleted file is worse than silence.
    const docs = await listUserDocuments(owner);
    const doc = docs.find(d => d.key === key);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const recipients = recipientsForOwner(readUsers(), target);
    const notify = await sendDocumentUploadedEmail({
      recipients,
      filename: doc.filename,
      senderName: guard.user.name,
    });
    return NextResponse.json({ ok: true, filename: doc.filename, notify });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Notify failed' }, { status: 500 });
  }
}
