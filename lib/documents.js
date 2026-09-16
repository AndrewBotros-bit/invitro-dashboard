/**
 * Per-LP document storage helpers.
 *
 * Files live in Vercel Blob under `documents/{username}/{filename}`.
 * The username segment is used as the ACL key — both LP-side listing
 * and download verification filter by it — so keeping filenames unique
 * within an LP's folder is enough to route correctly.
 *
 * Blob URLs contain a random suffix that makes them hard to guess,
 * but we don't rely on that for security: every download goes through
 * an authenticated proxy route that re-checks the requester's session.
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
    filename: b.pathname.slice(prefix.length),
    size: b.size,
    uploadedAt: b.uploadedAt,
  }));
}

/**
 * Upload a file for a given LP. Overwrites if a file with the same
 * name already exists (allowExtension via `allowOverwrite`).
 */
export async function uploadUserDocument(username, filename, body, contentType) {
  const key = `${folderPrefix(username)}${filename}`;
  const { url, pathname } = await put(key, body, {
    access: 'public',        // required by @vercel/blob 2.x
    addRandomSuffix: false,  // keep the original filename so the LP recognizes it
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
 * Fetch a document's bytes to stream back through our own /download route.
 * Vercel Blob's downloadUrl is public, so we NEVER expose it to the
 * client — instead we fetch it server-side and pipe the response.
 */
export async function fetchDocumentBytes(key) {
  const { blobs } = await list({ prefix: key, limit: 1 });
  const b = blobs.find(x => x.pathname === key);
  if (!b) return null;
  const res = await fetch(b.url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return { buffer: Buffer.from(buf), size: b.size, filename: key.split('/').pop() };
}
