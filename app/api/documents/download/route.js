import { cookies } from 'next/headers';
import { verifySessionToken, isAdmin, COOKIE_NAME } from '@/lib/auth';
import { fetchDocumentBytes, keyBelongsToUser, markDocumentSeen, documentOwnerKey } from '@/lib/documents';

/**
 * Authenticated document download.
 *
 * Blob URLs from Vercel Blob are semi-public (guessable via the random
 * suffix but not indexed), so we NEVER hand them back to the client.
 * Instead every download comes through here: session verified, key
 * ownership verified, then the bytes are streamed from Blob storage.
 *
 * Query: ?key=documents/<userfolder>/<filename>
 */
export async function GET(request) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return new Response('Not authenticated', { status: 401 });
  const user = verifySessionToken(session.value);
  if (!user) return new Response('Invalid session', { status: 401 });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) return new Response('key required', { status: 400 });

  // Admins can pull anyone's file. Everyone else can only pull from
  // their own folder — even if they guessed a valid key.
  if (!isAdmin(user) && !keyBelongsToUser(key, documentOwnerKey(user))) {
    return new Response('Forbidden', { status: 403 });
  }

  const doc = await fetchDocumentBytes(key);
  if (!doc) return new Response('Not found', { status: 404 });

  // Record the read receipt so the "New" badge clears. Only for the LP
  // themselves — an admin previewing a file must not mark it as read on
  // the LP's behalf, or the LP loses the signal that it arrived.
  if (!isAdmin(user)) {
    await markDocumentSeen(documentOwnerKey(user), key);
  }

  return new Response(doc.buffer, {
    status: 200,
    headers: {
      // Guess a sensible content-type from the extension — Blob metadata
      // doesn't always round-trip it cleanly.
      'Content-Type': guessContentType(doc.filename),
      'Content-Length': String(doc.size),
      'Content-Disposition': `attachment; filename="${sanitizeHeader(doc.filename)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function guessContentType(name) {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
  };
  return map[ext] || 'application/octet-stream';
}

function sanitizeHeader(s) {
  return String(s).replace(/[^\w.\-\s]/g, '_').slice(0, 200);
}
