import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'invitro-dashboard-dev-secret-change-in-prod';
const COOKIE_NAME = 'invitro-session';
const TOKEN_EXPIRY = '24h';
const USERS_PATH = path.join(process.cwd(), 'lib/auth/users.json');

/**
 * Read users from users.json at runtime.
 * Falls back to static import if fs read fails (e.g. in tests).
 */
export function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[AUTH] Could not read users.json:', err.message);
    return [];
  }
}

export function findUser(username) {
  const users = readUsers();
  return users.find(u => u.username === username) || null;
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function createSessionToken(user) {
  const payload = {
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Long-lived token for kiosk/digital-signage displays (e.g. Juuno TV signal).
 * Embedded in the URL as ?display=TOKEN; iframe-friendly because it doesn't
 * rely on cookies. Inherits the user's permissions exactly (so be careful
 * which user you generate one for — admin tokens grant admin to anyone with
 * the URL).
 *
 * @param {object} user
 * @param {string} [expiresIn='365d']
 */
export function createDisplayToken(user, expiresIn = '365d') {
  const payload = {
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    kind: 'display',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Verify a session token AND refresh the user's permissions/role from
 * users.json. The JWT only carries identity (username); authorization
 * (perms, role) is re-read from the canonical user store on each request.
 *
 * Why: JWTs are signed once at login and are immutable thereafter. If
 * permissions were baked into the JWT, admin updates wouldn't propagate
 * to active sessions until the user logs out and logs back in. Re-reading
 * means permission changes take effect on the user's very next page load
 * (after the redeploy that bakes users.json into the build).
 *
 * Returns null if the token is invalid OR the user no longer exists
 * (e.g., admin deleted their account) — denying access in either case.
 */
export function verifySessionAndRefresh(token) {
  const session = verifySessionToken(token);
  if (!session) return null;
  const fresh = findUser(session.username);
  if (!fresh) return null; // user was deleted — revoke session
  if (fresh.disabled === true) return null; // account disabled — revoke session
  return {
    username: fresh.username,
    name: fresh.name,
    role: fresh.role,
    permissions: fresh.permissions,
    email: fresh.email,
  };
}

export function hasCompanyAccess(user, company) {
  if (!user?.permissions) return false;
  if (user.permissions.companies === '*') return true;
  return Array.isArray(user.permissions.companies) && user.permissions.companies.includes(company);
}

export function hasTabAccess(user, tab) {
  if (!user?.permissions) return false;
  if (user.permissions.tabs === '*') return true;
  return Array.isArray(user.permissions.tabs) && user.permissions.tabs.includes(tab);
}

/**
 * Check breakdown access. Supports:
 *   - breakdowns: "*"  (admin)
 *   - breakdowns[key]: true  (allow all companies)
 *   - breakdowns[key]: false (deny all)
 *   - breakdowns[key]: ["AllRx", "AllCare"]  (allow only these companies)
 *
 * If `company` is passed and value is an array, check membership.
 * If no company passed and value is an array, the check is "does this user have
 * the drill-down for ANY company" → returns true if array non-empty.
 */
export function hasBreakdownAccess(user, breakdown, company = null) {
  if (!user?.permissions) return false;
  if (user.permissions.breakdowns === '*') return true;
  const val = user.permissions.breakdowns?.[breakdown];
  if (val === true) return true;
  if (val === false || val == null) return false;
  if (Array.isArray(val)) {
    if (company === null) return val.length > 0;
    return val.includes(company);
  }
  return false;
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

/**
 * Find which LP stakes a user has across vehicles, based on their lpName claim.
 *
 * Used by the IRR & Valuation section to scope a viewer's view to vehicles where
 * they personally hold a stake. The same LP name may appear in multiple vehicles
 * (e.g., Amir Barsoum is in Barsoum Brothers, Curenta Enterprise, and InVitro
 * Ventures) — we return all matches so the UI can show a combined view.
 *
 * @param {object} user - JWT-decoded user object
 * @param {object|null} irrData - data.irrValuation
 * @returns {Array<{ vehicleName: string, lp: object }>}
 */
export function getUserLpStakes(user, irrData) {
  const lpName = user?.permissions?.lpName;
  if (!lpName || !irrData?.vehicles) return [];
  const stakes = [];
  for (const v of irrData.vehicles) {
    const lp = (v.lps || []).find(l => l.name === lpName);
    if (lp) stakes.push({ vehicleName: v.name, lp });
  }
  return stakes;
}

export { COOKIE_NAME };
