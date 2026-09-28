import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionAndRefresh, isAdmin, readUsers, COOKIE_NAME } from '@/lib/auth';
import { listUserDocuments, documentOwnerKey, recipientsForOwner } from '@/lib/documents';

/**
 * Admin-only index of every stored document, grouped by investor folder,
 * with the addresses that would be notified for each.
 *
 * Exists so the "notify" backlog screen can show exactly who is about to be
 * emailed BEFORE anything is sent. Sending mail to ten LPs is not something
 * to trigger from a summary the admin has not seen.
 *
 * Read-only: lists blobs, never opens one. Opening a document would write a
 * read receipt and clear the LP's own "New" badge.
 */
export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = verifySessionAndRefresh(session.value);
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const users = readUsers();

    // One entry per FOLDER, not per login — several accounts can share one.
    // The first account for a folder is the one the notify route is called
    // against; recipients are resolved from the folder, so which login it
    // is does not change who gets mail.
    const seen = new Map();
    for (const u of users) {
      const owner = documentOwnerKey(u);
      if (!owner || seen.has(owner)) continue;
      seen.set(owner, u);
    }

    const folders = await Promise.all([...seen.entries()].map(async ([owner, account]) => {
      const docs = await listUserDocuments(owner);
      if (docs.length === 0) return null;
      const recipients = recipientsForOwner(users, account);
      return {
        owner,
        username: account.username,
        displayName: account.name || account.username,
        docs: docs.map(d => ({ key: d.key, filename: d.filename, uploadedAt: d.uploadedAt })),
        recipients: recipients.map(r => ({ email: r.email, name: r.name })),
      };
    }));

    const result = folders.filter(Boolean)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({
      folders: result,
      totalDocs: result.reduce((n, f) => n + f.docs.length, 0),
      unreachable: result.filter(f => f.recipients.length === 0).map(f => f.displayName),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'List failed' }, { status: 500 });
  }
}
