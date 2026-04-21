import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import users from './users.json';

const JWT_SECRET = process.env.JWT_SECRET || 'invitro-dashboard-dev-secret-change-in-prod';
const COOKIE_NAME = 'invitro-session';
const TOKEN_EXPIRY = '24h';

export function findUser(username) {
  return users.find(u => u.username === username) || null;
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
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

export function hasBreakdownAccess(user, breakdown) {
  if (!user?.permissions) return false;
  if (user.permissions.breakdowns === '*') return true;
  return user.permissions.breakdowns?.[breakdown] === true;
}

export { COOKIE_NAME };
