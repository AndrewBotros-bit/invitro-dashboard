import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, isAdmin, findUser, COOKIE_NAME } from '@/lib/auth';
import {
  listUserDocuments,
  uploadUserDocument,
  deleteUserDocument,
  keyBelongsToUser,
} from '@/lib/documents';
import { sendDocumentUploadedEmail } from '@/lib/document-email';

// Cap uploads at 25MB. K-1s are typically 200KB–2MB; anything much
// larger is probably not a tax document and warrants explicit review.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Whitelist file types we're comfortable serving back to LPs unchanged.
// Extend if the CFO starts sharing spreadsheets or Word docs.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/octet-stream', // fallback for browsers that don't set the type
]);

function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return { error: 'Not authenticated', status: 401 };
  const user = verifySessionToken(session.value);
  if (!user) return { error: 'Invalid session', status: 401 };
  if (!isAdmin(user)) return { error: 'Admin access required', status: 403 };
  return { user };
}

/** GET — admin lists all documents for one LP. */
export async function GET(_request, { params }) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { username } = params;
  const target = findUser(username);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  try {
    const docs = await listUserDocuments(username);
    return NextResponse.json({ username: target.username, name: target.name, docs });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'List failed' }, { status: 500 });
  }
}

/** POST — admin uploads a file (multipart/form-data with `file` field). */
export async function POST(request, { params }) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { username } = params;
  const target = findUser(username);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit` },
      { status: 413 }
    );
  }
  if (!ALLOWED_MIME.has(file.type) && file.type) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const { key } = await uploadUserDocument(username, file.name, buf, file.type);
    // Best-effort email notification; upload succeeds either way.
    const notify = await sendDocumentUploadedEmail({
      toEmail: target.email,
      toName: target.name,
      filename: file.name,
      senderName: guard.user.name,
    });
    return NextResponse.json({ ok: true, key, notify });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}

/** DELETE — admin removes a specific file. Verifies key ownership. */
export async function DELETE(request, { params }) {
  const guard = requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { username } = params;
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  if (!keyBelongsToUser(key, username)) {
    return NextResponse.json({ error: 'Key does not belong to this user' }, { status: 400 });
  }
  try {
    await deleteUserDocument(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}
