/**
 * Per-LP document storage helpers.
 *
 * Files live in Vercel Blob under `documents/{username}/{filename}`.
 * The username segment is used as the ACL key — both LP-side listing
 * and download verification filter by it — so keeping filenames unique
 * within an LP's folder is enough to route correctly.
 *
 * SECURITY
 * --------
 * Documents live in a PRIVATE Vercel Blob store (invitro-lp-documents),
 * so a blob URL on its own grants nothing — reading requires the store
 * token, which never leaves the server. Every download therefore goes
 * through our authenticated route, which verifies the session, confirms
 * the key belongs to that investor, and streams the bytes itself.
 *
 * This replaced a PUBLIC store, where any object was readable by anyone
 * holding its URL with no authentication whatsoever. That was not
 * theoretical: fetching a real K-1's URL with no credentials returned
 * HTTP 200 and the full 226KB PDF. Random suffixes made those URLs
 * unguessable, but a URL that leaked — forwarded, in history, through a
 * logging proxy — stayed valid forever.
 *
 * Do not reintroduce `access: 'public'` here. The store rejects it, and
 * it is the wrong answer for tax documents regardless.
 */

import { list, put, del, get } from '@vercel/blob';

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

export function folderPrefix(ownerKey) {
  return `${DOC_PREFIX}${usernameToFolder(ownerKey)}/`;
}

/**
 * The key a document belongs to: the INVESTOR, not the login.
 *
 * A document belongs to a person, and a person can have more than one
 * account. George Ayad has two (`georgeayad` and `Ayman.Test`) and Ayman
 * Ismail has three (`Ayman.Ismail`, `Mohamed.Noufal`, `Karim.Soliman`).
 * Keying folders by username silently assumed one login per person, so
 * whichever account a K-1 was uploaded against was the only one that
 * could see it — the others got an empty folder with no hint that a
 * document existed.
 *
 * Falls back to the username for accounts with no LP mapping (admins,
 * internal viewers), which keeps their folders exactly where they were.
 *
 * Verified against the full roster: this produces 24 distinct folders
 * with no two DIFFERENT people ever sharing one.
 */
export function documentOwnerKey(user) {
  return user?.permissions?.lpName || user?.username || null;
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
    // Private: the URL alone must never be enough to read an LP's K-1.
    access: 'private',
    // Kept even though URLs are no longer the security boundary — it
    // prevents one upload silently clobbering another, and the display
    // name is stripped back by displayFilename().
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
  // Private read: authenticates with the store token. A plain fetch of
  // the blob URL now fails, which is the entire point of the change.
  const res = await get(key, { access: 'private' });
  if (!res?.stream) return null;
  const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
  return {
    buffer: buf,
    size: res.blob?.size ?? buf.length,
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
    const res = await get(receiptsKey(username), { access: 'private', useCache: false });
    if (!res?.stream) return new Set();
    const arr = await new Response(res.stream).json();
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
      // Private like the documents. The keys inside name the files, which
      // for tax documents is itself revealing. Stable path so it can be
      // read back and updated.
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
  } catch {
    // A lost receipt just means the "New" badge lingers — never worth
    // failing the download the LP actually asked for.
  }
}
