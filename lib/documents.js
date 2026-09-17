/**
 * Per-LP document storage helpers.
 *
 * Files live in Vercel Blob under `documents/{username}/{filename}`.
 * The username segment is used as the ACL key — both LP-side listing
 * and download verification filter by it — so keeping filenames unique
 * within an LP's folder is enough to route correctly.
 *
 * SECURITY — READ BEFORE UPLOADING TAX DOCUMENTS
 * ----------------------------------------------
 * The app's own download route is properly authenticated: it verifies
 * the session and the key's owner, then streams the bytes server-side,
 * and never hands the blob URL to the client.
 *
 * But the Blob STORE backing this is provisioned as a *public* store,
 * which means any object in it is readable by anyone who has its URL,
 * with no auth at all. The SDK's `access: 'private'` is rejected against
 * a public store, so that protection is not available here today.
 *
 * Previously this also passed `addRandomSuffix: false`, which made those
 * public URLs *predictable* — `…/documents/<username>/<filename>` — so
 * knowing the store hostname and an LP's username was enough to pull
 * their K-1 straight past the auth proxy. That is now `true`, so URLs
 * are unguessable.
 *
 * That is mitigation, not a fix: the URL stays valid forever and grants
 * access to anyone who obtains it (a forwarded link, browser history, a
 * logging proxy). The real fix is a PRIVATE Blob store, after which
 * `access: 'private'` can be restored here and in the read path.
 */

import { list, put, del } from '@vercel/blob';

// Vercel Blob's `pathname` is the full key under the store root.
// Namespace under `documents/` so if other features ever use the same
// store they don't collide.
const DOC_PREFIX = 'documents/';

/**
 * Sanitize a username into a Blob-safe path segment.
 * Usernames in this app can contain spaces (`"Hall Room"`) and dots
 * (`"Ayman.Ismail"`); Blob accepts most characters but we normalize to
 * lower-kebab so the folder listing is predictable.
 */
export function usernameToFolder(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function folderPrefix(username) {
  return `${DOC_PREFIX}${usernameToFolder(username)}/`;
}

/**
 * List all documents belonging to a single LP. Returns lightweight
 * metadata suitable for the UI (never returns the blob's downloadUrl —
 * downloads always go through /api/documents/download to enforce auth).
 */
export async function listUserDocuments(username) {
  const prefix = folderPrefix(username);
  const { blobs } = await list({ prefix });
  return blobs.map(b => ({
    // `pathname` is the Blob's full key — used as the identifier the
    // client sends back to /download and /delete.
    key: b.pathname,
    filename: displayFilename(b.pathname.slice(prefix.length)),
    size: b.size,
    uploadedAt: b.uploadedAt,
  }));
}

/**
 * Upload a file for a given LP. Overwrites if a file with the same
 * name already exists (allowExtension via `allowOverwrite`).
 */
export async function uploadUserDocument(username, filename, body, contentType) {
  const prefix = folderPrefix(username);
  // With addRandomSuffix, `allowOverwrite` no longer replaces anything —
  // each upload gets a fresh key, so re-sending a corrected K-1 under the
  // same name would leave the LP looking at two files and guessing which
  // is current. Remove the previous copies of that display name first.
  try {
    const { blobs } = await list({ prefix });
    const stale = blobs.filter(
      b => displayFilename(b.pathname.slice(prefix.length)) === filename,
    );
    if (stale.length) await del(stale.map(b => b.url));
  } catch {
    // Non-fatal: worst case the LP sees an extra older copy.
  }
  const key = `${prefix}${filename}`;
  const { url, pathname } = await put(key, body, {
    // The SDK supports access:'private', but THIS STORE is provisioned
    // as a public store and rejects it ("Cannot use private access on a
    // public store"). Until a private store exists, every object is
    // readable by anyone holding its URL — so the URL must not be
    // guessable, hence addRandomSuffix. See the header comment.
    access: 'public',
    addRandomSuffix: true,
    allowOverwrite: true,
    contentType: contentType || 'application/octet-stream',
  });
  return { key: pathname, url };
}

/**
 * Delete a single document. Caller MUST already have verified the key
 * belongs to the acting user (or the caller is an admin).
 */
export async function deleteUserDocument(key) {
  await del(key);
}

/**
 * Verify that `key` belongs to `username`'s folder. Prevents an LP from
 * downloading another LP's file even if they guess the key.
 */
export function keyBelongsToUser(key, username) {
  return typeof key === 'string' && key.startsWith(folderPrefix(username));
}

/**
 * Fetch a document's bytes to stream back through our own /download
 * route. The blob URL is resolved server-side and never reaches the
 * client, so the authenticated proxy stays the only route the app
 * itself offers to a document.
 */
export async function fetchDocumentBytes(key) {
  const { blobs } = await list({ prefix: key, limit: 1 });
  const b = blobs.find(x => x.pathname === key);
  if (!b) return null;
  const res = await fetch(b.url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(buf),
    size: b.size,
    filename: displayFilename(key.split('/').pop()),
  };
}

/**
 * Strip Vercel Blob's random suffix for display. `put` with
 * addRandomSuffix appends `-<random>` before the extension, so
 * "K-1 2026.pdf" is stored as "K-1 2026-Xk39fQ2zP1a8.pdf". The LP should
 * see the name their CFO gave the file, not the storage key.
 */
export function displayFilename(stored) {
  return String(stored || '').replace(/-[A-Za-z0-9]{16,}(?=\.[^.]*$|$)/, '');
}

/**
 * ---------------------------------------------------------------------
 * Read receipts — which documents an LP has already downloaded.
 * ---------------------------------------------------------------------
 *
 * Stored as one small JSON array of blob keys per LP, under a SEPARATE
 * `doc-reads/` prefix. Keeping it out of `documents/` matters: that
 * prefix is what listUserDocuments enumerates, so a receipts file living
 * there would show up as a downloadable document in the LP's own list.
 *
 * Note the keys inside include filenames, which for tax documents are
 * themselves revealing — another reason the store should be private.
 *
 * Best-effort by design: a failed read means "nothing seen yet" (the
 * badge over-reports rather than hiding a new K-1), and a failed write
 * is swallowed so a receipt can never break an actual download.
 */
const READ_PREFIX = 'doc-reads/';

function receiptsKey(username) {
  return `${READ_PREFIX}${usernameToFolder(username)}.json`;
}

/** Set of blob keys this LP has already downloaded. */
export async function getSeenKeys(username) {
  try {
    const { blobs } = await list({ prefix: receiptsKey(username), limit: 1 });
    const b = blobs.find(x => x.pathname === receiptsKey(username));
    if (!b) return new Set();
    const res = await fetch(b.url, { cache: 'no-store' });
    if (!res.ok) return new Set();
    const arr = await res.json();
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Record that `key` has been downloaded by `username`. Never throws. */
export async function markDocumentSeen(username, key) {
  try {
    const seen = await getSeenKeys(username);
    if (seen.has(key)) return;
    seen.add(key);
    await put(receiptsKey(username), JSON.stringify([...seen]), {
      // Same public-store constraint as documents. A receipts file is
      // just a list of keys the LP has already opened — no document
      // content — and the path must stay stable so it can be updated.
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
  } catch {
    // A lost receipt just means the "New" badge lingers — never worth
    // failing the download the LP actually asked for.
  }
}
