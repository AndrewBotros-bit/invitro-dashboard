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

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
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

export { COOKIE_NAME };
